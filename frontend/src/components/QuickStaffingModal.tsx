import React, { useState, useEffect } from 'react';
import { IRessource } from '../types';
import { UserCheck, X, AlertTriangle, ShieldAlert, CheckCircle2, AlertOctagon, Info } from 'lucide-react';

interface QuickStaffingModalProps {
  isOpen: boolean;
  onClose: () => void;
  ressource: IRessource;
  projet: {
    _id: string;
    nom: string;
    codeProjet?: string;
  };
  mois: number;
  annee: number;
  joursExistants?: number;
  onConfirm: (jours: number) => void;
}

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface IResourceMonthlyStatus {
  joursOuvres: number;
  capaciteTheorique: number;
  absences: number;
  capaciteNette: number;
  totalJoursAffectesAutres: number; // Jours déjà affectés sur d'autres projets sur ce mois
  projetsAffectes: Array<{ projetId: string; nomProjet: string; codeProjet?: string; jours: number }>;
}

export const QuickStaffingModal: React.FC<QuickStaffingModalProps> = ({
  isOpen,
  onClose,
  ressource,
  projet,
  mois,
  annee,
  joursExistants = 0,
  onConfirm
}) => {
  const [joursInput, setJoursInput] = useState<string>(
    joursExistants > 0 ? String(joursExistants) : '5'
  );
  const [monthlyStatus, setMonthlyStatus] = useState<IResourceMonthlyStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Charger le statut de capacité et les affectations existantes sur le mois cible
  useEffect(() => {
    if (!isOpen) return;
    setLoadingStatus(true);
    fetch(`/api/ressources/planning/matrice?annee=${annee}`)
      .then((res) => res.json())
      .then((data) => {
        const rItem = (data.ressources || []).find(
          (item: any) => item.ressource?._id === ressource._id
        );
        if (rItem && rItem.moisPlanning) {
          const mData = rItem.moisPlanning.find((mp: any) => mp.mois === mois);
          if (mData) {
            // Filtrer les jours des AUTRES projets (exclure le projet courant pour ne pas double-compter)
            const otherProjets = (mData.projets || []).filter(
              (p: any) => String(p.projetId) !== String(projet._id)
            );
            const totalAutres = otherProjets.reduce((sum: number, p: any) => sum + (p.jours || 0), 0);

            setMonthlyStatus({
              joursOuvres: mData.joursOuvres || 20,
              capaciteTheorique: mData.capaciteTheorique || 20,
              absences: mData.absences || 0,
              capaciteNette: mData.capaciteNette || 20,
              totalJoursAffectesAutres: Number(totalAutres.toFixed(1)),
              projetsAffectes: otherProjets
            });
          }
        }
        setLoadingStatus(false);
      })
      .catch((err) => {
        console.error('Erreur chargement statut ressource:', err);
        setLoadingStatus(false);
      });
  }, [isOpen, annee, mois, ressource._id, projet._id]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(joursInput);
    if (!isNaN(val) && val >= 0) {
      onConfirm(val);
    }
  };

  const isInterne = ressource.type === 'Interne';
  const valSaisie = parseFloat(joursInput) || 0;

  // Calcul du conflit et taux de saturation
  const capaciteNette = monthlyStatus ? monthlyStatus.capaciteNette : 20;
  const joursDejaPris = monthlyStatus ? monthlyStatus.totalJoursAffectesAutres : 0;
  const totalFutur = Number((joursDejaPris + valSaisie).toFixed(1));
  const tauxOccupationFutur = capaciteNette > 0 ? Math.round((totalFutur / capaciteNette) * 100) : 100;
  const depassementJours = Number((totalFutur - capaciteNette).toFixed(1));

  const hasConflit = totalFutur > capaciteNette;

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-card" style={{ maxWidth: '460px', width: '92%' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: isInterne ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isInterne ? '#38bdf8' : '#c084fc'
              }}
            >
              <UserCheck size={18} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-heading)'
                }}
              >
                Affecter {ressource.nom}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {ressource.role} • {ressource.type}
              </div>
            </div>
          </div>
          <button className="toast-close-btn" onClick={onClose} style={{ fontSize: '1.2rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Cible d'affectation */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '2px' }}>
                Cible d'affectation :
              </div>
              <div style={{ fontWeight: 700, color: '#ffffff' }}>
                {projet.codeProjet && (
                  <span className="badge badge-secondary" style={{ marginRight: '6px' }}>
                    {projet.codeProjet}
                  </span>
                )}
                {projet.nom}
              </div>
              <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', marginTop: '4px' }}>
                📅 Mois : {NOMS_MOIS[mois - 1]} {annee}
              </div>
            </div>

            {/* Situation Capacitaire du Collaborateur sur ce mois */}
            {monthlyStatus && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Capacité nette ({monthlyStatus.joursOuvres}j ouvrés - {monthlyStatus.absences}j abs) :</span>
                  <strong style={{ color: '#ffffff' }}>{capaciteNette} j</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Déjà affecté sur d'autres projets :</span>
                  <strong style={{ color: joursDejaPris > 0 ? '#38bdf8' : '#94a3b8' }}>
                    {joursDejaPris} j
                  </strong>
                </div>

                {monthlyStatus.projetsAffectes.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px', paddingLeft: '6px', borderLeft: '2px solid rgba(6, 182, 212, 0.4)' }}>
                    {monthlyStatus.projetsAffectes.map((pa, idx) => (
                      <div key={idx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        • {pa.codeProjet ? `[${pa.codeProjet}] ` : ''}{pa.nomProjet} : <strong style={{ color: '#e2e8f0' }}>{pa.jours}j</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Saisie des jours */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Nombre de jours à affecter sur ce projet :</span>
                {joursExistants > 0 && (
                  <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>
                    Actuellement sur ce projet : {joursExistants}j
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="0"
                  max="31"
                  step="0.5"
                  required
                  autoFocus
                  className="form-input"
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    borderColor: hasConflit ? '#ef4444' : undefined
                  }}
                  value={joursInput}
                  onChange={(e) => setJoursInput(e.target.value)}
                />
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>jours</span>
              </div>
            </div>

            {/* ALERTE DE CONFLIT DE STAFFING EN TEMPS RÉEL (Axe 4) */}
            {hasConflit ? (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.6)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <AlertOctagon size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem' }}>
                    Attention : Conflit de staffing !
                  </div>
                  <div style={{ color: '#fecaca', fontSize: '0.78rem', marginTop: '2px', lineHeight: 1.35 }}>
                    Collaborateur déjà staffé à <strong>{tauxOccupationFutur}%</strong> sur ce mois ({totalFutur}j affectés pour {capaciteNette}j de capacité nette, soit un dépassement de <strong>+{depassementJours}j</strong>).
                  </div>
                </div>
              </div>
            ) : valSaisie > 0 && monthlyStatus ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: '#34d399'
                }}
              >
                <CheckCircle2 size={16} />
                <span>
                  Staffing total maîtrisé : <strong>{totalFutur}j / {capaciteNette}j</strong> ({tauxOccupationFutur}% d'occupation).
                </span>
              </div>
            ) : null}

            {/* Boutons d'accès rapide aux volumes usuels */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['2.5', '5', '10', '15', '20'].map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJoursInput(j)}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {j}j
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '20px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px'
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className={hasConflit ? 'btn btn-danger' : 'btn btn-primary'}
              style={{ minWidth: '110px' }}
            >
              {hasConflit ? 'Forcer / Enregistrer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
