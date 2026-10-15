export interface AbsenceRange {
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  totalJours: number;
  count: number;
}

/**
 * Regroupe les dates d'absences consécutives en plages de dates (ex: "Du 14/05 au 22/05 (7j)").
 * Gère le chevauchement du week-end (ex: du Vendredi au Lundi suivant).
 */
export function groupConsecutiveAbsences(
  details: Array<{ date: string; valeur: number }>
): AbsenceRange[] {
  if (!details || details.length === 0) return [];

  // Trier par date croissante
  const sorted = [...details].sort((a, b) => a.date.localeCompare(b.date));

  const ranges: AbsenceRange[] = [];
  let currentRange: AbsenceRange | null = null;
  let lastDateObj: Date | null = null;

  sorted.forEach((item) => {
    const parts = item.date.split('-');
    const currentDateObj = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));

    if (!currentRange || !lastDateObj) {
      currentRange = {
        startDateStr: item.date,
        endDateStr: item.date,
        totalJours: item.valeur,
        count: 1
      };
      lastDateObj = currentDateObj;
    } else {
      // Calculer l'écart en jours calendaires
      const diffTime = currentDateObj.getTime() - lastDateObj.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      // Si consécutif (1 jour) ou séparé uniquement par un week-end (2-3 jours sans autre jour travaillé entre)
      if (diffDays >= 1 && diffDays <= 3) {
        currentRange.endDateStr = item.date;
        currentRange.totalJours = Number((currentRange.totalJours + item.valeur).toFixed(1));
        currentRange.count += 1;
        lastDateObj = currentDateObj;
      } else {
        // Nouvelle plage d'absence isolée
        ranges.push(currentRange);
        currentRange = {
          startDateStr: item.date,
          endDateStr: item.date,
          totalJours: item.valeur,
          count: 1
        };
        lastDateObj = currentDateObj;
      }
    }
  });

  if (currentRange) {
    ranges.push(currentRange);
  }

  return ranges;
}

/**
 * Formate une plage d'absence pour l'affichage (ex: "Du 14/05 au 22/05 (7j)" ou "05/06 (1j)").
 */
export function formatAbsenceRangeLabel(range: AbsenceRange): string {
  const startParts = range.startDateStr.split('-');
  const startLabel = `${startParts[2]}/${startParts[1]}`;

  if (range.startDateStr === range.endDateStr) {
    return `${startLabel} (${range.totalJours}j)`;
  }

  const endParts = range.endDateStr.split('-');
  const endLabel = `${endParts[2]}/${endParts[1]}`;

  return `Du ${startLabel} au ${endLabel} (${range.totalJours}j)`;
}
