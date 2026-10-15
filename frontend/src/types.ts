export type UserRole = 'Admin' | 'LeadBA' | 'Lecteur';

export interface IRessource {
  _id: string;
  matricule: string;
  nom: string;
  type: 'Interne' | 'Externe';
  role: string;
  estLeadBA: boolean;
  tauxActivite: number;
  dateArrivee: string;
  dateDepart?: string;
  actif: boolean;
}

export interface IMoisCalendaireDTO {
  annee: number;
  mois: number;
  joursOuvresAuto: number;
  joursOuvresForces?: number;
  joursOuvresEffectifs: number;
}

export interface IConfigurationTolerances {
  _id?: string;
  toleranceB0Pct: number;
  toleranceB1Pct: number;
  seuilSousChargeJours: number;
  jiraAbsenceIssueKey?: string;
  categoriesRun?: string[];
}

export interface IImportAbsenceLog {
  _id?: string;
  dateImport: string;
  nombreLignesTraitees: number;
  nombreMatriculesReconnus: number;
  matriculesNonReconnus: string[];
  cellulesIgnoreesOuInvalides: number;
}

export interface ICapacitePopulation {
  etp: number;
  joursOuvres: number;
  capaciteTheorique: number;
  deperdition: number;
  capaciteNette: number;
}

export interface IMoisCapacite {
  annee: number;
  mois: number;
  nomMois: string;
  joursOuvres: number;
  estJoursOuvresForces: boolean;
  interne: ICapacitePopulation;
  externe: ICapacitePopulation;
  global: ICapacitePopulation;
}

export interface ICSVPreviewData {
  totalRows: number;
  detectedDatesRow: number;
  detectedMatriculeCol: number;
  detectedStartDataRow: number;
  datesCount: number;
  datesPreview: Array<{ colIndex: number; dateStr: string }>;
  sampleRows: string[][];
}

export interface IJalon {
  _id?: string;
  nom: string;
  mois: number; // 1 à 12
  semaine?: number; // 1 à 52/53 (ISO week)
  annee: number;
  type?: 'MEP' | 'UAT' | 'CADRAGE' | 'GONO' | 'AUTRE';
  couleur?: string;
}

export interface IDependanceProjet {
  projetId: string;
  codeProjet?: string;
  nom?: string;
  typeLien?: 'FIN_DEBUT';
  jalonRequisId?: string;
}

export interface IProjet {
  _id: string;
  codeProjet?: string;
  nom: string;
  type: 'RUN' | 'Projet' | 'Projet Opex' | 'Reco' | "Vie d'entreprise";
  epicDomaine?: string;
  leadBA?: IRessource | string;
  priorite?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | null;
  statut: "À l'étude" | 'Validé' | 'En cours' | 'Terminé';
  estimationB0?: number;
  estimationB1?: number;
  epicJiraLie: 'Oui' | 'Non' | 'NC';
  donneesAJour?: string;
  statutEstimation: 'B0' | 'B1' | 'NC';
  estimationRetenue: number;
  tolerancePct: number;
  chargeMaxToleree: number;
  totalPlanifie: number;
  couleurStatut: 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS';
  jiraBudgetLine?: string;
  jiraEpicKey?: string;
  jiraFeatureId?: string;
  jalons?: IJalon[];
  dependances?: IDependanceProjet[];
}

export interface IRapprochementMoisDetail {
  mois: number;
  nomMois: string;
  planifieMois: number;
  consommeMois: number;
  planifieCumule: number;
  consommeCumule?: number;
  forecastCumule: number;
}

export interface IRapprochementProjetItem {
  projetId: string;
  codeProjet?: string;
  nom: string;
  type: string;
  statut: string;
  priorite?: string | null;
  leadBANom?: string;
  jiraBudgetLine?: string;
  jiraEpicKey?: string;
  jiraFeatureId?: string;
  estimationRetenue: number;
  statutEstimation: 'B0' | 'B1' | 'NC';
  chargeMaxToleree: number;
  totalPlanifie: number;
  planifieADate: number;
  planifieFutur: number;
  consommeTempo: number;
  resteAFaire: number;
  atterrissagePrevu: number;
  deriveADate: number;
  deriveTerminaison: number;
  santeConsommation: 'VERT' | 'ORANGE' | 'ROUGE';
  dernierImportAt?: string;
  moisDetails?: IRapprochementMoisDetail[];
  tempoContributors?: Array<{
    collaborator: string;
    timeInDays: number;
    type: string;
    category?: string;
  }>;
  staffedContributors?: Array<{
    ressourceId: string;
    nom: string;
    type: 'Interne' | 'Externe';
    jours: number;
  }>;
}

export interface IAffectationItem {
  ressourceId: string;
  matricule?: string;
  nom: string;
  type: 'Interne' | 'Externe';
  jours: number;
}

export interface IVentilationMensuelleDTO {
  annee: number;
  mois: number;
  joursInternes: number;
  joursExternes: number;
  affectations?: IAffectationItem[];
  noteArbitrage?: string;
  totalMois: number;
}

export interface ITempoProjetRessource {
  projetId?: string;
  codeProjet?: string;
  nomProjet: string;
  typeProjet: string;
  priorite?: string | null;
  jours: number;
  heures: number;
  isHorsProjet: boolean;
}

export interface IProjetAffecteRessource {
  projetId: string;
  codeProjet?: string;
  nomProjet: string;
  typeProjet: string;
  priorite?: string | null;
  jours: number;
  typeRessource: 'Interne' | 'Externe';
  tempoJours?: number;
  tempoHeures?: number;
}

export interface IMoisPlanningRessource {
  mois: number;
  estActif: boolean;
  joursOuvres: number;
  capaciteTheorique: number;
  absences: number;
  capaciteNette: number;
  totalJoursAffectes: number;
  tauxOccupation: number;
  statutCharge: 'DISPONIBLE' | 'OPTIMAL' | 'SURCHARGE' | 'INACTIF';
  projets: IProjetAffecteRessource[];
  tempoTotalJours?: number;
  tempoTotalHeures?: number;
  tempoProjets?: ITempoProjetRessource[];
}

export interface IPlanningRessourceItem {
  ressource: IRessource;
  moisPlanning: IMoisPlanningRessource[];
}

export interface INonAssigneItem {
  projetId: string;
  codeProjet?: string;
  nomProjet: string;
  typeProjet: string;
  priorite?: string | null;
  jours: number;
}

export interface IPlanningMatriceResponse {
  annee: number;
  nonAssignesParMois: {
    [mois: number]: {
      interne: INonAssigneItem[];
      externe: INonAssigneItem[];
      totalInterne: number;
      totalExterne: number;
    };
  };
  ressources: IPlanningRessourceItem[];
}

export interface IEcartB0B1KPI {
  nombreProjetsEvalues: number;
  ecartMoyenPct: number;
  detailProjets: Array<{
    id: string;
    nom: string;
    b0: number;
    b1: number;
    ecartPct: number;
  }>;
}

