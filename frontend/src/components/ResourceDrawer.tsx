import React, { useState } from 'react';
import { IRessource, IPlanningRessourceItem } from '../types';
import { Users, Search, ChevronRight, ChevronLeft, GripVertical, UserCheck, Calendar } from 'lucide-react';

interface ResourceDrawerProps {
  ressources: IRessource[];
  planningMap?: { [ressourceId: string]: IPlanningRessourceItem };
  isOpen: boolean;
  onToggle: () => void;
  annee: number;
  moisFocus?: number; // Mois sélectionné ou en cours (1 à 12)
  onDragStartResource?: (ressource: IRessource) => void;
  onDragEndResource?: () => void;
}

const NOMS_MOIS_COURTS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

export const ResourceDrawer: React.FC<ResourceDrawerProps> = ({
  ressources,
  planningMap = {},
  isOpen,
  onToggle,
  annee,
  moisFocus = new Date().getMonth() + 1,
  onDragStartResource,
  onDragEndResource
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [populationFilter, setPopulationFilter] = useState<'Tous' | 'Interne' | 'Externe'>('Tous');
  const [selectedMois, setSelectedMois] = useState<number>(moisFocus);

  // Mettre à jour si moisFocus change depuis l'extérieur
  React.useEffect(() => {
    setSelectedMois(moisFocus);
  }, [moisFocus]);

  const filteredRessources = ressources.filter((r) => {
    if (!r.actif) return false;
    const matchesSearch =
      r.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.matricule.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPop = populationFilter === 'Tous' || r.type === populationFilter;
    return matchesSearch && matchesPop;
  });

  return (
    <aside
      className={`resource-drawer ${isOpen ? 'open' : 'closed'}`}
      aria-label="Palette des ressources"
      style={{
        position: 'fixed',
        top: '64px',
        right: 0,
        bottom: 0,
        width: isOpen ? '340px' : '44px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(6, 182, 212, 0.3)',
        boxShadow: isOpen ? '-8px 0 32px rgba(0, 0, 0, 0.5)' : 'none',
        zIndex: 1000,
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Bouton Toggle / Onglet vertical */}
      <button
        onClick={onToggle}
        className="btn-drawer-toggle"
        title={isOpen ? 'Replier la palette des ressources' : 'Déplier la palette des ressources (Staffing)'}
        style={{
          position: 'absolute',
          left: '4px',
          top: '12px',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          color: 'var(--primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'all 0.2s'
        }}
      >
        {isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Vue repliée minimale */}
      {!isOpen && (
        <div
          onClick={onToggle}
          style={{
            marginTop: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            height: '100%'
          }}
          title="Cliquer pour ouvrir la palette de staffing"
        >
          <div style={{ color: 'var(--primary)', marginBottom: '8px' }}>
            <Users size={18} />
          </div>
          <span
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}
          >
            Staffing Nominatif
          </span>
        </div>
      )}

      {/* Vue dépliée */}
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: '48px', paddingRight: '16px', paddingTop: '12px', paddingBottom: '16px' }}>
          {/* Header */}
          <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-heading)' }}>
                  Palette Staffing
                </h3>
              </div>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Glissez-déposez sur une cellule ({annee}) pour affecter.
            </p>
          </div>

          {/* Sélecteur de mois focus pour la jauge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              background: 'rgba(30, 41, 59, 0.6)',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Calendar size={13} style={{ color: 'var(--primary)' }} />
              <span>Jauge pour :</span>
            </div>
            <select
              value={selectedMois}
              onChange={(e) => setSelectedMois(parseInt(e.target.value, 10))}
              className="form-select"
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                height: '24px',
                width: '110px',
                background: 'rgba(15, 23, 42, 0.9)',
                color: '#38bdf8',
                fontWeight: 700
              }}
            >
              {NOMS_MOIS_COURTS.map((mNom, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {mNom} {annee}
                </option>
              ))}
            </select>
          </div>

          {/* Recherche & Filtres */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Rechercher nom, rôle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{
                  paddingLeft: '32px',
                  fontSize: '0.8rem',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'rgba(30, 41, 59, 0.6)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {(['Tous', 'Interne', 'Externe'] as const).map((pop) => (
                <button
                  key={pop}
                  type="button"
                  onClick={() => setPopulationFilter(pop)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    fontSize: '0.72rem',
                    fontWeight: populationFilter === pop ? 700 : 500,
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: populationFilter === pop ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                    background: populationFilter === pop ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                    color: populationFilter === pop ? '#38bdf8' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {pop}
                </button>
              ))}
            </div>
          </div>

          {/* Liste scrollable des ressources */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingRight: '4px'
            }}
          >
            {filteredRessources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Aucune ressource trouvée.
              </div>
            ) : (
              filteredRessources.map((r) => {
                const isInterne = r.type === 'Interne';
                const tagColor = isInterne ? '#38bdf8' : '#c084fc';
                const tagBg = isInterne ? 'rgba(56, 189, 248, 0.12)' : 'rgba(192, 132, 252, 0.12)';
                const tagBorder = isInterne ? 'rgba(56, 189, 248, 0.3)' : 'rgba(192, 132, 252, 0.3)';

                // Données de charge sur le mois focus
                const planItem = planningMap[r._id];
                const moisData = planItem?.moisPlanning?.find((mp) => mp.mois === selectedMois);

                const capaciteNette = moisData ? moisData.capaciteNette : Math.round((r.tauxActivite || 1) * 20);
                const totalAffecte = moisData ? moisData.totalJoursAffectes : 0;
                const pctOccupation = capaciteNette > 0 ? Math.round((totalAffecte / capaciteNette) * 100) : (totalAffecte > 0 ? 100 : 0);

                // Couleur et état de la jauge
                let gaugeColor = '#10b981'; // Vert par défaut (< 85%)
                let gaugeLabel = 'Dispo';
                if (pctOccupation > 100) {
                  gaugeColor = '#ef4444'; // Rouge
                  gaugeLabel = 'Surcharge';
                } else if (pctOccupation >= 85) {
                  gaugeColor = '#f59e0b'; // Ambre/Orange
                  gaugeLabel = 'Optimal';
                }

                const gaugeWidthPct = Math.min(100, pctOccupation);

                return (
                  <div
                    key={r._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'RESSOURCE_STAFFING',
                        ressource: r
                      }));
                      e.dataTransfer.effectAllowed = 'copyMove';
                      if (onDragStartResource) onDragStartResource(r);
                    }}
                    onDragEnd={() => {
                      if (onDragEndResource) onDragEndResource();
                    }}
                    className="card-resource-draggable"
                    style={{
                      background: 'rgba(30, 41, 59, 0.7)',
                      border: pctOccupation > 100 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      cursor: 'grab',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                    title={`Glisser ${r.nom} sur un mois pour l'affecter.\nCharge ${NOMS_MOIS_COURTS[selectedMois - 1]} : ${totalAffecte}j / ${capaciteNette}j (${pctOccupation}%)`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.nom}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              color: tagColor,
                              background: tagBg,
                              border: `1px solid ${tagBorder}`
                            }}
                          >
                            {r.type === 'Interne' ? 'INT' : 'EXT'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.role}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                            {r.tauxActivite * 100}% ETP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Jauge d'occupation intégrée sous la carte */}
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '4px', padding: '4px 6px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {NOMS_MOIS_COURTS[selectedMois - 1]} : <strong style={{ color: '#f1f5f9' }}>{totalAffecte}j</strong> / {capaciteNette}j
                        </span>
                        <strong style={{ color: gaugeColor, fontFamily: 'var(--font-mono)' }}>
                          {pctOccupation}% {pctOccupation > 100 ? '⚠️' : ''}
                        </strong>
                      </div>

                      {/* Barre de progression */}
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            width: `${gaugeWidthPct}%`,
                            height: '100%',
                            background: gaugeColor,
                            borderRadius: '2px',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer d'information */}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={14} style={{ color: 'var(--primary)' }} />
            <span>{filteredRessources.length} ressource{filteredRessources.length > 1 ? 's' : ''} active{filteredRessources.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
