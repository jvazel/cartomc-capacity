import mongoose, { Schema, Document } from 'mongoose';

export interface IMoisCalendaire extends Document {
  annee: number;
  mois: number; // 1 à 12
  joursOuvresForces?: number;
}

const MoisCalendaireSchema: Schema = new Schema(
  {
    annee: { type: Number, required: true },
    mois: { type: Number, required: true, min: 1, max: 12 },
    joursOuvresForces: { type: Number }
  },
  { timestamps: true }
);

MoisCalendaireSchema.index({ annee: 1, mois: 1 }, { unique: true });

export const MoisCalendaire = mongoose.model<IMoisCalendaire>('MoisCalendaire', MoisCalendaireSchema);
