import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import ressourcesRouter from './routes/ressources.js';
import calendrierRouter from './routes/calendrier.js';
import configurationRouter from './routes/configuration.js';
import absencesRouter from './routes/absences.js';
import capaciteRouter from './routes/capacite.js';
import projetsRouter from './routes/projets.js';
import dashboardRouter from './routes/dashboard.js';
import tempoConfigRouter from './routes/tempoConfig.js';
import tempoExtractionsRouter from './routes/tempoExtractions.js';
import versionsRouter from './routes/versions.js';

// Load .env file natively or via fs parse
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    if (typeof (process as any).loadEnvFile === 'function') {
      (process as any).loadEnvFile(envPath);
    } else {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
} catch (e) {
  // Ignore env loading errors
}

// Allow internal enterprise HTTPS self-signed / enterprise CA certificates
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/capacity_planning_cartomc';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

import auditLogsRouter from './routes/auditLogs.js';
import snapshotsRouter from './routes/snapshots.js';
import simulationsRouter from './routes/simulations.js';

// Routes API
app.use('/api/ressources', ressourcesRouter);
app.use('/api/calendrier', calendrierRouter);
app.use('/api/configuration', configurationRouter);
app.use('/api/absences', absencesRouter);
app.use('/api/capacite', capaciteRouter);
app.use('/api/projets', projetsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/tempo/config', tempoConfigRouter);
app.use('/api/tempo/extractions', tempoExtractionsRouter);
app.use('/api/versions', versionsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/snapshots', snapshotsRouter);
app.use('/api/simulations', simulationsRouter);

// Connexion MongoDB avec log clair en cas d'échec
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connecté avec succès à MongoDB (capacity_planning_cartomc)');
    app.listen(PORT, () => {
      console.log(`🚀 Serveur Backend démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((err: any) => {
    console.error('❌ ERREUR DE CONNEXION À MONGODB :');
    console.error(err.message);
    console.error('⚠️  Assurez-vous que MongoDB est bien installé et démarré sur votre machine locale (localhost:27017).');
    process.exit(1);
  });
