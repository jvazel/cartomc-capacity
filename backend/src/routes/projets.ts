import express from 'express';
import { Projet } from '../models/Projet.js';
import { VentilationMensuelle } from '../models/VentilationMensuelle.js';
import { ConfigurationTolerances } from '../models/ConfigurationTolerances.js';
import { calculerCapaciteMensuelle } from '../services/capaciteService.js';
import { TempoWorklog } from '../models/TempoWorklog.js';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

// Helper pour récupérer ou initialiser la configuration des tolérances
async function getConfigTolerances() {
  let config = await ConfigurationTolerances.findOne();
  if (!config) {
    config = new ConfigurationTolerances({
      toleranceB0Pct: 100,
      toleranceB1Pct: 20,
      seuilSousChargeJours: 10
    });
    await config.save();
  }
  return config;
}

// GET /api/projets/matrice-ventilation : Récupère la matrice complète Projets x Mois avec capacitif d'équipe
router.get('/matrice-ventilation', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();

    const [projets, ventilations, capaciteMensuelle] = await Promise.all([
      Projet.find().populate('leadBA').sort({ createdAt: -1 }),
      VentilationMensuelle.find({ annee }),
      calculerCapaciteMensuelle(annee, 1, 12)
    ]);

    // Map des ventilations par projetId -> mois -> { joursInternes, joursExternes, noteArbitrage }
    // Et agrégation des ressources staffées par projetId -> Map<ressourceId, { ressourceId, nom, type, jours }>
    const mapVentilations = new Map<string, Map<number, { joursInternes: number; joursExternes: number; noteArbitrage: string }>>();
    const mapStaffedParProjet = new Map<string, Map<string, { ressourceId: string; nom: string; type: 'Interne' | 'Externe'; jours: number }>>();

    ventilations.forEach((v) => {
      const pid = v.projetId.toString();
      if (!mapVentilations.has(pid)) {
        mapVentilations.set(pid, new Map());
      }
      mapVentilations.get(pid)!.set(v.mois, {
        joursInternes: v.joursInternes,
        joursExternes: v.joursExternes,
        noteArbitrage: (v as any).noteArbitrage || ''
      });

      if (v.affectations && v.affectations.length > 0) {
        if (!mapStaffedParProjet.has(pid)) {
          mapStaffedParProjet.set(pid, new Map());
        }
        const projStaffMap = mapStaffedParProjet.get(pid)!;
        v.affectations.forEach((aff) => {
          const rid = aff.ressourceId ? aff.ressourceId.toString() : aff.nom;
          const exist = projStaffMap.get(rid) || {
            ressourceId: rid,
            nom: aff.nom,
            type: aff.type || 'Interne',
            jours: 0
          };
          exist.jours = Number((exist.jours + (aff.jours || 0)).toFixed(1));
          projStaffMap.set(rid, exist);
        });
      }
    });

    const matriceData = projets.map((p) => {
      const pid = p._id.toString();
      const projectVentMap = mapVentilations.get(pid);

      const moisDetails = [];
      let totalAnneeInternes = 0;
      let totalAnneeExternes = 0;

      for (let m = 1; m <= 12; m++) {
        const v = projectVentMap?.get(m) || { joursInternes: 0, joursExternes: 0, noteArbitrage: '' };
        totalAnneeInternes += v.joursInternes;
        totalAnneeExternes += v.joursExternes;

        moisDetails.push({
          mois: m,
          joursInternes: v.joursInternes,
          joursExternes: v.joursExternes,
          noteArbitrage: v.noteArbitrage || '',
          totalMois: Number((v.joursInternes + v.joursExternes).toFixed(1))
        });
      }

      const staffedResources = mapStaffedParProjet.has(pid)
        ? Array.from(mapStaffedParProjet.get(pid)!.values()).sort((a, b) => b.jours - a.jours)
        : [];

      return {
        projet: p.toObject(),
        annee,
        moisDetails,
        staffedResources,
        totalAnneeInternes: Number(totalAnneeInternes.toFixed(1)),
        totalAnneeExternes: Number(totalAnneeExternes.toFixed(1)),
        totalAnneeCumul: Number((totalAnneeInternes + totalAnneeExternes).toFixed(1))
      };
    });

    res.json({
      annee,
      matrice: matriceData,
      capaciteMensuelle
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets/check-code : Vérifie l'existence d'un code projet (pour avertissement d'unicité)
router.get('/check-code', async (req, res) => {
  try {
    const { code, excludeId } = req.query;
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return res.json({ exists: false });
    }

    const query: any = { codeProjet: { $regex: new RegExp(`^${code.trim()}$`, 'i') } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const count = await Projet.countDocuments(query);
    res.json({ exists: count > 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets/tempo-mapping-options : Options distinctes pour auto-complétion du mapping Jira
router.get('/tempo-mapping-options', async (req, res) => {
  try {
    const [budgetLines, epics, featureIds] = await Promise.all([
      TempoWorklog.distinct('budgetLine', { budgetLine: { $ne: '' } }),
      TempoWorklog.aggregate([
        { $match: { epicSummary: { $ne: '' } } },
        { $group: { _id: '$epicSummary', issueKey: { $first: '$issueKey' } } },
        { $sort: { _id: 1 } }
      ]),
      TempoWorklog.distinct('featureId', { featureId: { $ne: '-100' } })
    ]);

    res.json({
      budgetLines: budgetLines.filter(Boolean),
      epics: epics.map((e) => ({ summary: e._id, issueKey: e.issueKey })),
      featureIds: featureIds.filter(Boolean)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets/rapprochement-tempo : Rapprochement Consommé (Tempo BDD) vs Planifié
router.get('/rapprochement-tempo', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const now = new Date();
    const currentMois = now.getFullYear() === annee ? now.getMonth() + 1 : 12;

    const [projets, config, ventilations] = await Promise.all([
      Projet.find().populate('leadBA').sort({ createdAt: -1 }),
      getConfigTolerances(),
      VentilationMensuelle.find({ annee })
    ]);

    // MAP ventilations par projetId -> mois
    const mapVentilations = new Map<string, Map<number, number>>();
    ventilations.forEach((v) => {
      const pid = v.projetId.toString();
      if (!mapVentilations.has(pid)) {
        mapVentilations.set(pid, new Map());
      }
      const totalMois = (mapVentilations.get(pid)!.get(v.mois) || 0) + v.joursInternes + v.joursExternes;
      mapVentilations.get(pid)!.set(v.mois, totalMois);
    });

    // Dernier import Tempo horodaté
    const lastWorklog = await TempoWorklog.findOne().sort({ extractedAt: -1 });

    const items = await Promise.all(
      projets.map(async (p) => {
        const pid = p._id.toString();
        const pVentMap = mapVentilations.get(pid);

        let totalPlanifie = 0;
        let planifieADate = 0;
        let planifieFutur = 0;

        for (let m = 1; m <= 12; m++) {
          const mJours = pVentMap?.get(m) || 0;
          totalPlanifie += mJours;
          if (m <= currentMois) {
            planifieADate += mJours;
          } else {
            planifieFutur += mJours;
          }
        }

        // Construire la requête de recherche Tempo matching
        const orConditions: any[] = [];
        if (p.codeProjet && p.codeProjet.trim()) {
          orConditions.push({ budgetLine: { $regex: new RegExp(`^${p.codeProjet.trim()}$`, 'i') } });
        }
        if (p.jiraBudgetLine && p.jiraBudgetLine.trim()) {
          orConditions.push({ budgetLine: { $regex: new RegExp(`^${p.jiraBudgetLine.trim()}$`, 'i') } });
        }
        if (p.jiraEpicKey && p.jiraEpicKey.trim()) {
          orConditions.push({ epicSummary: { $regex: new RegExp(p.jiraEpicKey.trim(), 'i') } });
        }
        if (p.jiraFeatureId && p.jiraFeatureId.trim()) {
          orConditions.push({ featureId: p.jiraFeatureId.trim() });
        }

        const NOMS_MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

        let mapConsommeMois = new Map<number, number>();
        let consommeTempo = 0;
        let tempoContributors: Array<{ collaborator: string; timeInDays: number; type: string; category?: string }> = [];

        if (orConditions.length > 0) {
          const matchQuery: any = { year: annee, $or: orConditions };
          const [aggMois, aggContribs] = await Promise.all([
            TempoWorklog.aggregate([
              { $match: matchQuery },
              { $group: { _id: '$month', total: { $sum: '$timeInDays' } } }
            ]),
            TempoWorklog.aggregate([
              { $match: matchQuery },
              {
                $group: {
                  _id: '$collaborator',
                  timeInDays: { $sum: '$timeInDays' },
                  type: { $first: '$type' },
                  category: { $first: '$category' }
                }
              },
              { $sort: { timeInDays: -1 } }
            ])
          ]);

          aggMois.forEach((row) => {
            const val = Number(row.total.toFixed(2));
            mapConsommeMois.set(row._id, val);
            consommeTempo += val;
          });
          consommeTempo = Number(consommeTempo.toFixed(2));

          tempoContributors = aggContribs.map((c) => ({
            collaborator: c._id || 'Inconnu',
            timeInDays: Number(c.timeInDays.toFixed(2)),
            type: c.type || 'Unknown',
            category: c.category || ''
          }));
        }

        // Staffing prévisionnel (affectations)
        const staffedMap = new Map<string, { ressourceId: string; nom: string; type: 'Interne' | 'Externe'; jours: number }>();
        ventilations.filter((v) => v.projetId.toString() === pid).forEach((v) => {
          (v.affectations || []).forEach((aff: any) => {
            const rid = aff.ressourceId ? aff.ressourceId.toString() : aff.nom;
            const exist = staffedMap.get(rid) || {
              ressourceId: rid,
              nom: aff.nom,
              type: aff.type || 'Interne',
              jours: 0
            };
            exist.jours = Number((exist.jours + (aff.jours || 0)).toFixed(1));
            staffedMap.set(rid, exist);
          });
        });
        const staffedContributors = Array.from(staffedMap.values()).sort((a, b) => b.jours - a.jours);

        let planifieCumuleAcc = 0;
        let consommeCumuleAcc = 0;

        const moisDetails = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const planifieMois = pVentMap?.get(m) || 0;
          const consommeMois = mapConsommeMois.get(m) || 0;

          planifieCumuleAcc += planifieMois;
          if (m <= currentMois) {
            consommeCumuleAcc += consommeMois;
          }

          const forecastCumule =
            m <= currentMois
              ? Number(consommeCumuleAcc.toFixed(1))
              : Number((consommeTempo + (planifieCumuleAcc - planifieADate)).toFixed(1));

          return {
            mois: m,
            nomMois: NOMS_MOIS[i],
            planifieMois: Number(planifieMois.toFixed(1)),
            consommeMois: Number(consommeMois.toFixed(1)),
            planifieCumule: Number(planifieCumuleAcc.toFixed(1)),
            consommeCumule: m <= currentMois ? Number(consommeCumuleAcc.toFixed(1)) : undefined,
            forecastCumule
          };
        });

        let statutEstimation: 'B0' | 'B1' | 'NC' = 'NC';
        let estimationRetenue = 0;
        let tolerancePct = 0;

        if (p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0) {
          statutEstimation = 'B1';
          estimationRetenue = p.estimationB1;
          tolerancePct = config.toleranceB1Pct;
        } else if (p.estimationB0 !== undefined && p.estimationB0 !== null && p.estimationB0 > 0) {
          statutEstimation = 'B0';
          estimationRetenue = p.estimationB0;
          tolerancePct = config.toleranceB0Pct;
        }

        const chargeMaxToleree = Number((estimationRetenue * (1 + tolerancePct / 100)).toFixed(1));
        const resteAFaire = Math.max(0, Number((estimationRetenue - consommeTempo).toFixed(1)));
        const atterrissagePrevu = Number((consommeTempo + planifieFutur).toFixed(1));
        const deriveADate = Number((consommeTempo - planifieADate).toFixed(1));
        const deriveTerminaison = Number((atterrissagePrevu - estimationRetenue).toFixed(1));

        let santeConsommation: 'VERT' | 'ORANGE' | 'ROUGE' = 'VERT';
        if (estimationRetenue > 0) {
          if (atterrissagePrevu > chargeMaxToleree || consommeTempo > estimationRetenue) {
            santeConsommation = 'ROUGE';
          } else if (consommeTempo > planifieADate) {
            santeConsommation = 'ORANGE';
          }
        }

        const leadBANom = p.leadBA ? (typeof p.leadBA === 'object' ? (p.leadBA as any).nom : '') : '';

        return {
          projetId: pid,
          codeProjet: p.codeProjet,
          nom: p.nom,
          type: p.type,
          statut: p.statut,
          priorite: p.priorite,
          leadBANom,
          jiraBudgetLine: p.jiraBudgetLine,
          jiraEpicKey: p.jiraEpicKey,
          jiraFeatureId: p.jiraFeatureId,
          estimationRetenue,
          statutEstimation,
          chargeMaxToleree,
          totalPlanifie: Number(totalPlanifie.toFixed(1)),
          planifieADate: Number(planifieADate.toFixed(1)),
          planifieFutur: Number(planifieFutur.toFixed(1)),
          consommeTempo,
          resteAFaire,
          atterrissagePrevu,
          deriveADate,
          deriveTerminaison,
          santeConsommation,
          dernierImportAt: lastWorklog?.extractedAt ? lastWorklog.extractedAt.toISOString() : undefined,
          moisDetails,
          tempoContributors,
          staffedContributors
        };
      })
    );

    res.json({
      annee,
      currentMois,
      dernierImportAt: lastWorklog?.extractedAt ? lastWorklog.extractedAt.toISOString() : null,
      items
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets/kpi/ecart-b0-b1 : KPI écart moyen entre B0 et B1 sur tous les projets
router.get('/kpi/ecart-b0-b1', async (req, res) => {
  try {
    const projets = await Projet.find({
      estimationB0: { $gt: 0 },
      estimationB1: { $gt: 0 }
    });

    if (projets.length === 0) {
      return res.json({
        nombreProjetsEvalues: 0,
        ecartMoyenPct: 0,
        detailProjets: []
      });
    }

    let sumEcarts = 0;
    const detailProjets = projets.map((p) => {
      const b0 = p.estimationB0!;
      const b1 = p.estimationB1!;
      const ecartPct = Number((((b1 - b0) / b0) * 100).toFixed(1));
      sumEcarts += (b1 - b0) / b0;
      return {
        id: p._id,
        nom: p.nom,
        b0,
        b1,
        ecartPct
      };
    });

    const ecartMoyenPct = Number(((sumEcarts / projets.length) * 100).toFixed(1));

    res.json({
      nombreProjetsEvalues: projets.length,
      ecartMoyenPct,
      detailProjets
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets : Liste tous les projets
router.get('/', async (req, res) => {
  try {
    const projets = await Projet.find().populate('leadBA').sort({ createdAt: -1 });

    // Calculer la synthèse B0/B1 et ventilation pour chaque projet
    const config = await getConfigTolerances();
    const allVentilations = await VentilationMensuelle.find({});

    const mapTotalVentilation = new Map<string, number>();
    allVentilations.forEach((v) => {
      const pid = v.projetId.toString();
      const current = mapTotalVentilation.get(pid) || 0;
      mapTotalVentilation.set(pid, current + v.joursInternes + v.joursExternes);
    });

    const result = projets.map((p) => {
      const pObj = p.toObject();
      const totalPlanifie = Number((mapTotalVentilation.get(p._id.toString()) || 0).toFixed(1));

      let statutEstimation: 'B0' | 'B1' | 'NC' = 'NC';
      let estimationRetenue = 0;
      let tolerancePct = 0;

      if (p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0) {
        statutEstimation = 'B1';
        estimationRetenue = p.estimationB1;
        tolerancePct = config.toleranceB1Pct;
      } else if (p.estimationB0 !== undefined && p.estimationB0 !== null && p.estimationB0 > 0) {
        statutEstimation = 'B0';
        estimationRetenue = p.estimationB0;
        tolerancePct = config.toleranceB0Pct;
      }

      const chargeMaxToleree = Number((estimationRetenue * (1 + tolerancePct / 100)).toFixed(1));

      let couleurStatut: 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS' = 'GRIS';

      if (statutEstimation !== 'NC' && estimationRetenue > 0) {
        if (totalPlanifie <= estimationRetenue) {
          couleurStatut = 'VERT';
        } else if (totalPlanifie <= chargeMaxToleree) {
          couleurStatut = 'ORANGE';
        } else {
          couleurStatut = 'ROUGE';
        }
      }

      return {
        ...pObj,
        statutEstimation,
        estimationRetenue,
        tolerancePct,
        chargeMaxToleree,
        totalPlanifie,
        couleurStatut
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets/:id : Détail d'un projet avec calculs d'estimation
router.get('/:id', async (req, res) => {
  try {
    const projet = await Projet.findById(req.params.id).populate('leadBA');
    if (!projet) {
      return res.status(404).json({ message: 'Projet introuvable' });
    }

    const config = await getConfigTolerances();
    const ventilations = await VentilationMensuelle.find({ projetId: projet._id });

    const totalPlanifie = Number(
      ventilations.reduce((sum, v) => sum + v.joursInternes + v.joursExternes, 0).toFixed(1)
    );

    let statutEstimation: 'B0' | 'B1' | 'NC' = 'NC';
    let estimationRetenue = 0;
    let tolerancePct = 0;

    if (projet.estimationB1 !== undefined && projet.estimationB1 !== null && projet.estimationB1 > 0) {
      statutEstimation = 'B1';
      estimationRetenue = projet.estimationB1;
      tolerancePct = config.toleranceB1Pct;
    } else if (projet.estimationB0 !== undefined && projet.estimationB0 !== null && projet.estimationB0 > 0) {
      statutEstimation = 'B0';
      estimationRetenue = projet.estimationB0;
      tolerancePct = config.toleranceB0Pct;
    }

    const chargeMaxToleree = Number((estimationRetenue * (1 + tolerancePct / 100)).toFixed(1));

    let couleurStatut: 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS' = 'GRIS';
    if (statutEstimation !== 'NC' && estimationRetenue > 0) {
      if (totalPlanifie <= estimationRetenue) {
        couleurStatut = 'VERT';
      } else if (totalPlanifie <= chargeMaxToleree) {
        couleurStatut = 'ORANGE';
      } else {
        couleurStatut = 'ROUGE';
      }
    }

    res.json({
      ...projet.toObject(),
      statutEstimation,
      estimationRetenue,
      tolerancePct,
      chargeMaxToleree,
      totalPlanifie,
      couleurStatut
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projets : Création d'un projet
router.post('/', async (req, res) => {
  try {
    const newProjet = new Projet(req.body);
    await newProjet.save();
    const populated = await Projet.findById(newProjet._id).populate('leadBA');

    const auteur = req.headers['x-user-role'] ? String(req.headers['x-user-role']) : 'Administrateur / Manager';

    await AuditLog.create({
      timestamp: new Date(),
      auteur,
      action: 'CREATION_PROJET',
      projetId: newProjet._id,
      codeProjet: newProjet.codeProjet,
      nomProjet: newProjet.nom,
      description: `Création du projet "${newProjet.nom}" (${newProjet.type}${newProjet.estimationB0 ? `, B0: ${newProjet.estimationB0}j` : ''})`
    });

    res.status(201).json(populated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/projets/:id : Modification d'un projet
router.put('/:id', async (req, res) => {
  try {
    const existing = await Projet.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Projet introuvable' });
    }

    const updated = await Projet.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('leadBA');

    if (updated) {
      const auteur = req.headers['x-user-role'] ? String(req.headers['x-user-role']) : 'Administrateur / Manager';
      const modifications: Array<{ champ: string; ancienneValeur?: any; nouvelleValeur?: any }> = [];

      const fieldsToCheck = ['nom', 'codeProjet', 'type', 'priorite', 'statut', 'estimationB0', 'estimationB1', 'epicDomaine', 'epicJiraLie'];
      fieldsToCheck.forEach((field) => {
        const oldVal = (existing as any)[field];
        const newVal = (updated as any)[field];
        if (oldVal !== newVal) {
          modifications.push({
            champ: field,
            ancienneValeur: oldVal !== undefined ? oldVal : null,
            nouvelleValeur: newVal !== undefined ? newVal : null
          });
        }
      });

      // Détection spécifique passage B0 -> B1
      const wasReestimationB1 = (existing.estimationB1 || 0) === 0 && (updated.estimationB1 || 0) > 0;
      const action = wasReestimationB1 ? 'REESTIMATION_B1' : 'MODIFICATION_PROJET';
      const desc = wasReestimationB1
        ? `Réestimation B1 du projet "${updated.nom}" : ${existing.estimationB0 || 0}j B0 ➔ ${updated.estimationB1}j B1 🔒`
        : `Modification du projet "${updated.nom}" (${modifications.length} champ(s) modifié(s))`;

      if (modifications.length > 0) {
        await AuditLog.create({
          timestamp: new Date(),
          auteur,
          action,
          projetId: updated._id,
          codeProjet: updated.codeProjet,
          nomProjet: updated.nom,
          modifications,
          description: desc
        });
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/projets/:id : Suppression d'un projet et de ses ventilations
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Projet.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Projet introuvable' });
    }
    await VentilationMensuelle.deleteMany({ projetId: req.params.id });

    const auteur = req.headers['x-user-role'] ? String(req.headers['x-user-role']) : 'Administrateur / Manager';
    await AuditLog.create({
      timestamp: new Date(),
      auteur,
      action: 'SUPPRESSION_PROJET',
      projetId: deleted._id,
      codeProjet: deleted.codeProjet,
      nomProjet: deleted.nom,
      description: `Suppression du projet "${deleted.nom}"`
    });

    res.json({ message: 'Projet et ventilations associées supprimés' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projets/:id/ventilation : Récupère la ventilation mensuelle d'un projet pour une année
router.get('/:id/ventilation', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const ventilations = await VentilationMensuelle.find({
      projetId: req.params.id,
      annee
    }).sort({ mois: 1 });

    const mapVentilations = new Map<number, { joursInternes: number; joursExternes: number; affectations: any[]; noteArbitrage: string }>();
    ventilations.forEach((v) => {
      mapVentilations.set(v.mois, {
        joursInternes: v.joursInternes,
        joursExternes: v.joursExternes,
        affectations: v.affectations || [],
        noteArbitrage: (v as any).noteArbitrage || ''
      });
    });

    // Construire 12 mois complets
    const resultats = [];
    for (let m = 1; m <= 12; m++) {
      const vent = mapVentilations.get(m) || { joursInternes: 0, joursExternes: 0, affectations: [], noteArbitrage: '' };
      resultats.push({
        annee,
        mois: m,
        joursInternes: vent.joursInternes,
        joursExternes: vent.joursExternes,
        affectations: vent.affectations || [],
        noteArbitrage: vent.noteArbitrage || '',
        totalMois: Number((vent.joursInternes + vent.joursExternes).toFixed(1))
      });
    }

    res.json(resultats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projets/:id/ventilation/batch : Enregistre/met à jour toute la ventilation d'un projet en une seule fois
router.post('/:id/ventilation/batch', async (req, res) => {
  try {
    const { annee, items } = req.body; // items: Array<{ mois: number, joursInternes: number, joursExternes: number, affectations?: any[], noteArbitrage?: string }>
    if (!annee || !Array.isArray(items)) {
      return res.status(400).json({ error: "L'année et la liste des éléments de ventilation sont requises." });
    }

    const projetId = req.params.id;
    const projet = await Projet.findById(projetId);

    const bulkOps = items.map((item: any) => {
      const updateFields: any = {
        joursInternes: Math.max(0, Number(item.joursInternes || 0)),
        joursExternes: Math.max(0, Number(item.joursExternes || 0))
      };
      if (Array.isArray(item.affectations)) {
        updateFields.affectations = item.affectations;
      }
      if (item.noteArbitrage !== undefined) {
        updateFields.noteArbitrage = String(item.noteArbitrage || '').trim();
      }
      return {
        updateOne: {
          filter: { projetId, annee, mois: item.mois },
          update: { $set: updateFields },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      await VentilationMensuelle.bulkWrite(bulkOps);
    }

    if (projet) {
      const auteur = req.headers['x-user-role'] ? String(req.headers['x-user-role']) : 'Administrateur / Manager';
      const totalVentile = items.reduce((sum: number, it: any) => sum + Number(it.joursInternes || 0) + Number(it.joursExternes || 0), 0);
      await AuditLog.create({
        timestamp: new Date(),
        auteur,
        action: 'VENTILATION_BATCH',
        projetId: projet._id,
        codeProjet: projet.codeProjet,
        nomProjet: projet.nom,
        description: `Mise à jour de la ventilation mensuelle pour "${projet.nom}" en ${annee} (Total: ${totalVentile.toFixed(1)}j)`
      });
    }

    res.json({ message: 'Ventilation mensuelle enregistrée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projets/:id/ventilation/sync-tempo : Calcule et met à jour automatiquement la ventilation depuis les saisies Tempo
router.post('/:id/ventilation/sync-tempo', async (req, res) => {
  try {
    const annee = req.body.annee ? parseInt(req.body.annee as string, 10) : new Date().getFullYear();
    const projetId = req.params.id;
    const projet = await Projet.findById(projetId);

    if (!projet) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    // Récupérer le référentiel des ressources
    const { Ressource } = await import('../models/Ressource.js');
    const ressources = await Ressource.find({});
    const ressourceMap = new Map<string, any>();
    ressources.forEach((r) => {
      ressourceMap.set(r.nom.toLowerCase().trim(), r);
    });

    // Construire la requête de matching Tempo
    const orConditions: any[] = [];
    if (projet.codeProjet && projet.codeProjet.trim()) {
      orConditions.push({ budgetLine: { $regex: new RegExp(`^${projet.codeProjet.trim()}$`, 'i') } });
    }
    if (projet.jiraBudgetLine && projet.jiraBudgetLine.trim()) {
      orConditions.push({ budgetLine: { $regex: new RegExp(`^${projet.jiraBudgetLine.trim()}$`, 'i') } });
    }
    if (projet.jiraEpicKey && projet.jiraEpicKey.trim()) {
      orConditions.push({ epicSummary: { $regex: new RegExp(projet.jiraEpicKey.trim(), 'i') } });
    }
    if (projet.jiraFeatureId && projet.jiraFeatureId.trim()) {
      orConditions.push({ featureId: projet.jiraFeatureId.trim() });
    }

    if (orConditions.length === 0) {
      return res.status(400).json({
        error: "Ce projet n'a aucun identifiant Jira associé (Code projet, Ligne budget, Epic ou Feature ID)."
      });
    }

    // Récupérer tous les worklogs correspondants pour cette année
    const worklogs = await TempoWorklog.find({
      year: annee,
      $or: orConditions
    });

    if (worklogs.length === 0) {
      return res.status(404).json({
        error: `Aucune saisie de temps Tempo trouvée pour "${projet.nom}" en ${annee}.`
      });
    }

    // Récupérer la ventilation existante pour préserver les mois futurs non touchés par Tempo si souhaité
    const existingVentilations = await VentilationMensuelle.find({ projetId, annee });
    const existingMap = new Map<number, any>();
    existingVentilations.forEach((v) => existingMap.set(v.mois, v));

    // Agréger les temps par mois et par collaborateur
    // mois -> { interne: number, externe: number, affectations: Map<ressourceId, { ressource, jours }> }
    const tempoParMois = new Map<number, { interne: number; externe: number; affectations: Map<string, any> }>();

    for (let m = 1; m <= 12; m++) {
      tempoParMois.set(m, { interne: 0, externe: 0, affectations: new Map() });
    }

    worklogs.forEach((w) => {
      const m = w.month;
      if (m < 1 || m > 12) return;

      const moisData = tempoParMois.get(m)!;
      const collName = (w.collaborator || '').toLowerCase().trim();
      const ressource = ressourceMap.get(collName);

      const typeRessource = ressource ? ressource.type : (w.type === 'EXT' ? 'Externe' : 'Interne');
      const timeInDays = Number(w.timeInDays || 0);

      if (typeRessource === 'Externe') {
        moisData.externe = Number((moisData.externe + timeInDays).toFixed(1));
      } else {
        moisData.interne = Number((moisData.interne + timeInDays).toFixed(1));
      }

      if (ressource) {
        const rid = ressource._id.toString();
        if (!moisData.affectations.has(rid)) {
          moisData.affectations.set(rid, {
            ressourceId: ressource._id,
            matricule: ressource.matricule,
            nom: ressource.nom,
            type: ressource.type,
            jours: 0
          });
        }
        const aff = moisData.affectations.get(rid)!;
        aff.jours = Number((aff.jours + timeInDays).toFixed(1));
      }
    });

    // Mettre à jour en base de données les mois ayant des données Tempo
    const bulkOps: any[] = [];
    const moisModifies: number[] = [];

    for (let m = 1; m <= 12; m++) {
      const tData = tempoParMois.get(m)!;
      const totalMoisTempo = tData.interne + tData.externe;

      if (totalMoisTempo > 0) {
        moisModifies.push(m);
        const affectationsList = Array.from(tData.affectations.values());

        bulkOps.push({
          updateOne: {
            filter: { projetId, annee, mois: m },
            update: {
              $set: {
                joursInternes: tData.interne,
                joursExternes: tData.externe,
                affectations: affectationsList
              }
            },
            upsert: true
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await VentilationMensuelle.bulkWrite(bulkOps);
    }

    // Log d'audit
    const auteur = req.headers['x-user-role'] ? String(req.headers['x-user-role']) : 'Administrateur / Manager';
    await AuditLog.create({
      timestamp: new Date(),
      auteur,
      action: 'VENTILATION_BATCH',
      projetId: projet._id,
      codeProjet: projet.codeProjet,
      nomProjet: projet.nom,
      description: `Synchronisation automatique Tempo pour "${projet.nom}" (${annee}) sur ${moisModifies.length} mois (${worklogs.length} worklogs traités)`
    });

    res.json({
      message: `Ventilation synchronisée depuis Tempo avec succès sur ${moisModifies.length} mois.`,
      moisModifies,
      nombreWorklogs: worklogs.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projets/ventilation/sync-tempo-global : Synchronise la ventilation et le staffing de TOUS les projets depuis Tempo
router.post('/ventilation/sync-tempo-global', async (req, res) => {
  try {
    const annee = req.body.annee ? parseInt(req.body.annee as string, 10) : new Date().getFullYear();

    const [projets, worklogsAll, ressourcesAll] = await Promise.all([
      Projet.find({}),
      TempoWorklog.find({ year: annee }),
      (await import('../models/Ressource.js')).Ressource.find({})
    ]);

    const ressourceMap = new Map<string, any>();
    ressourcesAll.forEach((r) => {
      ressourceMap.set(r.nom.toLowerCase().trim(), r);
    });

    const bulkOps: any[] = [];
    let totalProjetsSync = 0;
    let totalMoisTouches = 0;

    for (const projet of projets) {
      // Conditions de matching pour ce projet
      const orConditions: any[] = [];
      if (projet.codeProjet && projet.codeProjet.trim()) {
        orConditions.push((w: any) => new RegExp(`^${projet.codeProjet!.trim()}$`, 'i').test(w.budgetLine || ''));
      }
      if (projet.jiraBudgetLine && projet.jiraBudgetLine.trim()) {
        orConditions.push((w: any) => new RegExp(`^${projet.jiraBudgetLine!.trim()}$`, 'i').test(w.budgetLine || ''));
      }
      if (projet.jiraEpicKey && projet.jiraEpicKey.trim()) {
        orConditions.push((w: any) => new RegExp(projet.jiraEpicKey!.trim(), 'i').test(w.epicSummary || ''));
      }
      if (projet.jiraFeatureId && projet.jiraFeatureId.trim()) {
        orConditions.push((w: any) => w.featureId === projet.jiraFeatureId!.trim());
      }

      if (orConditions.length === 0) continue;

      // Filtrer les worklogs pour ce projet
      const projectWorklogs = worklogsAll.filter((w) => orConditions.some((cond) => cond(w)));
      if (projectWorklogs.length === 0) continue;

      // Agréger par mois
      const tempoParMois = new Map<number, { interne: number; externe: number; affectations: Map<string, any> }>();
      for (let m = 1; m <= 12; m++) {
        tempoParMois.set(m, { interne: 0, externe: 0, affectations: new Map() });
      }

      projectWorklogs.forEach((w) => {
        const m = w.month;
        if (m < 1 || m > 12) return;

        const moisData = tempoParMois.get(m)!;
        const collName = (w.collaborator || '').toLowerCase().trim();
        const ressource = ressourceMap.get(collName);

        const typeRessource = ressource ? ressource.type : (w.type === 'EXT' ? 'Externe' : 'Interne');
        const timeInDays = Number(w.timeInDays || 0);

        if (typeRessource === 'Externe') {
          moisData.externe = Number((moisData.externe + timeInDays).toFixed(1));
        } else {
          moisData.interne = Number((moisData.interne + timeInDays).toFixed(1));
        }

        if (ressource) {
          const rid = ressource._id.toString();
          if (!moisData.affectations.has(rid)) {
            moisData.affectations.set(rid, {
              ressourceId: ressource._id,
              matricule: ressource.matricule,
              nom: ressource.nom,
              type: ressource.type,
              jours: 0
            });
          }
          const aff = moisData.affectations.get(rid)!;
          aff.jours = Number((aff.jours + timeInDays).toFixed(1));
        }
      });

      let hasProjectChanges = false;
      for (let m = 1; m <= 12; m++) {
        const tData = tempoParMois.get(m)!;
        const totalMoisTempo = tData.interne + tData.externe;

        if (totalMoisTempo > 0) {
          hasProjectChanges = true;
          totalMoisTouches++;
          bulkOps.push({
            updateOne: {
              filter: { projetId: projet._id, annee, mois: m },
              update: {
                $set: {
                  joursInternes: tData.interne,
                  joursExternes: tData.externe,
                  affectations: Array.from(tData.affectations.values())
                }
              },
              upsert: true
            }
          });
        }
      }

      if (hasProjectChanges) {
        totalProjetsSync++;
      }
    }

    if (bulkOps.length > 0) {
      await VentilationMensuelle.bulkWrite(bulkOps);
    }

    const auteur = req.headers['x-user-role'] ? String(req.headers['x-user-role']) : 'Administrateur / Manager';
    await AuditLog.create({
      timestamp: new Date(),
      auteur,
      action: 'VENTILATION_BATCH',
      description: `Synchronisation globale Tempo (${annee}) : ${totalProjetsSync} projets et ${totalMoisTouches} mois mis à jour automatiquement`
    });

    res.json({
      message: `Synchronisation globale réussie : ${totalProjetsSync} projets et ${totalMoisTouches} mois mis à jour.`,
      totalProjetsSync,
      totalMoisTouches
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
