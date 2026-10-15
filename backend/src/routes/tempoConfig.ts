import { Router, Request, Response } from 'express';
import { TempoConfig } from '../models/TempoConfig.js';
import { Ressource } from '../models/Ressource.js';

const router = Router();

/**
 * GET /api/tempo/config
 * Retrieves configuration (customfields + collaborators) and env defaults
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    let config = await TempoConfig.findOne();
    if (!config) {
      config = await TempoConfig.create({
        customFields: {
          budgetLine: 'customfield_10101',
          category: 'customfield_10102',
          lot: 'customfield_10103',
          featureId: 'customfield_10104',
          businessChange: 'customfield_10105'
        },
        collaborators: []
      });
    }

    // Fetch resources from MongoDB Ressource collection
    const dbRessources = await Ressource.find();
    const ressourceCollabs = dbRessources.map((r) => ({
      name: r.nom,
      type: (r.type === 'Interne' ? 'INT' : 'EXT') as 'INT' | 'EXT',
      role: (['DEV Back', 'PIL', 'QA', 'BA'].includes(r.role) ? r.role : 'Unknown') as any
    }));

    // Combine custom config collaborators + database resources (deduplicated by name)
    const existingNames = new Set((config.collaborators || []).map((c) => c.name.toLowerCase()));
    const mergedCollaborators = [
      ...(config.collaborators || []),
      ...ressourceCollabs.filter((r) => !existingNames.has(r.name.toLowerCase()))
    ];

    res.json({
      customFields: config.customFields,
      collaborators: mergedCollaborators,
      defaults: {
        baseUrl: process.env.JIRA_BASE_URL || 'https://collabtools.boulanger.team',
        projectKey: process.env.JIRA_DEFAULT_PROJECT || 'GTEP',
        hasTokenInEnv: Boolean(process.env.JIRA_API_TOKEN && process.env.JIRA_API_TOKEN.trim().length > 0),
        hasBaseUrlInEnv: Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_BASE_URL.trim().length > 0),
        hasProjectInEnv: Boolean(process.env.JIRA_DEFAULT_PROJECT && process.env.JIRA_DEFAULT_PROJECT.trim().length > 0)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la récupération de la configuration Tempo: ' + err.message });
  }
});

/**
 * PUT /api/tempo/config
 * Updates configuration (customfields + collaborators)
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const { customFields, collaborators } = req.body;

    let config = await TempoConfig.findOne();
    if (!config) {
      config = new TempoConfig({});
    }

    if (customFields) {
      config.customFields = {
        budgetLine: customFields.budgetLine || config.customFields.budgetLine,
        category: customFields.category || config.customFields.category,
        lot: customFields.lot || config.customFields.lot,
        featureId: customFields.featureId || config.customFields.featureId,
        businessChange: customFields.businessChange || config.customFields.businessChange
      };
    }

    if (Array.isArray(collaborators)) {
      config.collaborators = collaborators.map((c: any) => ({
        name: c.name ? String(c.name).trim() : '',
        type: ['INT', 'EXT', 'Unknown'].includes(c.type) ? c.type : 'Unknown',
        role: ['DEV Back', 'PIL', 'QA', 'BA', 'Unknown'].includes(c.role) ? c.role : 'Unknown'
      })).filter((c) => c.name.length > 0);
    }

    await config.save();
    res.json({
      message: 'Configuration mise à jour avec succès',
      customFields: config.customFields,
      collaborators: config.collaborators
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la sauvegarde de la configuration: ' + err.message });
  }
});

export default router;
