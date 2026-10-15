import mongoose, { Schema, Document } from 'mongoose';

export interface IRessource extends Document {
  matricule: string;
  nom: string;
  type: 'Interne' | 'Externe';
  role: string;
  estLeadBA: boolean;
  tauxActivite: number;
  dateArrivee: Date;
  dateDepart?: Date;
  actif: boolean;
}

const RessourceSchema: Schema = new Schema(
  {
    matricule: { type: String, required: true, unique: true, trim: true },
    nom: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Interne', 'Externe'], required: true },
    role: { type: String, required: true, trim: true },
    estLeadBA: { type: Boolean, default: false },
    tauxActivite: { type: Number, required: true, min: 0, max: 1, default: 1 },
    dateArrivee: { type: Date, required: true },
    dateDepart: { type: Date },
    actif: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Ressource = mongoose.model<IRessource>('Ressource', RessourceSchema);
