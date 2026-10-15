import React from 'react';
import { IProjet, IRapprochementProjetItem } from '../types';
import {
  User,
  Clock,
  Target,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Users,
  Link2
} from 'lucide-react';

export interface IStaffedResourceSummary {
  ressourceId: string;
  nom: string;
  type: 'Interne' | 'Externe';
  jours: number;
}

interface Project360TooltipProps {
  projet: IProjet;
  rapprochement?: IRapprochementProjetItem;
  staffedResources?: IStaffedResourceSummary[];
  position: { x: number; y: number };
  annee: number;
}

export const Project360Tooltip: React.FC<Project360TooltipProps> = ({
  projet,
  rapprochement,
  staffedResources = [],
  position,
  annee
}) => {
  // Calcul positionnement sécurisé pour ne pas déborder de l'écran
  const cardWidth = 360;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1400;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  // Décalage horizontal : afficher à droite de la souris, ou à gauche si près du bord
  let left = position.x + 18;
  if (left + cardWidth > viewportWidth - 20) {
    left = Math.max(10, position.x - cardWidth - 18);
  }

  // Décalage vertical : centrer légèrement par rapport au curseur
  let top = position.y - 20;
  if (top + 460 > viewportHeight) {
    top = Math.max(10, viewportHeight - 480);
  }
  if (top < 10) top = 10;

  // Lead BA
  const leadBAName = projet.leadBA
    ? typeof projet.leadBA === 'object'
      ? projet.leadBA.nom
      : rapprochement?.leadBANom || 'Non assigné'
    : rapprochement?.leadBANom || 'Non assigné';

  // Estimation B0 / B1
  const b0Val = projet.estimationB0 || 0;
  const b1Val = projet.estimationB1 || 0;
  const estimationRetenue = projet.estimationRetenue || rapprochement?.estimationRetenue || 0;
  const chargeMaxToleree = projet.chargeMaxToleree || rapprochement?.chargeMaxToleree || 0;
  const statutEstimation = projet.statutEstimation || rapprochement?.statutEstimation || 'NC';
  const totalPlanifie = projet.totalPlanifie || rapprochement?.totalPlanifie || 0;

  // Données Tempo
  const consommeTempo = rapprochement?.consommeTempo ?? null;
  const planifieADate = rapprochement?.planifieADate ?? null;
  const atterrissagePrevu = rapprochement?.atterrissagePrevu ?? null;
  const resteAFaire = rapprochement?.resteAFaire ?? null;
  const santeConsommation = rapprochement?.santeConsommation || 'VERT';

  // Badge santé globale
  const getSanteBadge = () => {
    // Si Santé Consommation Tempo est dispo
    if (consommeTempo !== null && consommeTempo > 0) {
      if (santeConsommation === 'ROUGE') {
        return {
          label: 'Critique / Dépassement',
          bg: 'rgba(239, 68, 68, 0.2)',
          border: 'rgba(239, 68, 68, 0.6)',
          color: '#ef4444',
          icon: <AlertOctagon size={13} />
        };
      }
      if (santeConsommation === 'ORANGE') {
        return {
          label: 'Vigilance / Surconsommé à date',
          bg: 'rgba(245, 158, 11, 0.2)',
          border: 'rgba(245, 158, 11, 0.6)',
          color: '#f59e0b',
          icon: <AlertTriangle size={13} />
        };
      }
      return {
        label: 'Maîtrisé Tempo',
        bg: 'rgba(16, 185, 129, 0.2)',
        border: 'rgba(16, 185, 129, 0.6)',
        color: '#10b981',
        icon: <CheckCircle2 size={13} />
      };
    }

    // Sinon basé sur la couleur de statut chiffrage
    if (projet.couleurStatut === 'ROUGE') {
      return {
        label: 'Dépassement Chiffrage',
        bg: 'rgba(239, 68, 68, 0.2)',
        border: 'rgba(239, 68, 68, 0.6)',
        color: '#ef4444',
        icon: <ShieldAlert size={13} />
      };
    }
    if (projet.couleurStatut === 'ORANGE') {
      return {
        label: 'Dans la tolérance',
        bg: 'rgba(245, 158, 11, 0.2)',
        border: 'rgba(245, 158, 11, 0.6)',
        color: '#f59e0b',
        icon: <AlertTriangle size={13} />
      };
    }
    if (projet.couleurStatut === 'VERT') {
      return {
        label: 'Conforme Budget',
        bg: 'rgba(16, 185, 129, 0.2)',
        border: 'rgba(16, 185, 129, 0.6)',
        color: '#10b981',
        icon: <ShieldCheck size={13} />
      };
    }
    return {
      label: 'Non chiffré',
      bg: 'rgba(100, 116, 139, 0.2)',
      border: 'rgba(100, 116, 139, 0.4)',
      color: '#94a3b8',
      icon: <Activity size={13} />
    };
  };

  const sante = getSanteBadge();

  // Top 4 ressources staffées
  const topStaff = staffedResources.slice(0, 4);
  const totalStaffJours = staffedResources.reduce((s, r) => s + r.jours, 0);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${cardWidth}px`,
        pointerEvents: 'none',
        zIndex: 99999,
        background: 'rgba(11, 17, 32, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(6, 182, 212, 0.45)',
        borderRadius: '12px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(6, 182, 212, 0.2)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'var(--font-family)',
        color: 'var(--text-main)',
        fontSize: '0.82rem',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      {/* En-tête : Code, Nom, Statut santé */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              {projet.codeProjet && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}
                >
                  {projet.codeProjet}
                </span>
              )}
              {projet.priorite && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {projet.priorite}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginLeft: 'auto'
                }}
              >
                {projet.type}
              </span>
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.92rem',
                color: '#ffffff',
                lineHeight: 1.3,
                wordBreak: 'break-word'
              }}
            >
              {projet.nom}
            </div>
          </div>
        </div>

        {/* Badge Santé Globale */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            alignSelf: 'flex-start',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: sante.bg,
            border: `1px solid ${sante.border}`,
            color: sante.color
          }}
        >
          {sante.icon}
          <span>Santé : {sante.label}</span>
        </div>
      </div>

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Bloc 1 : Lead BA & Cadrage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            padding: '6px 10px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <User size={12} style={{ color: 'var(--primary)' }} />
            Lead BA
          </div>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {leadBAName}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            padding: '6px 10px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={12} style={{ color: '#a855f7' }} />
            Statut & Domaine
          </div>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {projet.statut} {projet.epicDomaine ? `(${projet.epicDomaine})` : ''}
          </div>
        </div>
      </div>

      {/* Bloc 2 : Chiffrage B0 / B1 vs Planifié */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          padding: '8px 10px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Target size={12} style={{ color: '#38bdf8' }} />
            Charge Chiffrage ({statutEstimation})
          </span>
          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
            B0: <strong style={{ color: '#f1f5f9' }}>{b0Val}j</strong> • B1: <strong style={{ color: '#f1f5f9' }}>{b1Val > 0 ? `${b1Val}j` : '—'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
              {estimationRetenue > 0 ? `${estimationRetenue} j` : 'NC'}
            </span>
            {chargeMaxToleree > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                (Max toléré : {chargeMaxToleree}j)
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Planifié total : </span>
            <strong style={{ fontSize: '0.85rem', color: totalPlanifie > chargeMaxToleree && chargeMaxToleree > 0 ? '#f87171' : '#34d399' }}>
              {totalPlanifie} j
            </strong>
          </div>
        </div>
      </div>

      {/* Bloc 3 : Réalisé Tempo vs Atterrissage */}
      <div
        style={{
          background: 'rgba(6, 182, 212, 0.04)',
          borderRadius: '8px',
          padding: '8px 10px',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <Clock size={12} />
            Réalisé Tempo ({annee})
          </span>
          {rapprochement?.jiraBudgetLine && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Ligne : {rapprochement.jiraBudgetLine}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Consommé</div>
            <div style={{ fontWeight: 800, color: '#60a5fa', fontSize: '0.86rem' }}>
              {consommeTempo !== null ? `${consommeTempo} j` : '0 j'}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Planifié à date</div>
            <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: '0.86rem' }}>
              {planifieADate !== null ? `${planifieADate} j` : '0 j'}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Atterrissage</div>
            <div
              style={{
                fontWeight: 800,
                color: atterrissagePrevu && chargeMaxToleree && atterrissagePrevu > chargeMaxToleree ? '#ef4444' : '#10b981',
                fontSize: '0.86rem'
              }}
            >
              {atterrissagePrevu !== null ? `${atterrissagePrevu} j` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Bloc 4 : Principales ressources staffées */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={12} style={{ color: '#f59e0b' }} />
            Ressources staffées ({staffedResources.length})
          </span>
          {totalStaffJours > 0 && (
            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
              {totalStaffJours} j cumulés
            </span>
          )}
        </div>

        {topStaff.length === 0 ? (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
            Aucune ressource nominative assignée.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {topStaff.map((r, idx) => (
              <div
                key={r.ressourceId || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '3px 6px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '4px',
                  fontSize: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: r.type === 'Interne' ? '#38bdf8' : '#c084fc'
                    }}
                  />
                  <span style={{ color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.nom}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: r.type === 'Interne' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(192, 132, 252, 0.15)',
                      color: r.type === 'Interne' ? '#38bdf8' : '#c084fc'
                    }}
                  >
                    {r.type === 'Interne' ? 'Int' : 'Ext'}
                  </span>
                  <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                    {r.jours}j
                  </strong>
                </div>
              </div>
            ))}
            {staffedResources.length > 4 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                + {staffedResources.length - 4} autre(s) collaborateur(s)...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bloc 5 : Dépendances & Prérequis */}
      {projet.dependances && projet.dependances.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '0.74rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
            <Link2 size={12} />
            Prérequis obligatoires ({projet.dependances.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {projet.dependances.map((dep, idx) => (
              <span
                key={dep.projetId || idx}
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#7dd3fc',
                  fontWeight: 600
                }}
              >
                {dep.codeProjet ? `[${dep.codeProjet}] ` : ''}{dep.nom}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
