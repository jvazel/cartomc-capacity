import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Download,
  Settings,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';

export interface IControleRow {
  matricule: string;
  nom: string;
  role: string;
  type: string;
  joursCSV: number;
  heuresJira: number;
  joursJira: number;
  ecartJours: number;
  statut: 'CONFORME' | 'SOUS_SAISIE' | 'SUR_SAISIE' | 'NON_SAISI' | 'SANS_ABSENCE_CSV';
  jiraAuthorName?: string | null;
}

export interface IControleKPIs {
  totalCollaborateurs: number;
  totalConformes: number;
  totalSousSaisies: number;
  totalSurSaisies: number;
  totalJoursCSV: number;
  totalJoursJira: number;
  totalEcartJours: number;
}

const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const ControleAbsencesJiraTable: React.FC = () => {
  const { showSuccess, showDanger } = useToast();

  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState<number>(currentYear);
  const [mois, setMois] = useState<number | undefined>(undefined); // undefined = toute l'année

  const [issueKey, setIssueKey] = useState<string>('HP-26');
  const [savedIssueKey, setSavedIssueKey] = useState<string>('HP-26');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveJira, setIsLiveJira] = useState<boolean>(false);
  const [kpis, setKpis] = useState<IControleKPIs | null>(null);
  const [rows, setRows] = useState<IControleRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('TOUS');

  // Load configuration for jiraAbsenceIssueKey
  useEffect(() => {
    fetch('/api/configuration')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.jiraAbsenceIssueKey) {
          setIssueKey(data.jiraAbsenceIssueKey);
          setSavedIssueKey(data.jiraAbsenceIssueKey);
        }
      })
      .catch((err) => console.error('Erreur chargement configuration Jira:', err));
  }, []);

  // Fetch comparison data
  const fetchData = () => {
    setLoading(true);
    let url = `/api/absences/controle?annee=${annee}&issueKey=${encodeURIComponent(issueKey)}`;
    if (mois) {
      url += `&mois=${mois}`;
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Erreur lors du calcul du rapprochement.');
        return res.json();
      })
      .then((data) => {
        setKpis(data.kpis);
        setRows(data.rows || []);
        setIsLiveJira(!!data.isLiveJira);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur contrôle absences:', err);
        showDanger(err.message || 'Impossible de charger les données de rapprochement.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [annee, mois]);

  // Save new default Jira issue key in backend config
  const handleSaveIssueKey = async () => {
    if (!issueKey.trim()) return;
    setSavingConfig(true);
    try {
      const res = await fetch('/api/configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jiraAbsenceIssueKey: issueKey.trim().toUpperCase() })
      });
      if (!res.ok) throw new Error('Échec de la sauvegarde de la clé du ticket Jira.');
      const updated = await res.json();
      setSavedIssueKey(updated.jiraAbsenceIssueKey || issueKey.toUpperCase());
      showSuccess(`Clé Jira par défaut mise à jour avec succès : ${updated.jiraAbsenceIssueKey || issueKey.toUpperCase()}`);
      setSavingConfig(false);
      fetchData();
    } catch (err: any) {
      showDanger(err.message || 'Erreur lors de la mise à jour de la configuration.');
      setSavingConfig(false);
    }
  };

  // Filter rows
  const filteredRows = rows.filter((r) => {
    // Filter by search text
    const matchesSearch =
      r.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.role.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Filter by status
    if (statusFilter === 'TOUS') return true;
    if (statusFilter === 'ECARTS') return r.statut !== 'CONFORME';
    if (statusFilter === 'CONFORME') return r.statut === 'CONFORME';
    if (statusFilter === 'NON_SAISI') return r.statut === 'NON_SAISI' || r.statut === 'SOUS_SAISIE';
    if (statusFilter === 'SUR_SAISIE') return r.statut === 'SUR_SAISIE' || r.statut === 'SANS_ABSENCE_CSV';

    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (rows.length === 0) return;

    const headers = ['Matricule', 'Nom Collaborateur', 'Rôle', 'Type', 'Jours Prévus (CSV)', 'Heures Jira', 'Jours Jira (8h/j)', 'Écart (Jours)', 'Statut'];
    const csvContentRows = rows.map((r) => [
      `"${r.matricule}"`,
      `"${r.nom.replace(/"/g, '""')}"`,
      `"${r.role}"`,
      `"${r.type}"`,
      r.joursCSV.toString().replace('.', ','),
      r.heuresJira.toString().replace('.', ','),
      r.joursJira.toString().replace('.', ','),
      r.ecartJours.toString().replace('.', ','),
      `"${r.statut}"`
    ]);

    const csvData = '\uFEFF' + [headers.join(';'), ...csvContentRows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `Controle_Absences_Jira_${issueKey}_${annee}${mois ? '_' + mois : ''}.csv`;

    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStatutBadge = (statut: IControleRow['statut']) => {
    switch (statut) {
      case 'CONFORME':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Conforme
          </span>
        );
      case 'NON_SAISI':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={13} /> Non saisi sur Jira
          </span>
        );
      case 'SOUS_SAISIE':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} /> Sous-saisie Jira
          </span>
        );
      case 'SUR_SAISIE':
      case 'SANS_ABSENCE_CSV':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} /> Sur-saisie Jira
          </span>
        );
      default:
        return <span className="badge badge-secondary">{statut}</span>;
    }
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      {/* Title and Controls Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} style={{ color: 'var(--primary-light)' }} /> Contrôle de Saisie Jira vs Intentions CSV
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Vérifiez la conformité des heures saisies dans Jira sur le ticket de congés par rapport au fichier d'intentions. (1 jour = 8h)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={rows.length === 0}>
            <Download size={15} /> Exporter CSV
          </button>
          <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Synchroniser / Rafraîchir
          </button>
        </div>
      </div>

      {/* Filter and Config Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Year selector */}
          <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Année</label>
            <select
              className="form-select"
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month selector */}
          <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Période / Mois</label>
            <select
              className="form-select"
              value={mois || ''}
              onChange={(e) => setMois(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">Toute l'année {annee}</option>
              {MOIS_NOMS.map((nom, idx) => (
                <option key={idx + 1} value={idx + 1}>{nom} {annee}</option>
              ))}
            </select>
          </div>

          {/* Ticket Jira input */}
          <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Ticket Jira Congés
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="form-input"
                value={issueKey}
                onChange={(e) => setIssueKey(e.target.value)}
                placeholder="ex: HP-26"
                style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleSaveIssueKey}
                disabled={savingConfig || issueKey === savedIssueKey}
                title="Enregistrer comme clé par défaut"
                style={{ padding: '6px 12px' }}
              >
                <Settings size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Rechercher collaborateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}
        >
          <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('TOUS')}>
            <div className="kpi-label">Collaborateurs contrôlés</div>
            <div className="kpi-value">{kpis.totalCollaborateurs}</div>
            <div className="kpi-subtext" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Ticket : <strong>{issueKey}</strong>
              <span className={`badge ${isLiveJira ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                {isLiveJira ? '⚡ Jira API Direct' : '💾 Cache BDD'}
              </span>
            </div>
          </div>

          <div
            className="kpi-card"
            style={{
              borderColor: statusFilter === 'CONFORME' ? 'var(--success)' : undefined,
              cursor: 'pointer'
            }}
            onClick={() => setStatusFilter('CONFORME')}
          >
            <div className="kpi-label" style={{ color: 'var(--success)' }}>Conformes 🟢</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpis.totalConformes}</div>
            <div className="kpi-subtext">
              {kpis.totalCollaborateurs > 0
                ? `${Math.round((kpis.totalConformes / kpis.totalCollaborateurs) * 100)}% de conformité`
                : '-'}
            </div>
          </div>

          <div
            className="kpi-card"
            style={{
              borderColor: statusFilter === 'NON_SAISI' ? 'var(--danger)' : undefined,
              cursor: 'pointer'
            }}
            onClick={() => setStatusFilter('NON_SAISI')}
          >
            <div className="kpi-label" style={{ color: 'var(--danger)' }}>Sous-saisies / Manquants 🔴</div>
            <div className="kpi-value" style={{ color: 'var(--danger)' }}>{kpis.totalSousSaisies}</div>
            <div className="kpi-subtext" style={{ color: 'var(--danger)' }}>
              Action de relance requise
            </div>
          </div>

          <div
            className="kpi-card"
            style={{
              borderColor: statusFilter === 'SUR_SAISIE' ? 'var(--warning)' : undefined,
              cursor: 'pointer'
            }}
            onClick={() => setStatusFilter('SUR_SAISIE')}
          >
            <div className="kpi-label" style={{ color: 'var(--warning)' }}>Sur-saisies Jira 🟠</div>
            <div className="kpi-value" style={{ color: 'var(--warning)' }}>{kpis.totalSurSaisies}</div>
            <div className="kpi-subtext" style={{ color: 'var(--warning)' }}>
              Heures Jira {'>'} CSV
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Volume Total Congés</div>
            <div className="kpi-value" style={{ fontSize: '1.35rem' }}>
              {kpis.totalJoursJira} j <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ {kpis.totalJoursCSV} j CSV</span>
            </div>
            <div className="kpi-subtext" style={{ color: kpis.totalEcartJours === 0 ? 'var(--success)' : kpis.totalEcartJours < 0 ? 'var(--danger)' : 'var(--warning)' }}>
              Écart net : {kpis.totalEcartJours > 0 ? `+${kpis.totalEcartJours}` : kpis.totalEcartJours} j
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          className={`btn ${statusFilter === 'TOUS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('TOUS')}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Tous ({rows.length})
        </button>
        <button
          className={`btn ${statusFilter === 'ECARTS' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('ECARTS')}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Écarts uniquement ({rows.filter((r) => r.statut !== 'CONFORME').length})
        </button>
        <button
          className={`btn ${statusFilter === 'CONFORME' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('CONFORME')}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Conformes ({rows.filter((r) => r.statut === 'CONFORME').length})
        </button>
        <button
          className={`btn ${statusFilter === 'NON_SAISI' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setStatusFilter('NON_SAISI')}
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Sous-saisies / Manquants ({rows.filter((r) => r.statut === 'NON_SAISI' || r.statut === 'SOUS_SAISIE').length})
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Analyse du rapprochement en cours...
        </div>
      ) : filteredRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Aucun collaborateur ne correspond aux critères sélectionnés.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Collaborateur</th>
                <th>Rôle / Type</th>
                <th style={{ textAlign: 'right' }}>Prévu CSV</th>
                <th style={{ textAlign: 'right' }}>Heures Jira</th>
                <th style={{ textAlign: 'right' }}>Jours Jira (8h=1j)</th>
                <th style={{ textAlign: 'right' }}>Écart (Jours)</th>
                <th style={{ textAlign: 'center' }}>Statut Conformité</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => {
                const isEcart = r.statut !== 'CONFORME';
                return (
                  <tr
                    key={idx}
                    style={{
                      background: r.statut === 'NON_SAISI'
                        ? 'rgba(239, 68, 68, 0.06)'
                        : r.statut === 'SOUS_SAISIE'
                        ? 'rgba(239, 68, 68, 0.04)'
                        : r.statut === 'SUR_SAISIE' || r.statut === 'SANS_ABSENCE_CSV'
                        ? 'rgba(245, 158, 11, 0.04)'
                        : undefined
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.nom}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Matricule : {r.matricule} {r.jiraAuthorName && r.jiraAuthorName !== r.nom ? `(Jira: "${r.jiraAuthorName}")` : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{r.role}</div>
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {r.joursCSV} j
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {r.heuresJira} h
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary-light)' }}>
                      {r.joursJira} j
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: r.ecartJours === 0
                          ? 'var(--success)'
                          : r.ecartJours < 0
                          ? 'var(--danger)'
                          : 'var(--warning)'
                      }}
                    >
                      {r.ecartJours > 0 ? `+${r.ecartJours}` : r.ecartJours} j
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {renderStatutBadge(r.statut)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
