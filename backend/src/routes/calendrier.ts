import { Router, Request, Response } from 'express';
import { MoisCalendaire } from '../models/MoisCalendaire.js';
import { calculerJoursOuvresAuto } from '../utils/calendar.js';

const router = Router();

// GET tous les mois configurés pour une année
router.get('/annee/:annee', async (req: Request, res: Response) => {
  try {
    const annee = parseInt(req.params.annee, 10);
    const enregistres = await MoisCalendaire.find({ annee });
    const dictEnregistres = new Map<number, number | undefined>();
    enregistres.forEach((m: any) => dictEnregistres.set(m.mois, m.joursOuvresForces));

    const resultats = [];
    for (let mois = 1; mois <= 12; mois++) {
      const auto = calculerJoursOuvresAuto(annee, mois);
      const forcé = dictEnregistres.get(mois);
      resultats.push({
        annee,
        mois,
        joursOuvresAuto: auto,
        joursOuvresForces: forcé,
        joursOuvresEffectifs: forcé !== undefined && forcé !== null ? forcé : auto
      });
    }

    res.json(resultats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST/PUT forcer les jours ouvrés d'un mois
router.post('/forcer', async (req: Request, res: Response) => {
  try {
    const { annee, mois, joursOuvresForces } = req.body;
    
    if (joursOuvresForces === null || joursOuvresForces === undefined || joursOuvresForces === '') {
      // Supprimer le forçage
      await MoisCalendaire.findOneAndDelete({ annee, mois });
      return res.json({ message: 'Forçage réinitialisé (valeur calculée restaurée)' });
    }

    const valNum = Number(joursOuvresForces);
    const updated = await MoisCalendaire.findOneAndUpdate(
      { annee, mois },
      { joursOuvresForces: valNum },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
