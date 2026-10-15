import { Response } from 'express';
import { JiraTempoClient, RawTempoWorklog, RawJiraIssue } from './JiraTempoClient.js';
import { transformTempoData, TempoEntry, CustomFieldConfig } from './TempoTransformer.js';
import { ICollaboratorDoc } from '../models/TempoConfig.js';
import { TempoWorklog } from '../models/TempoWorklog.js';
import { VersionMilestone } from '../models/VersionMilestone.js';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ExtractionPhase = 'worklogs' | 'tickets' | 'epics' | 'enrichment';

export interface IJobProgress {
  phase: ExtractionPhase;
  current: number;
  total: number | null;
  message: string;
  startedAt: string;
  updatedAt: string;
}

export interface IJobState {
  jobId: string;
  status: JobStatus;
  progress: IJobProgress | null;
  result?: TempoEntry[];
  anomalies?: string[];
  error?: string | null;
  createdAt: string;
  completedAt?: string;
  abortController: AbortController;
  sseClients: Set<Response>;
  heartbeatTimer?: NodeJS.Timeout;
}

export interface ExtractionParams {
  startDate: string;
  endDate: string;
  projectKey: string;
  baseUrl: string;
  jiraToken: string;
  customFields: CustomFieldConfig;
  collaborators: ICollaboratorDoc[];
}

class ExtractionJobManager {
  private jobs = new Map<string, IJobState>();
  private readonly ttlMs = 3600 * 1000; // 1 hour TTL

  constructor() {
    // Periodic cleanup of expired jobs
    setInterval(() => this.cleanupExpiredJobs(), 300000);
  }

  createJob(): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const jobState: IJobState = {
      jobId,
      status: 'queued',
      progress: null,
      createdAt: now,
      abortController: new AbortController(),
      sseClients: new Set()
    };

    this.jobs.set(jobId, jobState);
    return jobId;
  }

  getJob(jobId: string): IJobState | undefined {
    return this.jobs.get(jobId);
  }

  addSseClient(jobId: string, res: Response): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.sseClients.add(res);

    // Send initial status immediately
    this.sendSseEvent(res, 'status', {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      error: job.error
    });

    if (job.status === 'completed' && job.result) {
      this.sendSseEvent(res, 'completed', {
        status: 'completed',
        totalEntries: job.result.length,
        anomaliesCount: job.anomalies?.length || 0
      });
    } else if (job.status === 'failed') {
      this.sendSseEvent(res, 'failed', { status: 'failed', error: job.error });
    }

    return true;
  }

  removeSseClient(jobId: string, res: Response): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.sseClients.delete(res);
    }
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    job.abortController.abort();

    this.notifySseClients(job, 'cancelled', { status: 'cancelled', message: 'Job annulé par l\'utilisateur' });
    this.closeSseConnections(job);
    return true;
  }

  private sendSseEvent(res: Response, eventType: string, data: any): void {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private notifySseClients(job: IJobState, eventType: string, data: any): void {
    for (const res of job.sseClients) {
      try {
        this.sendSseEvent(res, eventType, data);
      } catch (err) {
        job.sseClients.delete(res);
      }
    }
  }

  private closeSseConnections(job: IJobState): void {
    if (job.heartbeatTimer) {
      clearInterval(job.heartbeatTimer);
    }
    for (const res of job.sseClients) {
      try {
        res.end();
      } catch (e) {
        // ignore
      }
    }
    job.sseClients.clear();
  }

  private updateProgress(job: IJobState, phase: ExtractionPhase, current: number, total: number | null, message: string): void {
    const now = new Date().toISOString();
    const progress: IJobProgress = {
      phase,
      current,
      total,
      message,
      startedAt: job.progress?.startedAt || now,
      updatedAt: now
    };
    job.progress = progress;
    this.notifySseClients(job, 'progress', progress);
  }

  async runJob(jobId: string, params: ExtractionParams): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    const startedAt = new Date().toISOString();
    this.updateProgress(job, 'worklogs', 0, null, 'Démarrage de la récupération des worklogs Tempo...');

    // Start 12s Heartbeat timer
    job.heartbeatTimer = setInterval(() => {
      this.notifySseClients(job, 'heartbeat', { timestamp: Math.floor(Date.now() / 1000) });
    }, 12000);

    const client = new JiraTempoClient({
      baseUrl: params.baseUrl,
      token: params.jiraToken,
      timeoutMs: 60000,
      maxConcurrency: 5
    });

    try {
      // 1. Fetch Tempo Worklogs
      this.updateProgress(job, 'worklogs', 0, null, `Récupération des worklogs Tempo pour ${params.projectKey}...`);
      const worklogs = await client.getTempoWorklogs(
        params.startDate,
        params.endDate,
        params.projectKey,
        job.abortController.signal
      );

      this.updateProgress(
        job,
        'worklogs',
        worklogs.length,
        worklogs.length,
        `${worklogs.length} worklogs Tempo récupérés.`
      );

      if (worklogs.length === 0) {
        job.status = 'completed';
        job.result = [];
        job.anomalies = ['Aucun worklog trouvé pour les critères sélectionnés.'];
        job.completedAt = new Date().toISOString();
        this.notifySseClients(job, 'completed', { status: 'completed', totalEntries: 0, anomaliesCount: 1 });
        this.closeSseConnections(job);
        return;
      }

      // 2. Fetch Jira Tickets via JQL
      this.updateProgress(job, 'tickets', 0, null, 'Recherche des tickets Jira associés...');
      const jql = `project = "${params.projectKey}" AND worklogDate >= "${params.startDate}" AND worklogDate <= "${params.endDate}"`;
      const requestedFields = [
        'summary',
        'status',
        'issuetype',
        'project',
        'timetracking',
        'labels',
        'fixVersions',
        'parent',
        params.customFields.budgetLine,
        params.customFields.category,
        params.customFields.lot,
        params.customFields.featureId,
        params.customFields.businessChange
      ];

      const tickets = await client.searchJiraIssues(
        jql,
        requestedFields,
        (fetched, total) => {
          this.updateProgress(
            job,
            'tickets',
            fetched,
            total,
            `Récupération des tickets Jira (${fetched} / ${total})...`
          );
        },
        job.abortController.signal
      );

      const issuesMap = new Map<string, RawJiraIssue>();
      tickets.forEach((t) => issuesMap.set(t.key, t));

      // 3. Deduplicate and fetch Epic summaries if needed
      this.updateProgress(job, 'epics', 0, null, 'Analyse et récupération des Epics parents...');
      const epicKeys = new Set<string>();
      tickets.forEach((t) => {
        if (t.fields?.parent?.key) {
          epicKeys.add(t.fields.parent.key);
        }
      });

      const epicsMap = new Map<string, RawJiraIssue>();
      let epicIndex = 0;
      const epicTotal = epicKeys.size;

      for (const epicKey of epicKeys) {
        if (job.abortController.signal.aborted) break;
        // Check if epic is already in tickets search
        if (issuesMap.has(epicKey)) {
          epicsMap.set(epicKey, issuesMap.get(epicKey)!);
        } else {
          const epicIssue = await client.getJiraIssue(epicKey, ['summary'], job.abortController.signal);
          if (epicIssue) {
            epicsMap.set(epicKey, epicIssue);
          }
        }
        epicIndex++;
        this.updateProgress(
          job,
          'epics',
          epicIndex,
          epicTotal,
          `Récupération des Epics parents (${epicIndex} / ${epicTotal})...`
        );
      }

      // 3.5 Batch resolve Jira User display names for any JIRAUSER keys
      this.updateProgress(job, 'enrichment', 0, worklogs.length, 'Résolution des noms et prénoms d\'utilisateurs Jira...');
      const rawUserKeys = worklogs.map((wl) => {
        const authorObj = wl.author || (wl as any).authorKey || (wl as any).worker;
        if (typeof authorObj === 'object' && authorObj !== null) {
          return authorObj.key || authorObj.name || authorObj.username || authorObj.displayName;
        }
        return String(authorObj || '');
      });
      const userNamesMap = await client.batchResolveUsers(rawUserKeys, job.abortController.signal);

      // 4. Enrich & Transform into 24 columns
      this.updateProgress(job, 'enrichment', 0, worklogs.length, 'Enrichissement des données en cours...');
      const { entries, anomalies } = transformTempoData(
        worklogs,
        issuesMap,
        epicsMap,
        params.collaborators,
        params.customFields,
        params.baseUrl,
        userNamesMap
      );

      // 5. Persist to MongoDB (Purge & Replace for the date range)
      try {
        const startDateObj = new Date(params.startDate + 'T00:00:00.000Z');
        const endDateObj = new Date(params.endDate + 'T23:59:59.999Z');

        await TempoWorklog.deleteMany({
          worklogDate: { $gte: startDateObj, $lte: endDateObj },
          projectKey: params.projectKey
        });

        if (entries.length > 0) {
          const docsToInsert = entries.map((entry) => ({
            ...entry,
            projectKey: params.projectKey,
            worklogDate: new Date(entry.worklogDate),
            extractedAt: new Date()
          }));
          await TempoWorklog.insertMany(docsToInsert);
        }

        // 5.1 Synchroniser les versions Jira dans VersionMilestone
        try {
          const versionsMap = new Map<string, { released: boolean; archived: boolean; releaseDate?: Date | null }>();

          // A) Récupérer les versions directement depuis les tickets extraits
          tickets.forEach((t) => {
            if (Array.isArray(t.fields?.fixVersions)) {
              t.fields.fixVersions.forEach((fv) => {
                if (fv && fv.name) {
                  const vName = fv.name.trim();
                  if (vName) {
                    versionsMap.set(vName, {
                      released: Boolean(fv.released),
                      archived: Boolean(fv.archived),
                      releaseDate: fv.releaseDate ? new Date(fv.releaseDate) : null
                    });
                  }
                }
              });
            }
          });

          // B) Récupérer également la liste exhaustive des versions du projet via l'API Jira
          try {
            const projectVersions = await client.getProjectVersions(params.projectKey, job.abortController.signal);
            projectVersions.forEach((pv) => {
              if (pv.name) {
                const vName = pv.name.trim();
                if (vName) {
                  versionsMap.set(vName, {
                    released: Boolean(pv.released),
                    archived: Boolean(pv.archived),
                    releaseDate: pv.releaseDate ? new Date(pv.releaseDate) : null
                  });
                }
              }
            });
          } catch (projVerErr: any) {
            console.warn('⚠️ [ExtractionJobManager] Impossible de requêter l\'endpoint versions du projet:', projVerErr.message);
          }

          // C) Mettre à jour la collection VersionMilestone sans écraser les jalons existants
          if (versionsMap.size > 0) {
            const bulkOps = Array.from(versionsMap.entries()).map(([versionName, vData]) => ({
              updateOne: {
                filter: { versionName, projectKey: params.projectKey },
                update: {
                  $set: {
                    released: vData.released,
                    archived: vData.archived,
                    jiraReleaseDate: vData.releaseDate,
                    lastExtractedAt: new Date()
                  },
                  $setOnInsert: {
                    versionName,
                    projectKey: params.projectKey,
                    dateFinAFaire: null,
                    dateFinEnCours: null,
                    dateFinMR: null,
                    dateFinRecette: null,
                    dateMEPP: null,
                    dateMEP: null,
                    description: ''
                  }
                },
                upsert: true
              }
            }));

            await VersionMilestone.bulkWrite(bulkOps);
            console.log(`✅ [ExtractionJobManager] ${versionsMap.size} versions synchronisées dans VersionMilestone pour le projet ${params.projectKey}.`);
          }
        } catch (versionErr: any) {
          console.error('Erreur lors de la synchronisation de VersionMilestone:', versionErr);
        }
      } catch (dbErr: any) {
        console.error('Erreur lors de la persistance MongoDB TempoWorklog:', dbErr);
      }

      job.status = 'completed';
      job.result = entries;
      job.anomalies = anomalies;
      job.completedAt = new Date().toISOString();

      this.updateProgress(
        job,
        'enrichment',
        entries.length,
        entries.length,
        `Extraction terminée avec succès (${entries.length} lignes générées).`
      );

      this.notifySseClients(job, 'completed', {
        status: 'completed',
        totalEntries: entries.length,
        anomaliesCount: anomalies.length
      });
    } catch (err: any) {
      if ((job.status as string) !== 'cancelled') {
        job.status = 'failed';
        job.error = err.message || 'Erreur lors de l\'exécution de l\'extraction';
        job.completedAt = new Date().toISOString();
        this.notifySseClients(job, 'failed', { status: 'failed', error: job.error });
      }
    } finally {
      this.closeSseConnections(job);
    }
  }

  private cleanupExpiredJobs(): void {
    const now = Date.now();
    for (const [jobId, job] of this.jobs.entries()) {
      const createdTime = new Date(job.createdAt).getTime();
      if (now - createdTime > this.ttlMs) {
        this.closeSseConnections(job);
        this.jobs.delete(jobId);
      }
    }
  }
}

export const extractionJobManager = new ExtractionJobManager();
