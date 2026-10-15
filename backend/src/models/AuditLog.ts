import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  timestamp: Date;
  auteur: string;
  action:
    | 'CREATION_PROJET'
    | 'MODIFICATION_PROJET'
    | 'SUPPRESSION_PROJET'
    | 'VENTILATION_BATCH'
    | 'REESTIMATION_B1'
    | 'SNAPSHOT_CREATION'
    | 'SNAPSHOT_SUPPRESSION';
  projetId?: mongoose.Types.ObjectId;
  codeProjet?: string;
  nomProjet?: string;
  modifications?: Array<{
    champ: string;
    ancienneValeur?: any;
    nouvelleValeur?: any;
  }>;
  description?: string;
}

const AuditLogSchema: Schema = new Schema(
  {
    timestamp: { type: Date, default: Date.now },
    auteur: { type: String, required: true, default: 'Système / Utilisateur' },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATION_PROJET',
        'MODIFICATION_PROJET',
        'SUPPRESSION_PROJET',
        'VENTILATION_BATCH',
        'REESTIMATION_B1',
        'SNAPSHOT_CREATION',
        'SNAPSHOT_SUPPRESSION'
      ]
    },
    projetId: { type: Schema.Types.ObjectId, ref: 'Projet' },
    codeProjet: { type: String },
    nomProjet: { type: String },
    modifications: [
      {
        champ: { type: String, required: true },
        ancienneValeur: { type: Schema.Types.Mixed },
        nouvelleValeur: { type: Schema.Types.Mixed }
      }
    ],
    description: { type: String }
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
