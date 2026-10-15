import mongoose, { Schema, Document } from 'mongoose';

export interface IVersionMilestone extends Document {
  versionName: string;
  projectKey: string;
  released: boolean;
  archived: boolean;
  jiraReleaseDate?: Date | null;
  dateFinAFaire?: Date | null;
  dateFinEnCours?: Date | null;
  dateFinMR?: Date | null;
  dateFinRecette?: Date | null;
  dateMEPP?: Date | null;
  dateMEP?: Date | null;
  description?: string;
  lastExtractedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VersionMilestoneSchema: Schema = new Schema(
  {
    versionName: { type: String, required: true, trim: true },
    projectKey: { type: String, required: true, trim: true },
    released: { type: Boolean, default: false, index: true },
    archived: { type: Boolean, default: false },
    jiraReleaseDate: { type: Date, default: null },
    dateFinAFaire: { type: Date, default: null },
    dateFinEnCours: { type: Date, default: null },
    dateFinMR: { type: Date, default: null },
    dateFinRecette: { type: Date, default: null },
    dateMEPP: { type: Date, default: null },
    dateMEP: { type: Date, default: null },
    description: { type: String, trim: true, default: '' },
    lastExtractedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

// Unicité par versionName et projectKey
VersionMilestoneSchema.index({ versionName: 1, projectKey: 1 }, { unique: true });

export const VersionMilestone = mongoose.model<IVersionMilestone>('VersionMilestone', VersionMilestoneSchema);
export default VersionMilestone;

