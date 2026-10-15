import mongoose, { Schema, Document } from 'mongoose';

export interface ISnapshotProjetItem {
  projetId: string;
  codeProjet?: string;
  nom: string;
  type: string;
  epicDomaine?: string;
  leadBANom?: string;
  priorite?: string | null;
  statut: string;
  estimationB0?: number;
  estimationB1?: number;
  totalPlanifie: number;
  ventilations: Array<{
    mois: number;
    joursInternes: number;
    joursExternes: number;
    totalMois: number;
  }>;
}

export interface IPortfolioSnapshot extends Document {
  nom: string;
  description?: string;
  annee: number;
  dateCreation: Date;
  auteur: string;
  nombreProjets: number;
  totalB0: number;
  totalB1: number;
  totalPlanifie: number;
  projetsData: ISnapshotProjetItem[];
}

const PortfolioSnapshotSchema: Schema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    annee: { type: Number, required: true },
    dateCreation: { type: Date, default: Date.now },
    auteur: { type: String, required: true, default: 'Administrateur / Manager' },
    nombreProjets: { type: Number, default: 0 },
    totalB0: { type: Number, default: 0 },
    totalB1: { type: Number, default: 0 },
    totalPlanifie: { type: Number, default: 0 },
    projetsData: [
      {
        projetId: { type: String, required: true },
        codeProjet: { type: String },
        nom: { type: String, required: true },
        type: { type: String, required: true },
        epicDomaine: { type: String },
        leadBANom: { type: String },
        priorite: { type: String },
        statut: { type: String, required: true },
        estimationB0: { type: Number },
        estimationB1: { type: Number },
        totalPlanifie: { type: Number, default: 0 },
        ventilations: [
          {
            mois: { type: Number, required: true },
            joursInternes: { type: Number, default: 0 },
            joursExternes: { type: Number, default: 0 },
            totalMois: { type: Number, default: 0 }
          }
        ]
      }
    ]
  },
  { timestamps: true }
);

export const PortfolioSnapshot = mongoose.model<IPortfolioSnapshot>(
  'PortfolioSnapshot',
  PortfolioSnapshotSchema
);
