import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/database/stats
 * Renvoie le nombre de collections et le comptage de documents par collection
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: 'Base de données non connectée' });
    }

    const collections = await db.listCollections().toArray();
    const stats: Record<string, number> = {};
    let totalDocuments = 0;

    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      const count = await db.collection(col.name).countDocuments();
      stats[col.name] = count;
      totalDocuments += count;
    }

    return res.json({
      databaseName: db.databaseName,
      collectionsCount: Object.keys(stats).length,
      totalDocuments,
      collections: stats
    });
  } catch (error: any) {
    console.error('Erreur stats BDD:', error);
    return res.status(500).json({ error: error.message || 'Erreur lors de la récupération des stats BDD' });
  }
});

/**
 * GET /api/database/export
 * Exporte l'intégralité des collections de la base sous format JSON téléchargeable
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: 'Base de données non connectée' });
    }

    const collections = await db.listCollections().toArray();
    const exportData: Record<string, any[]> = {};
    const summary: Record<string, number> = {};
    let totalDocuments = 0;

    for (const col of collections) {
      // Exclure les collections internes du système
      if (col.name.startsWith('system.')) continue;

      const docs = await db.collection(col.name).find({}).toArray();
      exportData[col.name] = docs;
      summary[col.name] = docs.length;
      totalDocuments += docs.length;
    }

    const payload = {
      _meta: {
        application: 'CartOMC - Capacity Planning',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        databaseName: db.databaseName,
        totalCollections: Object.keys(exportData).length,
        totalDocuments,
        summary
      },
      data: exportData
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `cartomc_backup_${dateStr}.json`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error: any) {
    console.error('Erreur export BDD:', error);
    return res.status(500).json({ error: error.message || 'Erreur lors de l\'exportation de la base' });
  }
});

/**
 * POST /api/database/import
 * Importe et restaure les données d'un export JSON
 * Options dans le body : { data: Record<string, any[]>, mode: 'replace' | 'merge' }
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: 'Base de données non connectée' });
    }

    const { data, mode = 'replace' } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Fichier ou données d\'importation invalides (section "data" manquante).' });
    }

    const results: Record<string, { inserted: number; replaced: boolean }> = {};
    let grandTotalInserted = 0;

    for (const [collectionName, documents] of Object.entries(data)) {
      if (collectionName.startsWith('system.')) continue;
      if (!Array.isArray(documents)) continue;

      const collection = db.collection(collectionName);

      // Si mode replace : on vide d'abord la collection
      if (mode === 'replace') {
        await collection.deleteMany({});
      }

      if (documents.length > 0) {
        // Restaurer les documents en convertissant si besoin les champs spécifiques
        if (mode === 'replace') {
          // Insertion en masse
          const insertRes = await collection.insertMany(documents, { ordered: false });
          results[collectionName] = {
            inserted: insertRes.insertedCount,
            replaced: true
          };
          grandTotalInserted += insertRes.insertedCount;
        } else {
          // Mode merge : upsert document par document via _id si présent
          let insertedCount = 0;
          for (const doc of documents) {
            if (doc._id) {
              await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
              insertedCount++;
            } else {
              await collection.insertOne(doc);
              insertedCount++;
            }
          }
          results[collectionName] = {
            inserted: insertedCount,
            replaced: false
          };
          grandTotalInserted += insertedCount;
        }
      } else {
        results[collectionName] = {
          inserted: 0,
          replaced: mode === 'replace'
        };
      }
    }

    return res.json({
      message: 'Base de données restaurée avec succès',
      mode,
      totalInserted: grandTotalInserted,
      details: results,
      importedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erreur import BDD:', error);
    return res.status(500).json({ error: error.message || 'Erreur lors de la restauration de la base' });
  }
});

export default router;
