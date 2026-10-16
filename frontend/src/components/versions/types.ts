export interface VersionMilestones {
  dateFinAFaire?: string | null;
  dateFinEnCours?: string | null;
  dateFinMR?: string | null;
  dateFinRecette?: string | null;
  dateMEPP?: string | null;
  dateMEP?: string | null;
}

export interface VersionMetrics {
  totalTickets: number;
  todo: number;
  inProgress: number;
  review: number;
  qa: number;
  done: number;
  anomalies: {
    total: number;
    aDecaler: number;
    retardDev: number;
    retardMR: number;
    retardRecette: number;
    retardMEPP?: number;
  };
  health: 'green' | 'orange' | 'red';
}

export interface VersionItem {
  _id: string;
  versionName: string;
  projectKey: string;
  released: boolean;
  archived?: boolean;
  jiraReleaseDate?: string | null;
  dateFinAFaire?: string | null;
  dateFinEnCours?: string | null;
  dateFinMR?: string | null;
  dateFinRecette?: string | null;
  dateMEPP?: string | null;
  dateMEP?: string | null;
  description?: string;
  updatedAt?: string;
  metrics: VersionMetrics;
}

export interface VersionTicket {
  key: string;
  summary: string;
  status: string;
  statusCategory: 'todo' | 'inprogress' | 'review' | 'qa' | 'done' | 'other';
  collaborator: string;
  role?: string;
  type?: string;
  ticketLink?: string;
  estimatedInDays?: number | null;
  timeInDays: number;
  anomaly: 'none' | 'a_decaler' | 'retard_dev' | 'retard_mr' | 'retard_recette' | 'retard_mepp';
  anomalyLabel: string;
  severity: 'ok' | 'warning' | 'critical';
}
