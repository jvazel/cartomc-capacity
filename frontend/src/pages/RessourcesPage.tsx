import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IRessource } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  UserCheck,
  CalendarDays,
  Users,
  Calendar,
  Filter,
  Briefcase,
  User,
  Shield,
  Sparkles,
  X,
  Check,
  Save,
  AlertCircle,
  Calculator
} from 'lucide-react';
import { RessourceCalendarModal } from '../components/RessourceCalendarModal';
import { PicsAbsencesWidget } from '../components/PicsAbsencesWidget';
import { groupConsecutiveAbsences, formatAbsenceRangeLabel } from '../utils/absenceGroup';
import { getAbsenceHeatmapStyle } from '../utils/heatmap';
import { RessourceProjetsView } from '../components/RessourceProjetsView';
import { WorkspaceManager } from '../components/WorkspaceManager';
import { VerifCapaciteTable } from '../components/VerifCapaciteTable';

export const RessourcesPage: React.FC = () => {
  const { role } = useAuth();
  const { showSuccess, showDanger } = useToast();
  const isReadOnly = role === 'Lecteur';

  // Navigation sous-onglets
  const [activeSubTab, setActiveSubTab] = useState<'referentiel' | 'absences' | 'projets' | 'capacites'>('referentiel');

  const [ressources, setRessources] = useState<IRessource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Absences per resource state
  const [absAnnee, setAbsAnnee] = useState<number>(new Date().getFullYear());
  const [absMois, setAbsMois] = useState<number | ''>(''); // '' = toute l'année
  const [absTypeFilter, setAbsTypeFilter] = useState<'Tous' | 'Interne' | 'Externe'>('Tous');
  const [absData, setAbsData] = useState<{
    [matricule: string]: { total: number; details: Array<{ date: string; valeur: number }> };
  }>({});
  const [loadingAbsData, setLoadingAbsData] = useState<boolean>(false);
  const [selectedRessourceDetails, setSelectedRessourceDetails] = useState<IRessource | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    type: 'Interne' as 'Interne' | 'Externe',
    role: 'BA',
    estLeadBA: false,
    tauxActivite: 1,
    dateArrivee: new Date().toISOString().split('T')[0],
    dateDepart: '',
    actif: true
  });
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchRessources = () => {
    setLoading(true);
    fetch('/api/ressources')
      .then((res) => res.json())
      .then((data) => {
        setRessources(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  const fetchAbsencesMatrice = (annee: number, mois: number | '') => {
    setLoadingAbsData(true);
    const query = mois !== '' ? `annee=${annee}&mois=${mois}` : `annee=${annee}`;
    fetch(`/api/absences/matrice?${query}`)
      .then((res) => res.json())
      .then((data) => {
        setAbsData(data.absencesByMatricule || {});
        setLoadingAbsData(false);
      })
      .catch((err) => {
        console.error('Erreur matrice absences:', err);
        setLoadingAbsData(false);
      });
  };

  useEffect(() => {
    fetchRessources();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'absences') {
      fetchAbsencesMatrice(absAnnee, absMois);
    }
  }, [activeSubTab, absAnnee, absMois]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      matricule: '',
      nom: '',
      type: 'Interne',
      role: 'BA',
      estLeadBA: false,
      tauxActivite: 1,
      dateArrivee: new Date().toISOString().split('T')[0],
      dateDepart: '',
      actif: true
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (res: IRessource) => {
    setEditingId(res._id);
    setFormData({
      matricule: res.matricule,
      nom: res.nom,
      type: res.type,
      role: res.role,
      estLeadBA: res.estLeadBA,
      tauxActivite: res.tauxActivite,
      dateArrivee: res.dateArrivee ? new Date(res.dateArrivee).toISOString().split('T')[0] : '',
      dateDepart: res.dateDepart ? new Date(res.dateDepart).toISOString().split('T')[0] : '',
      actif: res.actif
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, nom: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer la ressource "${nom}" ?`)) return;
    try {
      const res = await fetch(`/api/ressources/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Erreur: ${data.message}`);
        return;
      }
      fetchRessources();
    } catch (err: any) {
      alert(`Erreur lors de la suppression: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = {
      ...formData,
      tauxActivite: Number(formData.tauxActivite),
      dateDepart: formData.dateDepart ? formData.dateDepart : undefined
    };

    try {
      const url = editingId ? `/api/ressources/${editingId}` : '/api/ressources';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.message || 'Une erreur est survenue');
        showDanger(result.message || 'Erreur lors de l\'enregistrement de la ressource.');
        return;
      }

      setIsModalOpen(false);
      fetchRessources();
      showSuccess(
        editingId
          ? `La ressource "${formData.nom}" a été modifiée avec succès.`
          : `La ressource "${formData.nom}" a été créée avec succès.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau');
      showDanger(err.message || 'Erreur lors de la communication réseau.');
    }
  };

  // Mode d'affichage pour le référentiel : 'cards' (Trombinoscope) ou 'table' (Grille dense)
  const [viewLayout, setViewLayout] = useState<'cards' | 'table'>('cards');
  const [filterRole, setFilterRole] = useState<string>('Tous');
  const [filterStatut, setFilterStatut] = useState<'Tous' | 'Actif' | 'Inactif'>('Tous');

  const filteredRessources = ressources.filter((r) => {
    const matchesSearch =
      r.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.role.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = absTypeFilter === 'Tous' || r.type === absTypeFilter;
    const matchesRole = filterRole === 'Tous' || r.role === filterRole;
    const matchesStatut =
      filterStatut === 'Tous' ||
      (filterStatut === 'Actif' && r.actif) ||
      (filterStatut === 'Inactif' && !r.actif);

    return matchesSearch && matchesType && matchesRole && matchesStatut;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
  };

  const nomsMois = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre'
  ];

  // Calculs statistiques pour les KPIs d'équipe
  const totalRessources = ressources.length;
  const ressourcesActives = ressources.filter((r) => r.actif);
  const totalETP = ressourcesActives.reduce((acc, r) => acc + (r.tauxActivite || 1), 0);
  const totalInternes = ressourcesActives.filter((r) => r.type === 'Interne').length;
  const totalExternes = ressourcesActives.filter((r) => r.type === 'Externe').length;
  const totalLeadBA = ressourcesActives.filter((r) => r.estLeadBA).length;
  const distinctRoles = Array.from(new Set(ressources.map((r) => r.role))).filter(Boolean);

  // Cumul global d'absences sur la sélection
  const totalAbsencesSelection = Object.values(absData).reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <div>
      {/* En-tête Principal Redessiné avec Actions et Bouton Ajout */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 0 16px rgba(6, 182, 212, 0.25)'
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>Référentiel & Suivi des Ressources</h1>
              <p className="page-subtitle" style={{ margin: 0, marginTop: '2px' }}>
                Pilotage d'équipe 360°, gestion des collaborateurs, capacité ETP, suivi thermique des absences et staffing.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Onglets sous-navigation façon Pill Switcher moderne */}
          <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              className={`btn ${activeSubTab === 'referentiel' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.84rem', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveSubTab('referentiel')}
            >
              <Users size={15} /> Référentiel Équipe
            </button>

            <button
              className={`btn ${activeSubTab === 'absences' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.84rem', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveSubTab('absences')}
            >
              <CalendarDays size={15} /> Suivi des Absences
            </button>

            <button
              className={`btn ${activeSubTab === 'projets' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.84rem', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveSubTab('projets')}
            >
              <Briefcase size={15} /> Projets & Affectations
            </button>

            <button
              className={`btn ${activeSubTab === 'capacites' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.84rem', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveSubTab('capacites')}
            >
              <Calculator size={15} /> Capacités Mensuelles
            </button>
          </div>

          {!isReadOnly && activeSubTab === 'referentiel' && (
            <button className="btn btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={17} /> Ajouter un collaborateur
            </button>
          )}
        </div>
      </div>

      {/* Cartes KPI Synthétiques d'Équipe (Style Visual Wow) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '22px'
        }}
      >
        {/* KPI 1 : Effectif Actif & Répartition */}
        <div
          className="card"
          style={{
            margin: 0,
            padding: '16px 18px',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(11, 17, 32, 0.9) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={15} style={{ color: '#38bdf8' }} /> Effectif Actif
            </span>
            <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
              {ressourcesActives.length}/{totalRessources}
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
            {ressourcesActives.length} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)' }}>actifs</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span style={{ color: '#38bdf8' }}>🔵 {totalInternes} Internes</span>
            <span style={{ color: '#c084fc' }}>🟣 {totalExternes} Externes</span>
          </div>
        </div>

        {/* KPI 2 : Capacité Théorique ETP */}
        <div
          className="card"
          style={{
            margin: 0,
            padding: '16px 18px',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(11, 17, 32, 0.9) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={15} style={{ color: '#60a5fa' }} /> Capacité Théorique
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
            {totalETP.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>ETP</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Moyenne : {(ressourcesActives.length > 0 ? totalETP / ressourcesActives.length : 0).toFixed(2)} ETP/collaborateur
          </div>
        </div>

        {/* KPI 3 : Encadrement Lead BA */}
        <div
          className="card"
          style={{
            margin: 0,
            padding: '16px 18px',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(11, 17, 32, 0.9) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={15} style={{ color: '#fbbf24' }} /> Référents Lead BA
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: '#fbbf24', fontFamily: 'var(--font-heading)' }}>
            {totalLeadBA} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)' }}>référents</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Habilités à l'estimation et au staffing
          </div>
        </div>

        {/* KPI 4 : Absentéisme Cumulé */}
        <div
          className="card"
          style={{
            margin: 0,
            padding: '16px 18px',
            background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.7) 0%, rgba(11, 17, 32, 0.9) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CalendarDays size={15} style={{ color: '#f87171' }} /> Cumul Congés / Absences
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '4px', color: totalAbsencesSelection > 50 ? '#f87171' : '#ffffff', fontFamily: 'var(--font-mono)' }}>
            {totalAbsencesSelection.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>jours</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Période : {absMois !== '' ? nomsMois[Number(absMois) - 1] : 'Année'} {absAnnee}
          </div>
        </div>
      </div>

      {/* Barre de Filtres Avancés & Workspaces */}
      {activeSubTab !== 'projets' && activeSubTab !== 'capacites' && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              {/* Vues & Filtres sauvegardés (Workspaces) */}
              <WorkspaceManager
                storageKey="ressources"
                currentFilters={{
                  searchTerm,
                  absAnnee,
                  absMois,
                  absTypeFilter,
                  filterRole,
                  filterStatut,
                  viewLayout
                }}
                defaultFilters={{
                  searchTerm: '',
                  absAnnee: new Date().getFullYear(),
                  absMois: '',
                  absTypeFilter: 'Tous',
                  filterRole: 'Tous',
                  filterStatut: 'Tous',
                  viewLayout: 'cards'
                }}
                onApplyFilters={(f) => {
                  if (f.searchTerm !== undefined) setSearchTerm(f.searchTerm);
                  if (f.absAnnee !== undefined) setAbsAnnee(f.absAnnee);
                  if (f.absMois !== undefined) setAbsMois(f.absMois as number | '');
                  if (f.absTypeFilter !== undefined) setAbsTypeFilter(f.absTypeFilter as 'Tous' | 'Interne' | 'Externe');
                  if (f.filterRole !== undefined) setFilterRole(f.filterRole);
                  if (f.filterStatut !== undefined) setFilterStatut(f.filterStatut as 'Tous' | 'Actif' | 'Inactif');
                  if (f.viewLayout !== undefined) setViewLayout(f.viewLayout as 'cards' | 'table');
                }}
                systemPresets={[
                  {
                    id: 'sys_internes',
                    name: 'Collaborateurs Internes',
                    icon: '🏛️',
                    description: 'Afficher uniquement les collaborateurs en CDI/Internes',
                    filters: {
                      searchTerm: '',
                      absAnnee,
                      absMois: '',
                      absTypeFilter: 'Interne',
                      filterRole: 'Tous',
                      filterStatut: 'Actif',
                      viewLayout: 'cards'
                    }
                  },
                  {
                    id: 'sys_externes',
                    name: 'Prestataires Externes',
                    icon: '💼',
                    description: 'Afficher uniquement les prestataires et consultants externes',
                    filters: {
                      searchTerm: '',
                      absAnnee,
                      absMois: '',
                      absTypeFilter: 'Externe',
                      filterRole: 'Tous',
                      filterStatut: 'Actif',
                      viewLayout: 'cards'
                    }
                  },
                  {
                    id: 'sys_leadba_role',
                    name: 'Profils Lead BA',
                    icon: '⭐',
                    description: 'Filtre rapide sur les rôles et Lead BAs de l\'équipe',
                    filters: {
                      searchTerm: '',
                      absAnnee,
                      absMois: '',
                      absTypeFilter: 'Tous',
                      filterRole: 'BA',
                      filterStatut: 'Actif',
                      viewLayout: 'cards'
                    }
                  }
                ]}
              />

              {/* Champ de recherche moderne avec loupe et bouton clear */}
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px', maxWidth: '340px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px', paddingRight: searchTerm ? '28px' : '10px', fontSize: '0.84rem', height: '36px', width: '100%' }}
                  placeholder="Rechercher nom, matricule, rôle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Effacer la recherche"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filtre Type (Interne / Externe) */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <select
                  className="form-select"
                  style={{ minWidth: '135px', height: '36px', fontSize: '0.84rem' }}
                  value={absTypeFilter}
                  onChange={(e) => setAbsTypeFilter(e.target.value as 'Tous' | 'Interne' | 'Externe')}
                  title="Filtrer par population"
                >
                  <option value="Tous">Tous types</option>
                  <option value="Interne">🔵 Internes</option>
                  <option value="Externe">🟣 Externes</option>
                </select>
              </div>

              {/* Filtre Rôle */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <select
                  className="form-select"
                  style={{ minWidth: '150px', height: '36px', fontSize: '0.84rem' }}
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  title="Filtrer par rôle métier"
                >
                  <option value="Tous">Tous les rôles ({distinctRoles.length})</option>
                  {distinctRoles.map((ro) => (
                    <option key={ro} value={ro}>{ro}</option>
                  ))}
                </select>
              </div>

              {/* Filtre Statut Actif / Inactif */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <select
                  className="form-select"
                  style={{ minWidth: '130px', height: '36px', fontSize: '0.84rem' }}
                  value={filterStatut}
                  onChange={(e) => setFilterStatut(e.target.value as any)}
                  title="Filtrer par statut"
                >
                  <option value="Tous">Tous statuts</option>
                  <option value="Actif">🟢 Actifs</option>
                  <option value="Inactif">⚪ Inactifs</option>
                </select>
              </div>

              {/* Filtres de Période pour l'onglet Absences */}
              {activeSubTab === 'absences' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    className="form-select"
                    style={{ minWidth: '95px', height: '36px', fontSize: '0.84rem' }}
                    value={absAnnee}
                    onChange={(e) => setAbsAnnee(Number(e.target.value))}
                    title="Sélectionner l'année"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ minWidth: '150px', height: '36px', fontSize: '0.84rem' }}
                    value={absMois}
                    onChange={(e) => setAbsMois(e.target.value === '' ? '' : Number(e.target.value))}
                    title="Sélectionner le mois"
                  >
                    <option value="">Toute l'année</option>
                    {nomsMois.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Bascule de disposition pour le Référentiel (Cartes Trombinoscope vs Grille Dense) */}
            {activeSubTab === 'referentiel' && (
              <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className={`btn ${viewLayout === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setViewLayout('cards')}
                  title="Affichage en cartes de profil (Trombinoscope)"
                >
                  <Users size={14} /> Cartes
                </button>
                <button
                  type="button"
                  className={`btn ${viewLayout === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setViewLayout('table')}
                  title="Affichage en tableau dense"
                >
                  <Filter size={14} /> Tableau
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONGLET 1 : Référentiel des ressources */}
      {activeSubTab === 'referentiel' && (
        loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chargement des collaborateurs...
          </div>
        ) : filteredRessources.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Aucun collaborateur ne correspond aux critères de recherche.
          </div>
        ) : viewLayout === 'cards' ? (
          /* MODE TROMBINOSCOPE / CARTES PROFILES GLASSMORPHISM */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '16px',
              marginBottom: '30px'
            }}
          >
            {filteredRessources.map((r) => {
              const initials = r.nom
                .split(' ')
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || '??';

              const isInterne = r.type === 'Interne';
              const accentColor = isInterne ? '#38bdf8' : '#c084fc';
              const bgAccent = isInterne ? 'rgba(56, 189, 248, 0.12)' : 'rgba(192, 132, 252, 0.12)';
              const borderAccent = isInterne ? 'rgba(56, 189, 248, 0.35)' : 'rgba(192, 132, 252, 0.35)';

              return (
                <div
                  key={r._id}
                  className="card"
                  style={{
                    margin: 0,
                    padding: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: r.actif ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(239, 68, 68, 0.25)',
                    background: r.actif
                      ? 'linear-gradient(160deg, rgba(15, 23, 42, 0.85) 0%, rgba(11, 17, 32, 0.95) 100%)'
                      : 'linear-gradient(160deg, rgba(20, 15, 20, 0.85) 0%, rgba(15, 10, 15, 0.95) 100%)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = accentColor;
                    e.currentTarget.style.boxShadow = `0 12px 28px rgba(0, 0, 0, 0.5), 0 0 15px ${bgAccent}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = r.actif ? 'rgba(255, 255, 255, 0.08)' : 'rgba(239, 68, 68, 0.25)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
                  }}
                >
                  {/* Bandeau supérieur de la carte */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: bgAccent,
                          border: `1.5px solid ${borderAccent}`,
                          color: accentColor,
                          fontWeight: 800,
                          fontSize: '1.05rem',
                          fontFamily: 'var(--font-heading)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 0 12px ${bgAccent}`
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                          {r.nom}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.matricule}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: bgAccent,
                          color: accentColor,
                          border: `1px solid ${borderAccent}`
                        }}
                      >
                        {r.type}
                      </span>
                      {r.estLeadBA && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <UserCheck size={11} /> Lead BA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corps d'informations de la carte */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Rôle métier :</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.role}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Quotité ETP :</span>
                      <span style={{ fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {(r.tauxActivite || 1).toLocaleString('fr-FR')} ETP
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Période active :</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {formatDate(r.dateArrivee)} ➔ {r.dateDepart ? formatDate(r.dateDepart) : 'Actuel'}
                      </span>
                    </div>
                  </div>

                  {/* Pied de carte avec statut & boutons d'action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div>
                      {r.actif ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                          Actif
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f87171' }} />
                          Inactif
                        </span>
                      )}
                    </div>

                    {!isReadOnly && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '5px 9px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleOpenEdit(r)}
                          title="Modifier le collaborateur"
                        >
                          <Edit2 size={13} />
                          <span>Modifier</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '5px 8px' }}
                          onClick={() => handleDelete(r._id, r.nom)}
                          title="Supprimer la ressource"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* MODE GRILLE DENSE ENRICHIE */
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Matricule</th>
                  <th>Type</th>
                  <th>Rôle</th>
                  <th>Lead BA</th>
                  <th style={{ textAlign: 'center' }}>ETP</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th style={{ textAlign: 'center' }}>Statut</th>
                  {!isReadOnly && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRessources.map((r) => {
                  const isInterne = r.type === 'Interne';
                  const initials = r.nom
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '??';

                  return (
                    <tr key={r._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: isInterne ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                              border: isInterne ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(192, 132, 252, 0.4)',
                              color: isInterne ? '#38bdf8' : '#c084fc',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {initials}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.nom}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{r.matricule}</td>
                      <td>
                        <span
                          className={`badge ${
                            r.type === 'Interne' ? 'badge-primary' : 'badge-purple'
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.role}</td>
                      <td>
                        {r.estLeadBA ? (
                          <span className="badge badge-success" style={{ gap: '4px' }}>
                            <UserCheck size={12} /> Lead BA
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {r.tauxActivite.toLocaleString('fr-FR')}
                      </td>
                      <td>{formatDate(r.dateArrivee)}</td>
                      <td>{formatDate(r.dateDepart)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {r.actif ? (
                          <span className="badge badge-success" style={{ gap: '4px' }}>
                            <CheckCircle size={13} /> Actif
                          </span>
                        ) : (
                          <span className="badge" style={{ gap: '4px', color: 'var(--text-dim)' }}>
                            <XCircle size={13} /> Inactif
                          </span>
                        )}
                      </td>
                      {!isReadOnly && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 9px', marginRight: '6px' }}
                            onClick={() => handleOpenEdit(r)}
                            title="Modifier"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '5px 9px' }}
                            onClick={() => handleDelete(r._id, r.nom)}
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ONGLET 2 : Suivi des absences par ressource (Redesign Visual Planning & Cartes Thermiques) */}
      {activeSubTab === 'absences' && (
        <>
          {/* Widget d'alerte des absences simultanées / pics d'absentéisme */}
          <PicsAbsencesWidget annee={absAnnee} mois={absMois} />

          {/* Bandeau d'actions et de bascule de vue pour les Absences */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Affichage de <strong>{filteredRessources.length}</strong> collaborateurs</span>
              <span>•</span>
              <span>Volume cumulé : <strong style={{ color: '#ffffff' }}>{totalAbsencesSelection.toFixed(1)} j</strong></span>
            </div>

            <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className={`btn ${viewLayout === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setViewLayout('cards')}
                title="Affichage en cartes de synthèse thermique"
              >
                <Users size={14} /> Cartes Synthèse
              </button>
              <button
                type="button"
                className={`btn ${viewLayout === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.78rem', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setViewLayout('table')}
                title="Affichage en grille détaillée"
              >
                <Filter size={14} /> Tableau Détaillé
              </button>
            </div>
          </div>

          {loadingAbsData ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chargement des relevés d'absences...
            </div>
          ) : filteredRessources.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aucun collaborateur ne correspond aux critères de recherche.
            </div>
          ) : viewLayout === 'cards' ? (
            /* MODE CARTES THERMIQUES D'ABSENTÉISME */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '16px',
                marginBottom: '30px'
              }}
            >
              {filteredRessources.map((r) => {
                const matKey = r.matricule.trim().toUpperCase();
                const absInfo = absData[matKey] || { total: 0, details: [] };
                const isInterne = r.type === 'Interne';
                const initials = r.nom
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '??';

                const maxJoursBase = absMois !== '' ? 21.5 * (r.tauxActivite || 1) : 220 * (r.tauxActivite || 1);
                const heatStyle = getAbsenceHeatmapStyle(absInfo.total, maxJoursBase);
                const pctDeperdition = Math.min(100, Math.round((absInfo.total / (maxJoursBase || 1)) * 100));
                const ranges = groupConsecutiveAbsences(absInfo.details);

                return (
                  <div
                    key={r._id}
                    className="card"
                    style={{
                      margin: 0,
                      padding: '18px',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: absInfo.total > 0 ? `1px solid ${heatStyle.border || 'rgba(255, 255, 255, 0.1)'}` : '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.85) 0%, rgba(11, 17, 32, 0.95) 100%)',
                      boxShadow: absInfo.total > 10 ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 14px rgba(239, 68, 68, 0.12)' : '0 8px 20px rgba(0, 0, 0, 0.3)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = absInfo.total > 10 ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 14px rgba(239, 68, 68, 0.12)' : '0 8px 20px rgba(0, 0, 0, 0.3)';
                    }}
                  >
                    {/* En-tête collaborateur */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: isInterne ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                            border: isInterne ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(192, 132, 252, 0.4)',
                            color: isInterne ? '#38bdf8' : '#c084fc',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>{r.nom}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {r.matricule} • {r.role}
                          </div>
                        </div>
                      </div>

                      <span
                        className="badge"
                        style={{
                          backgroundColor: heatStyle.bg,
                          color: heatStyle.color,
                          borderColor: heatStyle.border,
                          borderStyle: 'solid',
                          borderWidth: '1px',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          padding: '3px 8px'
                        }}
                      >
                        {absInfo.total} j ({heatStyle.label})
                      </span>
                    </div>

                    {/* Jauge Thermique de Déperdition */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Taux d'impact capacitif :</span>
                        <span style={{ fontWeight: 700, color: heatStyle.color }}>{pctDeperdition}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pctDeperdition}%`,
                            height: '100%',
                            background: heatStyle.color || '#38bdf8',
                            transition: 'width 0.4s ease',
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                    </div>

                    {/* Plages de dates d'absence */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', minHeight: '62px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Périodes d'absence ({ranges.length}) :
                      </div>
                      {ranges.length === 0 ? (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                          Aucun jour d'absence sur la période
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {ranges.slice(0, 3).map((rg, idx) => (
                            <span
                              key={idx}
                              className="badge badge-secondary"
                              style={{
                                fontSize: '0.74rem',
                                padding: '2px 7px',
                                background: rg.startDateStr !== rg.endDateStr ? 'rgba(59, 130, 246, 0.15)' : undefined,
                                borderColor: rg.startDateStr !== rg.endDateStr ? 'rgba(59, 130, 246, 0.3)' : undefined,
                                color: rg.startDateStr !== rg.endDateStr ? '#60a5fa' : undefined,
                                fontWeight: 600
                              }}
                            >
                              {formatAbsenceRangeLabel(rg)}
                            </span>
                          ))}
                          {ranges.length > 3 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--primary-light)', fontWeight: 600, alignSelf: 'center' }}>
                              +{ranges.length - 3} autre(s)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bouton d'action calendrier individuel */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}
                        onClick={() => setSelectedRessourceDetails(r)}
                      >
                        <CalendarDays size={14} style={{ color: '#38bdf8' }} />
                        <span>Consulter le planning 7x6</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* MODE TABLEAU DÉTAILLÉ ENRICHI */
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Collaborateur</th>
                    <th>Matricule</th>
                    <th>Type</th>
                    <th>Rôle</th>
                    <th style={{ textAlign: 'center' }}>ETP</th>
                    <th>Cumul d'absences ({absMois !== '' ? nomsMois[Number(absMois) - 1] : ''} {absAnnee})</th>
                    <th>Détail des dates d'absence</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRessources.map((r) => {
                    const matKey = r.matricule.trim().toUpperCase();
                    const absInfo = absData[matKey] || { total: 0, details: [] };
                    const isInterne = r.type === 'Interne';
                    const initials = r.nom
                      .split(' ')
                      .filter(Boolean)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '??';

                    const maxJoursBase = absMois !== '' ? 21.5 * (r.tauxActivite || 1) : 220 * (r.tauxActivite || 1);
                    const heatStyle = getAbsenceHeatmapStyle(absInfo.total, maxJoursBase);
                    const ranges = groupConsecutiveAbsences(absInfo.details);

                    return (
                      <tr key={r._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: isInterne ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                                border: isInterne ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(192, 132, 252, 0.4)',
                                color: isInterne ? '#38bdf8' : '#c084fc',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {initials}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.nom}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{r.matricule}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.type === 'Interne' ? 'badge-primary' : 'badge-purple'
                            }`}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td>{r.role}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{r.tauxActivite}</td>
                        <td>
                          <span
                            className="badge"
                            title={`Taux d'absentéisme : ${heatStyle.label}`}
                            style={{
                              backgroundColor: heatStyle.bg,
                              color: heatStyle.color,
                              borderColor: heatStyle.border,
                              borderStyle: 'solid',
                              borderWidth: '1px',
                              fontWeight: 700,
                              fontSize: '0.85rem'
                            }}
                          >
                            {absInfo.total} j ({heatStyle.label})
                          </span>
                        </td>
                        <td>
                          {absInfo.details.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              Aucune absence sur la période
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxWidth: '460px' }}>
                              {ranges.slice(0, 5).map((range, idx) => (
                                <span
                                  key={idx}
                                  className="badge badge-secondary"
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '3px 8px',
                                    background: range.startDateStr !== range.endDateStr ? 'rgba(59, 130, 246, 0.15)' : undefined,
                                    borderColor: range.startDateStr !== range.endDateStr ? 'rgba(59, 130, 246, 0.3)' : undefined,
                                    color: range.startDateStr !== range.endDateStr ? '#60a5fa' : undefined,
                                    fontWeight: 600
                                  }}
                                >
                                  {formatAbsenceRangeLabel(range)}
                                </span>
                              ))}
                              {ranges.length > 5 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 600, alignSelf: 'center' }}>
                                  +{ranges.length - 5} autre(s) plage(s)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setSelectedRessourceDetails(r)}
                          >
                            <CalendarDays size={14} /> Voir planning
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ONGLET 3 : Projets & Affectations */}
      {activeSubTab === 'projets' && (
        <RessourceProjetsView annee={absAnnee} />
      )}

      {/* ONGLET 4 : Vérification des Capacités Mensuelles */}
      {activeSubTab === 'capacites' && (
        <VerifCapaciteTable anneeInitiale={absAnnee} />
      )}

      {/* Modal Calendrier & Planning de la ressource */}
      {selectedRessourceDetails && (
        <RessourceCalendarModal
          ressource={selectedRessourceDetails}
          anneeInitiale={absAnnee}
          moisInitial={absMois !== '' ? Number(absMois) : new Date().getMonth() + 1}
          onClose={() => setSelectedRessourceDetails(null)}
        />
      )}

      {/* Modal Création / Édition des Ressources - Design Modernisé Glassmorphism */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: '680px',
              width: '95%',
              padding: 0,
              background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 17, 32, 0.99) 100%)',
              border: '1px solid rgba(249, 115, 22, 0.45)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(249, 115, 22, 0.22)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
          >
            {/* En-tête Premium avec Avatar Réactif et Badges */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.05) 50%, transparent 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: formData.type === 'Interne' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(192, 132, 252, 0.18)',
                    border: formData.type === 'Interne' ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(192, 132, 252, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: formData.type === 'Interne' ? '#38bdf8' : '#c084fc',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    boxShadow: formData.type === 'Interne' ? '0 0 16px rgba(56, 189, 248, 0.25)' : '0 0 16px rgba(192, 132, 252, 0.25)'
                  }}
                >
                  {formData.nom.trim()
                    ? formData.nom
                        .split(' ')
                        .filter(Boolean)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : <User size={22} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)', color: '#ffffff', letterSpacing: '-0.01em' }}>
                      {editingId ? 'Modifier le collaborateur' : 'Ajouter un collaborateur'}
                    </h2>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: formData.type === 'Interne' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                        color: formData.type === 'Interne' ? '#38bdf8' : '#c084fc',
                        border: formData.type === 'Interne' ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(192, 132, 252, 0.35)'
                      }}
                    >
                      {formData.type}
                    </span>
                    {formData.estLeadBA && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Shield size={11} /> Lead BA
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    {formData.nom ? `${formData.nom} (${formData.matricule || 'Sans matricule'}) — ${formData.role || 'Rôle non spécifié'}` : 'Référentiel des compétences et quotité capacitaire.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '6px 8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)'
                }}
                onClick={() => setIsModalOpen(false)}
                title="Fermer (Échap)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps du Formulaire */}
            <div style={{ padding: '24px', maxHeight: 'calc(80vh - 140px)', overflowY: 'auto' }}>
              {errorMsg && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form id="resourceMainForm" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Section 1 : Identité & Affectation */}
                <div>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} />
                    <span>Identité & Profil Collaborateur</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Matricule <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="ex: BL207380"
                        value={formData.matricule}
                        onChange={(e) => setFormData({ ...formData, matricule: e.target.value.trim() })}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Nom complet (Prénom Nom) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="ex: Thomas Martin"
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Population <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            type: e.target.value as 'Interne' | 'Externe'
                          })
                        }
                      >
                        <option value="Interne">🔵 Interne (Salarié)</option>
                        <option value="Externe">🟣 Externe (Prestataire / Régie)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Rôle Métier / Titre <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="ex: Business Analyst, DEV Fullstack, Tech Lead..."
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2 : Capacité, Quotité & Rôles Spécifiques */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={14} />
                    <span>Capacité & Engagement Équipe</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" style={{ margin: 0 }}>
                          Taux d'activité (ETP) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 700 }}>
                          {(formData.tauxActivite * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          className="form-input"
                          required
                          value={formData.tauxActivite}
                          onChange={(e) =>
                            setFormData({ ...formData, tauxActivite: parseFloat(e.target.value) || 0 })
                          }
                          style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, maxWidth: '100px' }}
                        />
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1, 0.8, 0.5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              className="btn btn-secondary"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                fontWeight: formData.tauxActivite === val ? 700 : 500,
                                background: formData.tauxActivite === val ? 'rgba(249, 115, 22, 0.25)' : undefined,
                                borderColor: formData.tauxActivite === val ? 'var(--primary)' : undefined,
                                color: formData.tauxActivite === val ? '#f97316' : 'var(--text-muted)'
                              }}
                              onClick={() => setFormData({ ...formData, tauxActivite: val })}
                            >
                              {val * 100}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Carte Lead BA */}
                    <div
                      onClick={() => setFormData({ ...formData, estLeadBA: !formData.estLeadBA })}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: formData.estLeadBA ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: formData.estLeadBA ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            background: formData.estLeadBA ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: formData.estLeadBA ? '#fbbf24' : 'var(--text-muted)'
                          }}
                        >
                          <Shield size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: formData.estLeadBA ? '#fbbf24' : '#ffffff' }}>
                            Rôle Lead BA
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Peut être assigné sur les projets
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.estLeadBA}
                        onChange={(e) => setFormData({ ...formData, estLeadBA: e.target.checked })}
                        style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3 : Dates de Contrat & Statut Actif */}
                <div>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CalendarDays size={14} />
                    <span>Période Contractuelle & Statut</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Date d'arrivée dans l'équipe <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        required
                        value={formData.dateArrivee}
                        onChange={(e) => setFormData({ ...formData, dateArrivee: e.target.value })}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Déclenche la prise en compte capacitaire
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Date de départ (optionnelle)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.dateDepart}
                        onChange={(e) => setFormData({ ...formData, dateDepart: e.target.value })}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Arrête le calcul de capacité au mois concerné
                      </span>
                    </div>
                  </div>

                  {/* Toggle Actif / Inactif Moderne */}
                  <div
                    onClick={() => setFormData({ ...formData, actif: !formData.actif })}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: formData.actif ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: formData.actif ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: formData.actif ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: formData.actif ? '#34d399' : '#f87171'
                        }}
                      >
                        {formData.actif ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: formData.actif ? '#34d399' : '#f87171' }}>
                          {formData.actif ? 'Ressource Active dans l\'équipe' : 'Ressource Inactive / Archivée'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {formData.actif
                            ? 'Participe aux calculs capacitifs et au staffing sur les projets.'
                            : 'Exclue des calculs de capacité globale et des nouveaux projets.'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer Fixe d'Action */}
            <div
              style={{
                padding: '16px 24px',
                background: 'rgba(11, 17, 32, 0.95)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} style={{ color: '#10b981' }} />
                <span>Les champs avec (*) conditionnent la capacité</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  form="resourceMainForm"
                  className="btn btn-primary"
                  style={{
                    padding: '8px 22px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(249, 115, 22, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={15} />
                  <span>{editingId ? 'Enregistrer les modifications' : 'Créer le collaborateur'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
