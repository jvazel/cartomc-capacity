import express from 'express';
import { calculerCapaciteMensuelle } from '../services/capaciteService.js';

const router = express.Router();

// GET /api/capacite : Retourne le calcul de capacité mensuelle pour une année et plage de mois
router.get('/', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const moisDebut = req.query.moisDebut ? parseInt(req.query.moisDebut as string, 10) : 1;
    const moisFin = req.query.moisFin ? parseInt(req.query.moisFin as string, 10) : 12;

    const resCapacite = await calculerCapaciteMensuelle(annee, moisDebut, moisFin);
    res.json(resCapacite);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
