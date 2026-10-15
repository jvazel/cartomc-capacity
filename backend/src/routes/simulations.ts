import express from 'express';
import { SimulationDraft } from '../models/SimulationDraft.js';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

// GET /api/simulations : Récupère la liste des brouillons de simulations What-If
router.get('/', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : undefined;
    const query = annee ? { annee } : {};
    const drafts = await SimulationDraft.find(query).sort({ dateModification: -1 });
    res.json(drafts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/simulations/:id : Récupère un brouillon individuel
router.get('/:id', async (req, res) => {
  try {
    const draft = await SimulationDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Brouillon introuvable' });
    }
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulations : Création d'un brouillon de scénario What-If
router.post('/', async (req, res) => {
  try {
    const { nom, description, annee, shiftsMap, auteur } = req.body;
    if (!nom || !nom.trim()) {
      return res.status(400).json({ error: 'Le nom du scénario est obligatoire.' });
    }

    const targetAnnee = annee ? parseInt(annee, 10) : new Date().getFullYear();
    const cleanShiftsMap: { [key: string]: number } = {};

    if (shiftsMap && typeof shiftsMap === 'object') {
      Object.keys(shiftsMap).forEach((key) => {
        const val = Number(shiftsMap[key]);
        if (val !== 0) {
          cleanShiftsMap[key] = val;
        }
      });
    }

    const newDraft = new SimulationDraft({
      nom: nom.trim(),
      description: description ? description.trim() : '',
      annee: targetAnnee,
      auteur: auteur || req.headers['x-user-role'] || 'Administrateur / Manager',
      shiftsMap: cleanShiftsMap,
      dateCreation: new Date(),
      dateModification: new Date()
    });

    await newDraft.save();

    // Audit log
    await AuditLog.create({
      timestamp: new Date(),
      auteur: newDraft.auteur,
      action: 'SNAPSHOT_CREATION',
      description: `Sauvegarde du brouillon de scénario What-If "${newDraft.nom}" (${Object.keys(cleanShiftsMap).length} projet(s) décalé(s) pour ${targetAnnee})`
    });

    res.status(201).json(newDraft);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/simulations/:id : Mise à jour d'un brouillon existant
router.put('/:id', async (req, res) => {
  try {
    const { nom, description, shiftsMap } = req.body;
    const existing = await SimulationDraft.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Brouillon introuvable' });
    }

    if (nom) existing.nom = nom.trim();
    if (description !== undefined) existing.description = description.trim();
    if (shiftsMap && typeof shiftsMap === 'object') {
      const cleanShiftsMap: { [key: string]: number } = {};
      Object.keys(shiftsMap).forEach((key) => {
        const val = Number(shiftsMap[key]);
        if (val !== 0) {
          cleanShiftsMap[key] = val;
        }
      });
      existing.shiftsMap = cleanShiftsMap as any;
    }

    existing.dateModification = new Date();
    await existing.save();

    res.json(existing);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/simulations/:id : Suppression d'un brouillon
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await SimulationDraft.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Brouillon introuvable' });
    }
    res.json({ message: 'Scénario brouillon supprimé avec succès' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
