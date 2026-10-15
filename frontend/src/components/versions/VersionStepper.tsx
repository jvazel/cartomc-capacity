import React from 'react';
import { VersionItem } from './types';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

interface VersionStepperProps {
  version: VersionItem;
  onEditClick?: () => void;
}

export const VersionStepper: React.FC<VersionStepperProps> = ({ version, onEditClick }) => {
  const now = new Date();

  const parseDate = (d?: string | null) => (d ? new Date(d) : null);

  const steps = [
    {
      id: 'dateFinAFaire',
      title: 'Fin À faire',
      sub: 'Arrêt nouveaux tickets',
      date: parseDate(version.dateFinAFaire),
      color: '#38bdf8', // Cyan/Sky
      glowColor: 'rgba(56, 189, 248, 0.4)',
      anomaliesCount: version.metrics.anomalies.aDecaler,
      anomalyText: `${version.metrics.anomalies.aDecaler} ticket(s) non démarré(s)`
    },
    {
      id: 'dateFinEnCours',
      title: 'Fin En cours',
      sub: 'Clôture Dév',
      date: parseDate(version.dateFinEnCours),
      color: '#fbbf24', // Amber
      glowColor: 'rgba(251, 191, 36, 0.4)',
      anomaliesCount: version.metrics.anomalies.retardDev,
      anomalyText: `${version.metrics.anomalies.retardDev} dév(s) hors délai`
    },
    {
      id: 'dateFinMR',
      title: 'Fin MR',
      sub: 'Freeze Code / Merge',
      date: parseDate(version.dateFinMR),
      color: '#c084fc', // Purple
      glowColor: 'rgba(192, 132, 252, 0.4)',
      anomaliesCount: version.metrics.anomalies.retardMR,
      anomalyText: `${version.metrics.anomalies.retardMR} MR ouverte(s)`
    },
    {
      id: 'dateFinRecette',
      title: 'Fin Recette',
      sub: 'Validation QA',
      date: parseDate(version.dateFinRecette),
      color: '#fb923c', // Orange
      glowColor: 'rgba(251, 146, 60, 0.4)',
      anomaliesCount: version.metrics.anomalies.retardRecette,
      anomalyText: `${version.metrics.anomalies.retardRecette} recette(s) en retard`
    },
    {
      id: 'dateMEPP',
      title: 'MEPP',
      sub: 'Préprod & Benchs',
      date: parseDate(version.dateMEPP),
      color: '#34d399', // Emerald
      glowColor: 'rgba(52, 211, 153, 0.4)',
      anomaliesCount: 0,
      anomalyText: ''
    },
    {
      id: 'dateMEP',
      title: 'MEP',
      sub: 'Mise en Prod',
      date: parseDate(version.dateMEP || version.jiraReleaseDate),
      color: '#f472b6', // Pink
      glowColor: 'rgba(244, 114, 182, 0.4)',
      anomaliesCount: 0,
      anomalyText: ''
    }
  ];

  const formatDateDisplay = (d: Date | null) => {
    if (!d || isNaN(d.getTime())) return 'Non défini';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        position: 'relative',
        padding: '10px 4px',
        overflowX: 'auto'
      }}
    >
      {steps.map((step, idx) => {
        const isPassed = step.date ? now > step.date : false;
        const hasDate = Boolean(step.date);
        const hasAnomaly = step.anomaliesCount > 0;

        return (
          <React.Fragment key={step.id}>
            {/* Étape */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '110px',
                flex: 1,
                position: 'relative',
                zIndex: 2,
                cursor: onEditClick ? 'pointer' : 'default'
              }}
              onClick={onEditClick}
              title={hasDate ? `Date : ${formatDateDisplay(step.date)}` : 'Cliquer pour définir le jalon'}
            >
              {/* Pastille */}
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hasAnomaly
                    ? 'rgba(239, 68, 68, 0.2)'
                    : isPassed
                    ? 'rgba(16, 185, 129, 0.15)'
                    : hasDate
                    ? 'rgba(11, 17, 32, 0.9)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: `2px solid ${
                    hasAnomaly
                      ? 'var(--danger)'
                      : isPassed
                      ? 'var(--success)'
                      : hasDate
                      ? step.color
                      : 'rgba(255, 255, 255, 0.15)'
                  }`,
                  color: hasAnomaly
                    ? '#f87171'
                    : isPassed
                    ? '#34d399'
                    : hasDate
                    ? step.color
                    : 'var(--text-dim)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  boxShadow: hasAnomaly
                    ? '0 0 12px rgba(239, 68, 68, 0.4)'
                    : hasDate
                    ? `0 0 10px ${step.glowColor}`
                    : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                {hasAnomaly ? (
                  <AlertCircle size={18} />
                ) : isPassed ? (
                  <CheckCircle2 size={18} />
                ) : hasDate ? (
                  idx + 1
                ) : (
                  <Clock size={15} />
                )}
              </div>

              {/* Titre & Sous-titre */}
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    color: hasAnomaly ? '#fca5a5' : 'var(--text-main)',
                    display: 'block'
                  }}
                >
                  {step.title}
                </span>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: hasDate ? 600 : 400,
                    color: hasDate ? 'var(--text-main)' : 'var(--text-dim)',
                    backgroundColor: hasDate ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    border: hasDate ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                    padding: hasDate ? '2px 7px' : '0',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginTop: '3px'
                  }}
                >
                  {formatDateDisplay(step.date)}
                </span>
              </div>

              {/* Badge d'alerte spécifique au jalon */}
              {hasAnomaly && (
                <div
                  className="badge badge-danger"
                  style={{
                    marginTop: '5px',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <AlertTriangle size={11} /> {step.anomaliesCount} à décaler
                </div>
              )}
            </div>

            {/* Ligne de connexion entre étapes */}
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 0.8,
                  height: '2px',
                  backgroundColor: isPassed ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isPassed ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none',
                  marginTop: '16px',
                  position: 'relative',
                  zIndex: 1
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
