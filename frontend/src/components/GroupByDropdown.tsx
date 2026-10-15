import React, { useState, useRef, useEffect } from 'react';
import {
  FolderTree,
  ChevronDown,
  Layers,
  FolderOpen,
  UserCheck,
  Flag,
  Tag,
  Check,
  ChevronsUpDown,
  ListFilter
} from 'lucide-react';

export type GroupByOption = 'none' | 'domaine' | 'leadBA' | 'priorite' | 'type';

interface GroupOptionDef {
  key: GroupByOption;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  badge?: string;
  color: string;
}

const GROUP_OPTIONS: GroupOptionDef[] = [
  {
    key: 'none',
    label: 'Aucun regroupement',
    sublabel: 'Liste à plat de tous les projets',
    icon: <ListFilter size={15} />,
    color: '#94a3b8'
  },
  {
    key: 'domaine',
    label: 'Domaine / Epic',
    sublabel: 'Macro-périmètres stratégiques',
    icon: <FolderOpen size={15} />,
    badge: 'VP',
    color: '#38bdf8'
  },
  {
    key: 'leadBA',
    label: 'Lead BA',
    sublabel: 'Responsable Business Analyst',
    icon: <UserCheck size={15} />,
    color: '#818cf8'
  },
  {
    key: 'priorite',
    label: 'Niveau de Priorité',
    sublabel: 'Arbitrage P0, P1, P2...',
    icon: <Flag size={15} />,
    color: '#f59e0b'
  },
  {
    key: 'type',
    label: 'Type de Projet',
    sublabel: 'RUN, Projet, Opex, Reco...',
    icon: <Tag size={15} />,
    color: '#34d399'
  }
];

interface GroupByDropdownProps {
  value: GroupByOption;
  onChange: (value: GroupByOption) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  showExpandCollapseButtons?: boolean;
}

export const GroupByDropdown: React.FC<GroupByDropdownProps> = ({
  value,
  onChange,
  onExpandAll,
  onCollapseAll,
  showExpandCollapseButtons = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption = GROUP_OPTIONS.find((opt) => opt.key === value) || GROUP_OPTIONS[0];
  const isGrouped = value !== 'none';

  // Fermer le menu lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {/* Bouton Trigger principal façon pilule moderne */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 12px',
          height: '34px',
          borderRadius: '8px',
          background: isGrouped
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(59, 130, 246, 0.12))'
            : 'rgba(30, 41, 59, 0.75)',
          border: isGrouped
            ? '1px solid rgba(56, 189, 248, 0.55)'
            : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isGrouped
            ? '0 0 14px rgba(6, 182, 212, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 2px 8px rgba(0, 0, 0, 0.2)',
          color: isGrouped ? '#f0f9ff' : 'var(--text-main, #e2e8f0)',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        title="Regrouper les projets (Vue hiérarchique Visual Planning)"
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            background: isGrouped ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            color: activeOption.color,
            transition: 'transform 0.2s'
          }}
        >
          {activeOption.icon}
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 500, fontSize: '0.75rem' }}>
            Grouper :
          </span>
          <span style={{ color: isGrouped ? '#38bdf8' : 'var(--text-main, #f8fafc)' }}>
            {activeOption.label}
          </span>
        </span>

        <ChevronDown
          size={14}
          style={{
            marginLeft: '2px',
            color: isGrouped ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>

      {/* Menu Déroulant Glassmorphism */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            minWidth: '270px',
            background: '#0f172a',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(6, 182, 212, 0.25)',
            padding: '8px',
            color: '#f8fafc'
          }}
        >
          <div
            style={{
              padding: '6px 10px 8px 10px',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#94a3b8',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ color: '#94a3b8' }}>Hiérarchie portefeuille</span>
            <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700 }}>Visual Planning</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
            {GROUP_OPTIONS.map((opt) => {
              const isSelected = opt.key === value;
              return (
                <div
                  key={opt.key}
                  onClick={() => {
                    onChange(opt.key);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.16)'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(56, 189, 248, 0.5)'
                      : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        color: opt.color,
                        border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`
                      }}
                    >
                      {opt.icon}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? '#ffffff' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {opt.label}
                        {opt.badge && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.25)',
                              color: '#38bdf8',
                              fontWeight: 700
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>
                        {opt.sublabel}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#38bdf8',
                        color: '#0f172a'
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Boutons d'action Déplier / Replier compacts quand un regroupement est actif */}
      {isGrouped && showExpandCollapseButtons && onExpandAll && onCollapseAll && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '2px',
            gap: '2px',
            marginLeft: '2px'
          }}
        >
          <button
            type="button"
            onClick={onExpandAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
              e.currentTarget.style.background = 'transparent';
            }}
            title="Déplier tous les groupes"
          >
            Déplier
          </button>

          <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: '0.75rem' }}>|</span>

          <button
            type="button"
            onClick={onCollapseAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
              e.currentTarget.style.background = 'transparent';
            }}
            title="Replier tous les groupes"
          >
            Replier
          </button>
        </div>
      )}
    </div>
  );
};
