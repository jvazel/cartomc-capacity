import React from 'react';
import { Loader2, AlertTriangle, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { IJobProgress, ExtractionPhase } from '../../types/tempo';

interface ExtractionProgressPanelProps {
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: IJobProgress | null;
  elapsedSeconds: number;
  isConnectionLost: boolean;
  onCancel: () => void;
}

export const ExtractionProgressPanel: React.FC<ExtractionProgressPanelProps> = ({
  status,
  progress,
  elapsedSeconds,
  isConnectionLost,
  onCancel
}) => {
  if (status !== 'running' && status !== 'queued') {
    return null;
  }

  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const phases: Array<{ id: ExtractionPhase; label: string }> = [
    { id: 'worklogs', label: 'Worklogs Tempo' },
    { id: 'tickets', label: 'Tickets Jira' },
    { id: 'epics', label: 'Epics parents' },
    { id: 'enrichment', label: 'Enrichissement' }
  ];

  const currentPhaseIndex = progress
    ? phases.findIndex((p) => p.id === progress.phase)
    : 0;

  const current = progress?.current || 0;
  const total = progress?.total;
  const hasTotal = typeof total === 'number' && total > 0;
  const percentage = hasTotal ? Math.min(100, Math.round((current / total!) * 100)) : null;

  return (
    <div className="card card-neon-blue">
      {/* Header status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Loader2 size={22} className="spin" color="var(--primary)" />
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Extraction Tempo en cours...
            </h4>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {progress?.message || 'Initialisation...'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', gap: '6px' }}>
            <Clock size={16} />
            <span>Temps écoulé : <strong>{formatSeconds(elapsedSeconds)}</strong></span>
          </div>

          <button onClick={onCancel} className="btn btn-danger" style={{ padding: '6px 14px' }}>
            <XCircle size={16} />
            Annuler
          </button>
        </div>
      </div>

      {/* Connection Lost Alert */}
      {isConnectionLost && (
        <div className="card card-neon-amber" style={{ padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} color="var(--warning)" />
          <span style={{ color: '#fbbf24' }}>Connexion SSE interrompue. Bascule automatique en mode sondage (polling)...</span>
        </div>
      )}

      {/* Stepper Phases */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {phases.map((ph, idx) => {
          const isDone = idx < currentPhaseIndex;
          const isActive = idx === currentPhaseIndex;
          return (
            <div
              key={ph.id}
              style={{
                flex: 1,
                minWidth: '130px',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                background: isActive
                  ? 'rgba(59, 130, 246, 0.15)'
                  : isDone
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${
                  isActive
                    ? 'var(--primary)'
                    : isDone
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'var(--border-color)'
                }`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isDone ? (
                <CheckCircle2 size={16} color="#34d399" />
              ) : isActive ? (
                <Loader2 size={16} className="spin" color="var(--primary)" />
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--text-muted)', display: 'inline-block' }} />
              )}
              <span style={{ fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>
                {ph.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Bar & Counters */}
      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: percentage !== null ? `${percentage}%` : '100%',
            background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
            transition: percentage !== null ? 'width 0.3s ease' : 'none'
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>
          {hasTotal ? `${current} / ${total} éléments traités` : `${current} éléments récupérés...`}
        </span>
        {percentage !== null && <span>{percentage}%</span>}
      </div>
    </div>
  );
};
