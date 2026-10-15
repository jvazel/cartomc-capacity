export interface IHeatmapStyle {
  bg: string;
  border: string;
  color: string;
  label: string;
}

/**
 * Calcule une couleur dynamique de type Heatmap (du vert clair au rouge sombre)
 * en fonction du taux de déperdition / absentéisme (de 0% à 50%+)
 * 
 * @param deperditionJours Nombre de jours d'absence cumulés
 * @param capaciteTheoriqueJours Capacité théorique totale de la population ou de la ressource
 */
export function getAbsenceHeatmapStyle(deperditionJours: number, capaciteTheoriqueJours: number): IHeatmapStyle {
  if (!capaciteTheoriqueJours || capaciteTheoriqueJours <= 0 || deperditionJours <= 0) {
    return {
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.2)',
      color: '#34d399',
      label: '0% abs.'
    };
  }

  const tauxPct = (deperditionJours / capaciteTheoriqueJours) * 100;

  // Seuil 1 : 0% - 5% (Absentéisme très faible / normal) -> Vert clair
  if (tauxPct <= 5) {
    return {
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.35)',
      color: '#34d399',
      label: `${tauxPct.toFixed(1)}% abs.`
    };
  }

  // Seuil 2 : 5% - 15% (Absentéisme modéré) -> Jaune / Lime
  if (tauxPct <= 15) {
    return {
      bg: 'rgba(234, 179, 8, 0.2)',
      border: 'rgba(234, 179, 8, 0.4)',
      color: '#facc15',
      label: `${tauxPct.toFixed(1)}% abs.`
    };
  }

  // Seuil 3 : 15% - 30% (Absentéisme élevé / Semaines de congés) -> Orange
  if (tauxPct <= 30) {
    return {
      bg: 'rgba(249, 115, 22, 0.25)',
      border: 'rgba(249, 115, 22, 0.5)',
      color: '#fb923c',
      label: `${tauxPct.toFixed(1)}% abs.`
    };
  }

  // Seuil 4 : 30% - 50% (Absentéisme très élevé / Ponts / Mois d'août) -> Rouge vif
  if (tauxPct <= 50) {
    return {
      bg: 'rgba(239, 68, 68, 0.3)',
      border: 'rgba(239, 68, 68, 0.6)',
      color: '#f87171',
      label: `${tauxPct.toFixed(1)}% abs.`
    };
  }

  // Seuil 5 : > 50% (Absentéisme critique / Pic massif) -> Rouge sombre / Violet
  return {
    bg: 'rgba(185, 28, 28, 0.45)',
    border: 'rgba(225, 29, 72, 0.8)',
    color: '#fda4af',
    label: `${tauxPct.toFixed(1)}% abs. 🔥`
  };
}
