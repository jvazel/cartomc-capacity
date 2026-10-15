import { Router, Request, Response } from 'express';
import { ConfigurationTolerances } from '../models/ConfigurationTolerances.js';

const router = Router();

// GET singleton config (défaut si inexistant)
router.get('/', async (_req: Request, res: Response) => {
  try {
    let config = await ConfigurationTolerances.findOne();
    if (!config) {
      config = await ConfigurationTolerances.create({
        toleranceB0Pct: 100,
        toleranceB1Pct: 20,
        seuilSousChargeJours: 10,
        jiraAbsenceIssueKey: 'HP-26',
        categoriesRun: ['MCO', 'Evol Technique']
      });
    }
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PUT update config
router.put('/', async (req: Request, res: Response) => {
  try {
    let config = await ConfigurationTolerances.findOne();
    if (!config) {
      config = new ConfigurationTolerances(req.body);
    } else {
      config.toleranceB0Pct = req.body.toleranceB0Pct ?? config.toleranceB0Pct;
      config.toleranceB1Pct = req.body.toleranceB1Pct ?? config.toleranceB1Pct;
      config.seuilSousChargeJours = req.body.seuilSousChargeJours ?? config.seuilSousChargeJours;
      if (req.body.jiraAbsenceIssueKey !== undefined) {
        config.jiraAbsenceIssueKey = req.body.jiraAbsenceIssueKey;
      }
      if (Array.isArray(req.body.categoriesRun)) {
        config.categoriesRun = req.body.categoriesRun;
      }
    }
    const saved = await config.save();
    res.json(saved);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
