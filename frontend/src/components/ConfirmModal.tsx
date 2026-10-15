import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle2, X, Zap, Clock, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'primary' | 'warning' | 'danger' | 'info';
  icon?: 'zap' | 'warning' | 'info' | 'check';
  loading?: boolean;
  loadingSteps?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  type = 'primary',
  icon = 'warning',
  loading = false,
  loadingSteps = [
    'Initialisation du traitement...',
    'Interrogation des données Tempo en base...',
    'Rapprochement des codes projets et budgets...',
    'Calcul de la charge macro et du staffing nominatif...',
    'Enregistrement et consolidation des ventilations...'
  ],
  onConfirm,
  onCancel
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Chronomètre et rotation d'étapes quand loading est actif
  useEffect(() => {
    let timer: any = null;
    let stepTimer: any = null;

    if (loading) {
      setElapsedSeconds(0);
      setCurrentStepIndex(0);

      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      stepTimer = setInterval(() => {
        setCurrentStepIndex((prev) => (prev + 1) % loadingSteps.length);
      }, 2500);
    } else {
      setElapsedSeconds(0);
      setCurrentStepIndex(0);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (stepTimer) clearInterval(stepTimer);
    };
  }, [loading, loadingSteps.length]);

  if (!isOpen) return null;

  const formatElapsedTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getThemeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          glowColor: 'rgba(245, 158, 11, 0.25)',
          borderColor: 'rgba(245, 158, 11, 0.4)',
          btnBg: '#f59e0b',
          btnHover: '#d97706',
          iconColor: '#fbbf24',
          iconBg: 'rgba(245, 158, 11, 0.15)'
        };
      case 'danger':
        return {
          glowColor: 'rgba(239, 68, 68, 0.25)',
          borderColor: 'rgba(239, 68, 68, 0.4)',
          btnBg: '#ef4444',
          btnHover: '#dc2626',
          iconColor: '#f87171',
          iconBg: 'rgba(239, 68, 68, 0.15)'
        };
      case 'info':
        return {
          glowColor: 'rgba(59, 130, 246, 0.25)',
          borderColor: 'rgba(59, 130, 246, 0.4)',
          btnBg: '#3b82f6',
          btnHover: '#2563eb',
          iconColor: '#60a5fa',
          iconBg: 'rgba(59, 130, 246, 0.15)'
        };
      default:
        // Vibrant orange primary
        return {
          glowColor: 'rgba(249, 115, 22, 0.3)',
          borderColor: 'rgba(249, 115, 22, 0.5)',
          btnBg: 'var(--primary)',
          btnHover: 'var(--primary-hover)',
          iconColor: 'var(--primary)',
          iconBg: 'rgba(249, 115, 22, 0.15)'
        };
    }
  };

  const theme = getThemeConfig();

  const renderIcon = () => {
    switch (icon) {
      case 'zap':
        return <Zap size={24} color={theme.iconColor} />;
      case 'check':
        return <CheckCircle2 size={24} color={theme.iconColor} />;
      case 'info':
        return <Info size={24} color={theme.iconColor} />;
      default:
        return <AlertTriangle size={24} color={theme.iconColor} />;
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '480px',
          width: '90%',
          border: `1px solid ${theme.borderColor}`,
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px ${theme.glowColor}`,
          padding: '24px',
          background: 'radial-gradient(ellipse at top, #162033 0%, #0b1120 100%)',
          animation: 'fadeInModal 0.25s ease-out'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: theme.iconBg,
              border: `1px solid ${theme.borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {renderIcon()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 6px 0',
                letterSpacing: '-0.01em'
              }}
            >
              {title}
            </h3>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {message}
            </div>

            {/* Panneau de chargement dynamique avec chronomètre et étapes */}
            {loading && (
              <div
                style={{
                  marginTop: '16px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${theme.borderColor}`,
                  borderRadius: '10px',
                  padding: '14px',
                  boxShadow: `inset 0 0 16px ${theme.glowColor}`
                }}
              >
                {/* En-tête : Chronomètre en direct */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                    <Loader2 size={15} className="spinner" style={{ color: theme.iconColor }} />
                    <span>Traitement en cours...</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.82rem',
                      fontFamily: 'var(--font-mono)',
                      color: theme.iconColor,
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <Clock size={13} />
                    <span>{formatElapsedTime(elapsedSeconds)}</span>
                  </div>
                </div>

                {/* Barre de progression pulsée / animée */}
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    position: 'relative',
                    marginBottom: '10px'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: '40%',
                      background: `linear-gradient(90deg, transparent, ${theme.btnBg}, transparent)`,
                      borderRadius: '3px',
                      animation: 'progressPulse 1.4s infinite ease-in-out'
                    }}
                  />
                </div>

                {/* Étape courante */}
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: theme.iconColor, display: 'inline-block' }}></span>
                  <span>{loadingSteps[currentStepIndex]}</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="toast-close-btn"
            onClick={onCancel}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={loading}
            style={{
              backgroundColor: theme.btnBg,
              color: '#ffffff',
              fontWeight: 600,
              padding: '8px 18px',
              fontSize: '0.88rem',
              boxShadow: `0 4px 14px ${theme.glowColor}`
            }}
          >
            {loading ? 'Traitement en cours...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
