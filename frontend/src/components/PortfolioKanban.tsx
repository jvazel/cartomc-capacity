import React, { useState } from 'react';
import { IProjet, IRessource } from '../types';
import {
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  User,
  SlidersHorizontal,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export type KanbanGroupBy = 'statut' | 'priorite' | 'type';

interface PortfolioKanbanProps {
  projets: IProjet[];
  ressourcesBA: IRessource[];
  isReadOnly: boolean;
  onUpdateStatut: (projetId: string, nouveauStatut: IProjet['statut']) => Promise<void>;
  onUpdatePriorite: (projetId: string, nouvellePrio: IProjet['priorite']) => Promise<void>;
  onOpenEdit: (projet: IProjet) => void;
  onOpenVentilation: (projet: IProjet) => void;
}

export const PortfolioKanban: React.FC<PortfolioKanbanProps> = ({
  projets,
  ressourcesBA,
  isReadOnly,
  onUpdateStatut,
  onUpdatePriorite,
  onOpenEdit,
  onOpenVentilation
}) => {
  const [groupBy, setGroupBy] = useState<KanbanGroupBy>('statut');
  const [filterLeadBA, setFilterLeadBA] = useState<string>('Tous');
  const [filterType, setFilterType] = useState<string>('Tous');
  const [searchCard, setSearchCard] = useState<string>('');
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Filtrage local pour les cartes du Kanban
  const filteredProjets = projets.filter((p) => {
    if (searchCard.trim() !== '') {
      const q = searchCard.toLowerCase();
      const matchNom = p.nom.toLowerCase().includes(q);
      const matchCode = p.codeProjet ? p.codeProjet.toLowerCase().includes(q) : false;
      const matchEpic = p.epicDomaine ? p.epicDomaine.toLowerCase().includes(q) : false;
      if (!matchNom && !matchCode && !matchEpic) return false;
    }
    if (filterType !== 'Tous' && p.type !== filterType) return false;
    if (filterLeadBA !== 'Tous') {
      const leadId = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : p.leadBA;
      if (leadId !== filterLeadBA) return false;
    }
    return true;
  });

  // Définition des colonnes selon le mode de regroupement
  interface KanbanColumnDef {
    id: string;
    label: string;
    badgeColor: string;
    accentColor: string;
    description: string;
  }

  const columns: KanbanColumnDef[] =
    groupBy === 'statut'
      ? [
          {
            id: "À l'étude",
            label: "À l'étude / Cadrage",
            badgeColor: '#f59e0b',
            accentColor: 'rgba(245, 158, 11, 0.15)',
            description: "En phase d'opportunité ou de chiffrage B0"
          },
          {
            id: 'Validé',
            label: 'Validé / Prêt',
            badgeColor: '#06b6d4',
            accentColor: 'rgba(6, 182, 212, 0.15)',
            description: 'Arbitré favorablement, en attente de démarrage ou staffing'
          },
          {
            id: 'En cours',
            label: 'En cours (Actif)',
            badgeColor: '#38bdf8',
            accentColor: 'rgba(56, 189, 248, 0.15)',
            description: 'Réalisation BUILD & consommation de capacité en direct'
          },
          {
            id: 'Terminé',
            label: 'Terminé / Livré',
            badgeColor: '#10b981',
            accentColor: 'rgba(16, 185, 129, 0.15)',
            description: 'Recette clôturée et mise en production effectuée'
          }
        ]
      : groupBy === 'priorite'
      ? [
          {
            id: 'P0',
            label: 'P0 - Critique / Réglementaire',
            badgeColor: '#ef4444',
            accentColor: 'rgba(239, 68, 68, 0.15)',
            description: 'Priorité absolue, bloquant métier ou légal'
          },
          {
            id: 'P1',
            label: 'P1 - Stratégique Haute',
            badgeColor: '#f97316',
            accentColor: 'rgba(249, 115, 22, 0.15)',
            description: 'Projets clés du plan directeur CartOMC'
          },
          {
            id: 'P2',
            label: 'P2 - Moyenne / Business',
            badgeColor: '#eab308',
            accentColor: 'rgba(234, 179, 8, 0.15)',
            description: 'Évolutions métiers importantes'
          },
          {
            id: 'P3_P4',
            label: 'P3 / P4 - Secondaire',
            badgeColor: '#3b82f6',
            accentColor: 'rgba(59, 130, 246, 0.15)',
            description: 'Optimisations et demandes de confort'
          },
          {
            id: 'NON_DEFINI',
            label: 'Sans Priorité / RUN',
            badgeColor: '#64748b',
            accentColor: 'rgba(100, 116, 139, 0.15)',
            description: 'Activités récurrentes ou projets non priorisés'
          }
        ]
      : [
          {
            id: 'Projet',
            label: 'Projets BUILD',
            badgeColor: '#38bdf8',
            accentColor: 'rgba(56, 189, 248, 0.15)',
            description: 'Développements majeurs et nouveaux chantiers'
          },
          {
            id: 'Projet Opex',
            label: 'Projets OPEX',
            badgeColor: '#a855f7',
            accentColor: 'rgba(168, 85, 247, 0.15)',
            description: 'Maintenance évolutive et exploitation'
          },
          {
            id: 'RUN',
            label: 'RUN & MCO',
            badgeColor: '#0284c7',
            accentColor: 'rgba(2, 132, 199, 0.15)',
            description: 'Activités récurrentes et support continu'
          },
          {
            id: 'AUTRES',
            label: "Reco & Vie d'entreprise",
            badgeColor: '#64748b',
            accentColor: 'rgba(100, 116, 139, 0.15)',
            description: 'Recommandations d’audit et gouvernance'
          }
        ];

  // Regroupement des projets par colonne
  const getProjectsForColumn = (colId: string) => {
    return filteredProjets.filter((p) => {
      if (groupBy === 'statut') {
        return p.statut === colId;
      }
      if (groupBy === 'priorite') {
        if (colId === 'P0') return p.priorite === 'P0';
        if (colId === 'P1') return p.priorite === 'P1';
        if (colId === 'P2') return p.priorite === 'P2';
        if (colId === 'P3_P4') return p.priorite === 'P3' || p.priorite === 'P4';
        if (colId === 'NON_DEFINI') return !p.priorite || p.priorite === null;
      }
      if (groupBy === 'type') {
        if (colId === 'Projet') return p.type === 'Projet';
        if (colId === 'Projet Opex') return p.type === 'Projet Opex';
        if (colId === 'RUN') return p.type === 'RUN';
        if (colId === 'AUTRES') return p.type === 'Reco' || p.type === "Vie d'entreprise";
      }
      return false;
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, projetId: string) => {
    if (isReadOnly) return;
    setDraggedProjectId(projetId);
    e.dataTransfer.setData('text/plain', projetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: string) => {
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const pid = draggedProjectId || e.dataTransfer.getData('text/plain');
    if (!pid || isReadOnly) return;

    if (groupBy === 'statut') {
      const validStatut = colId as IProjet['statut'];
      const targetProj = projets.find((p) => p._id === pid);
      if (targetProj && targetProj.statut !== validStatut) {
        await onUpdateStatut(pid, validStatut);
      }
    } else if (groupBy === 'priorite') {
      let targetPrio: IProjet['priorite'] = null;
      if (colId === 'P0') targetPrio = 'P0';
      else if (colId === 'P1') targetPrio = 'P1';
      else if (colId === 'P2') targetPrio = 'P2';
      else if (colId === 'P3_P4') targetPrio = 'P3';
      else if (colId === 'NON_DEFINI') targetPrio = null;

      const targetProj = projets.find((p) => p._id === pid);
      if (targetProj && targetProj.priorite !== targetPrio) {
        await onUpdatePriorite(pid, targetPrio);
      }
    }
    setDraggedProjectId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Barre de contrôle du Kanban */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Sélecteur de regroupement (Colonnes) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <SlidersHorizontal size={15} style={{ color: '#38bdf8' }} /> Regrouper par :
          </span>
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={() => setGroupBy('statut')}
              className="btn"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                border: 'none',
                background: groupBy === 'statut' ? '#0284c7' : 'transparent',
                color: groupBy === 'statut' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: groupBy === 'statut' ? 700 : 500,
                borderRadius: '6px'
              }}
            >
              Statut (Cycle de vie)
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('priorite')}
              className="btn"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                border: 'none',
                background: groupBy === 'priorite' ? '#0284c7' : 'transparent',
                color: groupBy === 'priorite' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: groupBy === 'priorite' ? 700 : 500,
                borderRadius: '6px'
              }}
            >
              Niveau de Priorité (P0-P4)
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('type')}
              className="btn"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                border: 'none',
                background: groupBy === 'type' ? '#0284c7' : 'transparent',
                color: groupBy === 'type' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: groupBy === 'type' ? 700 : 500,
                borderRadius: '6px'
              }}
            >
              Typologie (BUILD / OPEX / RUN)
            </button>
          </div>
        </div>

        {/* Filtres rapides dans le Kanban */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            style={{ width: '180px', padding: '5px 10px', fontSize: '0.82rem', height: '32px' }}
            placeholder="Filtrer les cartes..."
            value={searchCard}
            onChange={(e) => setSearchCard(e.target.value)}
          />

          <select
            className="form-select"
            style={{ width: '140px', padding: '5px 8px', fontSize: '0.82rem', height: '32px' }}
            value={filterLeadBA}
            onChange={(e) => setFilterLeadBA(e.target.value)}
          >
            <option value="Tous">Tous Lead BA</option>
            {ressourcesBA.map((r) => (
              <option key={r._id} value={r._id}>
                {r.nom}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: '130px', padding: '5px 8px', fontSize: '0.82rem', height: '32px' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="Tous">Tous Types</option>
            <option value="Projet">Projets BUILD</option>
            <option value="Projet Opex">Projets Opex</option>
            <option value="RUN">RUN & Support</option>
          </select>
        </div>
      </div>

      {/* Guide visuel Drag & Drop si éditable */}
      {!isReadOnly && (groupBy === 'statut' || groupBy === 'priorite') && (
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '2px 6px'
          }}
        >
          <Sparkles size={14} style={{ color: '#fbbf24' }} />
          <span>
            <strong>Astuce Réunion :</strong> Glissez-déposez les cartes d'une colonne à une autre pour arbitrer ou modifier instantanément leur {groupBy === 'statut' ? 'statut' : 'priorité'}.
          </span>
        </div>
      )}

      {/* Colonnes du Kanban (Grille fluide) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))`,
          gap: '16px',
          alignItems: 'flex-start',
          overflowX: 'auto',
          paddingBottom: '16px'
        }}
      >
        {columns.map((col) => {
          const colProjects = getProjectsForColumn(col.id);
          const totalJHEstimes = colProjects.reduce((acc, p) => acc + (p.estimationRetenue || 0), 0);
          const totalJHPlanifies = colProjects.reduce((acc, p) => acc + (p.totalPlanifie || 0), 0);
          const isDropActive = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                background: isDropActive ? 'rgba(30, 58, 138, 0.25)' : 'var(--surface-color)',
                border: isDropActive ? `2px dashed ${col.badgeColor}` : '1px solid var(--border-color)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '480px',
                transition: 'all 0.15s ease',
                boxShadow: isDropActive ? `0 0 16px ${col.badgeColor}33` : 'none'
              }}
            >
              {/* En-tête de colonne */}
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderTopLeftRadius: '11px',
                  borderTopRightRadius: '11px',
                  borderTop: `3px solid ${col.badgeColor}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: col.badgeColor
                      }}
                    />
                    {col.label}
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: col.accentColor,
                      color: col.badgeColor,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${col.badgeColor}40`
                    }}
                  >
                    {colProjects.length}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  <span>{col.description}</span>
                  <span style={{ fontWeight: 600, color: '#94a3b8' }}>
                    {totalJHEstimes} J.H
                  </span>
                </div>
              </div>

              {/* Corps de la colonne (Liste des cartes) */}
              <div
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  flex: 1
                }}
              >
                {colProjects.length === 0 ? (
                  <div
                    style={{
                      border: '1px dashed rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '30px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      marginTop: '8px'
                    }}
                  >
                    Aucun projet dans cette étape.
                  </div>
                ) : (
                  colProjects.map((p) => {
                    const leadNom = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA.nom : '-';
                    const isCritique = p.couleurStatut === 'ROUGE';
                    const isOrange = p.couleurStatut === 'ORANGE';
                    const isNonChiffre = p.statutEstimation === 'NC' || (!p.estimationB0 && !p.estimationB1);

                    return (
                      <div
                        key={p._id}
                        draggable={!isReadOnly && (groupBy === 'statut' || groupBy === 'priorite')}
                        onDragStart={(e) => handleDragStart(e, p._id)}
                        style={{
                          background: 'rgba(30, 41, 59, 0.6)',
                          border: isCritique
                            ? '1px solid rgba(239, 68, 68, 0.5)'
                            : isOrange
                            ? '1px solid rgba(245, 158, 11, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: !isReadOnly && (groupBy === 'statut' || groupBy === 'priorite') ? 'grab' : 'pointer',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)';
                          e.currentTarget.style.borderColor = isCritique
                            ? 'rgba(239, 68, 68, 0.5)'
                            : isOrange
                            ? 'rgba(245, 158, 11, 0.4)'
                            : 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        {/* Haut de la carte : Code + Priorité + Type */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: '#38bdf8',
                                background: 'rgba(56, 189, 248, 0.12)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              {p.codeProjet || 'PROJ'}
                            </span>
                            {p.priorite && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 5px',
                                  background:
                                    p.priorite === 'P0'
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : p.priorite === 'P1'
                                      ? 'rgba(249, 115, 22, 0.2)'
                                      : p.priorite === 'P2'
                                      ? 'rgba(234, 179, 8, 0.2)'
                                      : 'rgba(59, 130, 246, 0.2)',
                                  color:
                                    p.priorite === 'P0'
                                      ? '#ef4444'
                                      : p.priorite === 'P1'
                                      ? '#f97316'
                                      : p.priorite === 'P2'
                                      ? '#fbbf24'
                                      : '#3b82f6',
                                  border: `1px solid ${
                                    p.priorite === 'P0'
                                      ? '#ef444440'
                                      : p.priorite === 'P1'
                                      ? '#f9731640'
                                      : '#eab30840'
                                  }`
                                }}
                              >
                                {p.priorite}
                              </span>
                            )}
                          </div>

                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              fontWeight: 500
                            }}
                          >
                            {p.type}
                          </span>
                        </div>

                        {/* Titre du Projet */}
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: '#f8fafc',
                            lineHeight: 1.35
                          }}
                        >
                          {p.nom}
                        </div>

                        {/* Domaine / Epic */}
                        {p.epicDomaine && (
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Layers size={12} style={{ color: '#06b6d4' }} /> {p.epicDomaine}
                          </div>
                        )}

                        {/* Métriques Charge & Staffing */}
                        <div
                          style={{
                            background: 'rgba(15, 23, 42, 0.5)',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.75rem'
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Estimé : </span>
                            <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                              {p.estimationRetenue || 0} J.H
                            </strong>
                            <span style={{ fontSize: '0.65rem', marginLeft: '3px', color: p.statutEstimation === 'B1' ? '#38bdf8' : '#fbbf24' }}>
                              ({p.statutEstimation})
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Planifié : </span>
                            <strong style={{ color: isCritique ? '#f87171' : '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                              {p.totalPlanifie || 0} J.H
                            </strong>
                          </div>
                        </div>

                        {/* Alertes d'état / dérapage */}
                        {isCritique && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#f87171',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <AlertTriangle size={12} /> Dérapage critique vs estimation max ({p.chargeMaxToleree}j)
                          </div>
                        )}

                        {isNonChiffre && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#fbbf24',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <AlertCircle size={12} /> Estimation non renseignée
                          </div>
                        )}

                        {/* Pied de carte : Lead BA & Boutons d'actions rapides */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            paddingTop: '8px',
                            marginTop: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            <User size={13} style={{ color: '#06b6d4' }} />
                            <span>{leadNom}</span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => onOpenVentilation(p)}
                              title="Ouvrir la ventilation mensuelle"
                              className="btn btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                height: '24px',
                                borderRadius: '4px'
                              }}
                            >
                              Ventiler
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenEdit(p)}
                              title="Modifier le projet"
                              className="btn btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                height: '24px',
                                borderRadius: '4px'
                              }}
                            >
                              Éditer
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
