import mongoose, { Schema, Document } from 'mongoose';

export interface IAbsenceJournaliere extends Document {
  matricule: string;
  date: Date;
  valeur: number; // 0 | 0.5 | 1
}

const AbsenceJournaliereSchema: Schema = new Schema(
  {
    matricule: { type: String, required: true, trim: true, uppercase: true },
    date: { type: Date, required: true },
    valeur: { type: Number, required: true, enum: [0, 0.5, 1], default: 0 }
  },
  { timestamps: true }
);

// Index unique par matricule + date pour l'upsert
AbsenceJournaliereSchema.index({ matricule: 1, date: 1 }, { unique: true });
AbsenceJournaliereSchema.index({ date: 1 });

export const AbsenceJournaliere = mongoose.model<IAbsenceJournaliere>(
  'AbsenceJournaliere',
  AbsenceJournaliereSchema
);
