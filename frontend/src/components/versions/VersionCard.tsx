import React from 'react';
import { VersionItem } from './types';
import { VersionStepper } from './VersionStepper';
import { Settings, Ticket, AlertTriangle, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';

interface VersionCardProps {
  version: VersionItem;
  onConfigureMilestones: (version: VersionItem) => void;
  onViewTickets: (version: VersionItem) => void;
}

export const VersionCard: React.FC<VersionCardProps> = ({
  version,
  onConfigureMilestones,
  onViewTickets
}) => {
  const { metrics } = version;
  const anomaliesTotal = metrics.anomalies.total;
  const aDecaler = metrics.anomalies.aDecaler;

  const totalTickets = metrics.totalTickets || 1;
  const percentDone = Math.round((metrics.done / totalTickets) * 100);

  return (
    <div
      className={`card ${
        metrics.health === 'red'
          ? 'card-neon-red'
          : metrics.health === 'orange'
          ? 'card-neon-amber'
          : 'card-neon-blue'
      }`}
      style={{
        padding: 0,
        marginBottom: '20px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* En-tête de la carte */}
      <div
        style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--primary)" />
            <h3
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em'
              }}
            >
              {version.versionName}
            </h3>
          </div>

          {/* Badge Released */}
          <span
            className={`badge ${version.released ? 'badge-success' : 'badge-primary'}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            {version.released ? '✓ Publiée (Release Jira)' : '⚡ Non publiée'}
          </span>

          {/* Badge Tickets En cours */}
          <span
            className="badge"
            style={{
              padding: '4px 10px',
              fontSize: '0.78rem',
              backgroundColor: metrics.inProgress > 0 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: metrics.inProgress > 0 ? '#fbbf24' : 'var(--text-muted)',
              border: `1px solid ${metrics.inProgress > 0 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              fontWeight: 600
            }}
          >
            🟡 {metrics.inProgress} en cours
          </span>

          {/* Santé Globale */}
          <span
            className={`badge ${
              metrics.health === 'green'
                ? 'badge-success'
                : metrics.health === 'orange'
                ? 'badge-warning'
                : 'badge-danger'
            }`}
            style={{ padding: '4px 10px', fontSize: '0.78rem', gap: '6px' }}
          >
            {metrics.health === 'green' ? (
              <CheckCircle2 size={13} />
            ) : metrics.health === 'orange' ? (
              <AlertTriangle size={13} />
            ) : (
              <AlertCircle size={13} />
            )}
            {metrics.health === 'green'
              ? 'Jalons respectés'
              : metrics.health === 'orange'
              ? 'Attention jalon'
              : `${anomaliesTotal} Anomalie(s)`}
          </span>
        </div>

        {/* Boutons d'action */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onConfigureMilestones(version)}
            className="btn btn-secondary"
            style={{
              padding: '7px 12px',
              fontSize: '0.82rem',
              fontWeight: 500
            }}
          >
            <Settings size={14} /> Paramétrer les dates
          </button>

          <button
            onClick={() => onViewTickets(version)}
            className="btn btn-primary"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <Ticket size={14} /> Voir tickets ({metrics.totalTickets})
          </button>
        </div>
      </div>

      {/* Corps de la carte */}
      <div style={{ padding: '20px 22px' }}>
        {/* Tunnel des jalons */}
        <div style={{ marginBottom: '18px' }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-dim)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}
          >
            Tunnel des 6 Jalons Opérationnels :
          </div>
          <VersionStepper version={version} onEditClick={() => onConfigureMilestones(version)} />
        </div>

        {/* Encart d'alerte spécifique si des tickets sont bloquants / à décaler */}
        {aDecaler > 0 && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '0.86rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fca5a5' }}>
              <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <span>
                <strong style={{ color: '#ffffff' }}>{aDecaler} ticket(s)</strong> sont encore au statut{' '}
                <em>« À faire »</em> alors que la date limite de prise en charge est passée.
              </span>
            </div>
            <button
              onClick={() => onViewTickets(version)}
              className="btn btn-danger"
              style={{
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              Consulter pour décalage Jira
            </button>
          </div>
        )}

        {/* Barre de répartition des statuts de tickets */}
        <div style={{ marginTop: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              fontSize: '0.82rem'
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              Progression de la release : <strong style={{ color: 'var(--text-main)' }}>{percentDone}%</strong> des tickets terminés
            </span>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>À faire : <strong style={{ color: 'var(--text-main)' }}>{metrics.todo}</strong></span>
              <span style={{ color: '#fbbf24' }}>En cours : <strong>{metrics.inProgress}</strong></span>
              <span style={{ color: '#c084fc' }}>Technical Validation : <strong>{metrics.review}</strong></span>
              <span style={{ color: '#fb923c' }}>QA : <strong>{metrics.qa}</strong></span>
              <span style={{ color: '#34d399' }}>Terminés : <strong>{metrics.done}</strong></span>
            </div>
          </div>

          {/* Barre segmentée avec Glow */}
          <div
            style={{
              height: '8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}
          >
            {metrics.done > 0 && (
              <div
                title={`Terminés: ${metrics.done}`}
                style={{
                  width: `${(metrics.done / totalTickets) * 100}%`,
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                }}
              />
            )}
            {metrics.qa > 0 && (
              <div
                title={`Recette: ${metrics.qa}`}
                style={{ width: `${(metrics.qa / totalTickets) * 100}%`, backgroundColor: '#f97316' }}
              />
            )}
            {metrics.review > 0 && (
              <div
                title={`Technical Validation: ${metrics.review}`}
                style={{ width: `${(metrics.review / totalTickets) * 100}%`, backgroundColor: '#a855f7' }}
              />
            )}
            {metrics.inProgress > 0 && (
              <div
                title={`En cours: ${metrics.inProgress}`}
                style={{ width: `${(metrics.inProgress / totalTickets) * 100}%`, backgroundColor: '#eab308' }}
              />
            )}
            {metrics.todo > 0 && (
              <div
                title={`À faire: ${metrics.todo}`}
                style={{ width: `${(metrics.todo / totalTickets) * 100}%`, backgroundColor: '#475569' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
