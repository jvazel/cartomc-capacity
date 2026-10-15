import mongoose, { Schema, Document } from 'mongoose';

export interface ICollaboratorDoc {
  matricule?: string;
  name: string;
  type: 'INT' | 'EXT' | 'Unknown';
  role: 'DEV Back' | 'PIL' | 'QA' | 'BA' | 'Unknown';
}

export interface ITempoConfigDoc extends Document {
  customFields: {
    budgetLine: string;
    category: string;
    lot: string;
    featureId: string;
    businessChange: string;
  };
  collaborators: ICollaboratorDoc[];
}

const CollaboratorSchema = new Schema<ICollaboratorDoc>({
  matricule: { type: String },
  name: { type: String, required: true },
  type: { type: String, enum: ['INT', 'EXT', 'Unknown'], default: 'Unknown' },
  role: { type: String, enum: ['DEV Back', 'PIL', 'QA', 'BA', 'Unknown'], default: 'Unknown' }
}, { _id: false });

const TempoConfigSchema = new Schema<ITempoConfigDoc>({
  customFields: {
    budgetLine: { type: String, default: 'customfield_10806' },
    category: { type: String, default: 'customfield_10900' },
    lot: { type: String, default: 'customfield_10103' },
    featureId: { type: String, default: 'customfield_10104' },
    businessChange: { type: String, default: 'customfield_10105' }
  },
  collaborators: [CollaboratorSchema]
}, { timestamps: true });

export const TempoConfig = mongoose.model<ITempoConfigDoc>('TempoConfig', TempoConfigSchema);
