import { Router, Request, Response } from 'express';
import { extractionJobManager } from '../services/ExtractionJobManager.js';
import { TempoConfig, ICollaboratorDoc } from '../models/TempoConfig.js';
import { Ressource } from '../models/Ressource.js';
import { TempoWorklog } from '../models/TempoWorklog.js';

const router = Router();

/**
 * GET /api/tempo/extractions/saved
 * Retrieve all saved Tempo worklogs from MongoDB BDD cache
 */
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const docs = await TempoWorklog.find().sort({ worklogDate: -1 });
    const lastDoc = docs.length > 0 ? docs[0] : null;

    res.json({
      totalEntries: docs.length,
      extractedAt: lastDoc ? lastDoc.extractedAt : null,
      entries: docs
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données sauvegardées : ' + err.message });
  }
});

/**
 * POST /api/tempo/extractions
 * Launch async Tempo extraction job
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, projectKey, baseUrl, jiraToken } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Les dates de début (startDate) et de fin (endDate) sont requises.' });
    }

    const finalProjectKey = (projectKey || process.env.JIRA_DEFAULT_PROJECT || 'GTEP').trim().toUpperCase();
    const finalBaseUrl = (baseUrl || process.env.JIRA_BASE_URL || 'https://collabtools.boulanger.team').trim();
    const finalToken = (jiraToken || process.env.JIRA_API_TOKEN || '').trim();

    if (!finalToken) {
      return res.status(400).json({
        error: 'Aucun token Jira fourni et aucun token configuré dans le fichier .env (JIRA_API_TOKEN).'
      });
    }

    // Load customFields & collaborators from database
    let config = await TempoConfig.findOne();
    if (!config) {
      config = await TempoConfig.create({
        customFields: {
          budgetLine: 'customfield_10806',
          category: 'customfield_10900',
          lot: 'customfield_10103',
          featureId: 'customfield_10104',
          businessChange: 'customfield_10105'
        },
        collaborators: []
      });
    }

    if (config.customFields) {
      let updated = false;
      if (config.customFields.budgetLine !== 'customfield_10806') {
        config.customFields.budgetLine = 'customfield_10806';
        updated = true;
      }
      if (config.customFields.category !== 'customfield_10900') {
        config.customFields.category = 'customfield_10900';
        updated = true;
      }
      if (updated) {
        await config.save();
      }
    }

    // Load all categorized resources from MongoDB Ressource collection
    const dbRessources = await Ressource.find();
    const ressourceCollaborators: ICollaboratorDoc[] = dbRessources.map((r) => ({
      matricule: r.matricule,
      name: r.nom,
      type: (r.type === 'Interne' ? 'INT' : 'EXT') as 'INT' | 'EXT',
      role: (['DEV Back', 'PIL', 'QA', 'BA'].includes(r.role) ? r.role : 'Unknown') as any
    }));

    // Merge resources from DB + collaborators configured in TempoConfig
    const combinedCollaborators: ICollaboratorDoc[] = [
      ...ressourceCollaborators,
      ...(config.collaborators || [])
    ];

    const jobId = extractionJobManager.createJob();

    // Launch background execution (non-blocking)
    extractionJobManager.runJob(jobId, {
      startDate,
      endDate,
      projectKey: finalProjectKey,
      baseUrl: finalBaseUrl,
      jiraToken: finalToken,
      customFields: config.customFields,
      collaborators: combinedCollaborators
    });

    res.status(202).json({ jobId });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors du lancement du traitement: ' + err.message });
  }
});

/**
 * GET /api/tempo/extractions/:jobId/events
 * SSE stream for real-time progress events & heartbeats
 */
router.get('/:jobId/events', (req: Request, res: Response) => {
  const { jobId } = req.params;

  const job = extractionJobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job non trouvé' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

  const added = extractionJobManager.addSseClient(jobId, res);
  if (!added) {
    return res.status(404).end();
  }

  req.on('close', () => {
    extractionJobManager.removeSseClient(jobId, res);
  });
});

/**
 * GET /api/tempo/extractions/:jobId
 * Get current job status, results, and anomalies (polling fallback)
 */
router.get('/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = extractionJobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job non trouvé ou expiré' });
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    result: job.result,
    anomalies: job.anomalies,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt
  });
});

/**
 * DELETE /api/tempo/extractions/:jobId
 * Cancel job and abort pending HTTP calls
 */
router.delete('/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const cancelled = extractionJobManager.cancelJob(jobId);

  if (!cancelled) {
    return res.status(400).json({ error: 'Job non trouvé ou déjà terminé/annulé' });
  }

  res.json({ message: 'Job annulé avec succès', jobId });
});

export default router;
