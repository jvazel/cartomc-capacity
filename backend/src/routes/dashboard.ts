import express from 'express';
import { Projet } from '../models/Projet.js';
import { VentilationMensuelle } from '../models/VentilationMensuelle.js';
import { calculerCapaciteMensuelle } from '../services/capaciteService.js';
import { ConfigurationTolerances } from '../models/ConfigurationTolerances.js';
import { TempoWorklog } from '../models/TempoWorklog.js';
import { Ressource } from '../models/Ressource.js';
import { AbsenceJournaliere } from '../models/AbsenceJournaliere.js';

const router = express.Router();


// GET /api/dashboard/control-tower : endpoint consolidé Macro Dashboard
router.get('/control-tower', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();

    const [projets, ventilations, capaciteMensuelle, config] = await Promise.all([
      Projet.find().populate('leadBA'),
      VentilationMensuelle.find({ annee }),
      calculerCapaciteMensuelle(annee, 1, 12),
      ConfigurationTolerances.findOne()
    ]);

    // Map ventilations par projetId et mois
    const mapVentilations = new Map<string, Map<number, { joursInternes: number; joursExternes: number }>>();
    ventilations.forEach((v) => {
      const pid = v.projetId.toString();
      if (!mapVentilations.has(pid)) {
        mapVentilations.set(pid, new Map());
      }
      mapVentilations.get(pid)!.set(v.mois, {
        joursInternes: v.joursInternes,
        joursExternes: v.joursExternes
      });
    });

    // 1. KPI B0/B1 et statuts d'estimation
    let nbB0 = 0;
    let nbB1 = 0;
    let nbNC = 0;

    let sumEcartsPct = 0;
    let nbEcartsProjets = 0;

    projets.forEach((p) => {
      const hasB0 = p.estimationB0 !== undefined && p.estimationB0 !== null && p.estimationB0 > 0;
      const hasB1 = p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0;

      if (hasB1) {
        nbB1++;
      } else if (hasB0) {
        nbB0++;
      } else {
        nbNC++;
      }

      if (hasB0 && hasB1) {
        const b0 = p.estimationB0!;
        const b1 = p.estimationB1!;
        sumEcartsPct += (b1 - b0) / b0;
        nbEcartsProjets++;
      }
    });

    const ecartMoyenB0B1Pct = nbEcartsProjets > 0 ? Number(((sumEcartsPct / nbEcartsProjets) * 100).toFixed(1)) : 0;

    // 2. Calcul des séries mensuelles par mois (1 à 12)
    const moisFiltre = req.query.mois ? parseInt(req.query.mois as string, 10) : undefined;
    const moisData = [];

    // Répartition (annuelle globale ou ciblée sur le mois filtré) des charges planifiées
    let repartitionRunBuild = { RUN: 0, BUILD: 0 };
    let repartitionPriorite = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, NC: 0 };

    for (let m = 1; m <= 12; m++) {
      const capM = capaciteMensuelle.find((c) => c.mois === m) || {
        nomMois: `Mois ${m}`,
        interne: { capaciteNette: 0, etp: 0, joursOuvres: 0 },
        externe: { capaciteNette: 0, etp: 0, joursOuvres: 0 },
        global: { capaciteNette: 0, etp: 0, joursOuvres: 0 }
      };

      // Initialiser ventilations par catégorie
      const charges = {
        interne: { RUN: 0, P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, Autres: 0, total: 0 },
        externe: { RUN: 0, P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, Autres: 0, total: 0 },
        global: { RUN: 0, P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, Autres: 0, total: 0 }
      };

      projets.forEach((p) => {
        const pid = p._id.toString();
        const ventMap = mapVentilations.get(pid);
        const vent = ventMap?.get(m) || { joursInternes: 0, joursExternes: 0 };

        const ji = vent.joursInternes;
        const je = vent.joursExternes;
        const jt = ji + je;

        if (jt === 0) return;

        // Déterminer la catégorie pour l'histogramme empilé
        let category: 'RUN' | 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'Autres' = 'Autres';

        if (p.type === 'RUN') {
          category = 'RUN';
        } else if (p.priorite && ['P0', 'P1', 'P2', 'P3', 'P4'].includes(p.priorite)) {
          category = p.priorite as any;
        } else {
          category = 'Autres';
        }

        // Ajouter aux catégories mensuelles
        charges.interne[category] += ji;
        charges.interne.total += ji;

        charges.externe[category] += je;
        charges.externe.total += je;

        charges.global[category] += jt;
        charges.global.total += jt;

        // Cumuler pour les camemberts (si aucun mois filtré => toute l'année, sinon seulement le mois ciblé)
        const doitCumuler = !moisFiltre || moisFiltre === m;
        if (doitCumuler) {
          if (p.type === 'RUN') {
            repartitionRunBuild.RUN += jt;
          } else {
            repartitionRunBuild.BUILD += jt;

            // Cumul par priorité hors RUN
            if (p.priorite && ['P0', 'P1', 'P2', 'P3', 'P4'].includes(p.priorite)) {
              repartitionPriorite[p.priorite as 'P0' | 'P1' | 'P2' | 'P3' | 'P4'] += jt;
            } else {
              repartitionPriorite.NC += jt;
            }
          }
        }
      });

      // Taux d'occupation = Charge / Capacité Nette
      const getTauxOccupation = (charge: number, capNette: number) => {
        if (capNette <= 0) return 0;
        return Number(((charge / capNette) * 100).toFixed(1));
      };

      // Arrondis à 1 décimale pour propre affichage
      const roundCategory = (catObj: any) => ({
        RUN: Number(catObj.RUN.toFixed(1)),
        P0: Number(catObj.P0.toFixed(1)),
        P1: Number(catObj.P1.toFixed(1)),
        P2: Number(catObj.P2.toFixed(1)),
        P3: Number(catObj.P3.toFixed(1)),
        P4: Number(catObj.P4.toFixed(1)),
        Autres: Number(catObj.Autres.toFixed(1)),
        total: Number(catObj.total.toFixed(1))
      });

      moisData.push({
        mois: m,
        nomMois: capM.nomMois || `Mois ${m}`,
        capaciteNette: {
          interne: capM.interne.capaciteNette,
          externe: capM.externe.capaciteNette,
          global: capM.global.capaciteNette
        },
        tauxOccupation: {
          interne: getTauxOccupation(charges.interne.total, capM.interne.capaciteNette),
          externe: getTauxOccupation(charges.externe.total, capM.externe.capaciteNette),
          global: getTauxOccupation(charges.global.total, capM.global.capaciteNette)
        },
        charges: {
          interne: roundCategory(charges.interne),
          externe: roundCategory(charges.externe),
          global: roundCategory(charges.global)
        }
      });
    }

    // Arrondis camemberts (annuels ou mensuels)
    repartitionRunBuild.RUN = Number(repartitionRunBuild.RUN.toFixed(1));
    repartitionRunBuild.BUILD = Number(repartitionRunBuild.BUILD.toFixed(1));

    Object.keys(repartitionPriorite).forEach((k) => {
      (repartitionPriorite as any)[k] = Number(((repartitionPriorite as any)[k]).toFixed(1));
    });

    // KPI Contrôle d'absences du mois en cours
    const currentMois = new Date().getMonth() + 1;
    const startDateMois = new Date(Date.UTC(annee, currentMois - 1, 1, 0, 0, 0, 0));
    const endDateMois = new Date(Date.UTC(annee, currentMois, 0, 23, 59, 59, 999));
    const issueKeyAbsence = config?.jiraAbsenceIssueKey ? config.jiraAbsenceIssueKey.trim().toUpperCase() : 'HP-26';

    const [ressourcesActives, absencesMoisCSV, worklogsJiraMois] = await Promise.all([
      Ressource.find({ actif: true }),
      AbsenceJournaliere.find({ date: { $gte: startDateMois, $lte: endDateMois }, valeur: { $gt: 0 } }),
      TempoWorklog.find({ issueKey: issueKeyAbsence, worklogDate: { $gte: startDateMois, $lte: endDateMois } })
    ]);

    const mapCsvMois = new Map<string, number>();
    absencesMoisCSV.forEach((abs) => {
      const mat = abs.matricule.trim().toUpperCase();
      mapCsvMois.set(mat, (mapCsvMois.get(mat) || 0) + abs.valeur);
    });

    const mapJiraMois = new Map<string, number>();
    worklogsJiraMois.forEach((wl) => {
      const name = (wl.collaborator || '').toLowerCase().trim();
      mapJiraMois.set(name, (mapJiraMois.get(name) || 0) + wl.timeInHours);
    });

    let nbConformesMois = 0;
    let nbAnomaliesMois = 0;

    ressourcesActives.forEach((r) => {
      const mat = r.matricule.trim().toUpperCase();
      const jCsv = mapCsvMois.get(mat) || 0;

      // Matching nom
      const cleanNom = r.nom.toLowerCase().trim();
      let hJira = 0;
      for (const [jAuthor, hrs] of mapJiraMois.entries()) {
        if (cleanNom.includes(jAuthor) || jAuthor.includes(cleanNom) || cleanNom.split(/\s+/).some(t => t.length > 2 && jAuthor.includes(t))) {
          hJira = hrs;
          break;
        }
      }
      const jJira = hJira / 8;
      if (Math.abs(jJira - jCsv) <= 0.05) {
        nbConformesMois++;
      } else {
        nbAnomaliesMois++;
      }
    });

    const totalRessourcesControle = ressourcesActives.length;
    const tauxConformiteAbsencesMoisPct = totalRessourcesControle > 0
      ? Number(((nbConformesMois / totalRessourcesControle) * 100).toFixed(0))
      : 100;

    // 1. Taux de couverture de chiffrage
    const totalProjets = projets.length;
    const projetsChiffres = nbB0 + nbB1;
    const tauxCouvertureChiffragePct = totalProjets > 0 ? Number(((projetsChiffres / totalProjets) * 100).toFixed(0)) : 100;
    const nbP0P1NonChiffres = projets.filter((p) => {
      const isP0P1 = p.priorite === 'P0' || p.priorite === 'P1';
      const isNoChiffrage = (!p.estimationB0 || p.estimationB0 <= 0) && (!p.estimationB1 || p.estimationB1 <= 0);
      return isP0P1 && isNoChiffrage;
    }).length;

    // 2. Velocié / Atterrissage Tempo à date
    const aggTempoADate = await TempoWorklog.aggregate([
      { $match: { year: annee, month: { $lte: currentMois } } },
      { $group: { _id: null, total: { $sum: '$timeInDays' } } }
    ]);
    const totalConsommeTempoADate = aggTempoADate.length > 0 ? Number(aggTempoADate[0].total.toFixed(1)) : 0;

    let totalPlanifieADate = 0;
    ventilations.forEach((v) => {
      if (v.mois <= currentMois) {
        totalPlanifieADate += (v.joursInternes + v.joursExternes);
      }
    });
    totalPlanifieADate = Number(totalPlanifieADate.toFixed(1));

    const ratioAtterrissageTempoPct = totalPlanifieADate > 0
      ? Number(((totalConsommeTempoADate / totalPlanifieADate) * 100).toFixed(0))
      : 100;

    // 3. Anticipation Déperdition M+1
    const nextMois = currentMois === 12 ? 12 : currentMois + 1;
    const capNextMois = capaciteMensuelle.find((c) => c.mois === nextMois);
    const deperditionNextMois = capNextMois ? capNextMois.global.deperdition : 0;
    const capTheoNextMois = capNextMois ? capNextMois.global.capaciteTheorique : 0;
    const tauxDeperditionNextMoisPct = capTheoNextMois > 0
      ? Number(((deperditionNextMois / capTheoNextMois) * 100).toFixed(1))
      : 0;

    // 4. Ratio Équilibre RUN vs BUILD (Planifié & Réel Tempo)
    const categoriesRunList = (config?.categoriesRun || ['MCO', 'Evol Technique']).map((c: string) => c.toLowerCase().trim());

    // Calcul Réel Tempo (annuel ou mois filtré)
    const matchTempoQuery: any = { year: annee };
    if (moisFiltre && moisFiltre >= 1 && moisFiltre <= 12) {
      matchTempoQuery.month = moisFiltre;
    }

    const allWorklogsTempo = await TempoWorklog.find(matchTempoQuery);
    let runReelJours = 0;
    let buildReelJours = 0;

    allWorklogsTempo.forEach((wl) => {
      const cat = (wl.category || '').toLowerCase().trim();
      if (categoriesRunList.some((c: string) => cat.includes(c) || c.includes(cat))) {
        runReelJours += wl.timeInDays;
      } else {
        buildReelJours += wl.timeInDays;
      }
    });

    runReelJours = Number(runReelJours.toFixed(1));
    buildReelJours = Number(buildReelJours.toFixed(1));
    const totalReelTempoJours = Number((runReelJours + buildReelJours).toFixed(1));

    const pctRUNReel = totalReelTempoJours > 0 ? Number(((runReelJours / totalReelTempoJours) * 100).toFixed(0)) : 0;
    const pctBUILDReel = totalReelTempoJours > 0 ? Number(((buildReelJours / totalReelTempoJours) * 100).toFixed(0)) : 0;

    const totalChargeAnnuelle = repartitionRunBuild.RUN + repartitionRunBuild.BUILD;
    const pctRUN = totalChargeAnnuelle > 0 ? Number(((repartitionRunBuild.RUN / totalChargeAnnuelle) * 100).toFixed(0)) : 0;
    const pctBUILD = totalChargeAnnuelle > 0 ? Number(((repartitionRunBuild.BUILD / totalChargeAnnuelle) * 100).toFixed(0)) : 0;

    // 5. Calcul des KPIs et Séries de Staffing Nominatif & Tempo
    let totalPlanifieAnnee = 0;
    let totalAffecteAnnee = 0;
    let totalAffecteInterneAnnee = 0;
    let totalAffecteExterneAnnee = 0;
    let totalPlanifieInterneAnnee = 0;
    let totalPlanifieExterneAnnee = 0;

    // Calcul mois par mois pour la trajectoire 12 mois (Graphique 3 volets)
    const trajectoireStaffing12Mois: Array<{
      mois: number;
      nomMois: string;
      planifieTotal: number;
      affecteTotal: number;
      affecteInterne: number;
      affecteExterne: number;
      reserveNonAssigne: number;
      consommeTempo: number | null;
    }> = [];

    // Aggregation tempo mois par mois pour l'année
    const mapTempoMoisTotal = new Map<number, number>();
    const aggTempoParMois = await TempoWorklog.aggregate([
      { $match: { year: annee } },
      { $group: { _id: '$month', total: { $sum: '$timeInDays' } } }
    ]);
    aggTempoParMois.forEach((row) => {
      mapTempoMoisTotal.set(row._id, Number(row.total.toFixed(1)));
    });

    const isCurrentAnnee = new Date().getFullYear() === annee;
    const limitMoisTempo = isCurrentAnnee ? (new Date().getMonth() + 1) : (annee < new Date().getFullYear() ? 12 : 0);

    for (let m = 1; m <= 12; m++) {
      const nomMois = capaciteMensuelle.find((c) => c.mois === m)?.nomMois || `Mois ${m}`;
      let planifieMois = 0;
      let planifieInterneM = 0;
      let planifieExterneM = 0;
      let affecteMois = 0;
      let affecteInterneM = 0;
      let affecteExterneM = 0;

      ventilations.filter((v) => v.mois === m).forEach((v) => {
        const ji = v.joursInternes || 0;
        const je = v.joursExternes || 0;
        planifieMois += (ji + je);
        planifieInterneM += ji;
        planifieExterneM += je;

        if (v.affectations && v.affectations.length > 0) {
          v.affectations.forEach((aff) => {
            const jAff = aff.jours || 0;
            affecteMois += jAff;
            if (aff.type === 'Externe') {
              affecteExterneM += jAff;
            } else {
              affecteInterneM += jAff;
            }
          });
        }
      });

      planifieMois = Number(planifieMois.toFixed(1));
      affecteMois = Number(affecteMois.toFixed(1));
      affecteInterneM = Number(affecteInterneM.toFixed(1));
      affecteExterneM = Number(affecteExterneM.toFixed(1));
      const reserveNonAssigne = Number(Math.max(0, planifieMois - affecteMois).toFixed(1));
      const consommeTempo = m <= limitMoisTempo ? (mapTempoMoisTotal.get(m) || 0) : null;

      trajectoireStaffing12Mois.push({
        mois: m,
        nomMois,
        planifieTotal: planifieMois,
        affecteTotal: affecteMois,
        affecteInterne: affecteInterneM,
        affecteExterne: affecteExterneM,
        reserveNonAssigne,
        consommeTempo
      });

      totalPlanifieAnnee += planifieMois;
      totalAffecteAnnee += affecteMois;
      totalAffecteInterneAnnee += affecteInterneM;
      totalAffecteExterneAnnee += affecteExterneM;
      totalPlanifieInterneAnnee += planifieInterneM;
      totalPlanifieExterneAnnee += planifieExterneM;
    }

    totalPlanifieAnnee = Number(totalPlanifieAnnee.toFixed(1));
    totalAffecteAnnee = Number(totalAffecteAnnee.toFixed(1));
    totalAffecteInterneAnnee = Number(totalAffecteInterneAnnee.toFixed(1));
    totalAffecteExterneAnnee = Number(totalAffecteExterneAnnee.toFixed(1));
    totalPlanifieInterneAnnee = Number(totalPlanifieInterneAnnee.toFixed(1));
    totalPlanifieExterneAnnee = Number(totalPlanifieExterneAnnee.toFixed(1));

    // Si un mois précis est filtré, calcul ciblé sur ce mois
    const moisCibleKpi = moisFiltre && moisFiltre >= 1 && moisFiltre <= 12 ? moisFiltre : (isCurrentAnnee ? currentMois : 1);
    const donneesMoisCible = trajectoireStaffing12Mois.find((t) => t.mois === moisCibleKpi) || trajectoireStaffing12Mois[0];

    const planifieRef = moisFiltre ? donneesMoisCible.planifieTotal : totalPlanifieAnnee;
    const affecteRef = moisFiltre ? donneesMoisCible.affecteTotal : totalAffecteAnnee;
    const affecteInterneRef = moisFiltre ? donneesMoisCible.affecteInterne : totalAffecteInterneAnnee;
    const affecteExterneRef = moisFiltre ? donneesMoisCible.affecteExterne : totalAffecteExterneAnnee;
    const planifieInterneRef = moisFiltre ? (ventilations.filter(v => v.mois === moisFiltre).reduce((acc, v) => acc + (v.joursInternes || 0), 0)) : totalPlanifieInterneAnnee;
    const planifieExterneRef = moisFiltre ? (ventilations.filter(v => v.mois === moisFiltre).reduce((acc, v) => acc + (v.joursExternes || 0), 0)) : totalPlanifieExterneAnnee;

    const tauxCouvertureNominativePct = planifieRef > 0 ? Number(((affecteRef / planifieRef) * 100).toFixed(0)) : 100;
    const tauxCouvertureInternePct = planifieInterneRef > 0 ? Number(((affecteInterneRef / planifieInterneRef) * 100).toFixed(0)) : 100;
    const tauxCouvertureExternePct = planifieExterneRef > 0 ? Number(((affecteExterneRef / planifieExterneRef) * 100).toFixed(0)) : 100;

    // Écart Affecté vs Réel Tempo sur le mois cible (ou à date)
    const consommeTempoRef = donneesMoisCible.consommeTempo ?? 0;
    const ecartAffecteTempoJours = Number((consommeTempoRef - donneesMoisCible.affecteTotal).toFixed(1));
    const ecartAffecteTempoPct = donneesMoisCible.affecteTotal > 0
      ? Number(((ecartAffecteTempoJours / donneesMoisCible.affecteTotal) * 100).toFixed(1))
      : 0;

    res.json({
      annee,
      mois: moisFiltre || null,
      kpis: {
        totalProjets,
        nbB0,
        nbB1,
        nbNC,
        ecartMoyenB0B1Pct,
        nbEcartsProjets,
        controleAbsencesMois: {
          mois: currentMois,
          totalCollaborateurs: totalRessourcesControle,
          totalConformes: nbConformesMois,
          totalAnomalies: nbAnomaliesMois,
          tauxConformitePct: tauxConformiteAbsencesMoisPct,
          issueKey: issueKeyAbsence
        },
        couvertureChiffrage: {
          tauxPct: tauxCouvertureChiffragePct,
          projetsChiffres,
          totalProjets,
          nbP0P1NonChiffres
        },
        atterrissageTempoADate: {
          consommeADate: totalConsommeTempoADate,
          planifieADate: totalPlanifieADate,
          ratioPct: ratioAtterrissageTempoPct
        },
        anticipationDeperditionM1: {
          mois: nextMois,
          nomMois: capNextMois?.nomMois || `Mois ${nextMois}`,
          deperditionJours: deperditionNextMois,
          tauxPct: tauxDeperditionNextMoisPct
        },
        équilibreRunBuild: {
          pctRUN,
          pctBUILD,
          totalRUN: repartitionRunBuild.RUN,
          totalBUILD: repartitionRunBuild.BUILD,
          pctRUNReel,
          pctBUILDReel,
          totalRUNReel: runReelJours,
          totalBUILDReel: buildReelJours,
          categoriesRun: config?.categoriesRun || ['MCO', 'Evol Technique']
        },
        staffingKpis: {
          tauxCouvertureNominativePct,
          tauxCouvertureInternePct,
          tauxCouvertureExternePct,
          totalAffecteJours: affecteRef,
          totalPlanifieJours: planifieRef,
          reserveNonAssigneJours: Number(Math.max(0, planifieRef - affecteRef).toFixed(1)),
          ecartAffecteTempoJours,
          ecartAffecteTempoPct,
          consommeTempoMois: consommeTempoRef,
          moisCible: moisCibleKpi,
          nomMoisCible: donneesMoisCible.nomMois
        }
      },
      trajectoireStaffing12Mois,
      repartitionRunBuild,
      repartitionRunBuildReelTempo: {
        RUN: runReelJours,
        BUILD: buildReelJours
      },
      repartitionPriorite,
      moisData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/alertes : Endpoint d'alertes proactives pour l'année
router.get('/alertes', async (req, res) => {
  try {
    const annee = req.query.annee ? parseInt(req.query.annee as string, 10) : new Date().getFullYear();

    const [projets, ventilations, capaciteMensuelle, config] = await Promise.all([
      Projet.find().populate('leadBA'),
      VentilationMensuelle.find({ annee }),
      calculerCapaciteMensuelle(annee, 1, 12),
      ConfigurationTolerances.findOne()
    ]);

    const toleranceB0 = config?.toleranceB0Pct || 100;
    const toleranceB1 = config?.toleranceB1Pct || 20;
    const seuilSousCharge = config?.seuilSousChargeJours || 10;

    const alertes: Array<{
      id: string;
      type: 'surcharge' | 'derive_b0_b1' | 'gouvernance' | 'sous_charge';
      severite: 'critique' | 'avertissement' | 'info';
      titre: string;
      message: string;
      details?: any;
    }> = [];

    // Map des ventilations mensuelles par projetId et mois
    const mapVentilations = new Map<string, Map<number, { joursInternes: number; joursExternes: number }>>();
    const mapProjectTotalPlanifie = new Map<string, number>();
    const mapProjectMoisPremierCharge = new Map<string, number>(); // Premier mois avec charge planifiée > 0

    ventilations.forEach((v) => {
      const pid = v.projetId.toString();
      if (!mapVentilations.has(pid)) {
        mapVentilations.set(pid, new Map());
      }
      mapVentilations.get(pid)!.set(v.mois, {
        joursInternes: v.joursInternes,
        joursExternes: v.joursExternes
      });

      const totalV = v.joursInternes + v.joursExternes;
      const currentT = mapProjectTotalPlanifie.get(pid) || 0;
      mapProjectTotalPlanifie.set(pid, currentT + totalV);

      if (totalV > 0) {
        const minM = mapProjectMoisPremierCharge.get(pid);
        if (minM === undefined || v.mois < minM) {
          mapProjectMoisPremierCharge.set(pid, v.mois);
        }
      }
    });

    // 1. Alerte de Surcharge par Mois (Solde < 0) pour Internes, Externes et Global
    for (let m = 1; m <= 12; m++) {
      const capM = capaciteMensuelle.find((c) => c.mois === m);
      if (!capM) continue;

      let sumInt = 0;
      let sumExt = 0;

      projets.forEach((p) => {
        const vent = mapVentilations.get(p._id.toString())?.get(m);
        if (vent) {
          sumInt += vent.joursInternes;
          sumExt += vent.joursExternes;
        }
      });

      sumInt = Number(sumInt.toFixed(1));
      sumExt = Number(sumExt.toFixed(1));

      const soldeInt = Number((capM.interne.capaciteNette - sumInt).toFixed(1));
      const soldeExt = Number((capM.externe.capaciteNette - sumExt).toFixed(1));

      if (soldeInt < 0) {
        alertes.push({
          id: `surcharge-int-${m}`,
          type: 'surcharge',
          severite: 'critique',
          titre: `Surcharge Internes en ${capM.nomMois} ${annee}`,
          message: `Surcharge détectée en ${capM.nomMois} ${annee} pour les ressources Internes. Solde : ${soldeInt} jours.`
        });
      }

      if (soldeExt < 0) {
        alertes.push({
          id: `surcharge-ext-${m}`,
          type: 'surcharge',
          severite: 'critique',
          titre: `Surcharge Externes en ${capM.nomMois} ${annee}`,
          message: `Surcharge détectée en ${capM.nomMois} ${annee} pour les ressources Externes. Solde : ${soldeExt} jours.`
        });
      }
    }

    // 2. Alerte de Dérive B0/B1 (Charge Planifiée > Charge Max Tolérée)
    projets.forEach((p) => {
      const totalPlanifie = Number((mapProjectTotalPlanifie.get(p._id.toString()) || 0).toFixed(1));

      let estimationRetenue = 0;
      let tolerancePct = 0;
      let statutEst = 'NC';

      if (p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0) {
        statutEst = 'B1';
        estimationRetenue = p.estimationB1;
        tolerancePct = toleranceB1;
      } else if (p.estimationB0 !== undefined && p.estimationB0 !== null && p.estimationB0 > 0) {
        statutEst = 'B0';
        estimationRetenue = p.estimationB0;
        tolerancePct = toleranceB0;
      }

      if (statutEst !== 'NC' && estimationRetenue > 0) {
        const chargeMax = Number((estimationRetenue * (1 + tolerancePct / 100)).toFixed(1));
        if (totalPlanifie > chargeMax) {
          alertes.push({
            id: `derive-${p._id}`,
            type: 'derive_b0_b1',
            severite: 'avertissement',
            titre: `Dépassement de tolérance sur le projet ${p.nom}`,
            message: `Le projet "${p.nom}" a dépassé sa tolérance de chiffrage (${totalPlanifie}j planifiés > charge max ${chargeMax}j en ${statutEst} + ${tolerancePct}%).`
          });
        }
      }
    });

    // 3. Alerte de Gouvernance :
    // a) Projets P0/P1 sans Lead BA
    const projetsP0P1SansBA = projets.filter(
      (p) => (p.priorite === 'P0' || p.priorite === 'P1') && !p.leadBA
    );

    if (projetsP0P1SansBA.length > 0) {
      alertes.push({
        id: 'gouvernance-p0-p1-sans-ba',
        type: 'gouvernance',
        severite: 'avertissement',
        titre: `Projets P0/P1 sans Lead BA assigné`,
        message: `${projetsP0P1SansBA.length} projet(s) classé(s) P0 ou P1 n'ont pas de Lead BA assigné (${projetsP0P1SansBA.map((p) => p.nom).join(', ')}).`
      });
    }

    // b) Projets P0 toujours en B0 démarrant le mois prochain
    const currentMonth = new Date().getMonth() + 1; // 1 à 12
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

    projets.forEach((p) => {
      if (p.priorite === 'P0') {
        const isB0 = p.estimationB0 && p.estimationB0 > 0 && (!p.estimationB1 || p.estimationB1 === 0);
        const premierMois = mapProjectMoisPremierCharge.get(p._id.toString());
        if (isB0 && premierMois === nextMonth) {
          alertes.push({
            id: `gouvernance-b0-start-next-${p._id}`,
            type: 'gouvernance',
            severite: 'avertissement',
            titre: `Projet P0 en B0 démarrant le mois prochain`,
            message: `Le projet "${p.nom}" (P0) est toujours chiffré en B0 alors qu'il démarre le mois prochain.`
          });
        }
      }
    });

    // 4. Alerte de Sous-charge : Solde > seuilSousChargeJours
    const projetsRecoNonPlanifies = projets.filter((p) => {
      if (p.type !== 'Reco') return false;
      const totalP = mapProjectTotalPlanifie.get(p._id.toString()) || 0;
      return totalP === 0;
    });

    for (let m = 1; m <= 12; m++) {
      const capM = capaciteMensuelle.find((c) => c.mois === m);
      if (!capM) continue;

      let sumGlob = 0;
      projets.forEach((p) => {
        const vent = mapVentilations.get(p._id.toString())?.get(m);
        if (vent) sumGlob += vent.joursInternes + vent.joursExternes;
      });

      const soldeGlob = Number((capM.global.capaciteNette - sumGlob).toFixed(1));

      if (soldeGlob >= seuilSousCharge) {
        alertes.push({
          id: `sous-charge-${m}`,
          type: 'sous_charge',
          severite: 'info',
          titre: `Capacité disponible en ${capM.nomMois} ${annee}`,
          message: `Capacité disponible importante détectée en ${capM.nomMois} ${annee} (+${soldeGlob} jours). ${projetsRecoNonPlanifies.length} projet(s) en statut 'Reco' pourraient être planifiés.`
        });
      }
    }

    // 5. Alerte de Consommation Tempo (Consommé > Planifié à date ou Atterrissage > Charge Max)
    const currentMoisIndex = new Date().getFullYear() === annee ? new Date().getMonth() + 1 : 12;

    for (const p of projets) {
      const orConditions: any[] = [];
      if (p.codeProjet && p.codeProjet.trim()) {
        orConditions.push({ budgetLine: { $regex: new RegExp(`^${p.codeProjet.trim()}$`, 'i') } });
      }
      if (p.jiraBudgetLine && p.jiraBudgetLine.trim()) {
        orConditions.push({ budgetLine: { $regex: new RegExp(`^${p.jiraBudgetLine.trim()}$`, 'i') } });
      }
      if (p.jiraEpicKey && p.jiraEpicKey.trim()) {
        orConditions.push({ epicSummary: { $regex: new RegExp(p.jiraEpicKey.trim(), 'i') } });
      }
      if (p.jiraFeatureId && p.jiraFeatureId.trim()) {
        orConditions.push({ featureId: p.jiraFeatureId.trim() });
      }

      if (orConditions.length === 0) continue;

      const aggResult = await TempoWorklog.aggregate([
        { $match: { year: annee, $or: orConditions } },
        { $group: { _id: null, total: { $sum: '$timeInDays' } } }
      ]);

      const consomme = aggResult.length > 0 ? Number(aggResult[0].total.toFixed(2)) : 0;
      if (consomme === 0) continue;

      const pVentMap = mapVentilations.get(p._id.toString());
      let planIdaDate = 0;
      let planifFutur = 0;

      for (let m = 1; m <= 12; m++) {
        const vent = pVentMap?.get(m) || { joursInternes: 0, joursExternes: 0 };
        const totalM = vent.joursInternes + vent.joursExternes;
        if (m <= currentMoisIndex) planIdaDate += totalM;
        else planifFutur += totalM;
      }

      let estimationRetenue = 0;
      let tolerancePct = 0;
      if (p.estimationB1 && p.estimationB1 > 0) {
        estimationRetenue = p.estimationB1;
        tolerancePct = toleranceB1;
      } else if (p.estimationB0 && p.estimationB0 > 0) {
        estimationRetenue = p.estimationB0;
        tolerancePct = toleranceB0;
      }

      const chargeMax = Number((estimationRetenue * (1 + tolerancePct / 100)).toFixed(1));
      const atterrissage = Number((consomme + planifFutur).toFixed(1));

      if (estimationRetenue > 0 && atterrissage > chargeMax) {
        alertes.push({
          id: `derive-tempo-critique-${p._id}`,
          type: 'derive_b0_b1',
          severite: 'critique',
          titre: `Dérive Tempo critique sur le projet ${p.nom}`,
          message: `L'atterrissage prévisionnel Tempo du projet "${p.nom}" (${atterrissage}j) dépasse la charge max tolérée (${chargeMax}j).`
        });
      } else if (consomme > planIdaDate && planIdaDate > 0) {
        alertes.push({
          id: `derive-tempo-date-${p._id}`,
          type: 'derive_b0_b1',
          severite: 'avertissement',
          titre: `Surconsommation Tempo à date sur ${p.nom}`,
          message: `Le temps consommé Tempo sur "${p.nom}" (${consomme}j) dépasse la charge planifiée à date (${planIdaDate.toFixed(1)}j).`
        });
      }
    }

    // 6. Alertes de Staffing & Anomalies d'Affectation
    // 6.1 Projets P0/P1 non staffés démarrant sous 60 jours
    projets.filter((p) => p.priorite === 'P0' || p.priorite === 'P1').forEach((p) => {
      const pid = p._id.toString();
      const pVents = ventilations.filter((v) => v.projetId.toString() === pid);
      
      // Regarder sur les mois du trimestre actuel ou mois courant
      const moisProches = [currentMoisIndex, currentMoisIndex + 1, currentMoisIndex + 2].filter((m) => m <= 12);
      moisProches.forEach((m) => {
        const vM = pVents.find((v) => v.mois === m);
        if (vM) {
          const planifie = (vM.joursInternes || 0) + (vM.joursExternes || 0);
          const affecte = (vM.affectations || []).reduce((acc: number, a: any) => acc + (a.jours || 0), 0);
          const nonAssigne = planifie - affecte;

          if (planifie >= 5 && nonAssigne / planifie >= 0.7) {
            alertes.push({
              id: `staffing-non-assigne-${p._id}-${m}`,
              type: 'staffing' as any,
              severite: p.priorite === 'P0' ? 'critique' : 'avertissement',
              titre: `Déficit de staffing sur ${p.nom} (Mois ${m})`,
              message: `Le projet prioritaire (${p.priorite}) a ${nonAssigne.toFixed(1)}j / ${planifie.toFixed(1)}j non attribués en mois ${m} (${Math.round((nonAssigne / planifie) * 100)}% en réservoir).`
            });
          }
        }
      });
    });

    // 6.2 Surcharge Nominative Individuelle (Collaborateurs affectés > 100% de leur capacité nette)
    const ressourcesActives = await Ressource.find({ actif: true });
    ressourcesActives.forEach((r) => {
      const rId = r._id.toString();
      const isInterne = r.type === 'Interne';

      // Vérifier le mois courant et le mois suivant
      [currentMoisIndex, currentMoisIndex + 1].filter((m) => m <= 12).forEach((m) => {
        let totalJoursAffectes = 0;
        ventilations.filter((v) => v.mois === m).forEach((v) => {
          (v.affectations || []).filter((a: any) => a.ressourceId.toString() === rId).forEach((a: any) => {
            totalJoursAffectes += a.jours || 0;
          });
        });

        // Capacité nette du mois
        const capM = capaciteMensuelle.find((c) => c.mois === m);
        const jOuvresMois = capM ? (isInterne ? capM.interne.joursOuvres : capM.externe.joursOuvres) : 21;
        const capNetteRessource = Math.max(1, jOuvresMois * (r.tempsTravailPct / 100));

        if (totalJoursAffectes > capNetteRessource * 1.1) {
          const tauxSurcharge = Math.round((totalJoursAffectes / capNetteRessource) * 100);
          alertes.push({
            id: `staffing-surcharge-${rId}-${m}`,
            type: 'staffing' as any,
            severite: tauxSurcharge > 125 ? 'critique' : 'avertissement',
            titre: `Surcharge nominative : ${r.nom} (${tauxSurcharge}%)`,
            message: `${r.nom} est staffé(e) à ${totalJoursAffectes.toFixed(1)}j en mois ${m} pour une capacité nette de ${capNetteRessource.toFixed(1)}j.`
          });
        }
      });
    });

    // 7. Jalons Clés Imminents (J-30 / Mois en cours & M+1) avec Santé du Projet
    const moisCibleJalons = [currentMoisIndex, currentMoisIndex + 1].filter((m) => m <= 12);
    const nomsMois = [
      '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    projets.forEach((p) => {
      if (!p.jalons || p.jalons.length === 0) return;

      const totalPlanifie = Number((mapProjectTotalPlanifie.get(p._id.toString()) || 0).toFixed(1));
      let estimationRetenue = 0;
      let tolerancePct = 0;
      let statutEst = 'NC';

      if (p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0) {
        statutEst = 'B1';
        estimationRetenue = p.estimationB1;
        tolerancePct = toleranceB1;
      } else if (p.estimationB0 !== undefined && p.estimationB0 !== null && p.estimationB0 > 0) {
        statutEst = 'B0';
        estimationRetenue = p.estimationB0;
        tolerancePct = toleranceB0;
      }

      // Calcul santé projet (Vert, Orange, Rouge, NC)
      let santeProjet = 'Conforme';
      let santeCode: 'VERT' | 'ORANGE' | 'ROUGE' | 'NC' = 'VERT';

      if (statutEst === 'NC' || estimationRetenue === 0) {
        santeProjet = 'Non chiffré (NC)';
        santeCode = 'NC';
      } else {
        const chargeMax = Number((estimationRetenue * (1 + tolerancePct / 100)).toFixed(1));
        if (totalPlanifie > chargeMax) {
          santeProjet = `Dépassement (${totalPlanifie}j > max ${chargeMax}j)`;
          santeCode = 'ROUGE';
        } else if (totalPlanifie > estimationRetenue) {
          santeProjet = `Sous tolérance (${totalPlanifie}j / ${estimationRetenue}j +${tolerancePct}%)`;
          santeCode = 'ORANGE';
        } else {
          santeProjet = `Conforme (${totalPlanifie}j / ${estimationRetenue}j)`;
          santeCode = 'VERT';
        }
      }

      // Parcourir les jalons du projet
      p.jalons.forEach((j) => {
        if (j.annee === annee && moisCibleJalons.includes(j.mois)) {
          const isCurrentMois = j.mois === currentMoisIndex;
          const labelDelai = isCurrentMois ? 'Ce mois-ci' : 'Le mois prochain (M+1)';
          const nomMoisStr = nomsMois[j.mois] || `Mois ${j.mois}`;
          const typeJalon = j.type || 'MEP';
          const isCritical = santeCode === 'ROUGE' && (typeJalon === 'MEP' || typeJalon === 'UAT');

          const weekStr = j.semaine ? ` (Semaine S${j.semaine})` : '';

          alertes.push({
            id: `jalon-${p._id}-${j._id || j.nom}-${j.mois}-${j.semaine || 'm'}`,
            type: 'jalon' as any,
            severite: isCritical ? 'critique' : santeCode === 'ROUGE' || santeCode === 'ORANGE' ? 'avertissement' : 'info',
            titre: `[${typeJalon}] ${j.nom} sur ${p.nom}`,
            message: `${labelDelai}${weekStr} (${nomMoisStr} ${annee}) • Santé projet: ${santeProjet} • Priorité: ${p.priorite || 'NC'}`,
            details: {
              projetId: p._id,
              projetNom: p.nom,
              jalonNom: j.nom,
              jalonType: typeJalon,
              jalonMois: j.mois,
              jalonSemaine: j.semaine,
              jalonAnnee: j.annee,
              couleurJalon: j.couleur || '#ef4444',
              santeCode,
              santeProjet,
              priorite: p.priorite || 'NC'
            }
          });
        }
      });
    });

    // 8. Alertes de Conflits de Dépendances (Liens Fin -> Début)
    // Map projetId -> { minMois: number, maxMois: number }
    const plagesProjets: Record<string, { minMois: number; maxMois: number }> = {};
    ventilations.forEach((v) => {
      const pid = v.projetId.toString();
      const charge = (v.joursInternes || 0) + (v.joursExternes || 0);
      if (charge > 0) {
        if (!plagesProjets[pid]) {
          plagesProjets[pid] = { minMois: v.mois, maxMois: v.mois };
        } else {
          plagesProjets[pid].minMois = Math.min(plagesProjets[pid].minMois, v.mois);
          plagesProjets[pid].maxMois = Math.max(plagesProjets[pid].maxMois, v.mois);
        }
      }
    });

    const projetsMap = new Map(projets.map((p) => [p._id.toString(), p]));

    projets.forEach((p) => {
      if (p.dependances && p.dependances.length > 0) {
        const plageSuccesseur = plagesProjets[p._id.toString()];
        if (!plageSuccesseur) return; // Pas encore ventilé

        p.dependances.forEach((dep) => {
          const prereqId = dep.projetId ? dep.projetId.toString() : '';
          const prereq = projetsMap.get(prereqId);
          if (!prereq) return;

          const plagePrereq = plagesProjets[prereqId];
          if (!plagePrereq) return; // Prédécesseur sans charge

          // Conflit : Le successeur commence avant ou pendant la fin du prédécesseur
          if (plageSuccesseur.minMois < plagePrereq.maxMois) {
            const nomMoisSucc = nomsMois[plageSuccesseur.minMois] || `Mois ${plageSuccesseur.minMois}`;
            const nomMoisPre = nomsMois[plagePrereq.maxMois] || `Mois ${plagePrereq.maxMois}`;

            alertes.push({
              id: `dependance-${p._id}-${prereq._id}`,
              type: 'dependance' as any,
              severite: 'critique',
              titre: `Conflit de dépendance : ${p.nom} ➔ Prérequis ${prereq.nom}`,
              message: `"${p.nom}" démarre en ${nomMoisSucc} alors que son prérequis "${prereq.nom}" s'achève en ${nomMoisPre}.`,
              details: {
                projetId: p._id,
                projetNom: p.nom,
                priorite: p.priorite || 'NC'
              }
            });
          } else if (plageSuccesseur.minMois === plagePrereq.maxMois) {
            const nomMoisCommun = nomsMois[plageSuccesseur.minMois] || `Mois ${plageSuccesseur.minMois}`;
            alertes.push({
              id: `dependance-overlap-${p._id}-${prereq._id}`,
              type: 'dependance' as any,
              severite: 'avertissement',
              titre: `Tension de dépendance : ${p.nom} ➔ Prérequis ${prereq.nom}`,
              message: `"${p.nom}" et son prérequis "${prereq.nom}" se chevauchent sur ${nomMoisCommun}.`,
              details: {
                projetId: p._id,
                projetNom: p.nom,
                priorite: p.priorite || 'NC'
              }
            });
          }
        });
      }
    });

    res.json(alertes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
