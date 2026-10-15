export type CompletudeStatut = 'VENTILE' | 'SOUS_VENTILE' | 'SUR_VENTILE' | 'NON_CHIFFRE';

export interface ICompletudeInfo {
  statut: CompletudeStatut;
  libelle: string;
  badgeClass: string;
  pourcentage: number | null;
  description: string;
}

/**
 * Calcule l'état de complétude de la ventilation par rapport à l'estimation retenue (B0 ou B1)
 */
export function getCompletudeVentilation(totalPlanifie: number, estimationRetenue: number): ICompletudeInfo {
  if (!estimationRetenue || estimationRetenue <= 0) {
    return {
      statut: 'NON_CHIFFRE',
      libelle: '⚪ Non chiffré',
      badgeClass: 'badge-secondary',
      pourcentage: null,
      description: 'Aucune estimation B0/B1 définie'
    };
  }

  const ratio = (totalPlanifie / estimationRetenue) * 100;
  const pctRound = Math.round(ratio);

  if (totalPlanifie === estimationRetenue) {
    return {
      statut: 'VENTILE',
      libelle: '🟢 100% ventilé',
      badgeClass: 'badge-success',
      pourcentage: 100,
      description: `Ventilation parfaite (${totalPlanifie}j ventilés sur ${estimationRetenue}j estimés)`
    };
  }

  if (totalPlanifie < estimationRetenue) {
    return {
      statut: 'SOUS_VENTILE',
      libelle: `🟡 Sous-ventilé (${pctRound}%)`,
      badgeClass: 'badge-warning',
      pourcentage: pctRound,
      description: `Ventilation incomplète (${totalPlanifie}j planifiés sur ${estimationRetenue}j estimés)`
    };
  }

  return {
    statut: 'SUR_VENTILE',
    libelle: `🔴 Sur-ventilé (${pctRound}%)`,
    badgeClass: 'badge-danger',
    pourcentage: pctRound,
    description: `Ventilation supérieure à l'estimation (${totalPlanifie}j planifiés sur ${estimationRetenue}j estimés)`
  };
}
