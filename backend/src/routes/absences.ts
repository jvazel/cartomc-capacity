import express from 'express';
import { AbsenceJournaliere } from '../models/AbsenceJournaliere.js';
import { ImportAbsenceLog } from '../models/ImportAbsenceLog.js';
import { Ressource } from '../models/Ressource.js';
import { TempoWorklog } from '../models/TempoWorklog.js';
import { ConfigurationTolerances } from '../models/ConfigurationTolerances.js';
import { JiraTempoClient } from '../services/JiraTempoClient.js';
import { parseWorklogDate } from '../services/TempoTransformer.js';
import { parseCSV, parseFrenchDate, analyzeCSVStructure } from '../utils/csvParser.js';

const router = express.Router();



// GET /api/absences/dernier-import : Récupère la date et le rapport du dernier import
router.get('/dernier-import', async (req, res) => {
  try {
    const lastLog = await ImportAbsenceLog.findOne().sort({ createdAt: -1 });
    res.json(lastLog || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/absences/matrice : Consultation du détail des absences par ressource et par période
router.get('/matrice', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const mois = req.query.mois ? parseInt(req.query.mois as string, 10) : undefined;

    let startDate: Date;
    let endDate: Date;

    if (mois && mois >= 1 && mois <= 12) {
      startDate = new Date(Date.UTC(annee, mois - 1, 1));
      endDate = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(annee, 0, 1));
      endDate = new Date(Date.UTC(annee, 11, 31, 23, 59, 59, 999));
    }

    const absences = await AbsenceJournaliere.find({
      date: { $gte: startDate, $lte: endDate },
      valeur: { $gt: 0 }
    }).sort({ date: 1 });

    // Agrégation par matricule
    const mapAbsences: { [matricule: string]: { total: number; details: Array<{ date: string; valeur: number }> } } = {};

    absences.forEach((abs) => {
      const mat = abs.matricule.toUpperCase();
      if (!mapAbsences[mat]) {
        mapAbsences[mat] = { total: 0, details: [] };
      }
      mapAbsences[mat].total = Number((mapAbsences[mat].total + abs.valeur).toFixed(1));
      mapAbsences[mat].details.push({
        date: formatDateUTC(abs.date),
        valeur: abs.valeur
      });
    });

    res.json({
      annee,
      mois,
      absencesByMatricule: mapAbsences
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/absences/pics-simultanes : Analyse des dates à fort absentéisme et absences simultanées
router.get('/pics-simultanes', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const mois = req.query.mois ? parseInt(req.query.mois as string, 10) : undefined;
    const seuilMin = req.query.seuilMin ? parseInt(req.query.seuilMin as string, 10) : 3;

    let startDate: Date;
    let endDate: Date;

    if (mois && mois >= 1 && mois <= 12) {
      startDate = new Date(Date.UTC(annee, mois - 1, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(annee, 0, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(annee, 11, 31, 23, 59, 59, 999));
    }

    const [absences, toutesRessources] = await Promise.all([
      AbsenceJournaliere.find({
        date: { $gte: startDate, $lte: endDate },
        valeur: { $gt: 0 }
      }).sort({ date: 1 }),
      Ressource.find({})
    ]);

    const ressourceMap = new Map<string, { nom: string; type: string; role: string }>();
    toutesRessources.forEach((r) => {
      ressourceMap.set(r.matricule.trim().toUpperCase(), {
        nom: r.nom,
        type: r.type,
        role: r.role
      });
    });

    const datesMap: {
      [dateStr: string]: {
        dateStr: string;
        totalDeperdition: number;
        ressources: Array<{ matricule: string; nom: string; type: string; role: string; valeur: number }>;
      };
    } = {};

    absences.forEach((abs) => {
      const mat = abs.matricule.trim().toUpperCase();
      const resInfo = ressourceMap.get(mat);
      if (!resInfo) return; // Seules les ressources reconnues

      const dateStr = formatDateUTC(abs.date);
      if (!datesMap[dateStr]) {
        datesMap[dateStr] = {
          dateStr,
          totalDeperdition: 0,
          ressources: []
        };
      }

      datesMap[dateStr].totalDeperdition = Number((datesMap[dateStr].totalDeperdition + abs.valeur).toFixed(1));
      datesMap[dateStr].ressources.push({
        matricule: abs.matricule,
        nom: resInfo.nom,
        type: resInfo.type,
        role: resInfo.role,
        valeur: abs.valeur
      });
    });

    const datesSimultanees = Object.values(datesMap)
      .filter((item) => item.ressources.length >= seuilMin)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    res.json({
      annee,
      mois,
      seuilMin,
      totalDatesCritiques: datesSimultanees.length,
      datesSimultanees
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper pour formater une date en YYYY-MM-DD UTC
function formatDateUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/absences/calendrier-ressource : Données pour le calendrier mensuel d'une ressource
router.get('/calendrier-ressource', async (req, res) => {
  try {
    const matricule = (req.query.matricule as string || '').trim();
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const mois = req.query.mois ? parseInt(req.query.mois as string, 10) : new Date().getMonth() + 1;

    if (!matricule) {
      return res.status(400).json({ error: 'Le matricule de la ressource est requis.' });
    }

    const startDate = new Date(Date.UTC(annee, mois - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999));

    const absences = await AbsenceJournaliere.find({
      matricule: { $regex: new RegExp(`^${matricule}$`, 'i') },
      date: { $gte: startDate, $lte: endDate }
    });

    const mapAbsences: { [dateStr: string]: number } = {};
    absences.forEach((abs) => {
      const dateStr = formatDateUTC(abs.date);
      mapAbsences[dateStr] = abs.valeur;
    });

    res.json({
      matricule,
      annee,
      mois,
      absencesMap: mapAbsences
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/absences/preview : Analyse le CSV et retourne un aperçu avec détection automatique du mapping
router.post('/preview', async (req, res) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'Le contenu du fichier CSV est obligatoire.' });
    }

    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Le fichier CSV est vide.' });
    }

    const analysis = analyzeCSVStructure(rows);

    res.json({
      totalRows: rows.length,
      detectedDatesRow: analysis.detectedDatesRow,
      detectedMatriculeCol: analysis.detectedMatriculeCol,
      detectedStartDataRow: analysis.detectedStartDataRow,
      datesCount: analysis.datesCount,
      datesPreview: analysis.datesPreview.slice(0, 10).map((d) => ({
        colIndex: d.colIndex,
        dateStr: d.dateStr
      })),
      sampleRows: rows.slice(0, 25)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/absences/import : Exécute l'import définitif avec le mapping de colonnes confirmé par l'utilisateur
router.post('/import', async (req, res) => {
  try {
    const { csvContent, datesRowIndex, matriculeColIndex, startDataRowIndex, conventionMode } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: 'Le contenu du fichier CSV est requis.' });
    }

    const rows = parseCSV(csvContent);
    const dRowIdx = typeof datesRowIndex === 'number' ? datesRowIndex : 0;
    const mColIdx = typeof matriculeColIndex === 'number' ? matriculeColIndex : 0;
    const sDataRowIdx = typeof startDataRowIndex === 'number' ? startDataRowIndex : 1;
    // Par défaut, convention Google Sheets : '0_is_absent' (0 = absent/vacances, 1 = présent, 0.5 = demi-journée)
    const mode = conventionMode === '1_is_absent' ? '1_is_absent' : '0_is_absent';

    if (dRowIdx >= rows.length) {
      return res.status(400).json({ error: "Ligne des dates invalide ou hors des limites du fichier." });
    }

    // 1. Extraire les colonnes contenant des dates valides depuis la ligne des dates
    const datesRow = rows[dRowIdx];
    const dateColumns: Array<{ colIndex: number; date: Date }> = [];
    const coveredDates: Date[] = [];

    datesRow.forEach((cell, colIdx) => {
      const parsed = parseFrenchDate(cell);
      if (parsed) {
        dateColumns.push({ colIndex: colIdx, date: parsed });
        coveredDates.push(parsed);
      }
    });

    if (dateColumns.length === 0) {
      return res.status(400).json({
        error: "Aucune date au format JJ/MM/AAAA n'a été trouvée sur la ligne d'en-tête sélectionnée."
      });
    }

    // 2. Charger le référentiel des ressources (pour filtrer par matricule reconnu)
    const meRessources = await Ressource.find({});
    const setMatriculesConnus = new Set(
      meRessources.map((r) => r.matricule.trim().toUpperCase())
    );

    let nombreLignesTraitees = 0;
    let nombreMatriculesReconnus = 0;
    const matriculesNonReconnusSet = new Set<string>();
    let cellulesIgnoreesOuInvalides = 0;

    const bulkOps: any[] = [];

    // 3. Traiter les lignes de ressources
    for (let r = sDataRowIdx; r < rows.length; r++) {
      const row = rows[r];
      const matriculeRaw = row[mColIdx];

      if (!matriculeRaw || matriculeRaw.trim() === '') {
        continue;
      }

      const matricule = matriculeRaw.trim().toUpperCase();
      nombreLignesTraitees++;

      if (!setMatriculesConnus.has(matricule)) {
        matriculesNonReconnusSet.add(matricule);
        continue;
      }

      nombreMatriculesReconnus++;

      // Pour chaque date reconnue, lire et convertir la valeur d'absence
      dateColumns.forEach(({ colIndex, date }) => {
        const cellValStr = row[colIndex] ? row[colIndex].trim() : '';

        let valeurAbsence = 0;

        if (cellValStr !== '') {
          // Remplacer virgule par point pour le parsing décimal
          const normalizedStr = cellValStr.replace(',', '.');
          const parsedVal = parseFloat(normalizedStr);

          if (isNaN(parsedVal)) {
            cellulesIgnoreesOuInvalides++;
            valeurAbsence = 0; // Traité comme présent (0 jour d'absence)
          } else if (mode === '0_is_absent') {
            // Convention Google Sheets : 0 = Absent (1.0 d'absence), 0.5 = Demi-journée, 1 = Présent (0 d'absence)
            if (parsedVal === 0) {
              valeurAbsence = 1;
            } else if (parsedVal === 0.5) {
              valeurAbsence = 0.5;
            } else if (parsedVal === 1) {
              valeurAbsence = 0;
            } else {
              cellulesIgnoreesOuInvalides++;
              valeurAbsence = parsedVal === 0 ? 1 : 0;
            }
          } else {
            // Convention Mode 1_is_absent : 1 = Absent, 0.5 = Demi-journée, 0 = Présent
            if (parsedVal === 1) {
              valeurAbsence = 1;
            } else if (parsedVal === 0.5) {
              valeurAbsence = 0.5;
            } else if (parsedVal === 0) {
              valeurAbsence = 0;
            } else {
              cellulesIgnoreesOuInvalides++;
              valeurAbsence = parsedVal >= 0.5 ? 1 : 0;
            }
          }
        } else {
          // Vide = présent (0 d'absence)
          valeurAbsence = 0;
        }

        bulkOps.push({
          updateOne: {
            filter: { matricule, date },
            update: { $set: { valeur: valeurAbsence } },
            upsert: true
          }
        });
      });
    }

    // 4. Exécuter les upserts en base
    if (bulkOps.length > 0) {
      await AbsenceJournaliere.bulkWrite(bulkOps);
    }

    // 5. Enregistrer le rapport d'importation
    const matriculesNonReconnus = Array.from(matriculesNonReconnusSet);
    const importLog = new ImportAbsenceLog({
      dateImport: new Date(),
      nombreLignesTraitees,
      nombreMatriculesReconnus,
      matriculesNonReconnus,
      cellulesIgnoreesOuInvalides
    });
    await importLog.save();

    res.json({
      message: 'Import des absences réalisé avec succès.',
      report: {
        dateImport: importLog.dateImport,
        nombreLignesTraitees,
        nombreMatriculesReconnus,
        matriculesNonReconnus,
        cellulesIgnoreesOuInvalides,
        nombreAbsencesEnregistrees: bulkOps.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
  * Helper cleanTokens & matchRessourceByNom pour la correspondance Prénom + Nom
  */
function cleanTokens(str: string): string[] {
  if (!str) return [];
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function matchRessourceByNom(name: string, ressources: any[]): any | undefined {
  if (!name) return undefined;
  const authorTokens = cleanTokens(name);
  if (authorTokens.length === 0) return undefined;
  const authorSet = new Set(authorTokens);

  // 1. Token set identique
  for (const r of ressources) {
    const rTokens = cleanTokens(r.nom);
    if (rTokens.length === authorTokens.length && rTokens.every((t) => authorSet.has(t))) {
      return r;
    }
  }

  // 2. Full inclusion match
  for (const r of ressources) {
    const rTokens = cleanTokens(r.nom);
    if (rTokens.length === 0) continue;
    const overlap = rTokens.filter((t) => authorSet.has(t)).length;
    if (overlap > 0 && (overlap >= rTokens.length || overlap >= authorTokens.length)) {
      return r;
    }
  }

  // 3. Multi-word overlap match (2+ tokens)
  for (const r of ressources) {
    const rTokens = cleanTokens(r.nom);
    const overlap = rTokens.filter((t) => authorSet.has(t)).length;
    if (overlap >= 2) {
      return r;
    }
  }

  return undefined;
}

// GET /api/absences/controle : Rapprochement Saisie Jira vs CSV Intentions par Collaborateur
router.get('/controle', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();
    const mois = req.query.mois ? parseInt(req.query.mois as string, 10) : undefined;
    
    // Si la clé du ticket n'est pas passée en paramètre, on lit la config globale
    let issueKey = (req.query.issueKey as string || '').trim().toUpperCase();
    if (!issueKey) {
      const config = await ConfigurationTolerances.findOne();
      issueKey = config?.jiraAbsenceIssueKey ? config.jiraAbsenceIssueKey.trim().toUpperCase() : 'HP-26';
    }

    // 1. Plage de dates UTC
    let startDate: Date;
    let endDate: Date;

    if (mois && mois >= 1 && mois <= 12) {
      startDate = new Date(Date.UTC(annee, mois - 1, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(annee, mois, 0, 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(annee, 0, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(annee, 11, 31, 23, 59, 59, 999));
    }

    // 2. Charger les ressources et les absences CSV enregistrées
    const [ressources, absencesCSV, dbWorklogsJira] = await Promise.all([
      Ressource.find({ actif: true }).sort({ nom: 1 }),
      AbsenceJournaliere.find({
        date: { $gte: startDate, $lte: endDate },
        valeur: { $gt: 0 }
      }),
      TempoWorklog.find({
        issueKey,
        worklogDate: { $gte: startDate, $lte: endDate }
      })
    ]);

    // 2b. Tentative de récupération en direct depuis l'API Jira si un token est configuré
    const jiraToken = (req.headers['x-jira-token'] as string) || process.env.JIRA_API_TOKEN || '';
    const baseUrl = process.env.JIRA_BASE_URL || 'https://collabtools.boulanger.team';
    let directJiraWorklogs: any[] = [];
    let isLiveJira = false;

    if (jiraToken) {
      try {
        const jiraClient = new JiraTempoClient({ baseUrl, token: jiraToken, timeoutMs: 15000 });
        const rawWls = await jiraClient.getIssueWorklogsDirect(issueKey);

        if (rawWls && rawWls.length > 0) {
          // Filtrer par plage de dates
          directJiraWorklogs = rawWls.filter((wl) => {
            const parsed = parseWorklogDate(wl);
            const wlDate = new Date(parsed.worklogDate);
            return wlDate >= startDate && wlDate <= endDate;
          });

          if (directJiraWorklogs.length > 0) {
            isLiveJira = true;
          }
        }
      } catch (jiraErr: any) {
        console.warn(`⚠️ API Jira direct échouée pour ${issueKey}, fallback BDD local:`, jiraErr.message);
      }
    }

    // 3. Agrégation CSV par matricule
    const csvTotalByMatricule = new Map<string, number>();
    absencesCSV.forEach((abs) => {
      const mat = abs.matricule.trim().toUpperCase();
      const current = csvTotalByMatricule.get(mat) || 0;
      csvTotalByMatricule.set(mat, Number((current + abs.valeur).toFixed(2)));
    });

    // 4. Agrégation Jira par collaborateur Jira
    const jiraWorklogByCollabName = new Map<string, { totalHours: number; totalDays: number; entriesCount: number }>();

    if (isLiveJira) {
      // Utiliser les worklogs frais récupérés en direct depuis l'API Jira
      directJiraWorklogs.forEach((wl) => {
        const name = (wl.author?.displayName || wl.author?.name || 'Inconnu').trim();
        const existing = jiraWorklogByCollabName.get(name) || { totalHours: 0, totalDays: 0, entriesCount: 0 };
        const hours = (wl.timeSpentSeconds || 0) / 3600;
        existing.totalHours += hours;
        existing.totalDays += hours / 8;
        existing.entriesCount += 1;
        jiraWorklogByCollabName.set(name, existing);
      });
    } else {
      // Utiliser la table BDD locale TempoWorklog
      dbWorklogsJira.forEach((wl) => {
        const name = (wl.collaborator || 'Inconnu').trim();
        const existing = jiraWorklogByCollabName.get(name) || { totalHours: 0, totalDays: 0, entriesCount: 0 };
        existing.totalHours += wl.timeInHours;
        existing.totalDays += wl.timeInDays;
        existing.entriesCount += 1;
        jiraWorklogByCollabName.set(name, existing);
      });
    }

    // 5. Consolidations par Ressource du référentiel
    const assignedJiraAuthors = new Set<string>();

    const rows = ressources.map((r) => {
      const mat = r.matricule.trim().toUpperCase();
      const joursCSV = csvTotalByMatricule.get(mat) || 0;

      // Chercher si un worklog Jira matche par prénom & nom
      let matchedJiraData = { totalHours: 0, totalDays: 0, entriesCount: 0 };
      let matchedAuthorName: string | undefined = undefined;

      for (const [jiraAuthor, data] of jiraWorklogByCollabName.entries()) {
        const matchedRessource = matchRessourceByNom(jiraAuthor, [r]);
        if (matchedRessource) {
          matchedJiraData = data;
          matchedAuthorName = jiraAuthor;
          assignedJiraAuthors.add(jiraAuthor);
          break;
        }
      }

      // Convertir les heures Jira en jours (1j = 8h) ou prendre totalDays de Tempo
      const joursJira = Number((matchedJiraData.totalHours / 8).toFixed(2));
      const ecartJours = Number((joursJira - joursCSV).toFixed(2));

      let statut: 'CONFORME' | 'SOUS_SAISIE' | 'SUR_SAISIE' | 'NON_SAISI' | 'SANS_ABSENCE_CSV';

      if (Math.abs(ecartJours) <= 0.05) {
        statut = 'CONFORME';
      } else if (joursCSV > 0 && joursJira === 0) {
        statut = 'NON_SAISI';
      } else if (joursJira < joursCSV) {
        statut = 'SOUS_SAISIE';
      } else if (joursCSV === 0 && joursJira > 0) {
        statut = 'SANS_ABSENCE_CSV';
      } else {
        statut = 'SUR_SAISIE';
      }

      return {
        matricule: r.matricule,
        nom: r.nom,
        role: r.role,
        type: r.type,
        joursCSV,
        heuresJira: Number(matchedJiraData.totalHours.toFixed(2)),
        joursJira,
        ecartJours,
        statut,
        jiraAuthorName: matchedAuthorName || null
      };
    });

    // 6. Restreindre exclusivement l'analyse aux membres du référentiel Ressources de l'équipe
    const allRows = rows;

    // 7. Calcul des statistiques KPI

    const totalCollaborateurs = allRows.length;
    const totalConformes = allRows.filter((r) => r.statut === 'CONFORME').length;
    const totalSousSaisies = allRows.filter((r) => r.statut === 'SOUS_SAISIE' || r.statut === 'NON_SAISI').length;
    const totalSurSaisies = allRows.filter((r) => r.statut === 'SUR_SAISIE' || r.statut === 'SANS_ABSENCE_CSV').length;
    const totalJoursCSV = Number(allRows.reduce((acc, curr) => acc + curr.joursCSV, 0).toFixed(2));
    const totalJoursJira = Number(allRows.reduce((acc, curr) => acc + curr.joursJira, 0).toFixed(2));
    const totalEcartJours = Number((totalJoursJira - totalJoursCSV).toFixed(2));

    res.json({
      annee,
      mois,
      issueKey,
      isLiveJira,
      kpis: {
        totalCollaborateurs,
        totalConformes,
        totalSousSaisies,
        totalSurSaisies,
        totalJoursCSV,
        totalJoursJira,
        totalEcartJours
      },
      rows: allRows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

