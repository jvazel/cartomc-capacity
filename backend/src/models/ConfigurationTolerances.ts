import mongoose, { Schema, Document } from 'mongoose';

export interface IConfigurationTolerances extends Document {
  toleranceB0Pct: number;
  toleranceB1Pct: number;
  seuilSousChargeJours: number;
  jiraAbsenceIssueKey: string;
  categoriesRun: string[];
}

const ConfigurationTolerancesSchema: Schema = new Schema(
  {
    toleranceB0Pct: { type: Number, required: true, default: 100 },
    toleranceB1Pct: { type: Number, required: true, default: 20 },
    seuilSousChargeJours: { type: Number, required: true, default: 10 },
    jiraAbsenceIssueKey: { type: String, required: true, default: 'HP-26', trim: true },
    categoriesRun: { type: [String], default: ['MCO', 'Evol Technique'] }
  },
  { timestamps: true }
);

export const ConfigurationTolerances = mongoose.model<IConfigurationTolerances>(
  'ConfigurationTolerances',
  ConfigurationTolerancesSchema
);

