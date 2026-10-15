import React, { useMemo } from 'react';
import { IProjet, IVentilationMensuelle } from '../types';

export interface IDependencyLinkItem {
  id: string;
  sourceProjectId: string;
  sourceProjectNom: string;
  sourceCodeProjet?: string;
  targetProjectId: string;
  targetProjectNom: string;
  targetCodeProjet?: string;
  sourceMoisEnd: number;
  targetMoisStart: number;
  hasConflict: boolean;
  isTension: boolean;
}

interface GanttDependencyLinksProps {
  projets: IProjet[];
  simulatedVentilations: Record<string, IVentilationMensuelle[]>;
  periodes: Array<{ key: string; label: string; moisList: number[] }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  showLinks: boolean;
  linkFilter: 'all' | 'conflicts_only' | 'focused_only';
  focusedProjectId: string | null;
  onSelectProject?: (projectId: string) => void;
}

export const GanttDependencyLinks: React.FC<GanttDependencyLinksProps> = ({
  projets,
  simulatedVentilations,
  periodes,
  containerRef,
  tableRef,
  showLinks,
  linkFilter,
  focusedProjectId,
  onSelectProject
}) => {
  // 1. Calculer les liens de dépendances existants
  const links = useMemo(() => {
    if (!showLinks) return [];

    const result: IDependencyLinkItem[] = [];
    const projetsMap = new Map<string, IProjet>();
    projets.forEach((p) => projetsMap.set(p._id, p));

    projets.forEach((successeur) => {
      if (!successeur.dependances || successeur.dependances.length === 0) return;

      const succVent = simulatedVentilations[successeur._id] || [];
      const succActiveMois = succVent
        .filter((v) => (v.joursInternes || 0) + (v.joursExternes || 0) > 0)
        .map((v) => v.mois);
      const targetMoisStart = succActiveMois.length > 0 ? Math.min(...succActiveMois) : 1;

      successeur.dependances.forEach((dep) => {
        const prerequis = projetsMap.get(dep.projetId);
        if (!prerequis) return;

        const preVent = simulatedVentilations[prerequis._id] || [];
        const preActiveMois = preVent
          .filter((v) => (v.joursInternes || 0) + (v.joursExternes || 0) > 0)
          .map((v) => v.mois);
        const sourceMoisEnd = preActiveMois.length > 0 ? Math.max(...preActiveMois) : 12;

        const hasConflict = targetMoisStart < sourceMoisEnd;
        const isTension = targetMoisStart === sourceMoisEnd;

        // Filtrage selon le mode choisi
        if (linkFilter === 'conflicts_only' && !hasConflict && !isTension) {
          return;
        }

        if (
          linkFilter === 'focused_only' &&
          focusedProjectId &&
          successeur._id !== focusedProjectId &&
          prerequis._id !== focusedProjectId
        ) {
          return;
        }

        result.push({
          id: `${prerequis._id}->${successeur._id}`,
          sourceProjectId: prerequis._id,
          sourceProjectNom: prerequis.nom,
          sourceCodeProjet: prerequis.codeProjet,
          targetProjectId: successeur._id,
          targetProjectNom: successeur.nom,
          targetCodeProjet: successeur.codeProjet,
          sourceMoisEnd,
          targetMoisStart,
          hasConflict,
          isTension
        });
      });
    });

    return result;
  }, [projets, simulatedVentilations, showLinks, linkFilter, focusedProjectId]);

  // Si désactivé ou aucun lien
  if (!showLinks || links.length === 0) return null;

  // Calcul dynamique des coordonnées SVG relatives au conteneur de table
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible'
      }}
    >
      <defs>
        {/* Flèche Cyan Standard (Nominal) */}
        <marker
          id="dep-arrow-cyan"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#06b6d4" />
        </marker>

        {/* Flèche Rouge Néon (Conflit Chronologique) */}
        <marker
          id="dep-arrow-conflict"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
        </marker>

        {/* Flèche Ambre (Tension même mois) */}
        <marker
          id="dep-arrow-tension"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#fbbf24" />
        </marker>

        {/* Flèche Violet Focus */}
        <marker
          id="dep-arrow-focus"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
        </marker>

        {/* Filtre Lueurs Néon */}
        <filter id="neon-glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="neon-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {links.map((link) => {
        // Trouver les éléments DOM sources et cibles
        const container = containerRef.current;
        if (!container) return null;

        const sourceEl = container.querySelector(`[data-cell-project="${link.sourceProjectId}"][data-cell-month="${link.sourceMoisEnd}"]`);
        const targetEl = container.querySelector(`[data-cell-project="${link.targetProjectId}"][data-cell-month="${link.targetMoisStart}"]`);

        if (!sourceEl || !targetEl) return null;

        const containerRect = container.getBoundingClientRect();
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        // Coordonnées relatives au conteneur avec scroll
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;

        // Point de départ : Bord droit milieu de la cellule prérequis
        const startX = sourceRect.right - containerRect.left + scrollLeft - 6;
        const startY = sourceRect.top - containerRect.top + scrollTop + sourceRect.height / 2;

        // Point d'arrivée : Bord gauche milieu de la cellule successeur
        const endX = targetRect.left - containerRect.left + scrollLeft + 6;
        const endY = targetRect.top - containerRect.top + scrollTop + targetRect.height / 2;

        const isFocused =
          focusedProjectId &&
          (focusedProjectId === link.sourceProjectId || focusedProjectId === link.targetProjectId);

        // Couleur et style selon conflit ou tension
        let strokeColor = 'rgba(6, 182, 212, 0.55)';
        let markerId = 'dep-arrow-cyan';
        let strokeDash = '4 3';
        let strokeWidth = 1.8;
        let filterEffect = undefined;

        if (link.hasConflict) {
          strokeColor = '#f43f5e';
          markerId = 'dep-arrow-conflict';
          strokeDash = 'none';
          strokeWidth = 2.6;
          filterEffect = 'url(#neon-glow-red)';
        } else if (link.isTension) {
          strokeColor = '#fbbf24';
          markerId = 'dep-arrow-tension';
          strokeDash = '5 2';
          strokeWidth = 2.2;
        } else if (isFocused) {
          strokeColor = '#c084fc';
          markerId = 'dep-arrow-focus';
          strokeDash = 'none';
          strokeWidth = 2.8;
          filterEffect = 'url(#neon-glow-cyan)';
        }

        // Calcul du tracé en courbe élégante (Bézier S-Curve ou orthogonale)
        // Cas A : Le successeur est après le prérequis dans le temps (startX < endX)
        let pathD = '';
        if (startX < endX - 10) {
          const midX = (startX + endX) / 2;
          pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX - 4} ${endY}`;
        } else {
          // Cas B : Conflit chronologique (le successeur démarre avant ou au même mois : endX <= startX)
          // La flèche doit faire une boucle visible par le haut/bas pour bien matérialiser le retour en arrière
          const loopOutX = Math.max(startX + 28, endX + 28);
          const midY = (startY + endY) / 2;
          pathD = `M ${startX} ${startY} L ${loopOutX} ${startY} C ${loopOutX + 20} ${midY}, ${loopOutX + 20} ${endY}, ${loopOutX} ${endY} L ${endX + 6} ${endY}`;
        }

        return (
          <g key={link.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
            {/* Ligne invisible plus large pour faciliter le clic/survol */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              onClick={() => onSelectProject && onSelectProject(link.targetProjectId)}
            >
              <title>
                {link.hasConflict
                  ? `🚨 CONFLIT CRITIQUE !\n[${link.targetCodeProjet || 'Projet'}] démarre en M${link.targetMoisStart < 10 ? '0' : ''}${link.targetMoisStart} AVANT la fin de son prérequis [${link.sourceCodeProjet || 'Prérequis'}] (M${link.sourceMoisEnd < 10 ? '0' : ''}${link.sourceMoisEnd})`
                  : link.isTension
                  ? `⚠️ TENSION : Démarre sur le même mois (M${link.targetMoisStart}) que la fin du prérequis.`
                  : `Liaison Fin ➔ Début :\n${link.sourceProjectNom} (Fin M${link.sourceMoisEnd}) ➔ ${link.targetProjectNom} (Début M${link.targetMoisStart})`}
              </title>
            </path>

            {/* Tracé visible de la flèche de dépendance */}
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDash}
              markerEnd={`url(#${markerId})`}
              filter={filterEffect}
              style={{
                transition: 'stroke 0.3s ease, stroke-width 0.3s ease'
              }}
            />

            {/* Badge d'alerte centré sur la flèche en cas de conflit */}
            {link.hasConflict && (
              <g
                transform={`translate(${(startX + endX) / 2}, ${(startY + endY) / 2})`}
                style={{ pointerEvents: 'none' }}
              >
                <circle r={9} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} filter="url(#neon-glow-red)" />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10px"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  !
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
