import { Router, Request, Response } from 'express';
import { VersionMilestone, IVersionMilestone } from '../models/VersionMilestone.js';
import { TempoWorklog } from '../models/TempoWorklog.js';
import { JiraTempoClient } from '../services/JiraTempoClient.js';
import { TempoConfig } from '../models/TempoConfig.js';
import { Ressource } from '../models/Ressource.js';

const router = Router();

// Normalisation des statuts Jira
export function categorizeJiraStatus(statusName: string = ''): 'todo' | 'inprogress' | 'review' | 'qa' | 'done' | 'other' {
  const s = statusName.toLowerCase().trim();
  if (['à faire', 'a faire', 'to do', 'todo', 'backlog', 'ouvert', 'open', 'nouveau', 'new'].includes(s)) {
    return 'todo';
  }
  if (['en cours', 'in progress', 'in dev', 'en dev', 'development'].includes(s)) {
    return 'inprogress';
  }
  if (['in review', 'en revue', 'revue', 'code review', 'technical validation', 'tech validation', 'validation technique', 'validation tech', 'mr', 'pr open', 'merge request', 'waiting review'].includes(s)) {
    return 'review';
  }
  if (['recette', 'en recette', 'qa', 'testing', 'en test', 'test', 'uat', 'recette en cours', 'ready to test', 'prêt pour test', 'pret pour test', 'ready for test', 'tests qlf', 'test qlf', 'qlf', 'en qlf'].includes(s)) {
    return 'qa';
  }
  if (['terminé', 'termine', 'fini', 'done', 'closed', 'fermé', 'ferme', 'résolu', 'resolu', 'resolved', 'livré', 'livre', 'en prod', 'prêt pour prod', 'awaiting prod integration', 'en attente mep', 'en attente de mep', 'en attente prod'].includes(s)) {
    return 'done';
  }
  return 'other';
}

// Fonctions d'aide pour vérifier la conformité des statuts Jira avec les jalons dépassés
export function isStatusAcceptedForFinMR(statusName: string = ''): boolean {
  const s = statusName.toLowerCase().trim();
  // Statuts autorisés après Fin MR : Validating, Ready to test, Tests QLF, Awaiting Prod Integration, Fini, Cancelled
  const acceptedTokens = [
    'validating',
    'ready to test',
    'prêt pour test',
    'pret pour test',
    'ready for test',
    'tests qlf',
    'test qlf',
    'qlf',
    'en qlf',
    'awaiting prod integration',
    'fini',
    'done',
    'terminé',
    'termine',
    'closed',
    'fermé',
    'ferme',
    'résolu',
    'resolu',
    'resolved',
    'livré',
    'livre',
    'en prod',
    'prêt pour prod',
    'cancelled',
    'canceled',
    'annulé',
    'annule'
  ];
  return acceptedTokens.some(token => s === token || s.includes(token));
}

export function isStatusAcceptedForFinRecetteOrMEPP(statusName: string = ''): boolean {
  const s = statusName.toLowerCase().trim();
  // Statuts autorisés après Fin Recette ou MEPP : Awaiting Prod Integration, Fini, Cancelled
  const acceptedTokens = [
    'awaiting prod integration',
    'fini',
    'done',
    'terminé',
    'termine',
    'closed',
    'fermé',
    'ferme',
    'résolu',
    'resolu',
    'resolved',
    'livré',
    'livre',
    'en prod',
    'prêt pour prod',
    'cancelled',
    'canceled',
    'annulé',
    'annule'
  ];
  return acceptedTokens.some(token => s === token || s.includes(token));
}

export function isStatusForbiddenForFinAFaire(statusName: string = ''): boolean {
  const s = statusName.toLowerCase().trim();
  // Statuts non permis après Fin À faire : "Ouverte", "Writing", "Validation", "Ready to Sprint", "Waiting Informations"
  const forbiddenTokens = [
    'ouverte',
    'ouvert',
    'open',
    'writing',
    'validation',
    'ready to sprint',
    'waiting informations',
    'waiting information',
    'waiting for information',
    'en attente info',
    'en attente informations'
  ];
  return forbiddenTokens.some(token => s === token || s.includes(token));
}

export function isStatusForbiddenForFinEnCours(statusName: string = ''): boolean {
  const s = statusName.toLowerCase().trim();
  // Statuts non permis après Fin En cours : "Ouverte", "Writing", "Validation", "Ready to Sprint", "En cours", "Waiting Informations"
  if (isStatusForbiddenForFinAFaire(statusName)) {
    return true;
  }
  const enCoursTokens = [
    'en cours',
    'in progress',
    'in dev',
    'en dev',
    'development'
  ];
  return enCoursTokens.some(token => s === token || s.includes(token));
}

/**
 * Calcul du statut d'anomalie d'un ticket vis-à-vis des jalons de sa version
 */
export function checkTicketAnomaly(
  statusName: string,
  milestones: {
    dateFinAFaire?: Date | null;
    dateFinEnCours?: Date | null;
    dateFinMR?: Date | null;
    dateFinRecette?: Date | null;
    dateMEPP?: Date | null;
    dateMEP?: Date | null;
  },
  now: Date = new Date()
): { anomaly: 'none' | 'a_decaler' | 'retard_dev' | 'retard_mr' | 'retard_recette' | 'retard_mepp'; label: string; severity: 'ok' | 'warning' | 'critical' } {
  const s = (statusName || '').trim();
  const lowerStatus = s.toLowerCase();

  // Les tickets annulés ne sont jamais en anomalie
  if (lowerStatus.includes('cancel') || lowerStatus.includes('annul')) {
    return { anomaly: 'none', label: 'Annulé', severity: 'ok' };
  }

  // 1. Dépassement MEPP : le statut doit être "Awaiting Prod Integration", "Fini" ou "Cancelled"
  if (milestones.dateMEPP && now > new Date(milestones.dateMEPP)) {
    if (!isStatusAcceptedForFinRecetteOrMEPP(statusName)) {
      return {
        anomaly: 'retard_mepp',
        label: `Non conforme MEPP (Statut "${s}" non permis après MEPP)`,
        severity: 'critical'
      };
    }
  }

  // 2. Dépassement Fin Recette : le statut doit être "Awaiting Prod Integration", "Fini" ou "Cancelled"
  if (milestones.dateFinRecette && now > new Date(milestones.dateFinRecette)) {
    if (!isStatusAcceptedForFinRecetteOrMEPP(statusName)) {
      return {
        anomaly: 'retard_recette',
        label: `Non conforme Fin Recette (Statut "${s}" non permis après Fin Recette)`,
        severity: 'critical'
      };
    }
  }

  // 3. Dépassement Fin MR : le statut doit être "Validating", "Ready to test", "Tests QLF", "Awaiting Prod Integration", "Fini" ou "Cancelled"
  if (milestones.dateFinMR && now > new Date(milestones.dateFinMR)) {
    if (!isStatusAcceptedForFinMR(statusName)) {
      return {
        anomaly: 'retard_mr',
        label: `Non conforme Fin MR (Statut "${s}" non permis après Fin MR)`,
        severity: 'critical'
      };
    }
  }

  // 4. Dépassement Fin En cours : le statut ne doit pas être "Ouverte", "Writing", "Validation", "Ready to Sprint", "En cours", "Waiting Informations"
  if (milestones.dateFinEnCours && now > new Date(milestones.dateFinEnCours)) {
    if (isStatusForbiddenForFinEnCours(statusName)) {
      return {
        anomaly: 'retard_dev',
        label: `Non conforme Fin En cours (Statut "${s}" non permis après Fin En cours)`,
        severity: 'critical'
      };
    }
  }

  // 5. Dépassement Fin À faire : le statut ne doit pas être "Ouverte", "Writing", "Validation", "Ready to Sprint", "Waiting Informations"
  if (milestones.dateFinAFaire && now > new Date(milestones.dateFinAFaire)) {
    if (isStatusForbiddenForFinAFaire(statusName)) {
      return {
        anomaly: 'a_decaler',
        label: `Non conforme Fin À faire (Statut "${s}" non permis après Fin À faire)`,
        severity: 'critical'
      };
    }
  }

  const category = categorizeJiraStatus(statusName);

  if (category === 'done') {
    return { anomaly: 'none', label: 'Terminé', severity: 'ok' };
  }

  // Fallback si d'autres statuts de type todo ou inprogress dépassent
  if (milestones.dateFinEnCours && now > new Date(milestones.dateFinEnCours)) {
    if (category === 'inprogress') {
      return {
        anomaly: 'retard_dev',
        label: 'Dév hors délai (Jalon "Fin En cours" dépassé)',
        severity: 'critical'
      };
    }
    if (category === 'todo') {
      return {
        anomaly: 'a_decaler',
        label: 'À décaler (Dév déjà clos pour cette release)',
        severity: 'critical'
      };
    }
  }

  if (milestones.dateFinAFaire && now > new Date(milestones.dateFinAFaire)) {
    if (category === 'todo') {
      return {
        anomaly: 'a_decaler',
        label: 'À décaler (Jalon "Fin À faire" dépassé)',
        severity: 'critical'
      };
    }
  }

  return { anomaly: 'none', label: 'En cours normal', severity: 'ok' };
}

/**
 * GET /api/versions
 * Liste toutes les versions avec leurs jalons et leurs indicateurs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectKey = (req.query.projectKey as string) || 'GTEP';
    const filter = (req.query.filter as string) || 'unreleased'; // 'unreleased' | 'released' | 'all'

    // 1. Auto-amorçage si VersionMilestone est vide pour ce projet :
    // On extrait les versions présentes dans TempoWorklog
    const countExisting = await VersionMilestone.countDocuments({ projectKey });
    if (countExisting === 0) {
      const distinctVersions = await TempoWorklog.distinct('fixVersions', { projectKey });
      const versionNames = new Set<string>();
      distinctVersions.forEach((fv) => {
        if (fv && typeof fv === 'string') {
          fv.split(',').forEach((part) => {
            const clean = part.trim();
            if (clean && clean !== 'NC' && clean !== 'Sans version') {
              versionNames.add(clean);
            }
          });
        }
      });

      if (versionNames.size > 0) {
        const initialDocs = Array.from(versionNames).map((name) => ({
          versionName: name,
          projectKey,
          released: false, // Par défaut non publiée
          archived: false,
          lastExtractedAt: new Date()
        }));
        await VersionMilestone.insertMany(initialDocs, { ordered: false }).catch(() => {});
      }
    }

    // 2. Requête des versions avec filtre
    const query: any = { projectKey };
    if (filter === 'unreleased') {
      query.released = false;
    } else if (filter === 'released') {
      query.released = true;
    }

    const versions = await VersionMilestone.find(query).sort({ dateMEP: 1, versionName: 1 });

    // 3. Enrichissement avec les métriques issues de TempoWorklog
    const now = new Date();

    // Récupération de tous les worklogs pour ce projet pour associer les tickets par version
    const worklogs = await TempoWorklog.find({ projectKey });

    // Mapper les tickets par fixVersion
    const ticketsByVersion = new Map<string, Map<string, { key: string; summary: string; status: string; collaborator: string; timeInDays: number }>>();

    worklogs.forEach((wl) => {
      const fvString = wl.fixVersions || '';
      if (!fvString) return;

      const fvList = fvString.split(',').map((v) => v.trim()).filter(Boolean);
      fvList.forEach((vName) => {
        if (!ticketsByVersion.has(vName)) {
          ticketsByVersion.set(vName, new Map());
        }
        const vMap = ticketsByVersion.get(vName)!;
        if (!vMap.has(wl.issueKey)) {
          vMap.set(wl.issueKey, {
            key: wl.issueKey,
            summary: wl.entryTask || '',
            status: wl.status || 'Inconnu',
            collaborator: wl.collaborator || 'Inconnu',
            timeInDays: wl.timeInDays || 0
          });
        } else {
          vMap.get(wl.issueKey)!.timeInDays += wl.timeInDays || 0;
        }
      });
    });

    // Formater la réponse consolidée
    const result = versions.map((v) => {
      const vTickets = ticketsByVersion.get(v.versionName);
      const ticketList = vTickets ? Array.from(vTickets.values()) : [];

      let countTotal = ticketList.length;
      let countTodo = 0;
      let countInProgress = 0;
      let countReview = 0;
      let countQA = 0;
      let countDone = 0;
      let countADecaler = 0;
      let countRetardDev = 0;
      let countRetardMR = 0;
      let countRetardRecette = 0;
      let countRetardMEPP = 0;

      ticketList.forEach((t) => {
        const cat = categorizeJiraStatus(t.status);
        if (cat === 'todo') countTodo++;
        else if (cat === 'inprogress') countInProgress++;
        else if (cat === 'review') countReview++;
        else if (cat === 'qa') countQA++;
        else if (cat === 'done') countDone++;

        const check = checkTicketAnomaly(t.status, {
          dateFinAFaire: v.dateFinAFaire,
          dateFinEnCours: v.dateFinEnCours,
          dateFinMR: v.dateFinMR,
          dateFinRecette: v.dateFinRecette,
          dateMEPP: v.dateMEPP,
          dateMEP: v.dateMEP
        }, now);

        if (check.anomaly === 'a_decaler') countADecaler++;
        else if (check.anomaly === 'retard_dev') countRetardDev++;
        else if (check.anomaly === 'retard_mr') countRetardMR++;
        else if (check.anomaly === 'retard_recette') countRetardRecette++;
        else if (check.anomaly === 'retard_mepp') countRetardMEPP++;
      });

      const totalAnomalies = countADecaler + countRetardDev + countRetardMR + countRetardRecette + countRetardMEPP;

      // Calcul de la santé globale de la version
      let health: 'green' | 'orange' | 'red' = 'green';
      if (totalAnomalies > 0) {
        health = countADecaler > 0 || countRetardDev > 0 || countRetardRecette > 0 || countRetardMEPP > 0 ? 'red' : 'orange';
      }

      return {
        _id: v._id,
        versionName: v.versionName,
        projectKey: v.projectKey,
        released: v.released,
        archived: v.archived,
        jiraReleaseDate: v.jiraReleaseDate,
        dateFinAFaire: v.dateFinAFaire,
        dateFinEnCours: v.dateFinEnCours,
        dateFinMR: v.dateFinMR,
        dateFinRecette: v.dateFinRecette,
        dateMEPP: v.dateMEPP,
        dateMEP: v.dateMEP,
        description: v.description,
        updatedAt: v.updatedAt,
        metrics: {
          totalTickets: countTotal,
          todo: countTodo,
          inProgress: countInProgress,
          review: countReview,
          qa: countQA,
          done: countDone,
          anomalies: {
            total: totalAnomalies,
            aDecaler: countADecaler,
            retardDev: countRetardDev,
            retardMR: countRetardMR,
            retardRecette: countRetardRecette,
            retardMEPP: countRetardMEPP
          },
          health
        }
      };
    });

    // Calcul des tickets orphelins / sans version affectée pour ce projet
    const unassignedTicketsMap = new Map<string, { key: string; summary: string; status: string; collaborator: string; timeInDays: number }>();
    worklogs.forEach((wl) => {
      const fv = (wl.fixVersions || '').trim();
      const isUnassigned = !fv || fv === 'NC' || fv === 'Sans version' || fv === 'None' || fv === 'null';
      if (isUnassigned) {
        if (!unassignedTicketsMap.has(wl.issueKey)) {
          unassignedTicketsMap.set(wl.issueKey, {
            key: wl.issueKey,
            summary: wl.entryTask || '',
            status: wl.status || 'Inconnu',
            collaborator: wl.collaborator || 'Inconnu',
            timeInDays: wl.timeInDays || 0
          });
        } else {
          unassignedTicketsMap.get(wl.issueKey)!.timeInDays += wl.timeInDays || 0;
        }
      }
    });

    const unassignedTicketsCount = unassignedTicketsMap.size;

    // Retourner un objet contenant versions et unassignedTicketsCount
    res.json({
      versions: result,
      unassignedTicketsCount
    });
  } catch (err: any) {
    console.error('Erreur GET /api/versions:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des versions: ' + err.message });
  }
});

/**
 * GET /api/versions/unassigned/tickets
 * Liste tous les tickets Jira non affectés à une version (fixVersions vide ou NC)
 */
router.get('/unassigned/tickets', async (req: Request, res: Response) => {
  try {
    const projectKey = (req.query.projectKey as string) || 'GTEP';
    const worklogs = await TempoWorklog.find({
      projectKey,
      $or: [
        { fixVersions: { $exists: false } },
        { fixVersions: null },
        { fixVersions: '' },
        { fixVersions: 'NC' },
        { fixVersions: 'Sans version' },
        { fixVersions: 'None' }
      ]
    });

    const ticketsMap = new Map<string, any>();
    worklogs.forEach((wl) => {
      if (!ticketsMap.has(wl.issueKey)) {
        ticketsMap.set(wl.issueKey, {
          key: wl.issueKey,
          summary: wl.entryTask || '',
          status: wl.status || 'Inconnu',
          statusCategory: categorizeJiraStatus(wl.status),
          collaborator: wl.collaborator || 'Inconnu',
          role: wl.role || '',
          type: wl.type || 'Unknown',
          ticketLink: wl.ticketLink || '',
          estimatedInDays: wl.estimatedInDays || null,
          timeInDays: wl.timeInDays || 0,
          anomaly: 'none',
          anomalyLabel: 'Non affecté à une version',
          severity: 'warning'
        });
      } else {
        ticketsMap.get(wl.issueKey).timeInDays += wl.timeInDays || 0;
      }
    });

    const tickets = Array.from(ticketsMap.values()).map((t) => ({
      ...t,
      timeInDays: Number(t.timeInDays.toFixed(2))
    }));

    res.json({
      projectKey,
      count: tickets.length,
      tickets
    });
  } catch (err: any) {
    console.error('Erreur GET /api/versions/unassigned/tickets:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des tickets non affectés: ' + err.message });
  }
});

/**
 * GET /api/versions/:id/tickets
 * Détail des tickets d'une version avec diagnostic individuel
 */
router.get('/:id/tickets', async (req: Request, res: Response) => {
  try {
    const version = await VersionMilestone.findById(req.params.id);
    if (!version) {
      return res.status(404).json({ error: 'Version introuvable' });
    }

    const worklogs = await TempoWorklog.find({
      projectKey: version.projectKey,
      fixVersions: { $regex: new RegExp(`(^|,\\s*)${escapeRegex(version.versionName)}(\\s*,|$)`, 'i') }
    });

    // Agréger par issueKey
    const ticketsMap = new Map<string, any>();
    const now = new Date();

    worklogs.forEach((wl) => {
      if (!ticketsMap.has(wl.issueKey)) {
        const check = checkTicketAnomaly(wl.status || '', {
          dateFinAFaire: version.dateFinAFaire,
          dateFinEnCours: version.dateFinEnCours,
          dateFinMR: version.dateFinMR,
          dateFinRecette: version.dateFinRecette,
          dateMEPP: version.dateMEPP,
          dateMEP: version.dateMEP
        }, now);

        ticketsMap.set(wl.issueKey, {
          key: wl.issueKey,
          summary: wl.entryTask || '',
          status: wl.status || 'Inconnu',
          statusCategory: categorizeJiraStatus(wl.status),
          collaborator: wl.collaborator || 'Inconnu',
          role: wl.role || '',
          type: wl.type || 'Unknown',
          ticketLink: wl.ticketLink || '',
          estimatedInDays: wl.estimatedInDays || null,
          timeInDays: wl.timeInDays || 0,
          anomaly: check.anomaly,
          anomalyLabel: check.label,
          severity: check.severity
        });
      } else {
        ticketsMap.get(wl.issueKey).timeInDays += wl.timeInDays || 0;
      }
    });

    const tickets = Array.from(ticketsMap.values()).map((t) => ({
      ...t,
      timeInDays: Number(t.timeInDays.toFixed(2))
    }));

    res.json({
      version: {
        _id: version._id,
        versionName: version.versionName,
        projectKey: version.projectKey,
        released: version.released,
        dateFinAFaire: version.dateFinAFaire,
        dateFinEnCours: version.dateFinEnCours,
        dateFinMR: version.dateFinMR,
        dateFinRecette: version.dateFinRecette,
        dateMEPP: version.dateMEPP,
        dateMEP: version.dateMEP
      },
      tickets
    });
  } catch (err: any) {
    console.error('Erreur GET /api/versions/:id/tickets:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des tickets de la version: ' + err.message });
  }
});

/**
 * PUT /api/versions/:id/milestones
 * Met à jour ou supprime les 6 dates de jalons d'une version
 */
router.put('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const {
      dateFinAFaire,
      dateFinEnCours,
      dateFinMR,
      dateFinRecette,
      dateMEPP,
      dateMEP,
      description
    } = req.body;

    const parseDateOrNull = (val: any) => {
      if (!val || val === '' || val === null) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const updated = await VersionMilestone.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          dateFinAFaire: parseDateOrNull(dateFinAFaire),
          dateFinEnCours: parseDateOrNull(dateFinEnCours),
          dateFinMR: parseDateOrNull(dateFinMR),
          dateFinRecette: parseDateOrNull(dateFinRecette),
          dateMEPP: parseDateOrNull(dateMEPP),
          dateMEP: parseDateOrNull(dateMEP),
          description: typeof description === 'string' ? description.trim() : undefined,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Version introuvable' });
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Erreur PUT /api/versions/:id/milestones:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des jalons: ' + err.message });
  }
});

/**
 * DELETE /api/versions/:id/milestones
 * Réinitialise tous les jalons d'une version
 */
router.delete('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const updated = await VersionMilestone.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          dateFinAFaire: null,
          dateFinEnCours: null,
          dateFinMR: null,
          dateFinRecette: null,
          dateMEPP: null,
          dateMEP: null,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Version introuvable' });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation des jalons: ' + err.message });
  }
});

/**
 * POST /api/versions/sync-jira
 * Synchronise manuellement les versions avec l'API Jira du projet
 */
router.post('/sync-jira', async (req: Request, res: Response) => {
  try {
    const projectKey = (req.body.projectKey as string) || 'GTEP';
    const baseUrl = process.env.JIRA_BASE_URL || 'https://collabtools.boulanger.team';
    const token = req.body.token || process.env.JIRA_API_TOKEN || '';

    if (!token) {
      return res.status(400).json({ error: 'Aucun token Jira disponible pour effectuer la synchronisation' });
    }

    const client = new JiraTempoClient({
      baseUrl,
      token,
      timeoutMs: 30000
    });

    const projectVersions = await client.getProjectVersions(projectKey);

    if (projectVersions.length === 0) {
      return res.json({ message: 'Aucune version retournée par Jira ou impossible de joindre Jira', count: 0 });
    }

    const bulkOps = projectVersions.map((pv) => ({
      updateOne: {
        filter: { versionName: pv.name.trim(), projectKey },
        update: {
          $set: {
            released: Boolean(pv.released),
            archived: Boolean(pv.archived),
            jiraReleaseDate: pv.releaseDate ? new Date(pv.releaseDate) : null,
            lastExtractedAt: new Date()
          },
          $setOnInsert: {
            versionName: pv.name.trim(),
            projectKey,
            dateFinAFaire: null,
            dateFinEnCours: null,
            dateFinMR: null,
            dateFinRecette: null,
            dateMEPP: null,
            dateMEP: null,
            description: pv.description || ''
          }
        },
        upsert: true
      }
    }));

    await VersionMilestone.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: `${projectVersions.length} versions synchronisées avec succès depuis Jira.`,
      count: projectVersions.length
    });
  } catch (err: any) {
    console.error('Erreur POST /api/versions/sync-jira:', err);
    res.status(500).json({ error: 'Erreur lors de la synchronisation Jira: ' + err.message });
  }
});

/**
 * Helper : calcul du numéro de semaine ISO-8601 et clé "YYYY-Www"
 */
function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(weekNo).padStart(2, '0')}`;
}

/**
 * GET /api/versions/reports/velocity
 * Rapport de vélocité inter-versions (Estimé vs Consommé vs Livré en Jours/Homme)
 */
router.get('/reports/velocity', async (req: Request, res: Response) => {
  try {
    const projectKey = (req.query.projectKey as string) || 'GTEP';
    const limit = parseInt(req.query.limit as string, 10) || 8;

    // Récupérer les versions du projet (publiées + non publiées récentes)
    const versions = await VersionMilestone.find({ projectKey })
      .sort({ dateMEP: 1, versionName: 1 });

    const worklogs = await TempoWorklog.find({ projectKey });

    // Mapper les worklogs par fixVersion
    const versionDataMap = new Map<string, {
      ticketsMap: Map<string, { estimatedInDays: number; timeInDays: number; status: string }>;
    }>();

    worklogs.forEach((wl) => {
      const fvString = wl.fixVersions || '';
      if (!fvString) return;
      const fvList = fvString.split(',').map((v) => v.trim()).filter(Boolean);

      fvList.forEach((vName) => {
        if (!versionDataMap.has(vName)) {
          versionDataMap.set(vName, { ticketsMap: new Map() });
        }
        const vEntry = versionDataMap.get(vName)!;
        if (!vEntry.ticketsMap.has(wl.issueKey)) {
          vEntry.ticketsMap.set(wl.issueKey, {
            estimatedInDays: wl.estimatedInDays || 0,
            timeInDays: wl.timeInDays || 0,
            status: wl.status || ''
          });
        } else {
          vEntry.ticketsMap.get(wl.issueKey)!.timeInDays += wl.timeInDays || 0;
          if (wl.estimatedInDays && !vEntry.ticketsMap.get(wl.issueKey)!.estimatedInDays) {
            vEntry.ticketsMap.get(wl.issueKey)!.estimatedInDays = wl.estimatedInDays;
          }
        }
      });
    });

    const velocityList = versions.map((v) => {
      const vEntry = versionDataMap.get(v.versionName);
      const tickets = vEntry ? Array.from(vEntry.ticketsMap.values()) : [];

      let totalEstimated = 0;
      let totalActual = 0;
      let totalDelivered = 0;

      tickets.forEach((t) => {
        const est = t.estimatedInDays > 0 ? t.estimatedInDays : 0;
        totalEstimated += est;
        totalActual += t.timeInDays || 0;

        const cat = categorizeJiraStatus(t.status);
        if (cat === 'done') {
          totalDelivered += est > 0 ? est : t.timeInDays;
        }
      });

      return {
        _id: v._id,
        versionName: v.versionName,
        released: v.released,
        dateMEP: v.dateMEP,
        estimatedDays: Number(totalEstimated.toFixed(1)),
        actualDays: Number(totalActual.toFixed(1)),
        deliveredDays: Number(totalDelivered.toFixed(1)),
        ticketCount: tickets.length
      };
    }).filter(v => v.ticketCount > 0 || v.actualDays > 0 || v.estimatedDays > 0);

    // Prendre les dernières versions selon la limite
    const sliced = velocityList.slice(-limit);

    // Calcul de la vélocité moyenne livrée
    const deliveredValues = sliced.filter(s => s.deliveredDays > 0).map(s => s.deliveredDays);
    const avgDelivered = deliveredValues.length > 0
      ? Number((deliveredValues.reduce((a, b) => a + b, 0) / deliveredValues.length).toFixed(1))
      : 0;

    res.json({
      projectKey,
      averageVelocityDays: avgDelivered,
      versions: sliced
    });
  } catch (err: any) {
    console.error('Erreur GET /api/versions/reports/velocity:', err);
    res.status(500).json({ error: 'Erreur rapport vélocité: ' + err.message });
  }
});

/**
 * GET /api/versions/:id/burnup
 * Burnup chart d'une version donnée : Évolution cumulée de l'effort (Estimé vs Consommé) par semaine
 */
router.get('/:id/burnup', async (req: Request, res: Response) => {
  try {
    const version = await VersionMilestone.findById(req.params.id);
    if (!version) {
      return res.status(404).json({ error: 'Version non trouvée' });
    }

    // Récupérer les worklogs de cette version
    const regex = new RegExp(`(^|,\\s*)${escapeRegex(version.versionName.trim())}(\\s*,|$)`, 'i');
    const worklogs = await TempoWorklog.find({
      projectKey: version.projectKey,
      fixVersions: { $regex: regex }
    }).sort({ worklogDate: 1 });

    // Dictionnaire des tickets de la version (clé -> { estimated, status, finalDone })
    const ticketsMap = new Map<string, { estimated: number; status: string; isDone: boolean }>();
    worklogs.forEach((wl) => {
      if (!ticketsMap.has(wl.issueKey)) {
        ticketsMap.set(wl.issueKey, {
          estimated: wl.estimatedInDays || 0,
          status: wl.status || '',
          isDone: categorizeJiraStatus(wl.status) === 'done'
        });
      } else if (wl.estimatedInDays && !ticketsMap.get(wl.issueKey)!.estimated) {
        ticketsMap.get(wl.issueKey)!.estimated = wl.estimatedInDays;
      }
    });

    const totalEstimated = Array.from(ticketsMap.values()).reduce((sum, t) => sum + (t.estimated || 0), 0);
    const totalActualDays = worklogs.reduce((sum, wl) => sum + (wl.timeInDays || 0), 0);

    // Agréger les temps par semaine ISO
    const weeklyActualMap = new Map<string, number>();
    worklogs.forEach((wl) => {
      const wDate = new Date(wl.worklogDate);
      const weekKey = getIsoWeekKey(wDate);
      const current = weeklyActualMap.get(weekKey) || 0;
      weeklyActualMap.set(weekKey, current + (wl.timeInDays || 0));
    });

    // Déterminer la plage de semaines (du 1er worklog jusqu'à aujourd'hui ou la date de MEP)
    let minDate = worklogs.length > 0 ? new Date(worklogs[0].worklogDate) : new Date();
    let maxDate = new Date();
    if (version.dateMEP && new Date(version.dateMEP) > maxDate) {
      maxDate = new Date(version.dateMEP);
    }
    if (version.dateFinAFaire && new Date(version.dateFinAFaire) < minDate) {
      minDate = new Date(version.dateFinAFaire);
    }

    // Construire la liste chronologique des semaines
    const weeksSet = new Set<string>();
    const cur = new Date(minDate);
    while (cur <= maxDate) {
      weeksSet.add(getIsoWeekKey(cur));
      cur.setDate(cur.getDate() + 7);
    }
    // Assurer l'inclusion de la semaine de MEP si existante
    if (version.dateMEP) {
      weeksSet.add(getIsoWeekKey(new Date(version.dateMEP)));
    }
    // Inclure toutes les semaines ayant eu des worklogs
    for (const wKey of weeklyActualMap.keys()) {
      weeksSet.add(wKey);
    }

    const sortedWeeks = Array.from(weeksSet).sort();

    // Calcul cumulé semaine par semaine
    let runningActual = 0;
    const nowWeekKey = getIsoWeekKey(new Date());

    const timeSeries = sortedWeeks.map((week, index) => {
      const addedActual = weeklyActualMap.get(week) || 0;
      runningActual += addedActual;

      const isFutureWeek = week > nowWeekKey;

      // Trajectoire idéale linéaire jusqu'à la MEP
      const idealProgress = sortedWeeks.length > 1
        ? Number(((totalEstimated * (index + 1)) / sortedWeeks.length).toFixed(1))
        : totalEstimated;

      return {
        week,
        // Périmètre total estimé (stable ou dynamique)
        scopeDays: Number(totalEstimated.toFixed(1)),
        // Consommé cumulé réel (null pour les semaines futures afin de ne pas fausser le tracé)
        actualDays: isFutureWeek && addedActual === 0 ? null : Number(runningActual.toFixed(1)),
        // Trajectoire idéale
        idealDays: Math.min(idealProgress, Number(totalEstimated.toFixed(1)))
      };
    });

    res.json({
      version: {
        _id: version._id,
        versionName: version.versionName,
        projectKey: version.projectKey,
        released: version.released,
        dateFinAFaire: version.dateFinAFaire,
        dateFinEnCours: version.dateFinEnCours,
        dateFinMR: version.dateFinMR,
        dateFinRecette: version.dateFinRecette,
        dateMEPP: version.dateMEPP,
        dateMEP: version.dateMEP
      },
      summary: {
        totalEstimatedDays: Number(totalEstimated.toFixed(1)),
        totalActualDays: Number(totalActualDays.toFixed(1)),
        remainingEstimatedDays: Number(Math.max(0, totalEstimated - totalActualDays).toFixed(1)),
        driftRatio: totalEstimated > 0 ? Number(((totalActualDays - totalEstimated) / totalEstimated * 100).toFixed(1)) : 0,
        ticketCount: ticketsMap.size
      },
      timeSeries
    });
  } catch (err: any) {
    console.error('Erreur GET /api/versions/:id/burnup:', err);
    res.status(500).json({ error: 'Erreur burnup chart: ' + err.message });
  }
});

/**
 * GET /api/versions/:id/transitions
 * Analyse du temps passé par statut (Lead Time, Cycle Time, goulots d'étranglement et flux cumulé CFD)
 */
router.get('/:id/transitions', async (req: Request, res: Response) => {
  try {
    const version = await VersionMilestone.findById(req.params.id);
    if (!version) {
      return res.status(404).json({ error: 'Version non trouvée' });
    }

    // Récupérer les worklogs de cette version triés par date
    const regex = new RegExp(`(^|,\\s*)${escapeRegex(version.versionName.trim())}(\\s*,|$)`, 'i');
    const worklogs = await TempoWorklog.find({
      projectKey: version.projectKey,
      fixVersions: { $regex: regex }
    }).sort({ worklogDate: 1 });

    // Regrouper par issueKey pour suivre le cycle de vie de chaque ticket
    const ticketsLifecycle = new Map<string, {
      key: string;
      summary: string;
      collaborator: string;
      finalStatus: string;
      ticketLink: string;
      estimatedDays: number;
      firstDate: Date;
      lastDate: Date;
      statusHistory: Map<string, { daysSpent: number; firstSeen: Date; lastSeen: Date }>;
      totalDays: number;
    }>();

    worklogs.forEach((wl) => {
      const wDate = new Date(wl.worklogDate);
      const rawStatus = wl.status || 'Inconnu';
      const cat = categorizeJiraStatus(rawStatus);
      
      // Catégorie lisible pour l'analyse de flux
      let stage = 'inprogress';
      const isBlocked = rawStatus.toLowerCase().includes('block') || rawStatus.toLowerCase().includes('bloqu');
      if (isBlocked) stage = 'blocked';
      else if (cat === 'todo') stage = 'todo';
      else if (cat === 'inprogress') stage = 'inprogress';
      else if (cat === 'review') stage = 'review';
      else if (cat === 'qa') stage = 'qa';
      else if (cat === 'done') stage = 'done';

      if (!ticketsLifecycle.has(wl.issueKey)) {
        const histMap = new Map();
        histMap.set(stage, { daysSpent: wl.timeInDays || 0, firstSeen: wDate, lastSeen: wDate });
        ticketsLifecycle.set(wl.issueKey, {
          key: wl.issueKey,
          summary: wl.entryTask || '',
          collaborator: wl.collaborator || 'Non assigné',
          finalStatus: rawStatus,
          ticketLink: wl.ticketLink || '',
          estimatedDays: wl.estimatedInDays || 0,
          firstDate: wDate,
          lastDate: wDate,
          statusHistory: histMap,
          totalDays: wl.timeInDays || 0
        });
      } else {
        const t = ticketsLifecycle.get(wl.issueKey)!;
        t.totalDays += wl.timeInDays || 0;
        if (wl.estimatedInDays && !t.estimatedDays) {
          t.estimatedDays = wl.estimatedInDays;
        }
        if (wl.ticketLink && !t.ticketLink) {
          t.ticketLink = wl.ticketLink;
        }
        if (wDate < t.firstDate) t.firstDate = wDate;
        if (wDate > t.lastDate) {
          t.lastDate = wDate;
          t.finalStatus = rawStatus;
        }

        if (!t.statusHistory.has(stage)) {
          t.statusHistory.set(stage, { daysSpent: wl.timeInDays || 0, firstSeen: wDate, lastSeen: wDate });
        } else {
          const entry = t.statusHistory.get(stage)!;
          entry.daysSpent += wl.timeInDays || 0;
          if (wDate < entry.firstSeen) entry.firstSeen = wDate;
          if (wDate > entry.lastSeen) entry.lastSeen = wDate;
        }
      }
    });

    // 1. Durées moyennes par étape (Visualisation A)
    const stagesDef = [
      { id: 'todo', label: 'À faire (Cadrage)', color: '#3b82f6' },
      { id: 'inprogress', label: 'En cours (Développement)', color: '#fbbf24' },
      { id: 'review', label: 'Validation Tech / MR', color: '#c084fc' },
      { id: 'qa', label: 'Recette / QA', color: '#6366f1' },
      { id: 'blocked', label: 'Bloqué (Blocked)', color: '#ef4444' },
      { id: 'done', label: 'Terminé / Fini', color: '#10b981' }
    ];

    const stageSums: Record<string, { totalDays: number; count: number }> = {};
    stagesDef.forEach((s) => {
      stageSums[s.id] = { totalDays: 0, count: 0 };
    });

    const ticketsList = Array.from(ticketsLifecycle.values()).map((t) => {
      // Décomposition par ticket en jours
      const breakdown: Record<string, number> = {
        todo: 0,
        inprogress: 0,
        review: 0,
        qa: 0,
        blocked: 0,
        done: 0
      };

      for (const [st, entry] of t.statusHistory.entries()) {
        const days = Number(entry.daysSpent.toFixed(1));
        breakdown[st] = days;
        if (stageSums[st]) {
          stageSums[st].totalDays += days;
          stageSums[st].count += 1;
        }
      }

      // Durée calendaire totale (en jours civils)
      const calendarDurationDays = Math.max(
        1,
        Math.round((t.lastDate.getTime() - t.firstDate.getTime()) / (1000 * 3600 * 24)) + 1
      );

      const actualEffort = Number(t.totalDays.toFixed(1));
      const estDays = Number((t.estimatedDays || 0).toFixed(1));
      const diffDays = Number((actualEffort - estDays).toFixed(1));
      const diffRatio = estDays > 0 ? Number(((diffDays / estDays) * 100).toFixed(1)) : 0;

      return {
        key: t.key,
        summary: t.summary,
        collaborator: t.collaborator,
        finalStatus: t.finalStatus,
        ticketLink: t.ticketLink,
        estimatedDays: estDays,
        actualDays: actualEffort,
        diffDays,
        diffRatio,
        totalEffortDays: actualEffort,
        calendarDurationDays,
        breakdown,
        firstDate: t.firstDate,
        lastDate: t.lastDate
      };
    });

    const stageAverages = stagesDef.map((s) => {
      const item = stageSums[s.id];
      const avgDays = item.count > 0 ? Number((item.totalDays / item.count).toFixed(1)) : 0;
      return {
        stage: s.id,
        label: s.label,
        color: s.color,
        averageDays: avgDays,
        totalDays: Number(item.totalDays.toFixed(1)),
        ticketCount: item.count
      };
    });

    // Détection du goulot d'étranglement (l'étape active qui consomme le plus de temps)
    const activeStages = stageAverages.filter(s => s.stage !== 'done' && s.stage !== 'todo');
    const bottleneck = activeStages.length > 0
      ? activeStages.reduce((max, s) => s.averageDays > max.averageDays ? s : max, activeStages[0])
      : null;

    // Cycle Time moyen (somme dev + review + qa + blocked)
    const averageCycleTimeDays = Number(
      activeStages.reduce((sum, s) => sum + s.averageDays, 0).toFixed(1)
    );

    // 2. Cumulative Flow Diagram (CFD - Visualisation C)
    // Agréger semaine par semaine le nombre de tickets passés/actifs par statut
    const weeksSet = new Set<string>();
    worklogs.forEach((wl) => {
      weeksSet.add(getIsoWeekKey(new Date(wl.worklogDate)));
    });
    if (version.dateFinAFaire) weeksSet.add(getIsoWeekKey(new Date(version.dateFinAFaire)));
    if (version.dateMEP) weeksSet.add(getIsoWeekKey(new Date(version.dateMEP)));
    weeksSet.add(getIsoWeekKey(new Date()));

    const sortedWeeks = Array.from(weeksSet).sort();

    // Reconstitution cumulative pour le CFD
    const cfdData = sortedWeeks.map((week) => {
      let countTodo = 0;
      let countInProgress = 0;
      let countReview = 0;
      let countQA = 0;
      let countBlocked = 0;
      let countDone = 0;

      worklogs.forEach((wl) => {
        const wKey = getIsoWeekKey(new Date(wl.worklogDate));
        if (wKey <= week) {
          const rawStatus = (wl.status || '').toLowerCase();
          const isBlocked = rawStatus.includes('block') || rawStatus.includes('bloqu');
          const cat = categorizeJiraStatus(rawStatus);

          if (isBlocked) countBlocked++;
          else if (cat === 'done') countDone++;
          else if (cat === 'qa') countQA++;
          else if (cat === 'review') countReview++;
          else if (cat === 'inprogress') countInProgress++;
          else countTodo++;
        }
      });

      // Normalisation proportionnelle par ticket unique actif à cette semaine
      const totalEvents = countTodo + countInProgress + countReview + countQA + countBlocked + countDone;
      const scale = totalEvents > 0 ? ticketsList.length / totalEvents : 1;

      return {
        week,
        done: Math.round(countDone * scale),
        qa: Math.round(countQA * scale),
        review: Math.round(countReview * scale),
        inProgress: Math.round(countInProgress * scale),
        blocked: Math.round(countBlocked * scale),
        todo: Math.max(0, ticketsList.length - Math.round((countDone + countQA + countReview + countInProgress + countBlocked) * scale))
      };
    });

      // 3. Staffing Collaborateurs & Typologie (Interne vs Externe)
      // Récupérer la table des Ressources pour identifier le type officiel et rôle si disponible
      const dbRessources = await Ressource.find();
      const ressourceByName = new Map<string, any>();
      dbRessources.forEach((r) => {
        if (r.nom) ressourceByName.set(r.nom.toLowerCase().trim(), r);
      });

      const staffMap = new Map<string, { collaborator: string; type: 'Interne' | 'Externe'; role: string; days: number; ticketCount: number }>();
      const ticketsByCollab = new Map<string, Set<string>>();

      worklogs.forEach((wl) => {
        const cName = (wl.collaborator || 'Non assigné').trim();
        const normName = cName.toLowerCase();
        const dbRes = ressourceByName.get(normName);

        let cType: 'Interne' | 'Externe' = 'Interne';
        let cRole = 'Collaborateur';

        if (dbRes) {
          cType = dbRes.type === 'Externe' ? 'Externe' : 'Interne';
          cRole = dbRes.role || cRole;
        } else if (wl.type) {
          cType = wl.type === 'EXT' ? 'Externe' : 'Interne';
          cRole = wl.role || cRole;
        }

        if (!staffMap.has(cName)) {
          staffMap.set(cName, {
            collaborator: cName,
            type: cType,
            role: cRole,
            days: 0,
            ticketCount: 0
          });
          ticketsByCollab.set(cName, new Set());
        }

        const entry = staffMap.get(cName)!;
        entry.days += wl.timeInDays || 0;
        if (wl.issueKey) {
          ticketsByCollab.get(cName)!.add(wl.issueKey);
        }
      });

      const staffing = Array.from(staffMap.values()).map((s) => ({
        ...s,
        days: Number(s.days.toFixed(1)),
        ticketCount: ticketsByCollab.get(s.collaborator)?.size || 0
      })).sort((a, b) => b.days - a.days);

      const totalStaffDays = staffing.reduce((sum, s) => sum + s.days, 0);
      const daysInterne = Number(staffing.filter(s => s.type === 'Interne').reduce((sum, s) => sum + s.days, 0).toFixed(1));
      const daysExterne = Number(staffing.filter(s => s.type === 'Externe').reduce((sum, s) => sum + s.days, 0).toFixed(1));
      const ratioInterne = totalStaffDays > 0 ? Number(((daysInterne / totalStaffDays) * 100).toFixed(1)) : 0;
      const ratioExterne = totalStaffDays > 0 ? Number(((daysExterne / totalStaffDays) * 100).toFixed(1)) : 0;

      // 4. Arrivée du Scope (Scope Creep) par Semaine
      // Comparer semaine par semaine les tickets arrivés dans le scope vs tickets livrés (terminés)
      const weekAddedScopeMap = new Map<string, { count: number; estimatedDays: number; keys: string[] }>();
      const weekDoneScopeMap = new Map<string, { count: number; actualDays: number; keys: string[] }>();

      ticketsList.forEach((t) => {
        const addedWeek = getIsoWeekKey(t.firstDate);
        if (!weekAddedScopeMap.has(addedWeek)) {
          weekAddedScopeMap.set(addedWeek, { count: 0, estimatedDays: 0, keys: [] });
        }
        const aEntry = weekAddedScopeMap.get(addedWeek)!;
        aEntry.count++;
        aEntry.estimatedDays += t.estimatedDays > 0 ? t.estimatedDays : t.totalEffortDays;
        aEntry.keys.push(t.key);

        if (categorizeJiraStatus(t.finalStatus) === 'done') {
          const doneWeek = getIsoWeekKey(t.lastDate);
          if (!weekDoneScopeMap.has(doneWeek)) {
            weekDoneScopeMap.set(doneWeek, { count: 0, actualDays: 0, keys: [] });
          }
          const dEntry = weekDoneScopeMap.get(doneWeek)!;
          dEntry.count++;
          dEntry.actualDays += t.totalEffortDays;
          dEntry.keys.push(t.key);
        }
      });

      // Union de toutes les semaines de la release
      const scopeWeeksSet = new Set<string>([...sortedWeeks]);
      for (const w of weekAddedScopeMap.keys()) scopeWeeksSet.add(w);
      for (const w of weekDoneScopeMap.keys()) scopeWeeksSet.add(w);

      const sortedScopeWeeks = Array.from(scopeWeeksSet).sort();
      let cumulativeScopeCount = 0;
      let cumulativeScopeDays = 0;
      let cumulativeDoneCount = 0;
      let cumulativeDoneDays = 0;

      const scopeCreepData = sortedScopeWeeks.map((week) => {
        const added = weekAddedScopeMap.get(week) || { count: 0, estimatedDays: 0, keys: [] };
        const done = weekDoneScopeMap.get(week) || { count: 0, actualDays: 0, keys: [] };

        cumulativeScopeCount += added.count;
        cumulativeScopeDays += added.estimatedDays;
        cumulativeDoneCount += done.count;
        cumulativeDoneDays += done.actualDays;

        return {
          week,
          addedTickets: added.count,
          addedDays: Number(added.estimatedDays.toFixed(1)),
          completedTickets: done.count,
          completedDays: Number(done.actualDays.toFixed(1)),
          cumulativeScopeTickets: cumulativeScopeCount,
          cumulativeScopeDays: Number(cumulativeScopeDays.toFixed(1)),
          cumulativeDoneTickets: cumulativeDoneCount,
          cumulativeDoneDays: Number(cumulativeDoneDays.toFixed(1))
        };
      });

      // 5. Capacité Nette vs Charge Version
      // Période de la release : du premier worklog (ou dateFinAFaire) jusqu'à dateMEP (ou maxDate)
      let startReleaseDate = version.dateFinAFaire ? new Date(version.dateFinAFaire) : (worklogs.length > 0 ? new Date(worklogs[0].worklogDate) : new Date());
      let endReleaseDate = version.dateMEP ? new Date(version.dateMEP) : (worklogs.length > 0 ? new Date(worklogs[worklogs.length - 1].worklogDate) : new Date());
      if (endReleaseDate < startReleaseDate) {
        endReleaseDate = new Date(startReleaseDate);
        endReleaseDate.setDate(endReleaseDate.getDate() + 30);
      }

      // Calcul des jours ouvrés sur la période de release
      let workingDaysCount = 0;
      const scanDate = new Date(startReleaseDate);
      while (scanDate <= endReleaseDate) {
        const dayOfWeek = scanDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDaysCount++;
        }
        scanDate.setDate(scanDate.getDate() + 1);
      }
      if (workingDaysCount === 0) workingDaysCount = 20;

      // Nombre de contributeurs actifs sur cette release
      const activeContributorsCount = Math.max(1, staffing.length);
      // Capacité nette théorique de l'équipe mobilisée sur la période (Jours)
      const teamNetCapacityDays = Number((workingDaysCount * activeContributorsCount).toFixed(1));

      // Charge totale estimée (Scope) et consommée réelle (Tempo)
      const totalEstimatedCharge = Number(
        ticketsList.reduce((sum, t) => sum + (t.estimatedDays > 0 ? t.estimatedDays : t.totalEffortDays), 0).toFixed(1)
      );
      const totalActualCharge = Number(totalStaffDays.toFixed(1));

      // Ratio de faisabilité / saturation : Charge Version / Capacité Nette
      const feasibilityRatio = teamNetCapacityDays > 0
        ? Number(((totalEstimatedCharge / teamNetCapacityDays) * 100).toFixed(1))
        : 100;
      const actualConsumptionRatio = teamNetCapacityDays > 0
        ? Number(((totalActualCharge / teamNetCapacityDays) * 100).toFixed(1))
        : 100;

      const capacityVsDemand = {
        workingDaysCount,
        activeContributorsCount,
        teamNetCapacityDays,
        totalEstimatedCharge,
        totalActualCharge,
        feasibilityRatio,
        actualConsumptionRatio,
        status: feasibilityRatio > 100 ? 'surcharge' : feasibilityRatio > 85 ? 'tendu' : 'conforme'
      };

      // 6. Respect des 6 Jalons Clés (Drift / Écart en jours entre cible et réel)
      // Déterminer la date effective de passage pour chaque étape basée sur les worklogs
      const milestoneDefs = [
        { key: 'dateFinAFaire', id: 'todo', label: '1. Fin À faire (Cadrage)', target: version.dateFinAFaire },
        { key: 'dateFinEnCours', id: 'inprogress', label: '2. Fin En cours (Dév)', target: version.dateFinEnCours },
        { key: 'dateFinMR', id: 'review', label: '3. Fin MR (Tech Validation)', target: version.dateFinMR },
        { key: 'dateFinRecette', id: 'qa', label: '4. Fin Recette (QA/UAT)', target: version.dateFinRecette },
        { key: 'dateMEPP', id: 'mepp', label: '5. Pré-production (MEPP)', target: version.dateMEPP },
        { key: 'dateMEP', id: 'done', label: '6. Mise en Production (MEP)', target: version.dateMEP }
      ];

      // Trouver les dates réelles de fin d'activité pour chaque étape
      const milestoneDrift = milestoneDefs.map((m) => {
        let actualDate: Date | null = null;

        if (m.id === 'done') {
          // Date du dernier worklog ou date de clôture
          if (version.released && version.dateMEP) {
            actualDate = new Date(version.dateMEP);
          } else if (worklogs.length > 0) {
            const doneLogs = worklogs.filter(wl => categorizeJiraStatus(wl.status) === 'done');
            if (doneLogs.length > 0) {
              actualDate = new Date(doneLogs[doneLogs.length - 1].worklogDate);
            }
          }
        } else {
          // Chercher le dernier worklog correspondant à cette catégorie de statut
          const stageLogs = worklogs.filter(wl => {
            const cat = categorizeJiraStatus(wl.status);
            if (m.id === 'todo') return cat === 'todo';
            if (m.id === 'inprogress') return cat === 'inprogress';
            if (m.id === 'review') return cat === 'review';
            if (m.id === 'qa') return cat === 'qa';
            return false;
          });
          if (stageLogs.length > 0) {
            actualDate = new Date(stageLogs[stageLogs.length - 1].worklogDate);
          }
        }

        const targetDate = m.target ? new Date(m.target) : null;
        let driftDays: number | null = null;
        let driftStatus: 'ahead' | 'on_time' | 'delayed' | 'not_set' = 'not_set';

        if (targetDate && actualDate) {
          const diffMs = actualDate.getTime() - targetDate.getTime();
          driftDays = Math.round(diffMs / (1000 * 3600 * 24));
          if (driftDays > 2) driftStatus = 'delayed';
          else if (driftDays < -2) driftStatus = 'ahead';
          else driftStatus = 'on_time';
        } else if (targetDate && !actualDate) {
          // Si jalon dépassé dans le temps sans complétion
          const nowDiff = Math.round((Date.now() - targetDate.getTime()) / (1000 * 3600 * 24));
          if (nowDiff > 0) {
            driftDays = nowDiff;
            driftStatus = 'delayed';
          }
        }

        return {
          key: m.key,
          label: m.label,
          targetDate: targetDate ? targetDate.toISOString().split('T')[0] : null,
          actualDate: actualDate ? actualDate.toISOString().split('T')[0] : null,
          driftDays,
          driftStatus
        };
      });

      res.json({
        version: {
          _id: version._id,
          versionName: version.versionName,
          projectKey: version.projectKey,
          released: version.released,
          dateFinAFaire: version.dateFinAFaire,
          dateFinEnCours: version.dateFinEnCours,
          dateFinMR: version.dateFinMR,
          dateFinRecette: version.dateFinRecette,
          dateMEPP: version.dateMEPP,
          dateMEP: version.dateMEP
        },
        kpis: {
          ticketCount: ticketsList.length,
          averageCycleTimeDays,
          bottleneck: bottleneck ? { label: bottleneck.label, days: bottleneck.averageDays } : null,
          blockedAvgDays: stageAverages.find(s => s.stage === 'blocked')?.averageDays || 0
        },
        stageAverages,
        tickets: ticketsList.sort((a, b) => b.totalEffortDays - a.totalEffortDays),
        cfdData,
        staffingSummary: {
          totalStaffDays,
          daysInterne,
          daysExterne,
          ratioInterne,
          ratioExterne,
          staffing
        },
        scopeCreepData,
        capacityVsDemand,
        milestoneDrift
      });
    } catch (err: any) {
    console.error('Erreur GET /api/versions/:id/transitions:', err);
    res.status(500).json({ error: 'Erreur analyse statuts/transitions: ' + err.message });
  }
});

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export default router;
