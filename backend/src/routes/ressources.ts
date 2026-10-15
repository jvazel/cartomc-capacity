import { Router, Request, Response } from 'express';
import { Ressource } from '../models/Ressource.js';

const router = Router();

// GET all
router.get('/', async (_req: Request, res: Response) => {
  try {
    const ressources = await Ressource.find().sort({ nom: 1 });
    res.json(ressources);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET single
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const ressource = await Ressource.findById(req.params.id);
    if (!ressource) return res.status(404).json({ message: 'Ressource introuvable' });
    res.json(ressource);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE
router.post('/', async (req: Request, res: Response) => {
  try {
    const nouvelleRessource = new Ressource(req.body);
    const saved = await nouvelleRessource.save();
    res.status(201).json(saved);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce matricule existe déjà.' });
    }
    res.status(400).json({ message: error.message });
  }
});

// UPDATE
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await Ressource.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Ressource introuvable' });
    res.json(updated);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce matricule existe déjà.' });
    }
    res.status(400).json({ message: error.message });
  }
});

// DELETE
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await Ressource.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Ressource introuvable' });
    res.json({ message: 'Ressource supprimée avec succès' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/ressources/planning?annee=2026 : Planning multidimensionnel ressources x projets affectés
router.get('/planning/matrice', async (req: Request, res: Response) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();

    const [ressources, ventilations, projets, worklogs] = await Promise.all([
      Ressource.find().sort({ nom: 1 }),
      (await import('../models/VentilationMensuelle.js')).VentilationMensuelle.find({ annee }),
      (await import('../models/Projet.js')).Projet.find().select('_id nom codeProjet type priorite jiraBudgetLine jiraEpicKey jiraFeatureId'),
      (await import('../models/TempoWorklog.js')).TempoWorklog.find({ year: annee }).select('collaborator month timeInDays timeInHours budgetLine epicSummary featureId category')
    ]);

    const { MoisCalendaire } = await import('../models/MoisCalendaire.js');
    const { AbsenceJournaliere } = await import('../models/AbsenceJournaliere.js');
    const { calculerJoursOuvresAuto } = await import('../utils/calendar.js');

    // Jours ouvrés forcés
    const moisForcesList = await MoisCalendaire.find({ annee });
    const mapJoursForces = new Map<number, number>();
    moisForcesList.forEach((m) => {
      if (m.joursOuvresForces !== undefined && m.joursOuvresForces !== null) {
        mapJoursForces.set(m.mois, m.joursOuvresForces);
      }
    });

    const projetsMap = new Map<string, any>();
    projets.forEach((p) => {
      projetsMap.set(p._id.toString(), p);
    });

    // Absences de l'année
    const debutAnnee = new Date(Date.UTC(annee, 0, 1));
    const finAnnee = new Date(Date.UTC(annee, 11, 31, 23, 59, 59, 999));
    const absencesAnnee = await AbsenceJournaliere.find({
      date: { $gte: debutAnnee, $lte: finAnnee }
    });

    // Map absences par matricule -> mois -> jours
    const absencesByRessourceMois = new Map<string, Map<number, number>>();
    absencesAnnee.forEach((abs) => {
      const mat = (abs.matricule || '').toUpperCase();
      if (!absencesByRessourceMois.has(mat)) {
        absencesByRessourceMois.set(mat, new Map());
      }
      const d = new Date(abs.date);
      const m = d.getUTCMonth() + 1;
      const cur = absencesByRessourceMois.get(mat)!.get(m) || 0;
      absencesByRessourceMois.get(mat)!.set(m, cur + (abs.valeur || 0));
    });

    // Structure des réservoirs non assignés mois par mois
    // mois -> { interne: Array<{ projetId, codeProjet, nomProjet, jours }>, externe: Array<...> }
    const nonAssignesParMois: { [mois: number]: { interne: any[]; externe: any[]; totalInterne: number; totalExterne: number } } = {};
    for (let m = 1; m <= 12; m++) {
      nonAssignesParMois[m] = { interne: [], externe: [], totalInterne: 0, totalExterne: 0 };
    }

    // Map des affectations par ressourceId -> mois -> Array<{ projetId, codeProjet, nomProjet, jours }>
    const affectationsParRessource = new Map<string, Map<number, any[]>>();

    ventilations.forEach((v) => {
      const p = projetsMap.get(v.projetId.toString());
      if (!p) return;

      const m = v.mois;
      const affectations = v.affectations || [];

      let sommeAffecteeInterne = 0;
      let sommeAffecteeExterne = 0;

      affectations.forEach((aff) => {
        const rid = aff.ressourceId.toString();
        if (!affectationsParRessource.has(rid)) {
          affectationsParRessource.set(rid, new Map());
        }
        if (!affectationsParRessource.get(rid)!.has(m)) {
          affectationsParRessource.get(rid)!.set(m, []);
        }

        affectationsParRessource.get(rid)!.get(m)!.push({
          projetId: p._id,
          codeProjet: p.codeProjet || '',
          nomProjet: p.nom,
          typeProjet: p.type,
          priorite: p.priorite,
          jours: aff.jours,
          typeRessource: aff.type
        });

        if (aff.type === 'Externe') {
          sommeAffecteeExterne += aff.jours;
        } else {
          sommeAffecteeInterne += aff.jours;
        }
      });

      // Calcul du reste non assigné
      const resteInterne = Math.max(0, Number((v.joursInternes - sommeAffecteeInterne).toFixed(1)));
      const resteExterne = Math.max(0, Number((v.joursExternes - sommeAffecteeExterne).toFixed(1)));

      if (resteInterne > 0) {
        nonAssignesParMois[m].interne.push({
          projetId: p._id,
          codeProjet: p.codeProjet || '',
          nomProjet: p.nom,
          typeProjet: p.type,
          priorite: p.priorite,
          jours: resteInterne
        });
        nonAssignesParMois[m].totalInterne = Number((nonAssignesParMois[m].totalInterne + resteInterne).toFixed(1));
      }

      if (resteExterne > 0) {
        nonAssignesParMois[m].externe.push({
          projetId: p._id,
          codeProjet: p.codeProjet || '',
          nomProjet: p.nom,
          typeProjet: p.type,
          priorite: p.priorite,
          jours: resteExterne
        });
        nonAssignesParMois[m].totalExterne = Number((nonAssignesParMois[m].totalExterne + resteExterne).toFixed(1));
      }
    });

    // Indexer les projets pour correspondance avec les worklogs Tempo
    const matchProjetForWorklog = (w: any) => {
      const budgetLine = (w.budgetLine || '').toLowerCase().trim();
      const epicSummary = (w.epicSummary || '').toLowerCase().trim();
      const featureId = (w.featureId || '').trim();

      for (const p of projets) {
        if (p.codeProjet && p.codeProjet.trim() && budgetLine === p.codeProjet.trim().toLowerCase()) return p;
        if (p.jiraBudgetLine && p.jiraBudgetLine.trim() && budgetLine === p.jiraBudgetLine.trim().toLowerCase()) return p;
        if (p.jiraEpicKey && p.jiraEpicKey.trim() && epicSummary.includes(p.jiraEpicKey.trim().toLowerCase())) return p;
        if (p.jiraFeatureId && p.jiraFeatureId.trim() && featureId && featureId === p.jiraFeatureId.trim()) return p;
      }
      return null;
    };

    // Indexer les ressources par nom (insensible à la casse/trim)
    const ressourceByNameMap = new Map<string, any>();
    ressources.forEach((r) => {
      ressourceByNameMap.set((r.nom || '').toLowerCase().trim(), r);
    });

    // Structure des consommations Tempo réelles par ressourceId -> mois -> { totalJours, totalHeures, projets: Map<projetKey, { projetId, codeProjet, nomProjet, jours, heures, isHorsProjet }> }
    const tempoByRessourceMois = new Map<string, Map<number, {
      totalJours: number;
      totalHeures: number;
      projetsMap: Map<string, {
        projetId?: string;
        codeProjet?: string;
        nomProjet: string;
        typeProjet: string;
        priorite?: string | null;
        jours: number;
        heures: number;
        isHorsProjet: boolean;
      }>;
    }>>();

    worklogs.forEach((w: any) => {
      const collName = (w.collaborator || '').toLowerCase().trim();
      const ressource = ressourceByNameMap.get(collName);
      if (!ressource) return; // Uniquement pour les collaborateurs de l'équipe

      const rid = ressource._id.toString();
      const m = w.month;
      if (m < 1 || m > 12) return;

      if (!tempoByRessourceMois.has(rid)) {
        tempoByRessourceMois.set(rid, new Map());
      }
      if (!tempoByRessourceMois.get(rid)!.has(m)) {
        tempoByRessourceMois.get(rid)!.set(m, {
          totalJours: 0,
          totalHeures: 0,
          projetsMap: new Map()
        });
      }

      const mData = tempoByRessourceMois.get(rid)!.get(m)!;
      const j = Number(w.timeInDays || 0);
      const h = Number(w.timeInHours || 0);

      mData.totalJours = Number((mData.totalJours + j).toFixed(2));
      mData.totalHeures = Number((mData.totalHeures + h).toFixed(1));

      const matchedP = matchProjetForWorklog(w);
      const pKey = matchedP ? matchedP._id.toString() : `tempo_${w.budgetLine || w.epicSummary || 'AUTRE'}`;

      if (!mData.projetsMap.has(pKey)) {
        mData.projetsMap.set(pKey, {
          projetId: matchedP ? matchedP._id.toString() : undefined,
          codeProjet: matchedP ? matchedP.codeProjet : (w.budgetLine || ''),
          nomProjet: matchedP ? matchedP.nom : (w.budgetLine || w.epicSummary || 'Activité diverse'),
          typeProjet: matchedP ? matchedP.type : (w.category || 'RUN'),
          priorite: matchedP ? matchedP.priorite : null,
          jours: 0,
          heures: 0,
          isHorsProjet: !matchedP
        });
      }

      const pEntry = mData.projetsMap.get(pKey)!;
      pEntry.jours = Number((pEntry.jours + j).toFixed(2));
      pEntry.heures = Number((pEntry.heures + h).toFixed(1));
    });

    // Construction du retour pour chaque ressource
    const planningRessources = ressources.map((r) => {
      const rid = r._id.toString();
      const mat = (r.matricule || '').toUpperCase();
      const moisPlanning: any[] = [];

      for (let m = 1; m <= 12; m++) {
        const debutMois = new Date(Date.UTC(annee, m - 1, 1));
        const finMois = new Date(Date.UTC(annee, m, 0, 23, 59, 59, 999));

        const arr = new Date(r.dateArrivee);
        const dep = r.dateDepart ? new Date(r.dateDepart) : null;
        const estActifMois = r.actif && arr <= finMois && (!dep || dep >= debutMois);

        const joursOuvres = mapJoursForces.has(m) ? mapJoursForces.get(m)! : calculerJoursOuvresAuto(annee, m);
        const capaciteTheorique = estActifMois ? Number(((r.tauxActivite || 1) * joursOuvres).toFixed(1)) : 0;
        const absences = estActifMois ? Number((absencesByRessourceMois.get(mat)?.get(m) || 0).toFixed(1)) : 0;
        const capaciteNette = Math.max(0, Number((capaciteTheorique - absences).toFixed(1)));

        const projetsAffectes = affectationsParRessource.get(rid)?.get(m) || [];
        const totalJoursAffectes = Number(
          projetsAffectes.reduce((sum: number, p: any) => sum + (p.jours || 0), 0).toFixed(1)
        );

        // Données Tempo réelles pour ce mois
        const tempoMoisData = tempoByRessourceMois.get(rid)?.get(m);
        const tempoTotalJours = tempoMoisData ? tempoMoisData.totalJours : 0;
        const tempoTotalHeures = tempoMoisData ? tempoMoisData.totalHeures : 0;
        const tempoProjets = tempoMoisData ? Array.from(tempoMoisData.projetsMap.values()) : [];

        // Enrichir chaque projet affecté avec le consommé tempo s'il existe
        const projetsEnrichis = projetsAffectes.map((pa: any) => {
          const matchedTempoP = tempoMoisData?.projetsMap.get(pa.projetId.toString());
          return {
            ...pa,
            tempoJours: matchedTempoP ? matchedTempoP.jours : 0,
            tempoHeures: matchedTempoP ? matchedTempoP.heures : 0
          };
        });

        const tauxOccupation = capaciteNette > 0 ? Number(((totalJoursAffectes / capaciteNette) * 100).toFixed(1)) : (totalJoursAffectes > 0 ? 999 : 0);

        let statutCharge: 'DISPONIBLE' | 'OPTIMAL' | 'SURCHARGE' | 'INACTIF' = 'DISPONIBLE';
        if (!estActifMois) {
          statutCharge = 'INACTIF';
        } else if (totalJoursAffectes > capaciteNette) {
          statutCharge = 'SURCHARGE';
        } else if (tauxOccupation >= 85) {
          statutCharge = 'OPTIMAL';
        }

        moisPlanning.push({
          mois: m,
          estActif: estActifMois,
          joursOuvres,
          capaciteTheorique,
          absences,
          capaciteNette,
          totalJoursAffectes,
          tauxOccupation,
          statutCharge,
          projets: projetsEnrichis,
          tempoTotalJours,
          tempoTotalHeures,
          tempoProjets
        });
      }

      return {
        ressource: {
          _id: r._id,
          matricule: r.matricule,
          nom: r.nom,
          type: r.type,
          role: r.role,
          estLeadBA: r.estLeadBA,
          tauxActivite: r.tauxActivite,
          actif: r.actif
        },
        moisPlanning
      };
    });

    res.json({
      annee,
      nonAssignesParMois,
      ressources: planningRessources
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
