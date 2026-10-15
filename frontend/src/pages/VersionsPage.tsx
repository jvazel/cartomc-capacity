import React, { useState, useEffect, useCallback } from 'react';
import { VersionItem } from '../components/versions/types';
import { VersionCard } from '../components/versions/VersionCard';
import { MilestoneConfigModal } from '../components/versions/MilestoneConfigModal';
import { VersionTicketsModal } from '../components/versions/VersionTicketsModal';
import { VersionsCalendarView } from '../components/versions/VersionsCalendarView';
import { VersionReportsView } from '../components/versions/VersionReportsView';
import {
  Milestone,
  RefreshCw,
  Search,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Rocket,
  Info,
  Clock,
  ExternalLink,
  ArrowUpDown,
  FileQuestion,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BarChart2
} from 'lucide-react';

export const VersionsPage: React.FC = () => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [unassignedTicketsCount, setUnassignedTicketsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [projectKey, setProjectKey] = useState<string>('GTEP');
  const [filterReleased, setFilterReleased] = useState<'unreleased' | 'released' | 'all' | 'unassigned'>('unreleased');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar' | 'reports'>('cards');
  const [sortBy, setSortBy] = useState<'default' | 'inProgress_desc' | 'inProgress_asc' | 'totalTickets_desc' | 'anomalies_desc' | 'name_asc'>('default');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modales
  const [selectedVersionForMilestones, setSelectedVersionForMilestones] = useState<VersionItem | null>(null);
  const [selectedVersionForTickets, setSelectedVersionForTickets] = useState<VersionItem | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/versions?projectKey=${encodeURIComponent(projectKey)}&filter=${filterReleased === 'unassigned' ? 'unreleased' : filterReleased}`);
      if (!res.ok) throw new Error('Erreur réseau');
      const data = await res.json();
      if (Array.isArray(data)) {
        setVersions(data);
        if (data.unassignedTicketsCount !== undefined) {
          setUnassignedTicketsCount(data.unassignedTicketsCount);
        }
      } else if (data && data.versions) {
        setVersions(Array.isArray(data.versions) ? data.versions : []);
        setUnassignedTicketsCount(data.unassignedTicketsCount || 0);
      } else {
        setVersions([]);
      }
    } catch (err: any) {
      console.error('Erreur chargement versions:', err);
      showToast('Impossible de charger les versions', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projectKey, filterReleased]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Synchronisation Jira manuelle
  const handleSyncJira = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/versions/sync-jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Synchronisation Jira réussie !');
        loadVersions();
      } else {
        throw new Error(data.error || 'Erreur lors de la synchronisation');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sauvegarde des jalons
  const handleSaveMilestones = async (
    versionId: string,
    data: {
      dateFinAFaire?: string | null;
      dateFinEnCours?: string | null;
      dateFinMR?: string | null;
      dateFinRecette?: string | null;
      dateMEPP?: string | null;
      dateMEP?: string | null;
      description?: string;
    }
  ) => {
    const res = await fetch(`/api/versions/${versionId}/milestones`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erreur lors de la mise à jour des jalons');
    }
    showToast('Jalons enregistrés avec succès !');
    loadVersions();
  };

  // Suppression des jalons
  const handleResetMilestones = async (versionId: string) => {
    const res = await fetch(`/api/versions/${versionId}/milestones`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erreur lors de la suppression des jalons');
    }
    showToast('Jalons réinitialisés');
    loadVersions();
  };

  // Filtrage local texte
  let filteredVersions = versions.filter((v) =>
    v.versionName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Date pivot d'aujourd'hui (début de journée) pour ordonner les échéances MEP
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayTime = startOfToday.getTime();

  // Helper pour extraire le timestamp du jalon MEP
  const getMepTimestamp = (v: VersionItem): number | null => {
    const raw = v.dateMEP || v.jiraReleaseDate;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return isNaN(t) ? null : t;
  };

  // Application du tri sélectionné
  filteredVersions = [...filteredVersions].sort((a, b) => {
    if (sortBy === 'inProgress_desc') {
      const diff = (b.metrics?.inProgress || 0) - (a.metrics?.inProgress || 0);
      if (diff !== 0) return diff;
      return (b.metrics?.totalTickets || 0) - (a.metrics?.totalTickets || 0);
    }
    if (sortBy === 'inProgress_asc') {
      const diff = (a.metrics?.inProgress || 0) - (b.metrics?.inProgress || 0);
      if (diff !== 0) return diff;
      return (a.metrics?.totalTickets || 0) - (b.metrics?.totalTickets || 0);
    }
    if (sortBy === 'totalTickets_desc') {
      return (b.metrics?.totalTickets || 0) - (a.metrics?.totalTickets || 0);
    }
    if (sortBy === 'anomalies_desc') {
      return (b.metrics?.anomalies?.total || 0) - (a.metrics?.anomalies?.total || 0);
    }
    if (sortBy === 'name_asc') {
      return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
    }

    // 'default' : Jalon MEP chronologique à partir d'aujourd'hui (futures en 1er, passées reléguées en bas)
    const timeA = getMepTimestamp(a);
    const timeB = getMepTimestamp(b);

    // Si ni A ni B n'ont de date MEP
    if (timeA === null && timeB === null) {
      return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
    }
    if (timeA === null) return 1; // Sans date en fin de liste
    if (timeB === null) return -1;

    const isAFuture = timeA >= startOfTodayTime;
    const isBFuture = timeB >= startOfTodayTime;

    // 1. Les dates à venir (>= aujourd'hui) sont prioritaires sur les dates passées
    if (isAFuture && !isBFuture) return -1;
    if (!isAFuture && isBFuture) return 1;

    // 2. Si les deux sont à venir : ordre chronologique ascendant (la plus proche en premier)
    if (isAFuture && isBFuture) {
      if (timeA !== timeB) return timeA - timeB;
      return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
    }

    // 3. Si les deux sont passées (< aujourd'hui) : les plus récentes passées en premier
    if (timeA !== timeB) return timeB - timeA;
    return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
  });

  // Reset page à 1 lors du changement de filtre, tri, recherche ou taille de page
  useEffect(() => {
    setCurrentPage(1);
  }, [filterReleased, searchQuery, sortBy, pageSize]);

  // Pagination calculée
  const totalPages = Math.max(1, Math.ceil(filteredVersions.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredVersions.length);
  const paginatedVersions = filteredVersions.slice(startIndex, endIndex);

  // Statistiques globales
  const totalAnomalies = versions.reduce((sum, v) => sum + (v.metrics?.anomalies?.total || 0), 0);
  const totalTickets = versions.reduce((sum, v) => sum + (v.metrics?.totalTickets || 0), 0);
  const totalInProgress = versions.reduce((sum, v) => sum + (v.metrics?.inProgress || 0), 0);
  const totalADecaler = versions.reduce((sum, v) => sum + (v.metrics?.anomalies?.aDecaler || 0), 0);

  return (
    <main className="main-content">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            backgroundColor: toastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(6, 182, 212, 0.2)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* En-tête standard CartOMC */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Milestone size={30} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }} />
            Suivi des Versions & Jalons Opérationnels
          </h1>
          <p className="page-subtitle">
            Pilotage des 6 jalons de release, diagnostic des anomalies et alertes de décalage de tickets Jira.
          </p>
        </div>

        {/* Contrôles haut-droite : Projet & Synchro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Projet Jira :</span>
            <input
              type="text"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
              className="form-input"
              style={{
                width: '85px',
                textAlign: 'center',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '7px 10px'
              }}
            />
          </div>

          <button
            onClick={handleSyncJira}
            disabled={isSyncing}
            className="btn btn-secondary"
            title="Interroger l'API Jira pour récupérer toutes les versions et leur statut de publication"
            style={{ padding: '8px 16px' }}
          >
            <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? 'Synchronisation...' : 'Actualiser Jira'}
          </button>
        </div>
      </div>

      {/* Cartes KPI Synthétiques aux couleurs de CartOMC */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div className="card card-neon-blue" style={{ padding: '18px 20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Rocket size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Versions dans la vue</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {versions.length}
              </div>
            </div>
          </div>
        </div>

        <div className="card card-neon-purple" style={{ padding: '18px 20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Tickets associés</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {totalTickets}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Tickets En Cours avec clic rapide pour trier */}
        <div
          className="card"
          onClick={() => setSortBy((prev) => (prev === 'inProgress_desc' ? 'inProgress_asc' : 'inProgress_desc'))}
          title="Cliquer pour trier les versions par nombre de tickets en cours"
          style={{
            padding: '18px 20px',
            marginBottom: 0,
            cursor: 'pointer',
            border: sortBy.startsWith('inProgress') ? '1px solid rgba(251, 191, 36, 0.6)' : '1px solid var(--border-color)',
            background: sortBy.startsWith('inProgress') ? 'rgba(251, 191, 36, 0.12)' : 'rgba(0, 0, 0, 0.25)',
            boxShadow: sortBy.startsWith('inProgress') ? '0 0 16px rgba(251, 191, 36, 0.2)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Clock size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: '#fde68a', fontWeight: 600 }}>Tickets En cours</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: sortBy.startsWith('inProgress') ? '#fbbf24' : 'rgba(255, 255, 255, 0.08)',
                    color: sortBy.startsWith('inProgress') ? '#0f172a' : 'var(--text-muted)',
                    fontWeight: 700
                  }}
                >
                  {sortBy === 'inProgress_desc' ? 'Trié ↓' : sortBy === 'inProgress_asc' ? 'Trié ↑' : 'Trier'}
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.02em', marginTop: '2px' }}>
                {totalInProgress}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`card ${totalADecaler > 0 ? 'card-neon-red' : ''}`}
          style={{
            padding: '18px 20px',
            marginBottom: 0,
            border: totalADecaler > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
            background: totalADecaler > 0 ? 'rgba(239, 68, 68, 0.1)' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: totalADecaler > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                color: totalADecaler > 0 ? 'var(--danger)' : 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: totalADecaler > 0 ? '#fca5a5' : 'var(--text-muted)', fontWeight: 500 }}>
                Tickets à décaler
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: totalADecaler > 0 ? '#f87171' : 'var(--text-main)',
                  letterSpacing: '-0.02em'
                }}
              >
                {totalADecaler}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`card ${unassignedTicketsCount > 0 ? 'card-neon-amber' : ''}`}
          style={{ padding: '18px 20px', marginBottom: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: totalAnomalies === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: totalAnomalies === 0 ? 'var(--success)' : 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Santé du planning</div>
              <div
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: totalAnomalies === 0 ? 'var(--success)' : 'var(--warning)'
                }}
              >
                {totalAnomalies === 0 ? 'Tous jalons tenus' : `${totalAnomalies} alerte(s)`}
              </div>
            </div>
          </div>
        </div>

        {/* Tuile KPI Tickets Sans Version (Orphelins) */}
        <div
          className="card"
          onClick={() => {
            setSelectedVersionForTickets({
              _id: 'unassigned',
              versionName: 'Sans version',
              projectKey,
              released: false,
              metrics: {
                totalTickets: unassignedTicketsCount,
                todo: 0,
                inProgress: 0,
                review: 0,
                qa: 0,
                done: 0,
                anomalies: { total: 0, aDecaler: 0, retardDev: 0, retardMR: 0, retardRecette: 0 },
                health: 'orange'
              }
            });
          }}
          title="Cliquer pour afficher la liste de tous les tickets Jira orphelins (sans version)"
          style={{
            padding: '18px 20px',
            marginBottom: 0,
            cursor: 'pointer',
            border: unassignedTicketsCount > 0 ? '1px solid rgba(251, 146, 60, 0.5)' : '1px solid var(--border-color)',
            background: unassignedTicketsCount > 0 ? 'rgba(251, 146, 60, 0.1)' : 'rgba(0, 0, 0, 0.25)',
            boxShadow: unassignedTicketsCount > 0 ? '0 0 16px rgba(251, 146, 60, 0.2)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: unassignedTicketsCount > 0 ? 'rgba(251, 146, 60, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: unassignedTicketsCount > 0 ? '#fb923c' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileQuestion size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: unassignedTicketsCount > 0 ? '#fed7aa' : 'var(--text-muted)', fontWeight: 600 }}>
                  Sans version
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: unassignedTicketsCount > 0 ? '#fb923c' : 'rgba(255, 255, 255, 0.08)',
                    color: unassignedTicketsCount > 0 ? '#0f172a' : 'var(--text-muted)',
                    fontWeight: 700
                  }}
                >
                  Voir liste ➔
                </span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: unassignedTicketsCount > 0 ? '#fb923c' : 'var(--text-main)', letterSpacing: '-0.02em', marginTop: '2px' }}>
                {unassignedTicketsCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de Filtres Principale & Bascule de Vue */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        {/* Toggle Filtre Publiées / Non Publiées */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Statut Release Jira :
          </span>
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              onClick={() => setFilterReleased('unreleased')}
              className={`btn ${filterReleased === 'unreleased' ? 'btn-primary' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: filterReleased === 'unreleased' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              ⚡ Non publiées (En cours)
            </button>
            <button
              onClick={() => setFilterReleased('released')}
              className={`btn ${filterReleased === 'released' ? 'btn-primary' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: filterReleased === 'released' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              ✓ Publiées (Releases)
            </button>
            <button
              onClick={() => setFilterReleased('all')}
              className={`btn ${filterReleased === 'all' ? 'btn-primary' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: filterReleased === 'all' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              Toutes
            </button>
            <button
              onClick={() => {
                setSelectedVersionForTickets({
                  _id: 'unassigned',
                  versionName: 'Sans version',
                  projectKey,
                  released: false,
                  metrics: {
                    totalTickets: unassignedTicketsCount,
                    todo: 0,
                    inProgress: 0,
                    review: 0,
                    qa: 0,
                    done: 0,
                    anomalies: { total: 0, aDecaler: 0, retardDev: 0, retardMR: 0, retardRecette: 0 },
                    health: 'orange'
                  }
                });
              }}
              className="btn btn-secondary"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: unassignedTicketsCount > 0 ? '#fb923c' : 'var(--text-muted)',
                borderColor: unassignedTicketsCount > 0 ? 'rgba(251, 146, 60, 0.4)' : undefined
              }}
              title="Voir la liste complète des tickets Jira sans version"
            >
              ⚠️ Sans version ({unassignedTicketsCount})
            </button>
          </div>
        </div>

        {/* Barre de recherche, Sélecteur de Tri & Switch vue (Cartes vs Calendrier) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap' }}>
          {/* Sélecteur de Tri */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}
            >
              <ArrowUpDown size={15} style={{ color: sortBy.startsWith('inProgress') ? '#fbbf24' : 'var(--text-muted)', flexShrink: 0 }} />
              <span>Trier par :</span>
            </span>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                fontSize: '0.82rem',
                padding: '6px 12px',
                height: '36px',
                width: 'auto',
                minWidth: '200px',
                borderColor: sortBy.startsWith('inProgress') ? 'rgba(251, 191, 36, 0.5)' : undefined,
                backgroundColor: sortBy.startsWith('inProgress') ? 'rgba(251, 191, 36, 0.1)' : undefined,
                color: sortBy.startsWith('inProgress') ? '#fbbf24' : 'var(--text-main)',
                fontWeight: sortBy.startsWith('inProgress') ? 700 : 500,
                cursor: 'pointer'
              }}
              title="Critère de tri des versions"
            >
              <option value="default">Jalon MEP (À venir d'abord)</option>
              <option value="inProgress_desc">⚡ Tickets En cours (Plus élevé)</option>
              <option value="inProgress_asc">⚡ Tickets En cours (Moins élevé)</option>
              <option value="totalTickets_desc">📊 Total tickets (Décroissant)</option>
              <option value="anomalies_desc">⚠️ Anomalies / Alertes (Décroissant)</option>
              <option value="name_asc">🔤 Nom de version (A ➔ Z)</option>
            </select>
          </div>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Rechercher une version..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                padding: '6px 12px 6px 34px',
                fontSize: '0.85rem',
                width: '180px',
                height: '36px'
              }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              onClick={() => setViewMode('cards')}
              title="Vue Cartes & Pipeline de jalons"
              className={`btn ${viewMode === 'cards' ? 'btn-primary' : ''}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: viewMode === 'cards' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              <Layers size={14} /> Cartes
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              title="Vue Calendrier Mensuel"
              className={`btn ${viewMode === 'calendar' ? 'btn-primary' : ''}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: viewMode === 'calendar' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              <Calendar size={14} /> Calendrier
            </button>
            <button
              onClick={() => setViewMode('reports')}
              title="Rapports d'avancement & Vélocité"
              className={`btn ${viewMode === 'reports' ? 'btn-primary' : ''}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                color: viewMode === 'reports' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              <BarChart2 size={14} /> Rapports
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      {isLoading ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ marginBottom: '12px', color: 'var(--primary)' }} />
          <div>Chargement des versions et calcul des jalons...</div>
        </div>
      ) : filteredVersions.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border-color)'
          }}
        >
          <Info size={38} color="var(--text-dim)" style={{ marginBottom: '14px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Aucune version trouvée
          </h3>
          <p style={{ margin: '0 0 18px 0', fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '480px', marginInline: 'auto' }}>
            {filterReleased === 'unreleased'
              ? 'Aucune version active non publiée n\'a été détectée pour ce projet.'
              : 'Aucune version ne correspond à votre filtre de recherche.'}
          </p>
          <button
            onClick={handleSyncJira}
            className="btn btn-primary"
          >
            <RefreshCw size={14} /> Synchroniser la liste des versions avec Jira
          </button>
        </div>
      ) : viewMode === 'calendar' ? (
        <VersionsCalendarView
          versions={filteredVersions}
          onConfigureMilestones={(v) => setSelectedVersionForMilestones(v)}
          onViewTickets={(v) => setSelectedVersionForTickets(v)}
        />
      ) : viewMode === 'reports' ? (
        <VersionReportsView
          versions={versions}
          projectKey={projectKey}
        />
      ) : (
        <div>
          {paginatedVersions.map((version) => (
            <VersionCard
              key={version._id}
              version={version}
              onConfigureMilestones={(v) => setSelectedVersionForMilestones(v)}
              onViewTickets={(v) => setSelectedVersionForTickets(v)}
            />
          ))}

          {/* Contrôles de pagination */}
          {filteredVersions.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '16px 20px',
                marginTop: '16px',
                background: 'var(--card-bg, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '12px'
              }}
            >
              {/* Infos affichage & sélecteur de taille par page */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Affichage de <strong style={{ color: 'var(--text-main)' }}>{startIndex + 1}</strong> à{' '}
                  <strong style={{ color: 'var(--text-main)' }}>{endIndex}</strong> sur{' '}
                  <strong style={{ color: 'var(--accent-primary, #06b6d4)' }}>{filteredVersions.length}</strong> versions
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="version-page-size" style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    Par page :
                  </label>
                  <select
                    id="version-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="form-control"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.82rem',
                      height: '30px',
                      width: 'auto',
                      borderRadius: '6px'
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Boutons de pagination */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage <= 1}
                  title="Première page"
                  style={{
                    padding: '6px 10px',
                    height: '32px',
                    fontSize: '0.82rem',
                    opacity: validCurrentPage <= 1 ? 0.4 : 1,
                    cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronsLeft size={15} />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={validCurrentPage <= 1}
                  title="Page précédente"
                  style={{
                    padding: '6px 12px',
                    height: '32px',
                    fontSize: '0.82rem',
                    opacity: validCurrentPage <= 1 ? 0.4 : 1,
                    cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={15} /> Précédent
                </button>

                {/* Numéros de page visibles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 2)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((pageItem, idx) =>
                      typeof pageItem === 'number' ? (
                        <button
                          key={`page-${pageItem}`}
                          type="button"
                          onClick={() => setCurrentPage(pageItem)}
                          className={pageItem === validCurrentPage ? 'btn btn-primary' : 'btn btn-secondary'}
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 8px',
                            fontSize: '0.82rem',
                            fontWeight: pageItem === validCurrentPage ? 700 : 500
                          }}
                        >
                          {pageItem}
                        </button>
                      ) : (
                        <span
                          key={`ellipsis-${idx}`}
                          style={{
                            padding: '0 4px',
                            color: 'var(--text-dim)',
                            fontSize: '0.82rem',
                            userSelect: 'none'
                          }}
                        >
                          ...
                        </span>
                      )
                    )}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={validCurrentPage >= totalPages}
                  title="Page suivante"
                  style={{
                    padding: '6px 12px',
                    height: '32px',
                    fontSize: '0.82rem',
                    opacity: validCurrentPage >= totalPages ? 0.4 : 1,
                    cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Suivant <ChevronRight size={15} />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage >= totalPages}
                  title="Dernière page"
                  style={{
                    padding: '6px 10px',
                    height: '32px',
                    fontSize: '0.82rem',
                    opacity: validCurrentPage >= totalPages ? 0.4 : 1,
                    cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modale Paramétrage des Jalons */}
      <MilestoneConfigModal
        version={selectedVersionForMilestones}
        isOpen={Boolean(selectedVersionForMilestones)}
        onClose={() => setSelectedVersionForMilestones(null)}
        onSave={handleSaveMilestones}
        onReset={handleResetMilestones}
      />

      {/* Modale Détail des Tickets */}
      <VersionTicketsModal
        version={selectedVersionForTickets}
        isOpen={Boolean(selectedVersionForTickets)}
        onClose={() => setSelectedVersionForTickets(null)}
      />
    </main>
  );
};
