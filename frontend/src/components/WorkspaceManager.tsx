import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Sparkles,
  RotateCcw,
  Sliders,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export interface ISavedWorkspace<T = Record<string, any>> {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  filters: T;
  createdAt: string;
  isDefault?: boolean;
}

interface WorkspaceManagerProps<T = Record<string, any>> {
  /** Identifiant unique de l'écran (ex: 'timeline', 'projets', 'dashboard', 'ressources', 'audit') */
  storageKey: string;
  /** État actuel des filtres sur la page */
  currentFilters: T;
  /** Callback déclenché pour appliquer un ensemble de filtres */
  onApplyFilters: (filters: T) => void;
  /** Filtres par défaut de la page (pour le reset) */
  defaultFilters: T;
  /** Préréglages d'usine prédéfinis pour la page */
  systemPresets?: Array<{
    id: string;
    name: string;
    icon?: string;
    description?: string;
    filters: T;
  }>;
  /** Style personnalisé pour le conteneur */
  style?: React.CSSProperties;
}

export function WorkspaceManager<T extends Record<string, any>>({
  storageKey,
  currentFilters,
  onApplyFilters,
  defaultFilters,
  systemPresets = [],
  style
}: WorkspaceManagerProps<T>) {
  const { role, leadBARessource } = useAuth();
  const { showSuccess, showInfo } = useToast();

  const userScopedKey = `cartomc_workspaces_${storageKey}_${role || 'guest'}_${leadBARessource?._id || 'all'}`;

  const [savedViews, setSavedViews] = useState<ISavedWorkspace<T>[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newViewName, setNewViewName] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Charger les vues depuis LocalStorage au démarrage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(userScopedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSavedViews(parsed);
      } else {
        setSavedViews([]);
      }
    } catch (e) {
      console.error('Erreur lecture workspaces:', e);
      setSavedViews([]);
    }
  }, [userScopedKey]);

  // Sauvegarder dans LocalStorage
  const persistViews = (views: ISavedWorkspace<T>[]) => {
    setSavedViews(views);
    try {
      localStorage.setItem(userScopedKey, JSON.stringify(views));
    } catch (e) {
      console.error('Erreur écriture workspaces:', e);
    }
  };

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Appliquer une vue sauvegardée
  const handleSelectView = (view: { id: string; name: string; filters: T }) => {
    setActiveViewId(view.id);
    onApplyFilters(view.filters);
    setIsOpen(false);
    showSuccess(`Vue activée : "${view.name}"`);
  };

  // Réinitialiser les filtres aux valeurs par défaut
  const handleReset = () => {
    setActiveViewId(null);
    onApplyFilters(defaultFilters);
    setIsOpen(false);
    showInfo('Filtres réinitialisés aux valeurs standard');
  };

  // Sauvegarder la vue actuelle
  const handleCreateView = () => {
    if (!newViewName.trim()) return;
    const newView: ISavedWorkspace<T> = {
      id: `view_${Date.now()}`,
      name: newViewName.trim(),
      filters: { ...currentFilters },
      createdAt: new Date().toISOString()
    };
    const updated = [...savedViews, newView];
    persistViews(updated);
    setActiveViewId(newView.id);
    setNewViewName('');
    setIsCreating(false);
    setIsOpen(false);
    showSuccess(`Vue personnalisée "${newView.name}" enregistrée !`);
  };

  // Supprimer une vue personnalisée
  const handleDeleteView = (viewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedViews.filter((v) => v.id !== viewId);
    persistViews(updated);
    if (activeViewId === viewId) {
      setActiveViewId(null);
    }
    showInfo('Vue supprimée');
  };

  // Vérifier si les filtres actuels correspondent à un preset ou une vue
  const activeLabel = (() => {
    if (!activeViewId) return null;
    const custom = savedViews.find((v) => v.id === activeViewId);
    if (custom) return custom.name;
    const sys = systemPresets.find((v) => v.id === activeViewId);
    if (sys) return sys.name;
    return null;
  })();

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        zIndex: isOpen ? 9999 : 50,
        ...style
      }}
    >
      {/* Bouton Principal de sélection / bascule de vue */}
      <button
        type="button"
        className="btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          fontSize: '0.82rem',
          fontWeight: 600,
          borderRadius: '8px',
          border: activeLabel
            ? '1px solid rgba(6, 182, 212, 0.6)'
            : '1px solid rgba(148, 163, 184, 0.25)',
          background: activeLabel
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)'
            : 'rgba(15, 23, 42, 0.65)',
          color: activeLabel ? '#38bdf8' : 'var(--text-main)',
          backdropFilter: 'blur(8px)',
          boxShadow: activeLabel ? '0 0 12px rgba(6, 182, 212, 0.25)' : 'none',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        title="Gérer les vues et configurations de filtres personnalisées (Workspaces)"
      >
        <Bookmark size={14} style={{ color: activeLabel ? '#38bdf8' : 'var(--primary)' }} />
        <span>{activeLabel ? `Vue : ${activeLabel}` : 'Vues & Filtres'}</span>
        <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Popover Menu déroulant */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 99999,
            minWidth: '280px',
            maxWidth: '340px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(6, 182, 212, 0.2)',
            backdropFilter: 'blur(16px)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* Header Popover */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px 8px 6px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              <Sliders size={13} style={{ color: 'var(--primary)' }} />
              <span>ESPACES DE TRAVAIL (WORKSPACES)</span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
              style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Réinitialiser tous les filtres aux valeurs par défaut"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          {/* Section 1 : Préréglages recommandés / Vues d'usine */}
          {systemPresets.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8', padding: '4px 6px', letterSpacing: '0.04em' }}>
                ⭐ VUES STANDARDS RECOMMANDÉES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {systemPresets.map((preset) => {
                  const isSelected = activeViewId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectView(preset)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid transparent',
                        background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSelected ? '#38bdf8' : 'var(--text-main)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600 }}>{preset.icon || '📌'} {preset.name}</span>
                        {preset.description && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {preset.description}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={14} style={{ color: '#38bdf8' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2 : Vues personnalisées de l'utilisateur */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#c084fc',
                letterSpacing: '0.04em'
              }}
            >
              <span>💾 MES VUES SAUVEGARDÉES ({savedViews.length})</span>
            </div>

            {savedViews.length === 0 ? (
              <div style={{ padding: '8px 6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Aucune vue personnalisée enregistrée sur cet écran.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                {savedViews.map((view) => {
                  const isSelected = activeViewId === view.id;
                  return (
                    <div
                      key={view.id}
                      onClick={() => handleSelectView(view)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
                        background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSelected ? '#c084fc' : 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Star size={13} style={{ color: '#fbbf24' }} />
                        <span style={{ fontWeight: 600 }}>{view.name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isSelected && <Check size={14} style={{ color: '#c084fc' }} />}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteView(view.id, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Supprimer cette vue"
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulaire Sauvegarder la vue actuelle */}
          <div
            style={{
              marginTop: '4px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            {!isCreating ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreating(true)}
                style={{
                  width: '100%',
                  fontSize: '0.78rem',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} /> Enregistrer la vue actuelle...
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nom de votre vue (ex: Mes Projets P0)..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateView();
                    if (e.key === 'Escape') setIsCreating(false);
                  }}
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsCreating(false);
                      setNewViewName('');
                    }}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!newViewName.trim()}
                    onClick={handleCreateView}
                    style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Sparkles size={12} /> Sauvegarder
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
