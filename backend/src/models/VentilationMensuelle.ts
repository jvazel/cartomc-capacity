import mongoose, { Schema, Document } from 'mongoose';

export interface IAffectationRessource {
  ressourceId: mongoose.Types.ObjectId;
  matricule: string;
  nom: string;
  type: 'Interne' | 'Externe';
  jours: number;
}

export interface IVentilationMensuelle extends Document {
  projetId: mongoose.Types.ObjectId;
  annee: number;
  mois: number; // 1 à 12
  joursInternes: number;
  joursExternes: number;
  affectations?: IAffectationRessource[];
  noteArbitrage?: string;
}

const AffectationRessourceSchema: Schema = new Schema(
  {
    ressourceId: { type: Schema.Types.ObjectId, ref: 'Ressource', required: true },
    matricule: { type: String, default: '' },
    nom: { type: String, required: true },
    type: { type: String, enum: ['Interne', 'Externe'], default: 'Interne' },
    jours: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const VentilationMensuelleSchema: Schema = new Schema(
  {
    projetId: { type: Schema.Types.ObjectId, ref: 'Projet', required: true },
    annee: { type: Number, required: true },
    mois: { type: Number, required: true, min: 1, max: 12 },
    joursInternes: { type: Number, required: true, min: 0, default: 0 },
    joursExternes: { type: Number, required: true, min: 0, default: 0 },
    affectations: { type: [AffectationRessourceSchema], default: [] },
    noteArbitrage: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

// Index unique par projet + annee + mois
VentilationMensuelleSchema.index({ projetId: 1, annee: 1, mois: 1 }, { unique: true });

export const VentilationMensuelle = mongoose.model<IVentilationMensuelle>(
  'VentilationMensuelle',
  VentilationMensuelleSchema
);
