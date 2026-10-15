import express from 'express';
import { PortfolioSnapshot, ISnapshotProjetItem } from '../models/PortfolioSnapshot.js';
import { Projet } from '../models/Projet.js';
import { VentilationMensuelle } from '../models/VentilationMensuelle.js';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

// Helper: calculer le state actuel du portefeuille sous forme de structure Snapshot
async function captureCurrentPortfolioState(annee: number): Promise<{
  nombreProjets: number;
  totalB0: number;
  totalB1: number;
  totalPlanifie: number;
  projetsData: ISnapshotProjetItem[];
}> {
  const [projets, ventilations] = await Promise.all([
    Projet.find().populate('leadBA'),
    VentilationMensuelle.find({ annee })
  ]);

  const mapVentilations = new Map<string, Map<number, { joursInternes: number; joursExternes: number }>>();

  ventilations.forEach((v) => {
    const pid = v.projetId.toString();
    if (!mapVentilations.has(pid)) {
      mapVentilations.set(pid, new Map());
    }
    mapVentilations.get(pid)!.set(v.mois, {
      joursInternes: v.joursInternes,
      joursExternes: v.joursExternes
    });
  });

  let totalB0 = 0;
  let totalB1 = 0;
  let totalPlanifie = 0;

  const projetsData: ISnapshotProjetItem[] = projets.map((p) => {
    const pid = p._id.toString();
    const pVentMap = mapVentilations.get(pid);

    const b0 = p.estimationB0 || 0;
    const b1 = p.estimationB1 || 0;
    totalB0 += b0;
    totalB1 += b1;

    const vList = [];
    let pTotal = 0;

    for (let m = 1; m <= 12; m++) {
      const vent = pVentMap?.get(m) || { joursInternes: 0, joursExternes: 0 };
      const tMois = Number((vent.joursInternes + vent.joursExternes).toFixed(1));
      pTotal += tMois;
      vList.push({
        mois: m,
        joursInternes: vent.joursInternes,
        joursExternes: vent.joursExternes,
        totalMois: tMois
      });
    }

    pTotal = Number(pTotal.toFixed(1));
    totalPlanifie += pTotal;

    const leadBANom = p.leadBA ? (typeof p.leadBA === 'object' ? (p.leadBA as any).nom : '') : '';

    return {
      projetId: pid,
      codeProjet: p.codeProjet,
      nom: p.nom,
      type: p.type,
      epicDomaine: p.epicDomaine,
      leadBANom,
      priorite: p.priorite,
      statut: p.statut,
      estimationB0: p.estimationB0,
      estimationB1: p.estimationB1,
      totalPlanifie: pTotal,
      ventilations: vList
    };
  });

  return {
    nombreProjets: projets.length,
    totalB0: Number(totalB0.toFixed(1)),
    totalB1: Number(totalB1.toFixed(1)),
    totalPlanifie: Number(totalPlanifie.toFixed(1)),
    projetsData
  };
}

// GET /api/snapshots : Liste tous les snapshots
router.get('/', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : undefined;
    const query = annee ? { annee } : {};
    const snapshots = await PortfolioSnapshot.find(query).sort({ dateCreation: -1 });
    res.json(snapshots);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/snapshots/:id : Récupère un snapshot individuel
router.get('/:id', async (req, res) => {
  try {
    const snapshot = await PortfolioSnapshot.findById(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot introuvable' });
    }
    res.json(snapshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/snapshots : Création d'un nouveau Snapshot / Baseline de Portefeuille
router.post('/', async (req, res) => {
  try {
    const { nom, description, annee, auteur } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ error: 'Le nom du snapshot est obligatoire.' });
    }

    const targetAnnee = annee ? parseInt(annee, 10) : new Date().getFullYear();
    const currentState = await captureCurrentPortfolioState(targetAnnee);

    const newSnapshot = new PortfolioSnapshot({
      nom: nom.trim(),
      description: description ? description.trim() : '',
      annee: targetAnnee,
      auteur: auteur || 'Administrateur / Manager',
      dateCreation: new Date(),
      ...currentState
    });

    await newSnapshot.save();

    // Log de l'action dans l'AuditLog
    await AuditLog.create({
      timestamp: new Date(),
      auteur: auteur || 'Administrateur / Manager',
      action: 'SNAPSHOT_CREATION',
      description: `Création de la baseline "${newSnapshot.nom}" (${newSnapshot.nombreProjets} projets, ${newSnapshot.totalPlanifie}j planifiés pour ${targetAnnee})`
    });

    res.status(201).json(newSnapshot);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/snapshots/:id : Suppression d'un snapshot
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PortfolioSnapshot.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Snapshot introuvable' });
    }

    await AuditLog.create({
      timestamp: new Date(),
      auteur: 'Administrateur / Manager',
      action: 'SNAPSHOT_SUPPRESSION',
      description: `Suppression du snapshot baseline "${deleted.nom}"`
    });

    res.json({ message: 'Snapshot supprimé avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/snapshots/compare : Comparateur de 2 états (ex: Etat Actuel Réel vs Baseline B, ou Snapshot A vs Snapshot B)
router.get('/compare/diff', async (req, res) => {
  try {
    const { baseSnapshotId, targetSnapshotId, annee } = req.query;

    const targetAnnee = annee ? parseInt(annee as string, 10) : new Date().getFullYear();

    // Charger l'état de référence (Base)
    let baseState: {
      nom: string;
      totalB0: number;
      totalB1: number;
      totalPlanifie: number;
      projetsData: ISnapshotProjetItem[];
    };

    if (baseSnapshotId && baseSnapshotId !== 'current') {
      const snapBase = await PortfolioSnapshot.findById(baseSnapshotId);
      if (!snapBase) {
        return res.status(404).json({ error: 'Snapshot de base introuvable' });
      }
      baseState = {
        nom: snapBase.nom,
        totalB0: snapBase.totalB0,
        totalB1: snapBase.totalB1,
        totalPlanifie: snapBase.totalPlanifie,
        projetsData: snapBase.projetsData
      };
    } else {
      const curr = await captureCurrentPortfolioState(targetAnnee);
      baseState = {
        nom: 'Portefeuille Réel Actuel',
        ...curr
      };
    }

    // Charger l'état à comparer (Target / Comparison)
    let compState: {
      nom: string;
      totalB0: number;
      totalB1: number;
      totalPlanifie: number;
      projetsData: ISnapshotProjetItem[];
    };

    if (targetSnapshotId && targetSnapshotId !== 'current') {
      const snapTarget = await PortfolioSnapshot.findById(targetSnapshotId);
      if (!snapTarget) {
        return res.status(404).json({ error: 'Snapshot à comparer introuvable' });
      }
      compState = {
        nom: snapTarget.nom,
        totalB0: snapTarget.totalB0,
        totalB1: snapTarget.totalB1,
        totalPlanifie: snapTarget.totalPlanifie,
        projetsData: snapTarget.projetsData
      };
    } else {
      const curr = await captureCurrentPortfolioState(targetAnnee);
      compState = {
        nom: 'Portefeuille Réel Actuel',
        ...curr
      };
    }

    // Construire les maps par projetId / Code
    const mapBase = new Map<string, ISnapshotProjetItem>();
    baseState.projetsData.forEach((p) => {
      const key = p.projetId || p.codeProjet || p.nom;
      mapBase.set(key, p);
    });

    const mapComp = new Map<string, ISnapshotProjetItem>();
    compState.projetsData.forEach((p) => {
      const key = p.projetId || p.codeProjet || p.nom;
      mapComp.set(key, p);
    });

    // Liste unique de toutes les clés de projets
    const allKeys = Array.from(new Set([...Array.from(mapBase.keys()), ...Array.from(mapComp.keys())]));

    const projectDeltas = allKeys.map((key) => {
      const pBase = mapBase.get(key);
      const pComp = mapComp.get(key);

      const codeProjet = pComp?.codeProjet || pBase?.codeProjet || '';
      const nom = pComp?.nom || pBase?.nom || 'Projet inconnu';
      const type = pComp?.type || pBase?.type || '';
      const leadBANom = pComp?.leadBANom || pBase?.leadBANom || '';

      const b0Base = pBase?.estimationB0 || 0;
      const b0Comp = pComp?.estimationB0 || 0;
      const deltaB0 = Number((b0Comp - b0Base).toFixed(1));

      const b1Base = pBase?.estimationB1 || 0;
      const b1Comp = pComp?.estimationB1 || 0;
      const deltaB1 = Number((b1Comp - b1Base).toFixed(1));

      const planifieBase = pBase?.totalPlanifie || 0;
      const planifieComp = pComp?.totalPlanifie || 0;
      const deltaPlanifie = Number((planifieComp - planifieBase).toFixed(1));

      let evolStatut = 'Inchangé';
      if (!pBase && pComp) {
        evolStatut = 'Nouveau Projet';
      } else if (pBase && !pComp) {
        evolStatut = 'Projet Retiré';
      } else if ((pBase?.estimationB1 || 0) === 0 && (pComp?.estimationB1 || 0) > 0) {
        evolStatut = 'Passage B0 ➔ B1 🔒';
      } else if (deltaPlanifie !== 0 || deltaB0 !== 0 || deltaB1 !== 0) {
        evolStatut = 'Ventilation / Chiffrage Modifié';
      }

      // Comparaison mois par mois (1 à 12)
      const ventilationDeltas = [];
      for (let m = 1; m <= 12; m++) {
        const vBase = pBase?.ventilations.find((v) => v.mois === m)?.totalMois || 0;
        const vComp = pComp?.ventilations.find((v) => v.mois === m)?.totalMois || 0;
        const dMois = Number((vComp - vBase).toFixed(1));
        ventilationDeltas.push({
          mois: m,
          baseTotal: vBase,
          compTotal: vComp,
          delta: dMois
        });
      }

      return {
        key,
        codeProjet,
        nom,
        type,
        leadBANom,
        b0Base,
        b0Comp,
        deltaB0,
        b1Base,
        b1Comp,
        deltaB1,
        planifieBase,
        planifieComp,
        deltaPlanifie,
        evolStatut,
        ventilationDeltas
      };
    });

    const aggregateDelta = {
      baseNom: baseState.nom,
      compNom: compState.nom,
      totalB0Base: baseState.totalB0,
      totalB0Comp: compState.totalB0,
      deltaTotalB0: Number((compState.totalB0 - baseState.totalB0).toFixed(1)),
      totalB1Base: baseState.totalB1,
      totalB1Comp: compState.totalB1,
      deltaTotalB1: Number((compState.totalB1 - baseState.totalB1).toFixed(1)),
      totalPlanifieBase: baseState.totalPlanifie,
      totalPlanifieComp: compState.totalPlanifie,
      deltaTotalPlanifie: Number((compState.totalPlanifie - baseState.totalPlanifie).toFixed(1))
    };

    res.json({
      aggregateDelta,
      projectDeltas
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
