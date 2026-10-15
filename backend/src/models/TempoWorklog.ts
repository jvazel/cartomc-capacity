import mongoose, { Schema, Document } from 'mongoose';

export interface ITempoWorklog extends Document {
  worklogId?: string;
  projectKey: string;
  budgetLine: string;
  project: string;
  issueKey: string;
  category: string;
  lot: string;
  entryTask: string;
  comment?: string;
  ticketLink?: string;
  collaborator: string;
  type: 'INT' | 'EXT' | 'Unknown';
  timeInHours: number;
  timeInDays: number;
  estimatedInDays?: number | null;
  status?: string;
  issueType?: string;
  worklogDate: Date;
  month: number;
  year: number;
  epicSummary?: string;
  featureId?: string;
  role?: string;
  labels?: string;
  businessChange?: string;
  fixVersions?: string;
  extractedAt: Date;
}

const TempoWorklogSchema: Schema = new Schema(
  {
    worklogId: { type: String, trim: true },
    projectKey: { type: String, required: true, trim: true, index: true },
    budgetLine: { type: String, trim: true, index: true },
    project: { type: String, trim: true },
    issueKey: { type: String, trim: true, index: true },
    category: { type: String, trim: true },
    lot: { type: String, trim: true },
    entryTask: { type: String, trim: true },
    comment: { type: String, trim: true },
    ticketLink: { type: String, trim: true },
    collaborator: { type: String, trim: true, index: true },
    type: { type: String, enum: ['INT', 'EXT', 'Unknown'], default: 'Unknown' },
    timeInHours: { type: Number, required: true },
    timeInDays: { type: Number, required: true },
    estimatedInDays: { type: Number, default: null },
    status: { type: String, trim: true },
    issueType: { type: String, trim: true },
    worklogDate: { type: Date, required: true, index: true },
    month: { type: Number, required: true, index: true },
    year: { type: Number, required: true, index: true },
    epicSummary: { type: String, trim: true, index: true },
    featureId: { type: String, trim: true, index: true },
    role: { type: String, trim: true },
    labels: { type: String, trim: true },
    businessChange: { type: String, trim: true },
    fixVersions: { type: String, trim: true },
    extractedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Compound indexes for quick aggregated queries
TempoWorklogSchema.index({ worklogDate: 1, projectKey: 1 });
TempoWorklogSchema.index({ year: 1, month: 1 });
TempoWorklogSchema.index({ budgetLine: 1, featureId: 1 });

export const TempoWorklog = mongoose.model<ITempoWorklog>('TempoWorklog', TempoWorklogSchema);
