import express from 'express';
import { AuditLog } from '../models/AuditLog.js';

const router = express.Router();

// GET /api/audit-logs : Récupère la liste filtrable des logs d'audit
router.get('/', async (req, res) => {
  try {
    const { projetId, action, search, limit } = req.query;
    const filter: any = {};

    if (projetId && typeof projetId === 'string') {
      filter.projetId = projetId;
    }

    if (action && typeof action === 'string' && action !== 'Tous') {
      filter.action = action;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { nomProjet: regex },
        { codeProjet: regex },
        { auteur: regex },
        { description: regex }
      ];
    }

    const maxResults = limit ? parseInt(limit as string, 10) : 200;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(maxResults);

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audit-logs : Enregistrement manuel d'une entrée dans l'audit log
router.post('/', async (req, res) => {
  try {
    const log = new AuditLog(req.body);
    await log.save();
    res.status(201).json(log);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
