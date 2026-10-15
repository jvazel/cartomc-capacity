import mongoose, { Schema, Document } from 'mongoose';

export interface IImportAbsenceLog extends Document {
  dateImport: Date;
  nombreLignesTraitees: number;
  nombreMatriculesReconnus: number;
  matriculesNonReconnus: string[];
  cellulesIgnoreesOuInvalides: number;
}

const ImportAbsenceLogSchema: Schema = new Schema(
  {
    dateImport: { type: Date, default: Date.now },
    nombreLignesTraitees: { type: Number, default: 0 },
    nombreMatriculesReconnus: { type: Number, default: 0 },
    matriculesNonReconnus: [{ type: String }],
    cellulesIgnoreesOuInvalides: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const ImportAbsenceLog = mongoose.model<IImportAbsenceLog>(
  'ImportAbsenceLog',
  ImportAbsenceLogSchema
);
