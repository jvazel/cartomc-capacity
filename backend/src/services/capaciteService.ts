import { Ressource, IRessource } from '../models/Ressource.js';
import { MoisCalendaire } from '../models/MoisCalendaire.js';
import { AbsenceJournaliere } from '../models/AbsenceJournaliere.js';
import { calculerJoursOuvresAuto } from '../utils/calendar.js';

export interface PopulationCapaciteResult {
  etp: number;
  joursOuvres: number;
  capaciteTheorique: number;
  deperdition: number;
  capaciteNette: number;
}

export interface MoisCapaciteResult {
  annee: number;
  mois: number;
  nomMois: string;
  joursOuvres: number;
  estJoursOuvresForces: boolean;
  interne: PopulationCapaciteResult;
  externe: PopulationCapaciteResult;
  global: PopulationCapaciteResult;
}

const NOMS_MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

/**
 * Moteur backend réutilisable de calcul de capacité pour une période donnée.
 */
export async function calculerCapaciteMensuelle(
  annee: number,
  moisDebut: number = 1,
  moisFin: number = 12
): Promise<MoisCapaciteResult[]> {
  const resultats: MoisCapaciteResult[] = [];

  // Récupérer toutes les ressources paramétrées
  const toutesRessources = await Ressource.find({});

  // Récupérer les jours ouvrés forcés pour l'année
  const moisForcesList = await MoisCalendaire.find({ annee });
  const mapJoursForces = new Map<number, number>();
  moisForcesList.forEach((m) => {
    if (m.joursOuvresForces !== undefined && m.joursOuvresForces !== null) {
      mapJoursForces.set(m.mois, m.joursOuvresForces);
    }
  });

  for (let m = moisDebut; m <= moisFin; m++) {
    const debutMois = new Date(Date.UTC(annee, m - 1, 1));
    const finMois = new Date(Date.UTC(annee, m, 0, 23, 59, 59, 999));

    // Jours ouvrés du mois
    const estForced = mapJoursForces.has(m);
    const joursOuvres = estForced
      ? mapJoursForces.get(m)!
      : calculerJoursOuvresAuto(annee, m);

    // Filtrer les ressources actives sur le mois
    const ressourcesActives = toutesRessources.filter((r) => {
      if (!r.actif) return false;
      const arr = new Date(r.dateArrivee);
      if (arr > finMois) return false;
      if (r.dateDepart) {
        const dep = new Date(r.dateDepart);
        if (dep < debutMois) return false;
      }
      return true;
    });

    const ressourcesInternes = ressourcesActives.filter((r) => r.type === 'Interne');
    const ressourcesExternes = ressourcesActives.filter((r) => r.type === 'Externe');

    // Récupérer toutes les absences enregistrées sur ce mois
    const absencesDuMois = await AbsenceJournaliere.find({
      date: { $gte: debutMois, $lte: finMois }
    });

    // Calcul pour une population donnée
    const calculerPourPopulation = (ressources: IRessource[]): PopulationCapaciteResult => {
      const etp = Number(
        ressources.reduce((sum, r) => sum + (r.tauxActivite || 0), 0).toFixed(2)
      );

      const capaciteTheorique = Number((etp * joursOuvres).toFixed(2));

      const setMatricules = new Set(ressources.map((r) => r.matricule.toUpperCase()));

      const deperdition = Number(
        absencesDuMois
          .filter((abs) => setMatricules.has(abs.matricule.toUpperCase()))
          .reduce((sum, abs) => sum + abs.valeur, 0)
          .toFixed(2)
      );

      const capaciteNette = Number((capaciteTheorique - deperdition).toFixed(2));

      return {
        etp,
        joursOuvres,
        capaciteTheorique,
        deperdition,
        capaciteNette
      };
    };

    resultats.push({
      annee,
      mois: m,
      nomMois: NOMS_MOIS[m - 1],
      joursOuvres,
      estJoursOuvresForces: estForced,
      interne: calculerPourPopulation(ressourcesInternes),
      externe: calculerPourPopulation(ressourcesExternes),
      global: calculerPourPopulation(ressourcesActives)
    });
  }

  return resultats;
}
