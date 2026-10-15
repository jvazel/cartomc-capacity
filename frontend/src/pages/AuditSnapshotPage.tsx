import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Camera,
  History,
  GitCompare,
  Trash2,
  Calendar,
  Search,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Lock,
  Layers,
  ArrowRightLeft,
  Filter,
  Sparkles,
  Info,
  Clock
} from 'lucide-react';
import { WorkspaceManager } from '../components/WorkspaceManager';

interface ISnapshot {
  _id: string;
  nom: string;
  description?: string;
  annee: number;
  dateCreation: string;
  auteur: string;
  nombreProjets: number;
  totalB0: number;
  totalB1: number;
  totalPlanifie: number;
}

interface IAuditLog {
  _id: string;
  timestamp: string;
  auteur: string;
  action: string;
  codeProjet?: string;
  nomProjet?: string;
  description?: string;
  modifications?: Array<{
    champ: string;
    ancienneValeur?: any;
    nouvelleValeur?: any;
  }>;
}

interface ICompareResult {
  aggregateDelta: {
    baseNom: string;
    compNom: string;
    totalB0Base: number;
    totalB0Comp: number;
    deltaTotalB0: number;
    totalB1Base: number;
    totalB1Comp: number;
    deltaTotalB1: number;
    totalPlanifieBase: number;
    totalPlanifieComp: number;
    deltaTotalPlanifie: number;
  };
  projectDeltas: Array<{
    key: string;
    codeProjet: string;
    nom: string;
    type: string;
    leadBANom: string;
    b0Base: number;
    b0Comp: number;
    deltaB0: number;
    b1Base: number;
    b1Comp: number;
    deltaB1: number;
    planifieBase: number;
    planifieComp: number;
    deltaPlanifie: number;
    evolStatut: string;
    ventilationDeltas: Array<{
      mois: number;
      baseTotal: number;
      compTotal: number;
      delta: number;
    }>;
  }>;
}

export const AuditSnapshotPage: React.FC = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'snapshots' | 'audit'>('snapshots');
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());

  // Data states
  const [snapshots, setSnapshots] = useState<ISnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<IAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Comparator states
  const [baseSnapshotId, setBaseSnapshotId] = useState<string>('current');
  const [targetSnapshotId, setTargetSnapshotId] = useState<string>('');
  const [compareResult, setCompareResult] = useState<ICompareResult | null>(null);
  const [searchProjectDiff, setSearchProjectDiff] = useState<string>('');
  const [filterEvolStatut, setFilterEvolStatut] = useState<string>('Tous');
  const [expandedProjectKey, setExpandedProjectKey] = useState<string | null>(null);

  // Audit filter states
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('Tous');

  // Modal create snapshot
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [snapNom, setSnapNom] = useState<string>('');
  const [snapDesc, setSnapDesc] = useState<string>('');
  const [submittingSnap, setSubmittingSnap] = useState<boolean>(false);

  // Fetch snapshots & audit logs
  const loadSnapshots = async () => {
    try {
      const res = await fetch(`/api/snapshots?annee=${annee}`);
      const data = await res.json();
      setSnapshots(data);
      if (data.length > 0 && !targetSnapshotId) {
        setTargetSnapshotId(data[0]._id);
      }
    } catch (err) {
      console.error('Erreur chargement snapshots:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch(`/api/audit-logs?limit=200`);
      const data = await res.json();
      setAuditLogs(data);
    } catch (err) {
      console.error('Erreur chargement audit logs:', err);
    }
  };

  const executeComparison = async (baseId: string, targetId: string) => {
    if (!targetId && baseId === 'current') return;
    try {
      setLoading(true);
      const url = `/api/snapshots/compare/diff?baseSnapshotId=${baseId}&targetSnapshotId=${targetId || 'current'}&annee=${annee}`;
      const res = await fetch(url);
      const data = await res.json();
      setCompareResult(data);
    } catch (err) {
      console.error('Erreur comparaison snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSnapshots(), loadAuditLogs()]).then(() => {
      setLoading(false);
    });
  }, [annee]);

  useEffect(() => {
    if (snapshots.length > 0 && targetSnapshotId) {
      executeComparison(baseSnapshotId, targetSnapshotId);
    } else if (baseSnapshotId !== 'current') {
      executeComparison(baseSnapshotId, 'current');
    }
  }, [baseSnapshotId, targetSnapshotId, snapshots.length]);

  const handleSwapComparison = () => {
    const oldBase = baseSnapshotId;
    const oldTarget = targetSnapshotId || 'current';
    setBaseSnapshotId(oldTarget);
    setTargetSnapshotId(oldBase);
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapNom.trim()) return;
    try {
      setSubmittingSnap(true);
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role === 'Admin' ? 'Administrateur / Manager' : 'Lead BA'
        },
        body: JSON.stringify({
          nom: snapNom.trim(),
          description: snapDesc.trim(),
          annee,
          auteur: role === 'Admin' ? 'Administrateur / Manager' : 'Lead BA'
        })
      });
      if (res.ok) {
        setShowCreateModal(false);
        setSnapNom('');
        setSnapDesc('');
        await loadSnapshots();
        await loadAuditLogs();
      }
    } catch (err) {
      console.error('Erreur création snapshot:', err);
    } finally {
      setSubmittingSnap(false);
    }
  };

  const handleDeleteSnapshot = async (id: string, nom: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le snapshot baseline "${nom}" ?`)) return;
    try {
      const res = await fetch(`/api/snapshots/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (targetSnapshotId === id) setTargetSnapshotId('');
        if (baseSnapshotId === id) setBaseSnapshotId('current');
        await loadSnapshots();
        await loadAuditLogs();
      }
    } catch (err) {
      console.error('Erreur suppression snapshot:', err);
    }
  };

  const NOMS_MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  const getActionBadge = (act: string) => {
    switch (act) {
      case 'REESTIMATION_B1':
        return <span className="badge badge-success" style={{ gap: '4px' }}><Lock size={12} /> Passage B1</span>;
      case 'VENTILATION_BATCH':
        return <span className="badge badge-primary" style={{ gap: '4px' }}><Layers size={12} /> Ventilation</span>;
      case 'CREATION_PROJET':
        return <span className="badge badge-purple" style={{ gap: '4px' }}>➕ Création</span>;
      case 'MODIFICATION_PROJET':
        return <span className="badge badge-warning" style={{ gap: '4px' }}>✏️ Modification</span>;
      case 'SUPPRESSION_PROJET':
        return <span className="badge badge-danger" style={{ gap: '4px' }}>🗑️ Suppression</span>;
      case 'SNAPSHOT_CREATION':
        return <span className="badge badge-purple" style={{ gap: '4px' }}><Camera size={12} /> Snapshot</span>;
      default:
        return <span className="badge badge-secondary">{act}</span>;
    }
  };

  // Filtered project deltas for comparison table
  const filteredProjectDeltas = (compareResult?.projectDeltas || []).filter((p) => {
    const matchStatus = filterEvolStatut === 'Tous' || p.evolStatut.includes(filterEvolStatut);
    if (!matchStatus) return false;
    if (!searchProjectDiff) return true;
    const term = searchProjectDiff.toLowerCase();
    return (
      p.nom.toLowerCase().includes(term) ||
      (p.codeProjet && p.codeProjet.toLowerCase().includes(term)) ||
      (p.leadBANom && p.leadBANom.toLowerCase().includes(term)) ||
      p.evolStatut.toLowerCase().includes(term)
    );
  });

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchAction = auditActionFilter === 'Tous' || log.action === auditActionFilter;
    if (!matchAction) return false;
    if (!auditSearch) return true;
    const term = auditSearch.toLowerCase();
    return (
      (log.nomProjet && log.nomProjet.toLowerCase().includes(term)) ||
      (log.codeProjet && log.codeProjet.toLowerCase().includes(term)) ||
      (log.auteur && log.auteur.toLowerCase().includes(term)) ||
      (log.description && log.description.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <History style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.4))' }} size={30} />
            Historique & Versioning du Portefeuille
          </h1>
          <p className="page-subtitle">
            Capturez des baselines de référence, comparez les dérives du plan de charge et consultez le journal d'audit chronologique des réestimations B0 ➔ B1.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className="form-select"
              style={{ width: 'auto', padding: '8px 14px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          {role === 'Admin' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{
                boxShadow: '0 4px 16px rgba(6, 182, 212, 0.3)',
                padding: '9px 18px',
                fontWeight: 600
              }}
            >
              <Camera size={16} /> Geler une Baseline (Snapshot)
            </button>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          className={`btn ${activeTab === 'snapshots' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('snapshots')}
          style={{ gap: '8px' }}
        >
          <GitCompare size={16} /> Snapshots & Comparateur de Baselines ({snapshots.length})
        </button>
        <button
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}
          style={{ gap: '8px' }}
        >
          <FileText size={16} /> Journal d'Audit ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: SNAPSHOTS & COMPARATEUR */}
      {activeTab === 'snapshots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card Selecteur de Comparaison */}
          <div className="card card-neon-blue" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GitCompare style={{ color: 'var(--primary)' }} size={22} />
                Comparateur de Portefeuille & Analyse des Écarts
              </h2>

              <button
                className="btn btn-secondary"
                onClick={handleSwapComparison}
                style={{ fontSize: '0.82rem', padding: '6px 12px', gap: '6px' }}
                title="Inverser Référence et Cible"
              >
                <ArrowRightLeft size={14} /> Intervertir
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
              
              {/* Reference */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  1. État de Référence (Baseline de Départ)
                </label>
                <select
                  className="form-select"
                  value={baseSnapshotId}
                  onChange={(e) => setBaseSnapshotId(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(11, 17, 32, 0.9)',
                    borderColor: 'rgba(6, 182, 212, 0.4)',
                    padding: '12px 14px',
                    fontWeight: 500
                  }}
                >
                  <option value="current">🟢 Portefeuille Réel Actuel ({annee})</option>
                  {snapshots.map((s) => (
                    <option key={s._id} value={s._id}>
                      📸 Baseline : {s.nom} ({new Date(s.dateCreation).toLocaleDateString('fr-FR')}) — {s.totalPlanifie}j
                    </option>
                  ))}
                </select>
              </div>

              {/* Arrow */}
              <div style={{ color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '20px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ArrowRight size={20} />
                </div>
              </div>

              {/* Target */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#c084fc' }}>
                  2. État Cible (À Comparer)
                </label>
                <select
                  className="form-select"
                  value={targetSnapshotId}
                  onChange={(e) => setTargetSnapshotId(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(11, 17, 32, 0.9)',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                    padding: '12px 14px',
                    fontWeight: 500
                  }}
                >
                  <option value="current">🟢 Portefeuille Réel Actuel ({annee})</option>
                  {snapshots.map((s) => (
                    <option key={s._id} value={s._id}>
                      📸 Baseline : {s.nom} ({new Date(s.dateCreation).toLocaleDateString('fr-FR')}) — {s.totalPlanifie}j
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Cards Aggregate KPI Deltas */}
          {compareResult && compareResult.aggregateDelta && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
              
              {/* B0 Card */}
              <div className="card card-neon-blue" style={{ padding: '20px', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="user-role-title" style={{ color: 'var(--text-muted)' }}>ÉVOLUTION MACRO BUDGET B0</span>
                  <span className="badge badge-primary">Macro-chiffrage</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
                    {compareResult.aggregateDelta.totalB0Comp} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>j.h</span>
                  </span>
                  <span className={`badge ${compareResult.aggregateDelta.deltaTotalB0 > 0 ? 'badge-danger' : compareResult.aggregateDelta.deltaTotalB0 < 0 ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.85rem', padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>
                    {compareResult.aggregateDelta.deltaTotalB0 > 0 ? `+${compareResult.aggregateDelta.deltaTotalB0} j.h ↗` : compareResult.aggregateDelta.deltaTotalB0 < 0 ? `${compareResult.aggregateDelta.deltaTotalB0} j.h ↘` : '0 j.h ='}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                  Réf: {compareResult.aggregateDelta.totalB0Base} j.h ➔ Cible: {compareResult.aggregateDelta.totalB0Comp} j.h
                </div>
              </div>

              {/* B1 Card */}
              <div className="card card-neon-purple" style={{ padding: '20px', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="user-role-title" style={{ color: 'var(--text-muted)' }}>ÉVOLUTION MACRO BUDGET B1</span>
                  <span className="badge badge-purple"><Lock size={11} style={{ marginRight: '4px' }} /> Chiffrage Fin</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: '#c084fc' }}>
                    {compareResult.aggregateDelta.totalB1Comp} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>j.h</span>
                  </span>
                  <span className={`badge ${compareResult.aggregateDelta.deltaTotalB1 > 0 ? 'badge-danger' : compareResult.aggregateDelta.deltaTotalB1 < 0 ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.85rem', padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>
                    {compareResult.aggregateDelta.deltaTotalB1 > 0 ? `+${compareResult.aggregateDelta.deltaTotalB1} j.h ↗` : compareResult.aggregateDelta.deltaTotalB1 < 0 ? `${compareResult.aggregateDelta.deltaTotalB1} j.h ↘` : '0 j.h ='}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                  Réf: {compareResult.aggregateDelta.totalB1Base} j.h ➔ Cible: {compareResult.aggregateDelta.totalB1Comp} j.h
                </div>
              </div>

              {/* Planifié Card */}
              <div className="card card-neon-amber" style={{ padding: '20px', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="user-role-title" style={{ color: 'var(--text-muted)' }}>ÉVOLUTION CUMUL PLANIFIÉ</span>
                  <span className="badge badge-warning">12 Mois</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: '#fbbf24' }}>
                    {compareResult.aggregateDelta.totalPlanifieComp} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>j.h</span>
                  </span>
                  <span className={`badge ${compareResult.aggregateDelta.deltaTotalPlanifie > 0 ? 'badge-danger' : compareResult.aggregateDelta.deltaTotalPlanifie < 0 ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.85rem', padding: '4px 10px', fontFamily: 'var(--font-mono)' }}>
                    {compareResult.aggregateDelta.deltaTotalPlanifie > 0 ? `+${compareResult.aggregateDelta.deltaTotalPlanifie} j.h ↗` : compareResult.aggregateDelta.deltaTotalPlanifie < 0 ? `${compareResult.aggregateDelta.deltaTotalPlanifie} j.h ↘` : '0 j.h ='}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                  Réf: {compareResult.aggregateDelta.totalPlanifieBase} j.h ➔ Cible: {compareResult.aggregateDelta.totalPlanifieComp} j.h
                </div>
              </div>

            </div>
          )}

          {/* Table Comparison Details */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Analyse Détaillée des Écarts par Projet ({filteredProjectDeltas.length})
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Cliquez sur une ligne pour déplier le détail des dérives mensuelles de ventilation.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Vues & Filtres sauvegardés (Workspaces) */}
                <WorkspaceManager
                  storageKey="audit_diff"
                  currentFilters={{
                    filterEvolStatut,
                    searchProjectDiff
                  }}
                  defaultFilters={{
                    filterEvolStatut: 'Tous',
                    searchProjectDiff: ''
                  }}
                  onApplyFilters={(f) => {
                    if (f.filterEvolStatut !== undefined) setFilterEvolStatut(f.filterEvolStatut);
                    if (f.searchProjectDiff !== undefined) setSearchProjectDiff(f.searchProjectDiff);
                  }}
                  systemPresets={[
                    {
                      id: 'sys_b0_b1',
                      name: 'Passages B0 ➔ B1',
                      icon: '🔒',
                      description: 'Projets ayant fait l\'objet d\'une bascule de chiffrage fin',
                      filters: {
                        filterEvolStatut: 'Passage B0 ➔ B1',
                        searchProjectDiff: ''
                      }
                    },
                    {
                      id: 'sys_ventilation_modifiee',
                      name: 'Ventilations Modifiées',
                      icon: '✏️',
                      description: 'Projets avec réajustement des charges mensuelles',
                      filters: {
                        filterEvolStatut: 'Ventilation',
                        searchProjectDiff: ''
                      }
                    },
                    {
                      id: 'sys_nouveaux_projets',
                      name: 'Nouveaux Projets Entrants',
                      icon: '➕',
                      description: 'Projets apparus depuis la baseline de référence',
                      filters: {
                        filterEvolStatut: 'Nouveau Projet',
                        searchProjectDiff: ''
                      }
                    }
                  ]}
                />

                {/* Filter Status */}
                <select
                  className="form-select"
                  value={filterEvolStatut}
                  onChange={(e) => setFilterEvolStatut(e.target.value)}
                  style={{ width: '190px', fontSize: '0.85rem' }}
                >
                  <option value="Tous">Tous les statuts</option>
                  <option value="Passage B0 ➔ B1">🔒 Passage B0 ➔ B1</option>
                  <option value="Nouveau Projet">➕ Nouveau Projet</option>
                  <option value="Projet Retiré">🗑️ Projet Retiré</option>
                  <option value="Ventilation">✏️ Ventilation Modifiée</option>
                  <option value="Inchangé">⚪ Inchangé</option>
                </select>

                {/* Search input */}
                <div style={{ position: 'relative', width: '250px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Filtrer par nom ou code..."
                    value={searchProjectDiff}
                    onChange={(e) => setSearchProjectDiff(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}></th>
                    <th>Code / Projet</th>
                    <th>Lead BA</th>
                    <th>Évolution Statut</th>
                    <th style={{ textAlign: 'right' }}>Budget B0</th>
                    <th style={{ textAlign: 'right' }}>Budget B1</th>
                    <th style={{ textAlign: 'right' }}>Planifié 12M</th>
                    <th style={{ textAlign: 'right' }}>Écart Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjectDeltas.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        Aucun écart détecté pour les filtres sélectionnés.
                      </td>
                    </tr>
                  ) : (
                    filteredProjectDeltas.map((p) => {
                      const isExpanded = expandedProjectKey === p.key;
                      return (
                        <React.Fragment key={p.key}>
                          <tr
                            style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                            onClick={() => setExpandedProjectKey(isExpanded ? null : p.key)}
                          >
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </td>

                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {p.codeProjet && <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)' }}>{p.codeProjet}</span>}
                                {p.nom}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{p.type}</div>
                            </td>

                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.leadBANom || '—'}</td>

                            <td>
                              <span className={`badge ${p.evolStatut.includes('B0 ➔ B1') ? 'badge-success' : p.evolStatut === 'Nouveau Projet' ? 'badge-primary' : p.evolStatut === 'Projet Retiré' ? 'badge-danger' : p.deltaPlanifie !== 0 ? 'badge-warning' : 'badge-secondary'}`}>
                                {p.evolStatut}
                              </span>
                            </td>

                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{p.b0Base}j</span> ➔ <strong style={{ color: 'var(--text-main)' }}>{p.b0Comp}j</strong>
                              {p.deltaB0 !== 0 && (
                                <span className={`badge ${p.deltaB0 > 0 ? 'badge-danger' : 'badge-success'}`} style={{ marginLeft: '6px', fontSize: '0.72rem' }}>
                                  {p.deltaB0 > 0 ? `+${p.deltaB0}` : p.deltaB0}
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{p.b1Base}j</span> ➔ <strong style={{ color: '#c084fc' }}>{p.b1Comp}j</strong>
                              {p.deltaB1 !== 0 && (
                                <span className={`badge ${p.deltaB1 > 0 ? 'badge-danger' : 'badge-success'}`} style={{ marginLeft: '6px', fontSize: '0.72rem' }}>
                                  {p.deltaB1 > 0 ? `+${p.deltaB1}` : p.deltaB1}
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{p.planifieBase}j</span> ➔ <strong style={{ color: 'var(--text-main)' }}>{p.planifieComp}j</strong>
                            </td>

                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                              <span className={`badge ${p.deltaPlanifie > 0 ? 'badge-danger' : p.deltaPlanifie < 0 ? 'badge-success' : 'badge-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                {p.deltaPlanifie > 0 ? `+${p.deltaPlanifie} j.h` : p.deltaPlanifie < 0 ? `${p.deltaPlanifie} j.h` : '0 j.h'}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded row for monthly ventilations diff */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: 'rgba(7, 13, 25, 0.6)' }}>
                              <td></td>
                              <td colSpan={7} style={{ padding: '16px 20px' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Layers size={14} /> Décomposition des Écarts de Ventilation Mensuelle ({annee}) :
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '8px' }}>
                                  {p.ventilationDeltas.map((v) => (
                                    <div
                                      key={v.mois}
                                      style={{
                                        padding: '8px 4px',
                                        borderRadius: '8px',
                                        backgroundColor: v.delta > 0 ? 'rgba(239, 68, 68, 0.12)' : v.delta < 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                        border: v.delta !== 0 ? `1px solid ${v.delta > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` : '1px solid var(--border-color)',
                                        textAlign: 'center',
                                        fontSize: '0.78rem'
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{NOMS_MOIS[v.mois - 1]}</div>
                                      <div style={{ margin: '3px 0', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>{v.compTotal}j</div>
                                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: v.delta > 0 ? '#f87171' : v.delta < 0 ? '#34d399' : 'var(--text-dim)' }}>
                                        {v.delta > 0 ? `+${v.delta}j` : v.delta < 0 ? `${v.delta}j` : '='}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* List Saved Snapshots Cards */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera style={{ color: '#c084fc' }} size={20} /> Baselines Sauvegardées ({snapshots.length})
            </h2>

            {snapshots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', border: '1px dashed var(--border-color)' }}>
                Aucune baseline n'a été gelée pour l'année {annee}.
                <br />
                <span style={{ fontSize: '0.85rem' }}>Cliquez sur le bouton <strong>"Geler une Baseline (Snapshot)"</strong> en haut pour créer votre première référence.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px' }}>
                {snapshots.map((s) => (
                  <div
                    key={s._id}
                    className="card"
                    style={{
                      padding: '20px',
                      marginBottom: 0,
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>{s.nom}</div>
                      <span className="badge badge-purple" style={{ fontFamily: 'var(--font-mono)' }}>{s.annee}</span>
                    </div>

                    {s.description && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>{s.description}</p>
                    )}

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} /> Gelé le : <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{new Date(s.dateCreation).toLocaleDateString('fr-FR')}</strong> par <strong>{s.auteur}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        <span>📊 <strong>{s.nombreProjets}</strong> proj.</span>
                        <span>B0: <strong>{s.totalB0}j</strong></span>
                        <span>B1: <strong>{s.totalB1}j</strong></span>
                        <span style={{ color: 'var(--primary)' }}>Plan: <strong>{s.totalPlanifie}j</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '8px' }}
                        onClick={() => {
                          setTargetSnapshotId(s._id);
                          setBaseSnapshotId('current');
                        }}
                      >
                        🔍 Comparer vs Actuel
                      </button>

                      {role === 'Admin' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '8px 12px' }}
                          onClick={() => handleDeleteSnapshot(s._id, s.nom)}
                          title="Supprimer la baseline"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History style={{ color: 'var(--primary)' }} size={22} />
                Journal d'Audit Chronologique
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Historique inaltérable de toutes les créations, réestimations B0 ➔ B1, ajustements de ventilation et baselines.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: '210px', fontSize: '0.85rem' }}
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <option value="Tous">Toutes les actions</option>
                <option value="REESTIMATION_B1">🔒 Passages B1</option>
                <option value="VENTILATION_BATCH">⚡ Ventilations Batch</option>
                <option value="CREATION_PROJET">➕ Créations Projets</option>
                <option value="MODIFICATION_PROJET">✏️ Modifications Projets</option>
                <option value="SUPPRESSION_PROJET">🗑️ Suppressions Projets</option>
                <option value="SNAPSHOT_CREATION">📸 Snapshots</option>
              </select>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Recherche dans l'audit log..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Date & Heure</th>
                  <th style={{ width: '140px' }}>Type d'Action</th>
                  <th style={{ width: '170px' }}>Auteur</th>
                  <th>Projet Concerné</th>
                  <th>Détails & Modifications Champ par Champ</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Aucune entrée d'audit ne correspond aux filtres sélectionnés.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log._id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('fr-FR')}
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{log.auteur}</td>
                      <td>
                        {log.nomProjet ? (
                          <div>
                            {log.codeProjet && <span className="badge badge-secondary" style={{ marginRight: '6px', fontFamily: 'var(--font-mono)' }}>{log.codeProjet}</span>}
                            <strong style={{ color: 'var(--text-main)' }}>{log.nomProjet}</strong>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{log.description}</div>
                        {log.modifications && log.modifications.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {log.modifications.map((m, idx) => (
                              <span key={idx} className="badge badge-secondary" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                {m.champ} : <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{String(m.ancienneValeur ?? 'vide')}</span> ➔ <strong style={{ color: 'var(--primary)' }}>{String(m.nouvelleValeur)}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Créer Snapshot */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera style={{ color: 'var(--primary)' }} size={22} /> Geler une Baseline de Portefeuille
              </h3>
              <button className="toast-close-btn" onClick={() => setShowCreateModal(false)} style={{ fontSize: '1.2rem' }}>×</button>
            </div>

            <form onSubmit={handleCreateSnapshot}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', gap: '10px' }}>
                  <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    Le snapshot va figer l'état exact des projets et leurs ventilations mensuelles pour l'année <strong>{annee}</strong> pour servir de référence budgétaire inaltérable.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nom de la Baseline *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Baseline Budget Janvier 2026, Snapshot Q2, ..."
                    value={snapNom}
                    onChange={(e) => setSnapNom(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Contexte (optionnel)</label>
                  <textarea
                    rows={3}
                    placeholder="Précisez la raison de l'arbitrage ou de cette référence..."
                    value={snapDesc}
                    onChange={(e) => setSnapDesc(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.88rem', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingSnap}>
                  {submittingSnap ? 'Enregistrement...' : 'Enregistrer la Baseline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
