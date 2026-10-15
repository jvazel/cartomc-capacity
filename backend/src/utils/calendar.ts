/**
 * Calcule la date du Dimanche de Pâques (algorithme de Meeus/Jones/Butcher)
 */
function getPaques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Mars, 4 = Avril
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

/**
 * Retourne la liste des dates des jours fériés légaux en France pour une année donnée
 */
export function getJoursFeriesFrance(annee: number): Set<string> {
  const setFeries = new Set<string>();

  const addDate = (m: number, d: number) => {
    const monthStr = String(m).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    setFeries.add(`${annee}-${monthStr}-${dayStr}`);
  };

  // Jours fériés fixes en France (Zone B)
  addDate(1, 1);   // Jour de l'an
  addDate(5, 1);   // Fête du travail
  addDate(5, 8);   // Victoire 1945
  addDate(7, 14);  // Fête nationale
  addDate(8, 15);  // Assomption
  addDate(11, 1);  // Toussaint
  addDate(11, 11); // Armistice 1918
  addDate(12, 25); // Noël

  // Jours fériés mobiles liés à Pâques
  const paques = getPaques(annee);

  // Lundi de Pâques (Pâques + 1 jour)
  const lundiPaques = new Date(paques);
  lundiPaques.setUTCDate(paques.getUTCDate() + 1);
  addDate(lundiPaques.getUTCMonth() + 1, lundiPaques.getUTCDate());

  // Ascension (Pâques + 39 jours)
  const ascension = new Date(paques);
  ascension.setUTCDate(paques.getUTCDate() + 39);
  addDate(ascension.getUTCMonth() + 1, ascension.getUTCDate());

  // Lundi de Pentecôte (Pâques + 50 jours)
  const lundiPentecote = new Date(paques);
  lundiPentecote.setUTCDate(paques.getUTCDate() + 50);
  addDate(lundiPentecote.getUTCMonth() + 1, lundiPentecote.getUTCDate());

  return setFeries;
}

/**
 * Vérifie si une date calendaire est un jour férié en France
 */
export function estJourFerieFrance(annee: number, mois: number, jour: number): boolean {
  const feries = getJoursFeriesFrance(annee);
  const monthStr = String(mois).padStart(2, '0');
  const dayStr = String(jour).padStart(2, '0');
  return feries.has(`${annee}-${monthStr}-${dayStr}`);
}

/**
 * Calcule automatiquement le nombre de jours ouvrés réels d'un mois en France (Zone B)
 * Hors week-ends (Samedi/Dimanche) ET hors jours fériés légaux.
 */
export function calculerJoursOuvresAuto(annee: number, mois: number): number {
  // mois: 1 à 12
  const totalJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const setFeries = getJoursFeriesFrance(annee);
  let joursOuvres = 0;

  for (let jour = 1; jour <= totalJours; jour++) {
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    const dayOfWeek = date.getUTCDay(); // 0: Dimanche, 6: Samedi
    const monthStr = String(mois).padStart(2, '0');
    const dayStr = String(jour).padStart(2, '0');
    const dateStr = `${annee}-${monthStr}-${dayStr}`;

    const estWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const estFerie = setFeries.has(dateStr);

    if (!estWeekend && !estFerie) {
      joursOuvres++;
    }
  }

  return joursOuvres;
}
