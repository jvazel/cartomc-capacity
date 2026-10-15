import mongoose, { Schema, Document } from 'mongoose';

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
  projetId: mongoose.Types.ObjectId;
  codeProjet?: string;
  nom?: string;
  typeLien?: 'FIN_DEBUT';
  jalonRequisId?: string;
}

export interface IProjet extends Document {
  codeProjet?: string;
  nom: string;
  type: 'RUN' | 'Projet' | 'Projet Opex' | 'Reco' | "Vie d'entreprise";
  epicDomaine?: string;
  leadBA?: mongoose.Types.ObjectId;
  priorite?: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | null;
  statut: "À l'étude" | 'Validé' | 'En cours' | 'Terminé';
  estimationB0?: number;
  estimationB1?: number;
  epicJiraLie: 'Oui' | 'Non' | 'NC';
  donneesAJour?: string;
  jiraBudgetLine?: string;
  jiraEpicKey?: string;
  jiraFeatureId?: string;
  jalons?: IJalon[];
  dependances?: IDependanceProjet[];
}

const JalonSchema: Schema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    mois: { type: Number, required: true, min: 1, max: 12 },
    semaine: { type: Number, min: 1, max: 53 },
    annee: { type: Number, required: true },
    type: {
      type: String,
      enum: ['MEP', 'UAT', 'CADRAGE', 'GONO', 'AUTRE'],
      default: 'MEP'
    },
    couleur: { type: String, default: '#ef4444' }
  },
  { _id: true }
);

const DependanceSchema: Schema = new Schema(
  {
    projetId: { type: Schema.Types.ObjectId, ref: 'Projet', required: true },
    codeProjet: { type: String, trim: true },
    nom: { type: String, trim: true },
    typeLien: { type: String, enum: ['FIN_DEBUT'], default: 'FIN_DEBUT' },
    jalonRequisId: { type: String, trim: true }
  },
  { _id: false }
);

const ProjetSchema: Schema = new Schema(
  {
    codeProjet: { type: String, trim: true },
    nom: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['RUN', 'Projet', 'Projet Opex', 'Reco', "Vie d'entreprise"],
      required: true
    },
    epicDomaine: { type: String, trim: true },
    leadBA: { type: Schema.Types.ObjectId, ref: 'Ressource' },
    priorite: {
      type: String,
      enum: ['P0', 'P1', 'P2', 'P3', 'P4', null],
      default: null
    },
    statut: {
      type: String,
      enum: ["À l'étude", 'Validé', 'En cours', 'Terminé'],
      default: "À l'étude"
    },
    estimationB0: { type: Number, min: 0 },
    estimationB1: { type: Number, min: 0 },
    epicJiraLie: { type: String, enum: ['Oui', 'Non', 'NC'], default: 'NC' },
    donneesAJour: { type: String, trim: true },
    jiraBudgetLine: { type: String, trim: true },
    jiraEpicKey: { type: String, trim: true },
    jiraFeatureId: { type: String, trim: true },
    jalons: { type: [JalonSchema], default: [] },
    dependances: { type: [DependanceSchema], default: [] }
  },
  { timestamps: true }
);

export const Projet = mongoose.model<IProjet>('Projet', ProjetSchema);
