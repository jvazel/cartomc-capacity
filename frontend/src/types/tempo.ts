export type CollaboratorType = 'INT' | 'EXT' | 'Unknown';
export type CollaboratorRole = 'DEV Back' | 'PIL' | 'QA' | 'BA' | 'Unknown';

export interface ICollaboratorConfig {
  name: string;
  type: CollaboratorType;
  role: CollaboratorRole;
}

export interface ICustomFieldMapping {
  budgetLine: string;     // e.g. customfield_10101
  category: string;       // e.g. customfield_10102
  lot: string;            // e.g. customfield_10103
  featureId: string;      // e.g. customfield_10104
  businessChange: string; // e.g. customfield_10105
}

export interface ITempoConfig {
  customFields: ICustomFieldMapping;
  collaborators: ICollaboratorConfig[];
}

export interface TempoEntry {
  budgetLine: string;
  project: string;
  issueKey: string;
  category: string;
  lot: string;
  entryTask: string;
  comment: string;
  ticketLink: string;
  collaborator: string;
  type: CollaboratorType;
  timeInHours: number;
  timeInDays: number;
  estimatedInDays: number | null;
  status: string;
  issueType: string;
  worklogDate: string;
  month: number;
  year: number;
  epicSummary: string;
  featureId: string;
  role: CollaboratorRole;
  labels: string;
  businessChange: 'TRUE' | 'FALSE';
  fixVersions: string;
}

export type ExtractionPhase = 'worklogs' | 'tickets' | 'epics' | 'enrichment';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface IJobProgress {
  phase: ExtractionPhase;
  current: number;
  total: number | null;
  message: string;
  startedAt: string;
  updatedAt: string;
}

export interface IExtractionJobStatus {
  jobId: string;
  status: JobStatus;
  progress: IJobProgress | null;
  result?: TempoEntry[];
  anomalies?: string[];
  error?: string | null;
  createdAt: string;
  completedAt?: string;
}

export interface IExtractionRequest {
  startDate: string;
  endDate: string;
  projectKey?: string;
  baseUrl?: string;
  jiraToken?: string;
}

export interface IPivotNode {
  key: string;
  level: 'year' | 'month' | 'budgetLine' | 'category' | 'lot' | 'featureId' | 'entryTask';
  title: string;
  yearVal: string;
  monthVal: string;
  budgetLineVal: string;
  categoryVal: string;
  lotVal: string;
  featureIdVal: string;
  entryTaskVal: string;
  ticketLinkVal?: string;
  intDays: number;
  extDays: number;
  totalDays: number;
  children?: IPivotNode[];
}
