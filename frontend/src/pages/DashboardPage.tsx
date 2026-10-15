import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  Gauge,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Bell,
  UserCheck,
  Flag,
  Link2,
  Sliders,
  Sparkles,
  Zap,
  Calendar as CalendarIcon
} from 'lucide-react';
import { WorkspaceManager } from '../components/WorkspaceManager';
import { CircularGauge } from '../components/CircularGauge';
import { DashboardVersionsCalendar } from '../components/versions/DashboardVersionsCalendar';
import { MilestoneConfigModal } from '../components/versions/MilestoneConfigModal';
import { VersionTicketsModal } from '../components/versions/VersionTicketsModal';
import { VersionItem } from '../components/versions/types';

interface AlertItem {
  id: string;
  type: 'surcharge' | 'derive_b0_b1' | 'gouvernance' | 'sous_charge' | 'staffing' | 'jalon' | 'dependance';
  severite: 'critique' | 'avertissement' | 'info';
  titre: string;
  message: string;
  details?: {
    projetId?: string;
    projetNom?: string;
    jalonNom?: string;
    jalonType?: 'MEP' | 'UAT' | 'CADRAGE' | 'GONO' | 'AUTRE';
    jalonMois?: number;
    jalonAnnee?: number;
    couleurJalon?: string;
    santeCode?: 'VERT' | 'ORANGE' | 'ROUGE' | 'NC';
    santeProjet?: string;
    priorite?: string;
  };
}

interface ControlTowerData {
  annee: number;
  kpis: {
    totalProjets: number;
    nbB0: number;
    nbB1: number;
    nbNC: number;
    ecartMoyenB0B1Pct: number;
    nbEcartsProjets: number;
    controleAbsencesMois?: {
      mois: number;
      totalCollaborateurs: number;
      totalConformes: number;
      totalAnomalies: number;
      tauxConformitePct: number;
      issueKey: string;
    };
    couvertureChiffrage?: {
      tauxPct: number;
      projetsChiffres: number;
      totalProjets: number;
      nbP0P1NonChiffres: number;
    };
    atterrissageTempoADate?: {
      consommeADate: number;
      planifieADate: number;
      ratioPct: number;
    };
    anticipationDeperditionM1?: {
      mois: number;
      nomMois: string;
      deperditionJours: number;
      tauxPct: number;
    };
    équilibreRunBuild?: {
      pctRUN: number;
      pctBUILD: number;
      totalRUN: number;
      totalBUILD: number;
      pctRUNReel?: number;
      pctBUILDReel?: number;
      totalRUNReel?: number;
      totalBUILDReel?: number;
      categoriesRun?: string[];
    };
    staffingKpis?: {
      tauxCouvertureNominativePct: number;
      tauxCouvertureInternePct: number;
      tauxCouvertureExternePct: number;
      totalAffecteJours: number;
      totalPlanifieJours: number;
      reserveNonAssigneJours: number;
      ecartAffecteTempoJours: number;
      ecartAffecteTempoPct: number;
      consommeTempoMois: number;
      moisCible: number;
      nomMoisCible: string;
    };
  };
  trajectoireStaffing12Mois?: Array<{
    mois: number;
    nomMois: string;
    planifieTotal: number;
    affecteTotal: number;
    affecteInterne: number;
    affecteExterne: number;
    reserveNonAssigne: number;
    consommeTempo: number | null;
  }>;
  repartitionRunBuild: {
    RUN: number;
    BUILD: number;
  };
  repartitionPriorite: {
    P0: number;
    P1: number;
    P2: number;
    P3: number;
    P4: number;
    NC: number;
  };
  moisData: Array<{
    mois: number;
    nomMois: string;
    capaciteNette: {
      interne: number;
      externe: number;
      global: number;
    };
    tauxOccupation: {
      interne: number;
      externe: number;
      global: number;
    };
    charges: {
      interne: any;
      externe: any;
      global: any;
    };
  }>;
}

const COLORS_RUN_BUILD = ['#38bdf8', '#fbbf24']; // RUN = Sky Blue, BUILD = Amber/Gold
const COLORS_PRIORITES: { [key: string]: string } = {
  P0: '#ef4444', // Rouge Critique
  P1: '#f97316', // Orange Élevée
  P2: '#fbbf24', // Jaune Normale
  P3: '#3b82f6', // Bleu Basse
  P4: '#8b5cf6', // Violet Optionnelle
  NC: '#64748b'  // Gris NC
};

const COLORS_STACK: { [key: string]: string } = {
  RUN: '#0284c7',   // Darker Sky
  P0: '#ef4444',    // Red
  P1: '#f97316',    // Orange
  P2: '#eab308',    // Amber
  P3: '#3b82f6',    // Blue
  P4: '#8b5cf6',    // Purple
  Autres: '#64748b' // Slate/Gray
};

interface DashboardPageProps {
  onNavigateWithFilter?: (targetTab: string, params: { priorite?: string; b0b1?: string }) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateWithFilter }) => {
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [mois, setMois] = useState<number | undefined>(undefined);
  const [trimestre, setTrimestre] = useState<number | undefined>(undefined);
  const [population, setPopulation] = useState<'global' | 'interne' | 'externe'>('global');
  const [data, setData] = useState<ControlTowerData | null>(null);
  const [alertes, setAlertes] = useState<AlertItem[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCockpitTab, setActiveCockpitTab] = useState<'cockpit' | 'capacite' | 'alertes' | 'jalons'>('cockpit');
  const [selectedVersionForMilestones, setSelectedVersionForMilestones] = useState<VersionItem | null>(null);
  const [selectedVersionForTickets, setSelectedVersionForTickets] = useState<VersionItem | null>(null);
  const [calendarToastMessage, setCalendarToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState<number>(0);

  const showCalendarToast = (text: string, type: 'success' | 'error' = 'success') => {
    setCalendarToastMessage({ text, type });
    setTimeout(() => setCalendarToastMessage(null), 3500);
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const fetchDashboardData = (anneeTarget: number, moisTarget?: number, trimestreTarget?: number) => {
    setLoading(true);
    let controlTowerUrl = `/api/dashboard/control-tower?annee=${anneeTarget}`;
    if (trimestreTarget) {
      controlTowerUrl += `&trimestre=${trimestreTarget}`;
    } else if (moisTarget) {
      controlTowerUrl += `&mois=${moisTarget}`;
    }

    Promise.all([
      fetch(controlTowerUrl).then((r) => r.json()),
      fetch(`/api/dashboard/alertes?annee=${anneeTarget}`).then((r) => r.json())
    ])
      .then(([resData, alertesData]) => {
        setData(resData);
        setAlertes(alertesData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement dashboard control tower:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData(annee, mois, trimestre);
  }, [annee, mois, trimestre]);

  if (loading || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Chargement du Tableau de bord (Control Tower)...
      </div>
    );
  }

  // Préparation données histogramme empilé (adapté selon année entière, trimestre ou mois)
  const filteredMoisData = data.moisData.filter((m) => {
    if (trimestre) {
      const debutQ = (trimestre - 1) * 3 + 1;
      return m.mois >= debutQ && m.mois <= debutQ + 2;
    }
    if (mois) {
      return m.mois === mois;
    }
    return true;
  });

  const stackedChartData = filteredMoisData.map((m) => {
    const ch = m.charges[population];
    const capNette = m.capaciteNette[population];
    const totalCharge = ch.total;
    const depassement = totalCharge > capNette ? Number((totalCharge - capNette).toFixed(1)) : 0;

    return {
      nomMois: m.nomMois.substring(0, 4), // Ex: Janv
      RUN: ch.RUN,
      P0: ch.P0,
      P1: ch.P1,
      P2: ch.P2,
      P3: ch.P3,
      P4: ch.P4,
      Autres: ch.Autres,
      capaciteNette: capNette,
      totalCharge,
      depassement
    };
  });

  // Camembert RUN vs BUILD
  const pieRunBuildData = [
    { name: 'RUN', value: data.repartitionRunBuild.RUN },
    { name: 'BUILD (Projets)', value: data.repartitionRunBuild.BUILD }
  ];

  // Camembert Priorités (hors RUN)
  const piePrioritesData = [
    { name: 'P0 - Critique', value: data.repartitionPriorite.P0, color: COLORS_PRIORITES.P0 },
    { name: 'P1 - Élevée', value: data.repartitionPriorite.P1, color: COLORS_PRIORITES.P1 },
    { name: 'P2 - Normale', value: data.repartitionPriorite.P2, color: COLORS_PRIORITES.P2 },
    { name: 'P3 - Basse', value: data.repartitionPriorite.P3, color: COLORS_PRIORITES.P3 },
    { name: 'P4 - Optionnelle', value: data.repartitionPriorite.P4, color: COLORS_PRIORITES.P4 },
    { name: 'Non renseigné (NC)', value: data.repartitionPriorite.NC, color: COLORS_PRIORITES.NC }
  ].filter((item) => item.value > 0);

  // Helper badge couleur jauges
  const getGaugeBadgeClass = (taux: number) => {
    if (taux < 90) return 'badge-success'; // Vert
    if (taux <= 100) return 'badge-warning'; // Orange
    return 'badge-danger'; // Rouge > 100%
  };

  const getGaugeColor = (taux: number) => {
    if (taux < 90) return 'var(--success)';
    if (taux <= 100) return '#fbbf24';
    return '#ef4444';
  };

  const activeAlerts = alertes.filter((al) => !dismissedAlertIds.has(al.id));

  const handleDismissAlert = (id: string) => {
    setDismissedAlertIds((prev) => new Set(prev).add(id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Cockpit Header & Unified Temporal Bar */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '22px 28px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderColor: 'rgba(6, 182, 212, 0.25)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), 0 0 20px rgba(6, 182, 212, 0.08)',
          position: 'relative',
          zIndex: 100
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.2) 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(6, 182, 212, 0.25)'
                }}
              >
                <LayoutDashboard style={{ color: '#38bdf8' }} size={20} />
              </div>
              <div>
                <h1 className="page-title" style={{ margin: 0, fontSize: '1.65rem' }}>
                  Tableau de Bord — Control Tower
                </h1>
                <p className="page-subtitle" style={{ margin: '2px 0 0 0', fontSize: '0.84rem' }}>
                  Cockpit de pilotage capacitif macro, gouvernance stratégique et atterrissage Tempo.
                </p>
              </div>
            </div>
          </div>

          {/* Contrôles & Filtres Rapides */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Workspaces */}
            <WorkspaceManager
              storageKey="dashboard"
              currentFilters={{
                annee,
                mois,
                population
              }}
              defaultFilters={{
                annee: new Date().getFullYear(),
                mois: undefined,
                population: 'global'
              }}
              onApplyFilters={(f) => {
                if (f.annee !== undefined) setAnnee(f.annee);
                setMois(f.mois);
                if (f.population !== undefined) setPopulation(f.population as 'global' | 'interne' | 'externe');
              }}
              systemPresets={[
                {
                  id: 'sys_annee_complete',
                  name: `Vue Globale Annuelle (${annee})`,
                  icon: '🌍',
                  description: 'Synthèse macro sur les 12 mois complets',
                  filters: {
                    annee,
                    mois: undefined,
                    population: 'global'
                  }
                },
                {
                  id: 'sys_internes_annee',
                  name: 'Capacité Internes Seuls',
                  icon: '🏛️',
                  description: 'Pilotage de la production des effectifs permanents',
                  filters: {
                    annee,
                    mois: undefined,
                    population: 'interne'
                  }
                },
                {
                  id: 'sys_mois_courant',
                  name: `Focus Mois Courant (${new Date().toLocaleDateString('fr-FR', { month: 'long' })})`,
                  icon: '🎯',
                  description: 'Zoom opérationnel sur le mois en cours',
                  filters: {
                    annee: new Date().getFullYear(),
                    mois: new Date().getMonth() + 1,
                    population: 'global'
                  }
                }
              ]}
            />

            {/* Sélecteur de population (Global / Interne / Externe) */}
            <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                className={`btn ${population === 'global' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem', border: 'none' }}
                onClick={() => setPopulation('global')}
              >
                Cumul Global
              </button>
              <button
                className={`btn ${population === 'interne' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem', border: 'none' }}
                onClick={() => setPopulation('interne')}
              >
                Internes
              </button>
              <button
                className={`btn ${population === 'externe' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem', border: 'none' }}
                onClick={() => setPopulation('externe')}
              >
                Externes
              </button>
            </div>

            {/* Sélecteur d'année */}
            <select
              className="form-select"
              style={{ width: '92px', padding: '6px 10px', fontSize: '0.84rem', fontFamily: 'var(--font-mono)' }}
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            {/* Sélecteur de Mois */}
            <select
              className="form-select"
              style={{ width: '150px', padding: '6px 10px', fontSize: '0.84rem' }}
              value={trimestre ? `Q${trimestre}` : (mois || '')}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setMois(undefined);
                  setTrimestre(undefined);
                } else if (val.startsWith('Q')) {
                  setMois(undefined);
                  setTrimestre(Number(val.replace('Q', '')));
                } else {
                  setTrimestre(undefined);
                  setMois(Number(val));
                }
              }}
            >
              <option value="">Année entière</option>
              <optgroup label="Trimestres">
                <option value="Q1">Q1 (Janvier - Mars)</option>
                <option value="Q2">Q2 (Avril - Juin)</option>
                <option value="Q3">Q3 (Juillet - Septembre)</option>
                <option value="Q4">Q4 (Octobre - Décembre)</option>
              </optgroup>
              <optgroup label="Mois individuels">
                {[
                  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                ].map((nomM, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {nomM}
                  </option>
                ))}
              </optgroup>
            </select>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => fetchDashboardData(annee, mois, trimestre)}
              title="Recharger les données de la Control Tower"
            >
              <RefreshCw size={14} /> Rafraîchir
            </button>
          </div>
        </div>

        {/* Raccourcis temporels en un clic (Année, Mois en cours, Trimestres) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Raccourcis :
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '3px 9px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              borderColor: mois === undefined && trimestre === undefined ? 'var(--primary)' : undefined,
              color: mois === undefined && trimestre === undefined ? 'var(--primary)' : undefined,
              background: mois === undefined && trimestre === undefined ? 'var(--primary-glow)' : undefined
            }}
            onClick={() => {
              setMois(undefined);
              setTrimestre(undefined);
            }}
          >
            Année {annee}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '3px 9px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              borderColor: mois === new Date().getMonth() + 1 && trimestre === undefined ? 'var(--primary)' : undefined,
              color: mois === new Date().getMonth() + 1 && trimestre === undefined ? 'var(--primary)' : undefined,
              background: mois === new Date().getMonth() + 1 && trimestre === undefined ? 'var(--primary-glow)' : undefined
            }}
            onClick={() => {
              setTrimestre(undefined);
              setMois(new Date().getMonth() + 1);
            }}
          >
            ⚡ Mois en cours ({new Date().toLocaleDateString('fr-FR', { month: 'short' })})
          </button>
          {[
            { num: 1, label: 'Q1 (Jan-Mar)' },
            { num: 2, label: 'Q2 (Avr-Juin)' },
            { num: 3, label: 'Q3 (Juil-Sep)' },
            { num: 4, label: 'Q4 (Oct-Déc)' }
          ].map((q) => {
            const isQActive = trimestre === q.num;
            return (
              <button
                key={q.label}
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '3px 9px',
                  fontSize: '0.74rem',
                  borderRadius: '6px',
                  borderColor: isQActive ? 'var(--primary)' : undefined,
                  color: isQActive ? 'var(--primary)' : undefined,
                  background: isQActive ? 'var(--primary-glow)' : undefined,
                  fontWeight: isQActive ? 700 : 500
                }}
                onClick={() => {
                  setMois(undefined);
                  setTrimestre(q.num);
                }}
                title={`Afficher le trimestre complet ${q.label}`}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Cockpit Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          width: 'fit-content',
          marginTop: '6px',
          marginBottom: '20px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
        }}
      >
        <button
          type="button"
          className={`btn ${activeCockpitTab === 'cockpit' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '8px 18px',
            fontSize: '0.88rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeCockpitTab === 'cockpit' ? 600 : 500
          }}
          onClick={() => setActiveCockpitTab('cockpit')}
        >
          <BarChart3 size={16} />
          <span>Vue d'Ensemble & KPIs</span>
        </button>

        <button
          type="button"
          className={`btn ${activeCockpitTab === 'capacite' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '8px 18px',
            fontSize: '0.88rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeCockpitTab === 'capacite' ? 600 : 500
          }}
          onClick={() => setActiveCockpitTab('capacite')}
        >
          <Gauge size={16} />
          <span>Jauges & Trajectoires 12M</span>
        </button>

        <button
          type="button"
          className={`btn ${activeCockpitTab === 'alertes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '8px 18px',
            fontSize: '0.88rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeCockpitTab === 'alertes' ? 600 : 500
          }}
          onClick={() => setActiveCockpitTab('alertes')}
        >
          <Bell size={16} />
          <span>Hub Alertes & Gouvernance</span>
          {activeAlerts.length > 0 && (
            <span
              style={{
                marginLeft: '4px',
                padding: '2px 7px',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: activeCockpitTab === 'alertes' ? '#ffffff' : '#ef4444',
                color: activeCockpitTab === 'alertes' ? '#ef4444' : '#ffffff'
              }}
            >
              {activeAlerts.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`btn ${activeCockpitTab === 'jalons' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '8px 18px',
            fontSize: '0.88rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeCockpitTab === 'jalons' ? 600 : 500
          }}
          onClick={() => setActiveCockpitTab('jalons')}
        >
          <CalendarIcon size={16} />
          <span>Calendrier des Jalons</span>
        </button>
      </div>

      {/* 3. CONTENU DE L'ONGLET 1 : VUE D'ENSEMBLE & KPIS COCKPIT */}
      {activeCockpitTab === 'cockpit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Cartes KPI Principales (Grille Rehaussée avec Mini-Jauges Circulaires) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px'
            }}
          >
            {/* KPI 1 : Total Projets */}
            <div className="cockpit-kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Portefeuille Global
                  </span>
                  <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-heading)', color: '#ffffff' }}>
                    {data.kpis.totalProjets} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>projets</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Référencés dans CartOMC
                  </div>
                </div>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(56, 189, 248, 0.25)'
                  }}
                >
                  <FolderKanban size={20} style={{ color: '#38bdf8' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '14px', flexWrap: 'wrap' }}>
                <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>B0 : {data.kpis.nbB0}</span>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>B1 : {data.kpis.nbB1}</span>
                <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>NC : {data.kpis.nbNC}</span>
              </div>
            </div>

            {/* KPI 2 : Couverture Nominative Staffing (avec Circular Gauge) */}
            {data.kpis.staffingKpis && (
              <div
                className="cockpit-kpi-card"
                style={{
                  cursor: onNavigateWithFilter ? 'pointer' : 'default',
                  borderColor: 'rgba(6, 182, 212, 0.35)'
                }}
                onClick={() => onNavigateWithFilter && onNavigateWithFilter('ressources', {})}
                title="Cliquer pour accéder au pilotage du Staffing"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Couverture Nominative
                    </span>
                    <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-heading)', color: '#38bdf8' }}>
                      {data.kpis.staffingKpis.tauxCouvertureNominativePct}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {data.kpis.staffingKpis.totalAffecteJours}j staffés sur {data.kpis.staffingKpis.totalPlanifieJours}j
                    </div>
                  </div>
                  <CircularGauge
                    value={data.kpis.staffingKpis.tauxCouvertureNominativePct}
                    color="#06b6d4"
                    size={64}
                    strokeWidth={6}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                  <span>Réservoir : <strong style={{ color: '#fbbf24' }}>{data.kpis.staffingKpis.reserveNonAssigneJours}j</strong></span>
                  <span>Internes : {data.kpis.staffingKpis.tauxCouvertureInternePct}%</span>
                </div>
              </div>
            )}

            {/* KPI 3 : Maturité Chiffrage (B0 / B1) (avec Circular Gauge) */}
            {data.kpis.couvertureChiffrage && (
              <div
                className="cockpit-kpi-card"
                style={{
                  cursor: onNavigateWithFilter ? 'pointer' : 'default',
                  borderColor: 'rgba(168, 85, 247, 0.3)'
                }}
                onClick={() => onNavigateWithFilter && onNavigateWithFilter('projets', {})}
                title="Cliquer pour voir les projets"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Maturité Chiffrage
                    </span>
                    <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-heading)', color: '#c084fc' }}>
                      {data.kpis.couvertureChiffrage.tauxPct}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {data.kpis.couvertureChiffrage.projetsChiffres} / {data.kpis.couvertureChiffrage.totalProjets} projets chiffrés
                    </div>
                  </div>
                  <CircularGauge
                    value={data.kpis.couvertureChiffrage.tauxPct}
                    color="#a855f7"
                    size={64}
                    strokeWidth={6}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                  {data.kpis.couvertureChiffrage.nbP0P1NonChiffres > 0 ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>⚠️ {data.kpis.couvertureChiffrage.nbP0P1NonChiffres} P0/P1 non chiffré(s)</span>
                  ) : (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>🟢 Cadrage P0/P1 OK</span>
                  )}
                  <span style={{ color: 'var(--text-muted)' }}>Écart moy : {data.kpis.ecartMoyenB0B1Pct}%</span>
                </div>
              </div>
            )}

            {/* KPI 4 : Consommation Tempo Réel à Date */}
            {data.kpis.atterrissageTempoADate && (
              <div
                className="cockpit-kpi-card"
                style={{
                  cursor: onNavigateWithFilter ? 'pointer' : 'default',
                  borderColor: data.kpis.atterrissageTempoADate.ratioPct > 110 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.3)'
                }}
                onClick={() => onNavigateWithFilter && onNavigateWithFilter('tempo', {})}
                title="Cliquer pour accéder aux extractions Tempo"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Atterrissage Tempo
                    </span>
                    <div
                      style={{
                        fontSize: '1.9rem',
                        fontWeight: 800,
                        marginTop: '4px',
                        fontFamily: 'var(--font-heading)',
                        color: data.kpis.atterrissageTempoADate.ratioPct > 110 ? '#f87171' : '#34d399'
                      }}
                    >
                      {data.kpis.atterrissageTempoADate.ratioPct}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {data.kpis.atterrissageTempoADate.consommeADate}j réels / {data.kpis.atterrissageTempoADate.planifieADate}j prévus
                    </div>
                  </div>
                  <CircularGauge
                    value={data.kpis.atterrissageTempoADate.ratioPct}
                    color={data.kpis.atterrissageTempoADate.ratioPct > 110 ? '#ef4444' : '#10b981'}
                    size={64}
                    strokeWidth={6}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Dérive vs Prévisions</span>
                  <span style={{ fontWeight: 600, color: data.kpis.atterrissageTempoADate.ratioPct > 110 ? 'var(--danger)' : 'var(--success)' }}>
                    {data.kpis.atterrissageTempoADate.ratioPct > 100 ? `+${(data.kpis.atterrissageTempoADate.ratioPct - 100).toFixed(0)}%` : 'Conforme'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Grille Double Volets : Répartition RUN/BUILD & Graphique Empilé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
            {/* Volet Gauche : Équilibre RUN vs BUILD & Priorités */}
            <div className="card" style={{ margin: 0, padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieIcon size={18} style={{ color: '#a855f7' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.96rem' }}>Équilibre Stratégique RUN vs BUILD</span>
                </div>
                <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                  {trimestre ? `Trimestre Q${trimestre} ${annee}` : (mois ? `${new Date(annee, mois - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}` : `Année ${annee}`)}
                </span>
              </div>

              {/* Progress Bar RUN vs BUILD */}
              {data.kpis.équilibreRunBuild && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>🔵 RUN : {data.kpis.équilibreRunBuild.pctRUN}% ({data.kpis.équilibreRunBuild.totalRUN}j)</span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>🟡 BUILD : {data.kpis.équilibreRunBuild.pctBUILD}% ({data.kpis.équilibreRunBuild.totalBUILD}j)</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', borderRadius: '5px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${data.kpis.équilibreRunBuild.pctRUN}%`, background: '#0284c7', transition: 'width 0.8s ease' }} />
                    <div style={{ width: `${data.kpis.équilibreRunBuild.pctBUILD}%`, background: '#f59e0b', transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              )}

              {/* Camemberts Côte à Côte avec Légendes sous chaque graphique */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Camembert 1 : RUN vs BUILD */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: '180px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieRunBuildData}
                          cx="50%"
                          cy="50%"
                          outerRadius={65}
                          innerRadius={38}
                          dataKey="value"
                        >
                          {pieRunBuildData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_RUN_BUILD[index % COLORS_RUN_BUILD.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [`${val} j`, 'Planifié']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Projets RUN / BUILD
                  </div>
                  {/* Légende RUN vs BUILD */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', fontSize: '0.72rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                      <span style={{ color: 'var(--text-muted)' }}>RUN ({data.repartitionRunBuild.RUN}j)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                      <span style={{ color: 'var(--text-muted)' }}>BUILD ({data.repartitionRunBuild.BUILD}j)</span>
                    </div>
                  </div>
                </div>

                {/* Camembert 2 : Priorités P0-P4 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: '180px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={piePrioritesData}
                          cx="50%"
                          cy="50%"
                          outerRadius={65}
                          innerRadius={38}
                          dataKey="value"
                        >
                          {piePrioritesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: any) => [`${val} j`, 'Planifié']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Priorités BUILD
                  </div>
                  {/* Légende Priorités */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', fontSize: '0.7rem' }}>
                    {piePrioritesData.map((p) => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        <span style={{ color: 'var(--text-muted)' }}>{p.name.split(' - ')[0]} ({p.value}j)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Volet Droit : Synthèse Capacité Nette vs Charge Planifiée */}
            <div className="card" style={{ margin: 0, padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={18} style={{ color: '#06b6d4' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.96rem' }}>Charge Planifiée vs Capacité Nette ({population.toUpperCase()})</span>
                </div>
                {/* Légende Capacité Nette (Ligne Verte) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                  <span style={{ width: '14px', height: '2px', background: '#10b981', display: 'inline-block' }} />
                  <span style={{ color: '#34d399', fontWeight: 600 }}>Capacité Nette</span>
                </div>
              </div>

              <div style={{ width: '100%', height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="nomMois" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} unit="j" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      formatter={(val: any, name: any) => [`${val} j`, name]}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '10px', fontSize: '0.75rem' }}
                      iconSize={9}
                      iconType="circle"
                      formatter={(value) => <span style={{ color: 'var(--text-main)', marginRight: '8px' }}>{value}</span>}
                    />
                    <Bar dataKey="RUN" name="RUN" stackId="a" fill={COLORS_STACK.RUN} />
                    <Bar dataKey="P0" name="P0 (Critique)" stackId="a" fill={COLORS_STACK.P0} />
                    <Bar dataKey="P1" name="P1 (Élevée)" stackId="a" fill={COLORS_STACK.P1} />
                    <Bar dataKey="P2" name="P2 (Normale)" stackId="a" fill={COLORS_STACK.P2} />
                    <Bar dataKey="P3" name="P3 (Basse)" stackId="a" fill={COLORS_STACK.P3} />
                    <Bar dataKey="P4" name="P4 (Optionnelle)" stackId="a" fill={COLORS_STACK.P4} />
                    <ReferenceLine y={stackedChartData[0]?.capaciteNette || 0} stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Calendrier dynamique des Jalons attendus des versions */}
          <DashboardVersionsCalendar
            annee={annee}
            mois={mois}
            trimestre={trimestre}
            onSelectMois={(m) => setMois(m)}
            onConfigureMilestones={(v) => setSelectedVersionForMilestones(v)}
            onViewTickets={(v) => setSelectedVersionForTickets(v)}
          />
        </div>
      )}

      {/* 4. CONTENU DE L'ONGLET 2 : JAUGES DE CHARGE & TRAJECTOIRES 12 MOIS */}
      {activeCockpitTab === 'capacite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Grille Jauges Mensuelles */}
          <div className="card" style={{ margin: 0, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gauge size={18} style={{ color: '#06b6d4' }} />
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Jauges de Charge Mensuelles (Taux d'Occupation = Charge / Capacité Nette)</span>
              </div>
              <span className="badge badge-primary" style={{ fontSize: '0.78rem' }}>
                Population : {population.toUpperCase()}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px'
              }}
            >
              {data.moisData.map((m) => {
                const taux = m.tauxOccupation[population];
                const capNette = m.capaciteNette[population];
                const charge = m.charges[population].total;

                return (
                  <div
                    key={m.mois}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: `1px solid ${taux > 100 ? 'rgba(239, 68, 68, 0.45)' : 'var(--border-color)'}`,
                      borderRadius: '10px',
                      padding: '12px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      boxShadow: taux > 100 ? '0 0 14px rgba(239, 68, 68, 0.2)' : 'none',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {m.nomMois}
                    </div>

                    <span
                      className={`badge ${getGaugeBadgeClass(taux)}`}
                      style={{ fontSize: '0.9rem', fontWeight: 800, padding: '3px 8px', marginBottom: '8px' }}
                    >
                      {taux}%
                    </span>

                    <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: `${Math.min(100, taux)}%`,
                          height: '100%',
                          background: getGaugeColor(taux),
                          boxShadow: `0 0 8px ${getGaugeColor(taux)}`
                        }}
                      />
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Charge : <strong style={{ color: 'var(--text-main)' }}>{charge}j</strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Capacité : <strong>{capNette}j</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trajectoire Staffing 3 Volets */}
          {data.trajectoireStaffing12Mois && (
            <div className="card" style={{ margin: 0, padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} style={{ color: '#06b6d4' }} />
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>Trajectoire de Staffing Mensuelle : Planifié Total vs Affecté Nominatif vs Consommé Tempo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                  <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }}></span> Planifié
                  </span>
                  <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4' }}></span> Staffé
                  </span>
                  <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span> Tempo (Réel)
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: '340px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trajectoireStaffing12Mois} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="nomMois" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} unit="j" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                      formatter={(val: any, name: any) => [`${val !== null ? `${val} j` : 'Non échu'}`, name]}
                    />
                    <Bar dataKey="planifieTotal" fill="#64748b" name="Planifié Total Projets" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="affecteTotal" fill="#06b6d4" name="Staffé Nominatif" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="consommeTempo" fill="#f59e0b" name="Consommé Réel Tempo" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. CONTENU DE L'ONGLET 3 : HUB D'ALERTES & GOUVERNANCE */}
      {activeCockpitTab === 'alertes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(() => {
            const surcharges = activeAlerts.filter((a) => a.type === 'surcharge');
            const derives = activeAlerts.filter((a) => a.type === 'derive_b0_b1');
            const gouvernance = activeAlerts.filter((a) => a.type === 'gouvernance');
            const sousCharges = activeAlerts.filter((a) => a.type === 'sous_charge');
            const staffing = activeAlerts.filter((a) => a.type === 'staffing');
            const jalons = activeAlerts.filter((a) => a.type === 'jalon');
            const dependances = activeAlerts.filter((a) => a.type === 'dependance');

            const categories = [
              {
                id: 'dependance',
                titre: 'Conflits & Tensions de Dépendance',
                items: dependances,
                severite: 'critique' as const,
                icon: Link2,
                badgeColor: '#f43f5e',
                bg: 'rgba(244, 63, 94, 0.12)',
                border: 'rgba(244, 63, 94, 0.3)',
                targetTab: 'timeline'
              },
              {
                id: 'jalon',
                titre: 'Jalons Clés & Milestones Imminents (J-30)',
                items: jalons,
                severite: 'avertissement' as const,
                icon: Flag,
                badgeColor: '#ec4899',
                bg: 'rgba(236, 72, 153, 0.12)',
                border: 'rgba(236, 72, 153, 0.3)',
                targetTab: 'timeline'
              },
              {
                id: 'staffing',
                titre: 'Staffing & Anomalies d\'Affectation',
                items: staffing,
                severite: 'critique' as const,
                icon: Users,
                badgeColor: '#a855f7',
                bg: 'rgba(168, 85, 247, 0.12)',
                border: 'rgba(168, 85, 247, 0.3)',
                targetTab: 'ressources'
              },
              {
                id: 'surcharge',
                titre: 'Surcharges Capacitives Mensuelles',
                items: surcharges,
                severite: 'critique' as const,
                icon: AlertCircle,
                badgeColor: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.12)',
                border: 'rgba(239, 68, 68, 0.3)',
                targetTab: 'timeline'
              },
              {
                id: 'derive_b0_b1',
                titre: 'Dérives & Santé B0/B1',
                items: derives,
                severite: 'avertissement' as const,
                icon: AlertTriangle,
                badgeColor: '#f97316',
                bg: 'rgba(249, 115, 22, 0.12)',
                border: 'rgba(249, 115, 22, 0.3)',
                targetTab: 'projets'
              },
              {
                id: 'gouvernance',
                titre: 'Gouvernance & Priorités P0',
                items: gouvernance,
                severite: 'avertissement' as const,
                icon: AlertTriangle,
                badgeColor: '#fbbf24',
                bg: 'rgba(245, 158, 11, 0.12)',
                border: 'rgba(245, 158, 11, 0.3)',
                targetTab: 'projets',
                filterParams: { priorite: 'P0' }
              },
              {
                id: 'sous_charge',
                titre: 'Sous-charges & Opportunités',
                items: sousCharges,
                severite: 'info' as const,
                icon: Info,
                badgeColor: '#3b82f6',
                bg: 'rgba(59, 130, 246, 0.12)',
                border: 'rgba(59, 130, 246, 0.3)',
                targetTab: 'projets'
              }
            ].filter((cat) => cat.items.length > 0);

            if (categories.length === 0) {
              return (
                <div className="card" style={{ textAlign: 'center', padding: '48px 24px', margin: 0 }}>
                  <CheckCircle2 size={42} style={{ color: 'var(--success)', marginBottom: '12px' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Aucune alerte active sur le portefeuille</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                    Toutes les capacités, jalons et staffing sont actuellement sous contrôle pour l'année {annee}.
                  </p>
                </div>
              );
            }

            return (
              <div className="card" style={{ margin: 0, padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Bell size={20} style={{ color: 'var(--warning)' }} />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                      Hub d'Alertes Proactives ({activeAlerts.length} alerte{activeAlerts.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Réparties en {categories.length} catégorie(s)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {categories.map((cat) => {
                    const isExpanded = expandedCategories.has(cat.id);
                    const IconComp = cat.icon;

                    return (
                      <div
                        key={cat.id}
                        style={{
                          background: cat.bg,
                          border: `1px solid ${cat.border}`,
                          borderRadius: '10px',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => toggleCategory(cat.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <IconComp size={18} style={{ color: cat.badgeColor }} />
                            <strong style={{ fontSize: '0.92rem' }}>{cat.titre}</strong>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: cat.badgeColor,
                                color: '#ffffff',
                                fontSize: '0.74rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 800
                              }}
                            >
                              {cat.items.length}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {isExpanded ? 'Réduire' : 'Déplier le détail'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                            ) : (
                              <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div
                            style={{
                              borderTop: `1px solid ${cat.border}`,
                              padding: '10px 16px 14px 16px',
                              background: 'rgba(15, 23, 42, 0.45)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            {cat.items.map((al) => (
                              <div
                                key={al.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  fontSize: '0.84rem'
                                }}
                              >
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <strong style={{ color: cat.badgeColor }}>{al.titre}</strong>
                                    {al.type === 'jalon' && al.details?.santeCode && (
                                      <span
                                        className="badge"
                                        style={{
                                          fontSize: '0.7rem',
                                          padding: '1px 6px',
                                          background: al.details.santeCode === 'ROUGE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                          color: al.details.santeCode === 'ROUGE' ? '#ef4444' : '#f59e0b'
                                        }}
                                      >
                                        Santé : {al.details.santeCode}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <span style={{ color: 'var(--text-main)' }}>{al.message}</span>
                                    {onNavigateWithFilter && (
                                      <span
                                        style={{
                                          fontSize: '0.76rem',
                                          color: '#38bdf8',
                                          cursor: 'pointer',
                                          textDecoration: 'underline',
                                          fontWeight: 600
                                        }}
                                        onClick={() => onNavigateWithFilter(cat.targetTab, cat.filterParams || {})}
                                      >
                                        Voir sur le Gantt ➔
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 6px', border: 'none', background: 'transparent' }}
                                  title="Masquer cette alerte"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismissAlert(al.id);
                                  }}
                                >
                                  <X size={15} style={{ color: 'var(--text-muted)' }} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 6. CONTENU DE L'ONGLET 4 : CALENDRIER DES JALONS DE VERSIONS */}
      {activeCockpitTab === 'jalons' && (
        <DashboardVersionsCalendar
          annee={annee}
          mois={mois}
          trimestre={trimestre}
          refreshTrigger={calendarRefreshKey}
          onSelectMois={(m) => setMois(m)}
          onConfigureMilestones={(v) => setSelectedVersionForMilestones(v)}
          onViewTickets={(v) => setSelectedVersionForTickets(v)}
        />
      )}

      {/* Modale Paramétrage des Jalons d'une Version */}
      <MilestoneConfigModal
        version={selectedVersionForMilestones}
        isOpen={Boolean(selectedVersionForMilestones)}
        onClose={() => setSelectedVersionForMilestones(null)}
        onSave={async (versionId, jalonData) => {
          const res = await fetch(`/api/versions/${versionId}/milestones`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jalonData)
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Erreur lors de la mise à jour des jalons');
          }
          showCalendarToast('Jalons de la version mis à jour avec succès !');
          setSelectedVersionForMilestones(null);
          setCalendarRefreshKey((k) => k + 1);
          // Forcer le rechargement
          fetchDashboardData(annee, mois);
        }}
        onReset={async (versionId) => {
          const res = await fetch(`/api/versions/${versionId}/milestones`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Erreur lors de la suppression des jalons');
          }
          showCalendarToast('Jalons réinitialisés');
          setSelectedVersionForMilestones(null);
          setCalendarRefreshKey((k) => k + 1);
          fetchDashboardData(annee, mois);
        }}
      />

      {/* Modale de Détail des Tickets d'une Version */}
      <VersionTicketsModal
        version={selectedVersionForTickets}
        isOpen={Boolean(selectedVersionForTickets)}
        onClose={() => setSelectedVersionForTickets(null)}
      />

      {/* Toast Notification pour les actions sur jalons */}
      {calendarToastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            backgroundColor: calendarToastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
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
          {calendarToastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{calendarToastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
