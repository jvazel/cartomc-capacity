import mongoose, { Schema, Document } from 'mongoose';

export interface ISimulationDraft extends Document {
  nom: string;
  description?: string;
  annee: number;
  auteur: string;
  dateCreation: Date;
  dateModification: Date;
  shiftsMap: { [projetId: string]: number };
}

const SimulationDraftSchema: Schema = new Schema(
  {
    nom: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    annee: { type: Number, required: true },
    auteur: { type: String, required: true, default: 'Administrateur / Manager' },
    dateCreation: { type: Date, default: Date.now },
    dateModification: { type: Date, default: Date.now },
    shiftsMap: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  { timestamps: true }
);

export const SimulationDraft = mongoose.model<ISimulationDraft>(
  'SimulationDraft',
  SimulationDraftSchema
);
