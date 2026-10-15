import React, { useState, useEffect } from 'react';
import { VersionItem } from './types';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import {
  TrendingUp,
  Flame,
  Gauge,
  Clock,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  SlidersHorizontal,
  GitCommit,
  Timer,
  AlertOctagon,
  ListFilter,
  Crosshair,
  ExternalLink,
  Users,
  UserCheck,
  Milestone,
  GitPullRequest,
  ArrowDownRight,
  ArrowUpRight,
  Scale
} from 'lucide-react';

interface VelocityItem {
  _id: string;
  versionName: string;
  released: boolean;
  dateMEP?: string | null;
  estimatedDays: number;
  actualDays: number;
  deliveredDays: number;
  ticketCount: number;
}

interface VelocityReportResponse {
  projectKey: string;
  averageVelocityDays: number;
  versions: VelocityItem[];
}

interface BurnupPoint {
  week: string;
  scopeDays: number;
  actualDays: number | null;
  idealDays: number;
}

interface BurnupReportResponse {
  version: VersionItem;
  summary: {
    totalEstimatedDays: number;
    totalActualDays: number;
    remainingEstimatedDays: number;
    driftRatio: number;
    ticketCount: number;
  };
  timeSeries: BurnupPoint[];
}

interface StageAverage {
  stage: string;
  label: string;
  color: string;
  averageDays: number;
  totalDays: number;
  ticketCount: number;
}

interface TicketLifecycleItem {
  key: string;
  summary: string;
  collaborator: string;
  finalStatus: string;
  ticketLink?: string;
  estimatedDays: number;
  actualDays: number;
  diffDays: number;
  diffRatio: number;
  totalEffortDays: number;
  calendarDurationDays: number;
  breakdown: {
    todo: number;
    inprogress: number;
    review: number;
    qa: number;
    blocked: number;
    done: number;
  };
  firstDate?: string | Date;
  lastDate?: string | Date;
}

interface CFDPoint {
  week: string;
  todo: number;
  inProgress: number;
  review: number;
  qa: number;
  blocked: number;
  done: number;
}

interface StaffingItem {
  collaborator: string;
  type: 'Interne' | 'Externe';
  role: string;
  days: number;
  ticketCount: number;
}

interface ScopeCreepPoint {
  week: string;
  addedTickets: number;
  addedDays: number;
  completedTickets: number;
  completedDays: number;
  cumulativeScopeTickets: number;
  cumulativeScopeDays: number;
  cumulativeDoneTickets: number;
  cumulativeDoneDays: number;
}

interface CapacityVsDemand {
  workingDaysCount: number;
  activeContributorsCount: number;
  teamNetCapacityDays: number;
  totalEstimatedCharge: number;
  totalActualCharge: number;
  feasibilityRatio: number;
  actualConsumptionRatio: number;
  status: 'surcharge' | 'tendu' | 'conforme';
}

interface MilestoneDriftItem {
  key: string;
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  driftDays: number | null;
  driftStatus: 'ahead' | 'on_time' | 'delayed' | 'not_set';
}

interface TransitionsReportResponse {
  version: VersionItem;
  kpis: {
    ticketCount: number;
    averageCycleTimeDays: number;
    bottleneck: { label: string; days: number } | null;
    blockedAvgDays: number;
  };
  stageAverages: StageAverage[];
  tickets: TicketLifecycleItem[];
  cfdData: CFDPoint[];
  staffingSummary?: {
    totalStaffDays: number;
    daysInterne: number;
    daysExterne: number;
    ratioInterne: number;
    ratioExterne: number;
    staffing: StaffingItem[];
  };
  scopeCreepData?: ScopeCreepPoint[];
  capacityVsDemand?: CapacityVsDemand;
  milestoneDrift?: MilestoneDriftItem[];
}

interface VersionReportsViewProps {
  versions: VersionItem[];
  projectKey?: string;
  onSelectVersion?: (version: VersionItem) => void;
}

export const VersionReportsView: React.FC<VersionReportsViewProps> = ({
  versions,
  projectKey = 'GTEP'
}) => {
  // Sélection de la version courante pour les rapports détaillés
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [burnupData, setBurnupData] = useState<BurnupReportResponse | null>(null);
  const [velocityData, setVelocityData] = useState<VelocityReportResponse | null>(null);
  const [transitionsData, setTransitionsData] = useState<TransitionsReportResponse | null>(null);

  const [isLoadingBurnup, setIsLoadingBurnup] = useState<boolean>(false);
  const [isLoadingVelocity, setIsLoadingVelocity] = useState<boolean>(false);
  const [isLoadingTransitions, setIsLoadingTransitions] = useState<boolean>(false);

  // Sous-mode d'affichage pour la section Évolution & Transitions des tickets
  const [transitionsViewMode, setTransitionsViewMode] = useState<'stageAverages' | 'stackedTickets' | 'cfd' | 'scatterAccuracy'>('stageAverages');

  // Date pivot d'aujourd'hui pour le tri identique à la vue "Cartes"
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayTime = startOfToday.getTime();

  const getMepTimestamp = (v: VersionItem): number | null => {
    const raw = v.dateMEP || v.jiraReleaseDate;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return isNaN(t) ? null : t;
  };

  // Versions triées de la même façon que pour la vue Cartes :
  // Jalon MEP à partir d'aujourd'hui (futures chronologiques d'abord, passées ensuite, sans date en fin)
  const sortedVersions = [...versions].sort((a, b) => {
    const timeA = getMepTimestamp(a);
    const timeB = getMepTimestamp(b);

    if (timeA === null && timeB === null) {
      return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
    }
    if (timeA === null) return 1;
    if (timeB === null) return -1;

    const isAFuture = timeA >= startOfTodayTime;
    const isBFuture = timeB >= startOfTodayTime;

    if (isAFuture && !isBFuture) return -1;
    if (!isAFuture && isBFuture) return 1;

    if (isAFuture && isBFuture) {
      if (timeA !== timeB) return timeA - timeB;
      return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
    }

    if (timeA !== timeB) return timeB - timeA;
    return a.versionName.localeCompare(b.versionName, undefined, { numeric: true });
  });

  // Initialisation avec la première version disponible dans l'ordre de tri
  useEffect(() => {
    if (sortedVersions.length > 0 && !selectedVersionId) {
      // Sélectionner par défaut la première version non publiée (ou la première de la liste triée)
      const defaultVer = sortedVersions.find((v) => !v.released && (v.metrics?.totalTickets || 0) > 0) || sortedVersions[0];
      if (defaultVer) {
        setSelectedVersionId(defaultVer._id);
      }
    }
  }, [sortedVersions, selectedVersionId]);

  // Chargement des données de Vélocité
  const loadVelocityReport = async () => {
    setIsLoadingVelocity(true);
    try {
      const res = await fetch(`/api/versions/reports/velocity?projectKey=${encodeURIComponent(projectKey)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setVelocityData(data);
      }
    } catch (err) {
      console.error('Erreur chargement vélocité:', err);
    } finally {
      setIsLoadingVelocity(false);
    }
  };

  // Chargement du Burnup Chart de la version sélectionnée
  const loadBurnupReport = async (versionId: string) => {
    if (!versionId) return;
    setIsLoadingBurnup(true);
    try {
      const res = await fetch(`/api/versions/${versionId}/burnup`);
      if (res.ok) {
        const data = await res.json();
        setBurnupData(data);
      }
    } catch (err) {
      console.error('Erreur chargement burnup:', err);
    } finally {
      setIsLoadingBurnup(false);
    }
  };

  // Chargement des transitions & temps par statut de la version
  const loadTransitionsReport = async (versionId: string) => {
    if (!versionId) return;
    setIsLoadingTransitions(true);
    try {
      const res = await fetch(`/api/versions/${versionId}/transitions`);
      if (res.ok) {
        const data = await res.json();
        setTransitionsData(data);
      }
    } catch (err) {
      console.error('Erreur chargement transitions:', err);
    } finally {
      setIsLoadingTransitions(false);
    }
  };

  useEffect(() => {
    loadVelocityReport();
  }, [projectKey]);

  useEffect(() => {
    if (selectedVersionId) {
      loadBurnupReport(selectedVersionId);
      loadTransitionsReport(selectedVersionId);
    }
  }, [selectedVersionId]);

  const selectedVersionObj = versions.find((v) => v._id === selectedVersionId) || burnupData?.version;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* En-tête & Barre de Contrôle Globale */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2))',
              color: '#f97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(249, 115, 22, 0.3)'
            }}
          >
            <Flame size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Rapports & Pilotage Capacitif des Versions
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Burnup Chart, Vélocité, Cycle Time par Statut et Diagramme de Flux Cumulé (CFD)
            </p>
          </div>
        </div>

        {/* Sélecteur de Version focus pour les rapports détaillés */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label htmlFor="select-burnup-version" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)' }}>
            Version cible analysée :
          </label>
          <select
            id="select-burnup-version"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            className="form-control"
            style={{
              minWidth: '220px',
              padding: '6px 12px',
              fontSize: '0.88rem',
              fontWeight: 600,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: 'var(--text-main)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}
          >
            {sortedVersions.map((v) => {
              const mepDate = v.dateMEP ? new Date(v.dateMEP).toLocaleDateString('fr-FR') : null;
              return (
                <option key={v._id} value={v._id}>
                  {v.versionName} {!v.released ? '(En cours' : '(Publiée'}
                  {mepDate ? ` - MEP: ${mepDate})` : ')'}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              loadVelocityReport();
              if (selectedVersionId) {
                loadBurnupReport(selectedVersionId);
                loadTransitionsReport(selectedVersionId);
              }
            }}
            title="Rafraîchir les rapports"
            style={{ padding: '6px 12px', height: '36px', gap: '6px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} className={isLoadingBurnup || isLoadingVelocity || isLoadingTransitions ? 'spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* SECTION 1 : BURNUP CHART DE LA VERSION */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Burnup Chart : {selectedVersionObj?.versionName || 'Version'}
              </h4>
              <span
                className={`badge ${selectedVersionObj?.released ? 'badge-success' : 'badge-warning'}`}
                style={{ fontSize: '0.75rem' }}
              >
                {selectedVersionObj?.released ? 'Release Publiée' : 'Release En cours'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Évolution cumulée de l'effort en Jours : Périmètre estimé vs Jours consommés (Tempo) par semaine
            </p>
          </div>

          {/* Mini KPIs du Burnup */}
          {burnupData && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 600 }}>Périmètre Estimé</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#60a5fa' }}>
                  {burnupData.summary.totalEstimatedDays} j
                </div>
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 600 }}>Consommé Réel</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f87171' }}>
                  {burnupData.summary.totalActualDays} j
                </div>
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 600 }}>Reste Estimé</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4ade80' }}>
                  {burnupData.summary.remainingEstimatedDays} j
                </div>
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: burnupData.summary.driftRatio > 10
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(245, 158, 11, 0.12)',
                  border: burnupData.summary.driftRatio > 10
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(245, 158, 11, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: burnupData.summary.driftRatio > 10 ? '#fca5a5' : '#fde68a', fontWeight: 600 }}>
                  Écart / Dérive
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: burnupData.summary.driftRatio > 10 ? '#ef4444' : '#fbbf24' }}>
                  {burnupData.summary.driftRatio > 0 ? `+${burnupData.summary.driftRatio}%` : `${burnupData.summary.driftRatio}%`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Graphique Recharts Burnup */}
        {isLoadingBurnup ? (
          <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Calcul et traçage du Burnup Chart...
          </div>
        ) : !burnupData || burnupData.timeSeries.length === 0 ? (
          <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
            <Layers size={36} color="var(--text-dim)" style={{ marginBottom: '10px' }} />
            <div>Aucun worklog Tempo ou ticket enregistré pour cette version.</div>
          </div>
        ) : (
          <div style={{ width: '100%', height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={burnupData.timeSeries}
                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                <XAxis
                  dataKey="week"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  unit=" j"
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                  formatter={(value: any, name: string) => {
                    const num = value !== null && value !== undefined ? `${value} j` : 'Non échu';
                    if (name === 'scopeDays') return [num, 'Périmètre Estimé (Scope)'];
                    if (name === 'actualDays') return [num, 'Consommé Réel (Tempo)'];
                    if (name === 'idealDays') return [num, 'Trajectoire Idéale'];
                    return [num, name];
                  }}
                  labelFormatter={(label) => `Semaine : ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px' }}
                  formatter={(val) => {
                    if (val === 'scopeDays') return 'Périmètre Estimé (Scope)';
                    if (val === 'actualDays') return 'Consommé Réel (Tempo)';
                    if (val === 'idealDays') return 'Trajectoire Idéale';
                    return val;
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="idealDays"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="idealDays"
                />

                <Line
                  type="stepAfter"
                  dataKey="scopeDays"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#3b82f6' }}
                  name="scopeDays"
                />

                <Line
                  type="monotone"
                  dataKey="actualDays"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#ef4444' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                  name="actualDays"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* SECTION 2 : ÉVOLUTION DES TICKETS & TEMPS DE PASSAGE PAR STATUT */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        {/* En-tête de section avec indicateurs de flux et bascule des 3 visualisations */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Timer size={20} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Évolution des Tickets & Temps de Passage par Statut
              </h4>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Temps moyen passé dans chaque phase, durée par ticket et diagramme de flux cumulé (CFD)
            </p>
          </div>

          {/* Sélecteur des 3 visualisations */}
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={() => setTransitionsViewMode('stageAverages')}
              className={`btn ${transitionsViewMode === 'stageAverages' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
              title="1. Entonnoir : Durée moyenne passée dans chaque statut"
            >
              1. Durée par Statut
            </button>
            <button
              type="button"
              onClick={() => setTransitionsViewMode('stackedTickets')}
              className={`btn ${transitionsViewMode === 'stackedTickets' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
              title="2. Barres empilées : Décomposition par ticket"
            >
              2. Par Ticket
            </button>
            <button
              type="button"
              onClick={() => setTransitionsViewMode('cfd')}
              className={`btn ${transitionsViewMode === 'cfd' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
              title="3. Cumulative Flow Diagram : Répartition globale dans le temps"
            >
              3. Flux Cumulé (CFD)
            </button>
            <button
              type="button"
              onClick={() => setTransitionsViewMode('scatterAccuracy')}
              className={`btn ${transitionsViewMode === 'scatterAccuracy' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
              title="4. Nuage de points : Précision du chiffrage (Estimé vs Consommé Réel)"
            >
              4. Précision Estimations
            </button>
          </div>
        </div>

        {/* KPIs de diagnostic du flux */}
        {transitionsData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '22px' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.25)'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#67e8f9', fontWeight: 600 }}>Cycle Time Moyen</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#06b6d4', marginTop: '2px' }}>
                {transitionsData.kpis.averageCycleTimeDays} <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>j / ticket</span>
              </div>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: transitionsData.kpis.bottleneck ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                border: transitionsData.kpis.bottleneck ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: transitionsData.kpis.bottleneck ? '#fca5a5' : '#86efac', fontWeight: 600 }}>
                Goulot d'Étranglement Principal
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: transitionsData.kpis.bottleneck ? '#f87171' : '#10b981', marginTop: '2px' }}>
                {transitionsData.kpis.bottleneck ? `${transitionsData.kpis.bottleneck.label} (${transitionsData.kpis.bottleneck.days} j)` : 'Aucun goulot'}
              </div>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: transitionsData.kpis.blockedAvgDays > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: transitionsData.kpis.blockedAvgDays > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: transitionsData.kpis.blockedAvgDays > 0 ? '#fca5a5' : 'var(--text-dim)', fontWeight: 600 }}>
                Temps Moyen en Statut Bloqué
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: transitionsData.kpis.blockedAvgDays > 0 ? '#ef4444' : 'var(--text-main)', marginTop: '2px' }}>
                {transitionsData.kpis.blockedAvgDays} <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>j</span>
              </div>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: 600 }}>Tickets Analysés</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#60a5fa', marginTop: '2px' }}>
                {transitionsData.kpis.ticketCount}
              </div>
            </div>
          </div>
        )}

        {/* CONTENU DES 3 VISUALISATIONS */}
        {isLoadingTransitions ? (
          <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Calcul des durées de passage et transitions des tickets...
          </div>
        ) : !transitionsData || transitionsData.tickets.length === 0 ? (
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
            <Layers size={36} color="var(--text-dim)" style={{ marginBottom: '10px' }} />
            <div>Aucun historique de transition pour cette version.</div>
          </div>
        ) : transitionsViewMode === 'stageAverages' ? (
          /* VISUALISATION A : DURÉE MOYENNE PAR STATUT (BARRES HORIZONTALES) */
          <div>
            <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ce graphique indique le <strong>temps moyen en jours/homme</strong> passé par les tickets dans chaque étape du workflow :
            </div>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={transitionsData.stageAverages}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 160, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} horizontal={false} />
                  <XAxis type="number" unit=" j" stroke="#94a3b8" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                    formatter={(value: any, name: string, item: any) => [
                      `${value} j (${item.payload.totalDays}j au total sur ${item.payload.ticketCount} tickets)`,
                      'Temps moyen'
                    ]}
                  />
                  <Bar
                    dataKey="averageDays"
                    radius={[0, 4, 4, 0]}
                    name="Temps moyen par statut"
                    fill="#3b82f6"
                  >
                    {transitionsData.stageAverages.map((entry, index) => (
                      <Bar key={`cell-${index}`} dataKey="averageDays" fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : transitionsViewMode === 'stackedTickets' ? (
          /* VISUALISATION B : PAR TICKET (BARRES EMPILÉES PAR STATUT) */
          <div>
            <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Décomposition du temps passé par statut pour les tickets de la release (classés par effort total décroissant) :
            </div>
            <div style={{ width: '100%', height: `${Math.max(340, Math.min(transitionsData.tickets.length * 36 + 60, 600))}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={transitionsData.tickets.slice(0, 15).map(t => ({
                    key: t.key,
                    summary: t.summary,
                    todo: t.breakdown.todo,
                    inprogress: t.breakdown.inprogress,
                    review: t.breakdown.review,
                    qa: t.breakdown.qa,
                    blocked: t.breakdown.blocked,
                    done: t.breakdown.done
                  }))}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} horizontal={false} />
                  <XAxis type="number" unit=" j" stroke="#94a3b8" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="key"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any, name: string) => {
                      const labels: Record<string, string> = {
                        todo: 'À faire',
                        inprogress: 'En cours (Dév)',
                        review: 'Validation Tech',
                        qa: 'Recette / QA',
                        blocked: 'Bloqué',
                        done: 'Terminé'
                      };
                      return [`${val} j`, labels[name] || name];
                    }}
                    labelFormatter={(key, payload) => {
                      const item = payload?.[0]?.payload;
                      return `${key} : ${item?.summary || ''}`;
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '10px' }}
                    formatter={(val) => {
                      const labels: Record<string, string> = {
                        todo: 'À faire',
                        inprogress: 'En cours',
                        review: 'Validation Tech',
                        qa: 'Recette',
                        blocked: 'Bloqué',
                        done: 'Terminé'
                      };
                      return labels[val] || val;
                    }}
                  />
                  <Bar dataKey="todo" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="inprogress" stackId="a" fill="#fbbf24" />
                  <Bar dataKey="review" stackId="a" fill="#c084fc" />
                  <Bar dataKey="qa" stackId="a" fill="#6366f1" />
                  <Bar dataKey="blocked" stackId="a" fill="#ef4444" />
                  <Bar dataKey="done" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : transitionsViewMode === 'cfd' ? (
          /* VISUALISATION C : CUMULATIVE FLOW DIAGRAM (CFD) */
          <div>
            <div style={{ marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Évolution du volume de tickets par état dans le temps : la largeur horizontale d'une bande indique le délai de traitement de cette étape.
            </div>
            <div style={{ width: '100%', height: '340px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={transitionsData.cfdData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                  <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                    labelFormatter={(w) => `Semaine : ${w}`}
                    formatter={(val: any, name: string) => {
                      const labels: Record<string, string> = {
                        done: 'Terminé / Fini',
                        qa: 'Recette / QA',
                        review: 'Validation Tech',
                        blocked: 'Bloqué',
                        inProgress: 'En cours',
                        todo: 'À faire'
                      };
                      return [`${val} tickets`, labels[name] || name];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px' }}
                    formatter={(val) => {
                      const labels: Record<string, string> = {
                        done: 'Terminé / Fini',
                        qa: 'Recette / QA',
                        review: 'Validation Tech',
                        blocked: 'Bloqué',
                        inProgress: 'En cours',
                        todo: 'À faire'
                      };
                      return labels[val] || val;
                    }}
                  />
                  <Area type="monotone" dataKey="done" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="qa" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="review" stackId="1" stroke="#c084fc" fill="#c084fc" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.8} />
                  <Area type="monotone" dataKey="todo" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          /* VISUALISATION 4 : SCATTER PLOT - PRÉCISION D'ESTIMATION (ESTIMÉ VS RÉEL) */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Comparaison entre l'<strong>estimation initiale</strong> (Axe X) et le <strong>consommé réel Tempo</strong> (Axe Y) :
                <span style={{ marginLeft: '8px', color: '#f87171' }}>● Au-dessus = Sous-estimé (dérive)</span>
                <span style={{ marginLeft: '12px', color: '#60a5fa' }}>● En-dessous = Sur-estimé</span>
                <span style={{ marginLeft: '12px', color: '#10b981' }}>● Diagonale Y=X = Précision exacte</span>
              </div>
            </div>

            {/* Scatter Plot Recharts */}
            {(() => {
              const tickets = transitionsData?.tickets || [];
              const scatterPoints = tickets.map(t => ({
                key: t.key,
                summary: t.summary,
                collaborator: t.collaborator,
                ticketLink: t.ticketLink || `https://jira.aprr.fr/browse/${t.key}`,
                estimatedDays: t.estimatedDays,
                actualDays: t.actualDays,
                diffDays: t.diffDays,
                diffRatio: t.diffRatio,
                // Couleur du point selon la dérive
                fillColor: t.diffDays > 1 ? '#ef4444' : t.diffDays < -1 ? '#3b82f6' : '#10b981'
              }));

              const maxVal = Math.max(
                10,
                ...scatterPoints.map(p => Math.max(p.estimatedDays, p.actualDays))
              );

              // Données pour la ligne diagonale idéale Y = X
              const diagonalPoints = [
                { x: 0, y: 0 },
                { x: maxVal, y: maxVal }
              ];

              return (
                <div>
                  <div style={{ width: '100%', height: '380px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 30, left: 10, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                        <XAxis
                          type="number"
                          dataKey="estimatedDays"
                          name="Estimation initiale"
                          unit=" j"
                          domain={[0, Math.ceil(maxVal * 1.1)]}
                          stroke="#94a3b8"
                          fontSize={12}
                          label={{ value: 'Estimation Initiale (Jours)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 12 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="actualDays"
                          name="Temps Réel Consommé"
                          unit=" j"
                          domain={[0, Math.ceil(maxVal * 1.1)]}
                          stroke="#94a3b8"
                          fontSize={12}
                          label={{ value: 'Consommé Réel Tempo (Jours)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 12 }}
                        />
                        <ZAxis range={[70, 70]} />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3', stroke: '#64748b' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div
                                style={{
                                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                  border: '1px solid #334155',
                                  borderRadius: '8px',
                                  padding: '12px 14px',
                                  color: '#f8fafc',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                  fontSize: '0.84rem',
                                  maxWidth: '320px',
                                  pointerEvents: 'auto'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <a
                                    href={data.ticketLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontWeight: 700,
                                      color: '#38bdf8',
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    {data.key} <ExternalLink size={12} />
                                  </a>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ouvrir dans Jira</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '8px' }}>
                                  {data.summary}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Assigné :</span>
                                  <span style={{ fontWeight: 600 }}>{data.collaborator}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Estimation initiale :</span>
                                  <span style={{ fontWeight: 600, color: '#60a5fa' }}>{data.estimatedDays} j</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Consommé réel :</span>
                                  <span style={{ fontWeight: 600, color: '#f87171' }}>{data.actualDays} j</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Écart :</span>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: data.diffDays > 0 ? '#ef4444' : data.diffDays < 0 ? '#38bdf8' : '#10b981'
                                    }}
                                  >
                                    {data.diffDays > 0 ? `+${data.diffDays} j (${data.diffRatio > 0 ? '+' : ''}${data.diffRatio}%)` : `${data.diffDays} j (${data.diffRatio}%)`}
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />

                        {/* Ligne diagonale repère Y = X */}
                        <Line
                          data={diagonalPoints}
                          type="monotone"
                          dataKey="y"
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          legendType="none"
                        />

                        {/* Nuage de points des tickets sous-estimés (dérive > 1j) */}
                        <Scatter
                          name="Sous-estimés (Dérive > 1j)"
                          data={scatterPoints.filter(p => p.diffDays > 1)}
                          fill="#ef4444"
                          shape="circle"
                          cursor="pointer"
                          onClick={(node) => {
                            if (node && node.payload && node.payload.ticketLink) {
                              window.open(node.payload.ticketLink, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        />

                        {/* Nuage de points des tickets conformes (|diff| <= 1j) */}
                        <Scatter
                          name="Conformes (Précis à ±1j)"
                          data={scatterPoints.filter(p => Math.abs(p.diffDays) <= 1)}
                          fill="#10b981"
                          shape="circle"
                          cursor="pointer"
                          onClick={(node) => {
                            if (node && node.payload && node.payload.ticketLink) {
                              window.open(node.payload.ticketLink, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        />

                        {/* Nuage de points des tickets sur-estimés (diff < -1j) */}
                        <Scatter
                          name="Sur-estimés (Gain > 1j)"
                          data={scatterPoints.filter(p => p.diffDays < -1)}
                          fill="#3b82f6"
                          shape="circle"
                          cursor="pointer"
                          onClick={(node) => {
                            if (node && node.payload && node.payload.ticketLink) {
                              window.open(node.payload.ticketLink, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          wrapperStyle={{ paddingBottom: '12px' }}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Tableau des Outliers (Tickets ayant le plus dérivé) */}
                  {scatterPoints.filter(p => p.diffDays > 0).length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <AlertOctagon size={16} color="#ef4444" />
                        <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fca5a5' }}>
                          Principaux Outliers / Dérives de Chiffrage
                        </h5>
                      </div>

                      <div className="table-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.82rem' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '130px' }}>Clé Jira</th>
                              <th>Résumé du ticket</th>
                              <th style={{ width: '140px' }}>Assigné</th>
                              <th style={{ width: '100px', textAlign: 'center' }}>Estimé</th>
                              <th style={{ width: '100px', textAlign: 'center' }}>Consommé</th>
                              <th style={{ width: '130px', textAlign: 'center' }}>Dérive</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scatterPoints
                              .filter(p => p.diffDays > 0)
                              .sort((a, b) => b.diffDays - a.diffDays)
                              .slice(0, 5)
                              .map(t => (
                                <tr key={t.key}>
                                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    <a
                                      href={t.ticketLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: '#06b6d4',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                      title={`Ouvrir le ticket ${t.key} dans Jira`}
                                    >
                                      {t.key} <ExternalLink size={12} />
                                    </a>
                                  </td>
                                  <td>{t.summary}</td>
                                  <td style={{ color: 'var(--text-muted)' }}>{t.collaborator}</td>
                                  <td style={{ textAlign: 'center', color: '#60a5fa', fontWeight: 600 }}>{t.estimatedDays} j</td>
                                  <td style={{ textAlign: 'center', color: '#f87171', fontWeight: 600 }}>{t.actualDays} j</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span
                                      className="badge badge-danger"
                                      style={{ padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}
                                    >
                                      +{t.diffDays} j (+{t.diffRatio}%)
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* SECTION 2-BIS : 2. STAFFING COLLABORATEURS & TYPOLOGIE (INTERNE VS EXTERNE) */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Users size={20} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                2. Staffing Collaborateurs & Typologie (Interne vs Externe)
              </h4>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Répartition nominative de l'effort consommé (Tempo) et proportion Internes (🔵) vs Externes (🟣)
            </p>
          </div>

          {/* KPIs de Staffing */}
          {transitionsData?.staffingSummary && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 600 }}>Internes</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3b82f6' }}>
                  {transitionsData.staffingSummary.daysInterne} j <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>({transitionsData.staffingSummary.ratioInterne}%)</span>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#d8b4fe', fontWeight: 600 }}>Externes</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#a855f7' }}>
                  {transitionsData.staffingSummary.daysExterne} j <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>({transitionsData.staffingSummary.ratioExterne}%)</span>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 600 }}>Mobilisés</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981' }}>
                  {transitionsData.staffingSummary.staffing.length} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>personnes</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {isLoadingTransitions ? (
          <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Chargement du staffing...
          </div>
        ) : !transitionsData?.staffingSummary || transitionsData.staffingSummary.staffing.length === 0 ? (
          <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
            <Users size={32} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
            <div>Aucune imputation de collaborateur enregistrée sur cette release.</div>
          </div>
        ) : (
          <div>
            <div style={{ width: '100%', height: Math.max(260, transitionsData.staffingSummary.staffing.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={transitionsData.staffingSummary.staffing}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 90, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} unit=" j" tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="collaborator"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                    formatter={(val: any, _name: string, item: any) => {
                      const pl = item.payload;
                      return [
                        `${val} j (${pl.type} - ${pl.role || 'N/A'}, ${pl.ticketCount} ticket(s))`,
                        'Effort Consommé'
                      ];
                    }}
                  />
                  <Bar
                    dataKey="days"
                    radius={[0, 4, 4, 0]}
                    fill="#3b82f6"
                    // Coloration conditionnelle Interne vs Externe
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const fillColor = payload.type === 'Externe' ? '#a855f7' : '#3b82f6';
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={fillColor}
                          rx={4}
                          ry={4}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Légende typologique */}
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#3b82f6' }} />
                Interne (Salarié)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#a855f7' }} />
                Externe (Prestation / Régie)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2-TER : 3. ARRIVÉE DU SCOPE (SCOPE CREEP) */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Flame size={20} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                3. Arrivée du Scope (Scope Creep & Volatilité Hebdomadaire)
              </h4>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Flux d'entrée de nouveaux tickets/jours par semaine vs rythme de finalisation (tickets livrés)
            </p>
          </div>
        </div>

        {isLoadingTransitions ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Calcul du scope creep...
          </div>
        ) : !transitionsData?.scopeCreepData || transitionsData.scopeCreepData.length === 0 ? (
          <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
            <Flame size={32} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
            <div>Données insuffisantes pour reconstituer le scope creep hebdomadaire.</div>
          </div>
        ) : (
          <div style={{ width: '100%', height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={transitionsData.scopeCreepData}
                margin={{ top: 15, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} unit=" j" tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} unit=" t" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                  formatter={(val: any, name: string) => {
                    const labelMap: Record<string, string> = {
                      addedDays: 'Nouveau Scope Ajouté (J)',
                      completedDays: 'Effort Livré / Fini (J)',
                      addedTickets: 'Tickets Ajoutés',
                      completedTickets: 'Tickets Finalisés'
                    };
                    return [`${val}`, labelMap[name] || name];
                  }}
                  labelFormatter={(lbl) => `Semaine : ${lbl}`}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px' }}
                  formatter={(val) => {
                    if (val === 'addedDays') return 'Scope Ajouté (Jours)';
                    if (val === 'completedDays') return 'Effort Livré (Jours)';
                    if (val === 'addedTickets') return 'Tickets Ajoutés (Qté)';
                    if (val === 'completedTickets') return 'Tickets Livrés (Qté)';
                    return val;
                  }}
                />
                <Bar yAxisId="left" dataKey="addedDays" fill="#f59e0b" radius={[4, 4, 0, 0]} name="addedDays" />
                <Bar yAxisId="left" dataKey="completedDays" fill="#10b981" radius={[4, 4, 0, 0]} name="completedDays" />
                <Line yAxisId="right" type="monotone" dataKey="addedTickets" stroke="#fb923c" strokeWidth={2} dot={{ r: 3 }} name="addedTickets" />
                <Line yAxisId="right" type="monotone" dataKey="completedTickets" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} name="completedTickets" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* SECTION 2-QUATER : 4. CAPACITÉ NETTE VS CHARGE VERSION */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Scale size={20} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                4. Capacité Nette vs Charge Version (Faisabilité & Saturation)
              </h4>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Comparaison de la capacité théorique disponible de l'équipe mobilisée face au chiffrage de la version
            </p>
          </div>

          {transitionsData?.capacityVsDemand && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: transitionsData.capacityVsDemand.feasibilityRatio > 100
                    ? 'rgba(239, 68, 68, 0.15)'
                    : transitionsData.capacityVsDemand.feasibilityRatio > 85
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(16, 185, 129, 0.12)',
                  border: transitionsData.capacityVsDemand.feasibilityRatio > 100
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : transitionsData.capacityVsDemand.feasibilityRatio > 85
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(16, 185, 129, 0.3)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: transitionsData.capacityVsDemand.feasibilityRatio > 100 ? '#fca5a5' : '#86efac', fontWeight: 600 }}>
                  Taux de Faisabilité (Charge / Capacité)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: transitionsData.capacityVsDemand.feasibilityRatio > 100 ? '#ef4444' : transitionsData.capacityVsDemand.feasibilityRatio > 85 ? '#f59e0b' : '#10b981' }}>
                  {transitionsData.capacityVsDemand.feasibilityRatio}%
                </div>
              </div>
            </div>
          )}
        </div>

        {transitionsData?.capacityVsDemand && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '22px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jours Ouvrés sur la Période</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {transitionsData.capacityVsDemand.workingDaysCount} j
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contributeurs Mobilisés</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {transitionsData.capacityVsDemand.activeContributorsCount} personnes
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>Capacité Nette Théorique Équipe</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#60a5fa', marginTop: '4px' }}>
                  {transitionsData.capacityVsDemand.teamNetCapacityDays} j
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Charge Estimée (Scope)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f87171', marginTop: '4px' }}>
                  {transitionsData.capacityVsDemand.totalEstimatedCharge} j
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: '#fde68a' }}>Consommé Réel (Tempo)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                  {transitionsData.capacityVsDemand.totalActualCharge} j
                </div>
              </div>
            </div>

            {/* Histogramme comparatif 3 barres */}
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: 'Bilan Capacitif de la Release',
                      capaciteNette: transitionsData.capacityVsDemand.teamNetCapacityDays,
                      chargeEstimee: transitionsData.capacityVsDemand.totalEstimatedCharge,
                      consommeReel: transitionsData.capacityVsDemand.totalActualCharge
                    }
                  ]}
                  margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} unit=" j" tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any, name: string) => {
                      if (name === 'capaciteNette') return [`${val} j`, 'Capacité Nette Théorique Équipe'];
                      if (name === 'chargeEstimee') return [`${val} j`, 'Charge Estimée Version (Scope)'];
                      if (name === 'consommeReel') return [`${val} j`, 'Consommé Réel (Tempo)'];
                      return [val, name];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    formatter={(val) => {
                      if (val === 'capaciteNette') return 'Capacité Nette (J)';
                      if (val === 'chargeEstimee') return 'Charge Estimée (J)';
                      if (val === 'consommeReel') return 'Consommé Réel (J)';
                      return val;
                    }}
                  />
                  <Bar dataKey="capaciteNette" fill="#3b82f6" radius={[4, 4, 0, 0]} name="capaciteNette" />
                  <Bar dataKey="chargeEstimee" fill="#ef4444" radius={[4, 4, 0, 0]} name="chargeEstimee" />
                  <Bar dataKey="consommeReel" fill="#f59e0b" radius={[4, 4, 0, 0]} name="consommeReel" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2-QUINQUIES : 5. RESPECT DES 6 JALONS CLÉS */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Milestone size={20} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                5. Respect des 6 Jalons Clés (Dérive Cible vs Exécution Réelle)
              </h4>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Mesure des écarts (± jours) entre les dates théoriques de la release et la réalisation opérationnelle
            </p>
          </div>
        </div>

        {isLoadingTransitions ? (
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Calcul des écarts de jalons...
          </div>
        ) : !transitionsData?.milestoneDrift || transitionsData.milestoneDrift.length === 0 ? (
          <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
            <Milestone size={32} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
            <div>Aucun jalon renseigné sur cette version.</div>
          </div>
        ) : (
          <div>
            {/* Histogramme des écarts en jours (+/- J) */}
            <div style={{ width: '100%', height: '260px', marginBottom: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={transitionsData.milestoneDrift}
                  margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    tickFormatter={(val) => val.split(' (')[0]}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} unit=" j" tickLine={false} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc'
                    }}
                    formatter={(val: any, _name: string, item: any) => {
                      const pl = item.payload;
                      const sign = val > 0 ? `+${val}` : `${val}`;
                      return [
                        `${sign} jour(s) (Cible: ${pl.targetDate || 'Non fixée'} | Réalisé: ${pl.actualDate || 'En attente'})`,
                        'Écart Jalon'
                      ];
                    }}
                  />
                  <Bar
                    dataKey="driftDays"
                    name="Dérive (Jours)"
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const drift = payload.driftDays || 0;
                      let fill = '#10b981'; // on_time / avance
                      if (drift > 5) fill = '#ef4444'; // grand retard
                      else if (drift > 0) fill = '#f59e0b'; // retard léger
                      else if (drift < 0) fill = '#3b82f6'; // en avance

                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={fill}
                          rx={4}
                          ry={4}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tableau récapitulatif des 6 jalons */}
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Jalon Clé</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Date Cible</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Date Réelle d'Exécution</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Écart Constaté</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Statut Diagnostic</th>
                  </tr>
                </thead>
                <tbody>
                  {transitionsData.milestoneDrift.map((m) => {
                    const drift = m.driftDays;
                    let badgeClass = 'badge-success';
                    let badgeText = 'Dans les temps';

                    if (m.driftStatus === 'not_set') {
                      badgeClass = 'badge-secondary';
                      badgeText = 'Non planifié';
                    } else if (drift !== null && drift > 2) {
                      badgeClass = 'badge-danger';
                      badgeText = `Retard (${drift > 0 ? `+${drift}` : drift} j)`;
                    } else if (drift !== null && drift < -2) {
                      badgeClass = 'badge-primary';
                      badgeText = `En avance (${drift} j)`;
                    }

                    return (
                      <tr key={m.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ fontWeight: 600, padding: '10px 12px' }}>{m.label}</td>
                        <td style={{ textAlign: 'center', color: '#93c5fd' }}>{m.targetDate || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#cbd5e1' }}>{m.actualDate || 'En attente'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {drift !== null ? (
                            <span style={{ color: drift > 2 ? '#ef4444' : drift < -2 ? '#3b82f6' : '#10b981' }}>
                              {drift > 0 ? `+${drift}` : drift} j
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${badgeClass}`} style={{ padding: '3px 8px', fontSize: '0.74rem' }}>
                            {badgeText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3 : GRAPHIQUE DE VÉLOCITÉ INTER-VERSIONS */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                  color: '#06b6d4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <TrendingUp size={20} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Graphique de Vélocité des Versions
              </h4>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Comparaison de l'effort par release : Estimé vs Consommé Réel vs Livré (en Jours/Homme)
            </p>
          </div>

          {/* Vélocité moyenne livrée */}
          {velocityData && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              <Gauge size={22} color="#10b981" />
              <div>
                <div style={{ fontSize: '0.74rem', color: '#86efac', fontWeight: 600 }}>Vélocité Moyenne Livrée</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  {velocityData.averageVelocityDays} <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>j / version</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Graphique BarChart de vélocité */}
        {isLoadingVelocity ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Calcul de la vélocité des versions...
          </div>
        ) : !velocityData || velocityData.versions.length === 0 ? (
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
            <Layers size={36} color="var(--text-dim)" style={{ marginBottom: '10px' }} />
            <div>Aucun historique de version exploitable pour calculer la vélocité.</div>
          </div>
        ) : (
          <div style={{ width: '100%', height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={velocityData.versions}
                margin={{ top: 15, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                <XAxis
                  dataKey="versionName"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  unit=" j"
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                  formatter={(value: any, name: string) => {
                    const labelMap: Record<string, string> = {
                      estimatedDays: 'Estimé (Scope initial)',
                      actualDays: 'Consommé Réel (Tempo)',
                      deliveredDays: 'Livré (Conforme/Fini)'
                    };
                    return [`${value} j`, labelMap[name] || name];
                  }}
                  labelFormatter={(label) => `Version : ${label}`}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px' }}
                  formatter={(val) => {
                    if (val === 'estimatedDays') return 'Estimé (Scope)';
                    if (val === 'actualDays') return 'Consommé Réel (Tempo)';
                    if (val === 'deliveredDays') return 'Livré (Terminé)';
                    return val;
                  }}
                />

                {/* Ligne repère de vélocité moyenne */}
                {velocityData.averageVelocityDays > 0 && (
                  <ReferenceLine
                    y={velocityData.averageVelocityDays}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Moyenne: ${velocityData.averageVelocityDays}j`,
                      position: 'top',
                      fill: '#10b981',
                      fontSize: 11
                    }}
                  />
                )}

                <Bar dataKey="estimatedDays" fill="#3b82f6" radius={[4, 4, 0, 0]} name="estimatedDays" />
                <Bar dataKey="actualDays" fill="#f59e0b" radius={[4, 4, 0, 0]} name="actualDays" />
                <Bar dataKey="deliveredDays" fill="#10b981" radius={[4, 4, 0, 0]} name="deliveredDays" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
