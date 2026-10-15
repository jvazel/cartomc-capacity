import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IProjet } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Calendar,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Zap,
  Gauge,
  Play,
  Maximize2,
  Minimize2,
  Save,
  FolderOpen,
  GitCompare,
  Trash2,
  Plus,
  Info,
  Layers,
  ArrowRightLeft,
  Users,
  FolderTree,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  UserPlus,
  UserCheck,
  Flag,
  MessageSquare,
  FileText,
  Link2
} from 'lucide-react';
import { PlanningRessourcesGantt } from '../components/PlanningRessourcesGantt';
import { GroupByDropdown, GroupByOption } from '../components/GroupByDropdown';
import { ResourceDrawer } from '../components/ResourceDrawer';
import { QuickStaffingModal } from '../components/QuickStaffingModal';
import { JalonsManagerModal } from '../components/JalonsManagerModal';
import { NoteArbitrageModal } from '../components/NoteArbitrageModal';
import { RapportArbitrageModal } from '../components/RapportArbitrageModal';
import { Project360Tooltip, IStaffedResourceSummary } from '../components/Project360Tooltip';
import { WorkspaceManager } from '../components/WorkspaceManager';
import { GanttDependencyLinks } from '../components/GanttDependencyLinks';
import { IRessource, IJalon, IRapprochementProjetItem, IPlanningRessourceItem } from '../types';

interface ProjectShiftMap {
  [projetId: string]: number; // Nombre de mois de décalage (+1, -1, +2, etc.)
}

interface VentilationItem {
  mois: number;
  joursInternes: number;
  joursExternes: number;
  noteArbitrage?: string;
}

interface ProjectVentilationMap {
  [projetId: string]: VentilationItem[]; // 12 mois de ventilation
}

interface CapaciteMensuelleData {
  annee: number;
  mois: number;
  nomMois: string;
  joursOuvres: number;
  interne: { capaciteNette: number; etp: number };
  externe: { capaciteNette: number; etp: number };
  global: { capaciteNette: number; etp: number };
}

interface ISimulationDraft {
  _id: string;
  nom: string;
  description?: string;
  annee: number;
  auteur: string;
  dateCreation: string;
  dateModification: string;
  shiftsMap: ProjectShiftMap;
}

const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const NOMS_MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const COLORS_STACK: { [key: string]: string } = {
  RUN: '#0284c7',   // Sky
  P0: '#ef4444',    // Red
  P1: '#f97316',    // Orange
  P2: '#eab308',    // Amber
  P3: '#3b82f6',    // Blue
  P4: '#8b5cf6',    // Purple
  Autres: '#64748b' // Slate/Gray
};

export const TimelinePage: React.FC = () => {
  const { role, leadBARessource } = useAuth();
  const { showSuccess, showDanger, showInfo } = useToast();
  const isReadOnly = role === 'Lecteur';
  const isLeadBA = role === 'LeadBA';
  const isAdmin = role === 'Admin';

  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [population, setPopulation] = useState<'global' | 'interne' | 'externe'>('global');

  const [projets, setProjets] = useState<IProjet[]>([]);
  const [realVentilations, setRealVentilations] = useState<ProjectVentilationMap>({});
  const [capaciteMensuelle, setCapaciteMensuelle] = useState<CapaciteMensuelleData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // État de simulation What-If
  const [shiftsMap, setShiftsMap] = useState<ProjectShiftMap>({});
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftNom, setActiveDraftNom] = useState<string>('');
  const [applyingSimulation, setApplyingSimulation] = useState<boolean>(false);

  // Drafts sauvegardés
  const [savedDrafts, setSavedDrafts] = useState<ISimulationDraft[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [draftNom, setDraftNom] = useState<string>('');
  const [draftDesc, setDraftDesc] = useState<string>('');

  // Mode Comparateur Côte à Côte de 2 Scénarios
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [compareScenarioA, setCompareScenarioA] = useState<string>('real'); // 'real' ou draft ID ou 'current'
  const [compareScenarioB, setCompareScenarioB] = useState<string>('current'); // 'current' ou draft ID

  // Mode de Vue (Style Visual Planning : Portefeuille Projets vs Planning Ressources)
  const [viewMode, setViewMode] = useState<'projets' | 'ressources'>('projets');

  // Filtres
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('Tous');
  const [filterDependances, setFilterDependances] = useState<boolean>(false);
  const [showDependencyLinks, setShowDependencyLinks] = useState<boolean>(true);
  const [dependencyLinkFilter, setDependencyLinkFilter] = useState<'all' | 'conflicts_only' | 'focused_only'>('all');
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'domaine' | 'leadBA' | 'priorite' | 'type'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Références DOM pour le calque SVG des flèches de dépendance
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const ganttTableRef = React.useRef<HTMLTableElement>(null);
  const [, setRepaintCount] = useState(0); // Force le recalcul des coordonnées lors du défilement/redimensionnement

  // Ressources pour le Staffing Nominatif (Style Visual Planning)
  const [toutesRessources, setToutesRessources] = useState<IRessource[]>([]);
  const [planningRessourcesMap, setPlanningRessourcesMap] = useState<{ [ressourceId: string]: IPlanningRessourceItem }>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [draggedResource, setDraggedResource] = useState<IRessource | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null); // `${projetId}_${mois}`

  // État du modal d'affectation rapide
  const [quickStaffingTarget, setQuickStaffingTarget] = useState<{
    ressource: IRessource;
    projet: IProjet;
    mois: number;
    joursExistants: number;
  } | null>(null);

  // État du modal de gestion des jalons (Milestones Visual Planning)
  const [selectedProjectForJalons, setSelectedProjectForJalons] = useState<IProjet | null>(null);

  // État de la Fiche 360° Synthétique au survol (Tooltips enrichis Visual Planning)
  const [rapprochementMap, setRapprochementMap] = useState<{ [projetId: string]: IRapprochementProjetItem }>({});
  const [projectStaffedMap, setProjectStaffedMap] = useState<{ [projetId: string]: IStaffedResourceSummary[] }>({});
  const [hoveredProject360, setHoveredProject360] = useState<{
    projet: IProjet;
    position: { x: number; y: number };
  } | null>(null);
  const hoverTimeoutRef = React.useRef<any>(null);

  // État du modal de note d'arbitrage contextuelle (Axe 4)
  const [noteArbitrageTarget, setNoteArbitrageTarget] = useState<{
    projet: IProjet;
    mois: number;
    existingNote: string;
    canEdit: boolean;
  } | null>(null);

  // État du Rapport / Synthèse des Notes d'Arbitrage (Export COPROJ / COPIL)
  const [isRapportArbitrageOpen, setIsRapportArbitrageOpen] = useState<boolean>(false);
  const [filterNotesArbitrage, setFilterNotesArbitrage] = useState<'tous' | 'notes_actives' | 'notes_trimestre'>('tous');

  const handleOpenNoteArbitrage = (projet: IProjet, mois: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const projectVentMap = realVentilations[projet._id] || [];
    const vent = projectVentMap.find((v) => v.mois === mois);
    setNoteArbitrageTarget({
      projet,
      mois,
      existingNote: vent?.noteArbitrage || '',
      canEdit: canUserShiftProject(projet)
    });
  };

  const handleSaveNoteArbitrage = async (newNote: string) => {
    if (!noteArbitrageTarget) return;
    const { projet, mois } = noteArbitrageTarget;

    try {
      // 1. Récupérer toute la ventilation actuelle du projet
      const res = await fetch(`/api/projets/${projet._id}/ventilation?annee=${annee}`);
      const ventilations = await res.json();
      if (!Array.isArray(ventilations)) {
        throw new Error('Impossible de charger la ventilation.');
      }

      // 2. Mettre à jour la note sur le mois cible
      const updatedItems = ventilations.map((v: any) => ({
        mois: v.mois,
        joursInternes: v.joursInternes,
        joursExternes: v.joursExternes,
        affectations: v.affectations || [],
        noteArbitrage: v.mois === mois ? newNote : (v.noteArbitrage || '')
      }));

      // 3. Sauvegarder via batch
      const saveRes = await fetch(`/api/projets/${projet._id}/ventilation/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role || 'Admin'
        },
        body: JSON.stringify({
          annee,
          items: updatedItems
        })
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || 'Erreur lors de la sauvegarde de la note');
      }

      showSuccess(newNote ? `Note d'arbitrage enregistrée sur "${projet.nom}".` : `Note d'arbitrage supprimée sur "${projet.nom}".`);
      setNoteArbitrageTarget(null);
      fetchTimelineData(annee);
    } catch (err: any) {
      showDanger(err.message || "Erreur lors de l'enregistrement de la note.");
    }
  };

  const handleProjectMouseEnter = (projet: IProjet, e: React.MouseEvent) => {
    if (draggedProjectId || draggedResource) return; // Ne pas afficher pendant les drag-and-drops
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredProject360({
        projet,
        position: { x: clientX, y: clientY }
      });
    }, 120);
  };

  const handleProjectMouseMove = (e: React.MouseEvent) => {
    if (hoveredProject360) {
      setHoveredProject360((prev) =>
        prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null
      );
    }
  };

  const handleProjectMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredProject360(null);
  };

  const handleSaveJalonsProjet = async (jalons: IJalon[]) => {
    if (!selectedProjectForJalons) return;
    try {
      const res = await fetch(`/api/projets/${selectedProjectForJalons._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role || 'Admin'
        },
        body: JSON.stringify({ jalons })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erreur lors de la mise à jour des jalons');
      }
      showSuccess(`Jalons mis à jour pour "${selectedProjectForJalons.nom}".`);
      fetchTimelineData(annee);
    } catch (err: any) {
      showDanger(err.message || 'Erreur lors de la sauvegarde des jalons.');
    }
  };

  // Chargement des données réelles
  const fetchTimelineData = (targetAnnee: number) => {
    setLoading(true);
    Promise.all([
      fetch('/api/projets').then((r) => r.json()),
      fetch(`/api/projets/matrice-ventilation?annee=${targetAnnee}`).then((r) => r.json()),
      fetch(`/api/simulations?annee=${targetAnnee}`).then((r) => r.json()),
      fetch('/api/ressources').then((r) => r.json()),
      fetch(`/api/projets/rapprochement-tempo?annee=${targetAnnee}`).then((r) => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/ressources/planning/matrice?annee=${targetAnnee}`).then((r) => r.json()).catch(() => ({ ressources: [] }))
    ])
      .then(([projetsData, matriceRes, draftsData, ressourcesData, rapprochementRes, planningRes]) => {
        setProjets(projetsData || []);
        setCapaciteMensuelle(matriceRes.capaciteMensuelle || []);
        setSavedDrafts(draftsData || []);
        setToutesRessources(ressourcesData || []);

        // Map planning ressources
        const planMap: { [ressourceId: string]: IPlanningRessourceItem } = {};
        if (planningRes && Array.isArray(planningRes.ressources)) {
          planningRes.ressources.forEach((item: IPlanningRessourceItem) => {
            if (item.ressource?._id) {
              planMap[item.ressource._id] = item;
            }
          });
        }
        setPlanningRessourcesMap(planMap);

        // Map Rapprochement Tempo
        const rapMap: { [projetId: string]: IRapprochementProjetItem } = {};
        if (rapprochementRes && Array.isArray(rapprochementRes.items)) {
          rapprochementRes.items.forEach((item: IRapprochementProjetItem) => {
            rapMap[item.projetId] = item;
          });
        }
        setRapprochementMap(rapMap);

        const ventMap: ProjectVentilationMap = {};
        const staffMap: { [projetId: string]: IStaffedResourceSummary[] } = {};

        if (matriceRes.matrice) {
          matriceRes.matrice.forEach((item: any) => {
            ventMap[item.projet._id] = item.moisDetails.map((md: any) => ({
              mois: md.mois,
              joursInternes: md.joursInternes,
              joursExternes: md.joursExternes,
              noteArbitrage: md.noteArbitrage || ''
            }));
            if (Array.isArray(item.staffedResources)) {
              staffMap[item.projet._id] = item.staffedResources;
            }
          });
        }
        setRealVentilations(ventMap);
        setProjectStaffedMap(staffMap);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement timeline:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTimelineData(annee);
  }, [annee]);

  // Déterminer si l'utilisateur peut éditer un projet
  const canUserShiftProject = (p: IProjet): boolean => {
    if (isReadOnly) return false;
    if (isAdmin) return true;
    if (isLeadBA && leadBARessource) {
      const leadId = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : p.leadBA;
      return leadId === leadBARessource._id;
    }
    return false;
  };

  // Granularité temporelle (semaine | mois | trimestre | semestre)
  const [vueGranularite, setVueGranularite] = useState<'semaine' | 'mois' | 'trimestre' | 'semestre'>('mois');
  const [moisFocusSemaine, setMoisFocusSemaine] = useState<number>(new Date().getMonth() + 1);

  // Drag and Drop State
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverMois, setDragOverMois] = useState<number | null>(null);

  // Configuration des périodes d'affichage
  const periodes = React.useMemo(() => {
    if (vueGranularite === 'semaine') {
      const nomMoisCourt = NOMS_MOIS_COURTS[moisFocusSemaine - 1];

      // Helper standard ISO 8601 pour calculer le numéro de semaine annuel
      const getISOWeekNumber = (date: Date): number => {
        const target = new Date(date.valueOf());
        const dayNr = (date.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6
        target.setDate(target.getDate() - dayNr + 3); // Jeudi de la semaine
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
          target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      };

      // Calcul des vraies semaines ISO du mois (du 1er au dernier jour du mois)
      const daysInMonth = new Date(annee, moisFocusSemaine, 0).getDate();
      const weekGroups: { [weekNum: number]: { weekNum: number; days: number[] } } = {};
      const orderedWeekNums: number[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const curDate = new Date(annee, moisFocusSemaine - 1, day);
        const wNum = getISOWeekNumber(curDate);
        if (!weekGroups[wNum]) {
          weekGroups[wNum] = { weekNum: wNum, days: [] };
          orderedWeekNums.push(wNum);
        }
        weekGroups[wNum].days.push(day);
      }

      const totalWeeks = orderedWeekNums.length;

      return orderedWeekNums.map((wNum, idx) => {
        const group = weekGroups[wNum];
        const startDay = group.days[0];
        const endDay = group.days[group.days.length - 1];

        return {
          key: `W_${moisFocusSemaine}_${wNum}_${idx}`,
          label: `S${wNum} (${startDay}-${endDay} ${nomMoisCourt})`,
          moisList: [moisFocusSemaine],
          isWeek: true,
          weekFraction: group.days.length / daysInMonth,
          weekNum: wNum,
          startDay,
          endDay
        };
      });
    }
    if (vueGranularite === 'trimestre') {
      return [
        { key: 'Q1', label: 'Q1 (Jan-Mar)', moisList: [1, 2, 3] },
        { key: 'Q2', label: 'Q2 (Avr-Juin)', moisList: [4, 5, 6] },
        { key: 'Q3', label: 'Q3 (Juil-Sep)', moisList: [7, 8, 9] },
        { key: 'Q4', label: 'Q4 (Oct-Déc)', moisList: [10, 11, 12] }
      ];
    }
    if (vueGranularite === 'semestre') {
      return [
        { key: 'S1', label: 'S1 (Jan-Juin)', moisList: [1, 2, 3, 4, 5, 6] },
        { key: 'S2', label: 'S2 (Juil-Déc)', moisList: [7, 8, 9, 10, 11, 12] }
      ];
    }
    return NOMS_MOIS_COURTS.map((m, i) => ({
      key: `M${i + 1}`,
      label: m,
      moisList: [i + 1]
    }));
  }, [vueGranularite, annee, moisFocusSemaine]);

  // Shift project
  const handleShiftProject = (projetId: string, deltaMonths: number) => {
    setShiftsMap((prev) => {
      const currentShift = prev[projetId] || 0;
      const nextShift = currentShift + deltaMonths;
      const updated = { ...prev };
      if (nextShift === 0) {
        delete updated[projetId];
      } else {
        updated[projetId] = nextShift;
      }
      return updated;
    });
  };

  // Drag & drop start month
  const handleSetProjectStartMonth = (projetId: string, targetMois: number) => {
    const origVent = realVentilations[projetId] || [];
    const firstActiveMoisItem = origVent.find((v) => (v.joursInternes + v.joursExternes) > 0);
    if (!firstActiveMoisItem) return;

    const currentFirstMois = firstActiveMoisItem.mois;
    const deltaMonths = targetMois - currentFirstMois;

    setShiftsMap((prev) => {
      const updated = { ...prev };
      if (deltaMonths === 0) {
        delete updated[projetId];
      } else {
        updated[projetId] = deltaMonths;
      }
      return updated;
    });
  };

  // Traitement du drop d'une ressource sur un projet et un mois
  const handleResourceDropOnProjectMonth = async (ressource: IRessource, projet: IProjet, mois: number) => {
    // Vérifier les droits
    if (!canUserShiftProject(projet)) {
      showDanger(`Vous n'avez pas les droits pour modifier le staffing du projet "${projet.nom}".`);
      return;
    }

    try {
      // Récupérer la ventilation existante pour trouver les jours déjà affectés s'il y en a
      const res = await fetch(`/api/projets/${projet._id}/ventilation?annee=${annee}`);
      const ventilations = await res.json();
      const currentMonthVent = Array.isArray(ventilations) ? ventilations.find((v: any) => v.mois === mois) : null;
      const currentAffs = currentMonthVent?.affectations || [];
      const existingAff = currentAffs.find((a: any) => a.ressourceId === ressource._id);

      setQuickStaffingTarget({
        ressource,
        projet,
        mois,
        joursExistants: existingAff ? existingAff.jours : 0
      });
    } catch (err: any) {
      setQuickStaffingTarget({
        ressource,
        projet,
        mois,
        joursExistants: 0
      });
    }
  };

  const handleConfirmQuickStaffing = async (jours: number) => {
    if (!quickStaffingTarget) return;
    const { ressource, projet, mois } = quickStaffingTarget;

    try {
      // 1. Récupérer toute la ventilation actuelle du projet
      const res = await fetch(`/api/projets/${projet._id}/ventilation?annee=${annee}`);
      const ventilations = await res.json();
      if (!Array.isArray(ventilations)) {
        throw new Error('Impossible de charger la ventilation.');
      }

      // 2. Mettre à jour l'élément du mois ciblé
      const updatedItems = ventilations.map((v: any) => {
        if (v.mois !== mois) {
          return {
            mois: v.mois,
            joursInternes: v.joursInternes,
            joursExternes: v.joursExternes,
            affectations: v.affectations || []
          };
        }

        const affs: any[] = [...(v.affectations || [])];
        const existingIdx = affs.findIndex((a) => a.ressourceId === ressource._id);

        if (jours <= 0) {
          if (existingIdx !== -1) affs.splice(existingIdx, 1);
        } else {
          const newAffItem = {
            ressourceId: ressource._id,
            matricule: ressource.matricule,
            nom: ressource.nom,
            type: ressource.type,
            jours
          };
          if (existingIdx !== -1) {
            affs[existingIdx] = newAffItem;
          } else {
            affs.push(newAffItem);
          }
        }

        // Calcul de la charge macro minimale si inférieure à la somme affectée
        const sumInt = affs.filter((a) => a.type === 'Interne').reduce((s, a) => s + (a.jours || 0), 0);
        const sumExt = affs.filter((a) => a.type === 'Externe').reduce((s, a) => s + (a.jours || 0), 0);

        return {
          mois: v.mois,
          joursInternes: Math.max(v.joursInternes, sumInt),
          joursExternes: Math.max(v.joursExternes, sumExt),
          affectations: affs
        };
      });

      // 3. Sauvegarder via l'endpoint batch
      const saveRes = await fetch(`/api/projets/${projet._id}/ventilation/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role || 'Admin'
        },
        body: JSON.stringify({
          annee,
          items: updatedItems
        })
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        throw new Error(errData.error || 'Erreur lors de la sauvegarde');
      }

      showSuccess(`Affectation de ${ressource.nom} (${jours}j) enregistrée sur "${projet.nom}" !`);
      setQuickStaffingTarget(null);
      // Rafraîchir les données de la timeline
      fetchTimelineData(annee);
    } catch (err: any) {
      console.error('Erreur staffing rapide:', err);
      showDanger(err.message || "Erreur lors de l'enregistrement de l'affectation.");
    }
  };

  // Cancel simulation
  const handleCancelSimulation = () => {
    setShiftsMap({});
    setActiveDraftId(null);
    setActiveDraftNom('');
    showInfo('Simulation réinitialisée. Retour aux données réelles.');
  };

  // Apply simulation to database
  const handleApplySimulation = async () => {
    const shiftProjectIds = Object.keys(shiftsMap);
    if (shiftProjectIds.length === 0) return;

    if (!window.confirm('Voulez-vous vraiment enregistrer en base de données ces décalages de projets ?')) {
      return;
    }

    setApplyingSimulation(true);
    try {
      for (const pid of shiftProjectIds) {
        const shift = shiftsMap[pid];
        const origVent = realVentilations[pid] || [];

        const newItems = Array.from({ length: 12 }, (_, i) => ({
          mois: i + 1,
          joursInternes: 0,
          joursExternes: 0
        }));

        origVent.forEach((item) => {
          const newMois = item.mois + shift;
          if (newMois >= 1 && newMois <= 12) {
            newItems[newMois - 1].joursInternes = item.joursInternes;
            newItems[newMois - 1].joursExternes = item.joursExternes;
          }
        });

        await fetch(`/api/projets/${pid}/ventilation/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': role === 'Admin' ? 'Administrateur / Manager' : 'Lead BA'
          },
          body: JSON.stringify({
            annee,
            items: newItems
          })
        });
      }

      setApplyingSimulation(false);
      showSuccess('Simulation appliquée et enregistrée en base avec succès !');
      setShiftsMap({});
      setActiveDraftId(null);
      setActiveDraftNom('');
      fetchTimelineData(annee);
    } catch (err) {
      console.error(err);
      showDanger('Erreur lors de la sauvegarde de la simulation.');
      setApplyingSimulation(false);
    }
  };

  // Save current simulation as draft
  const handleSaveDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftNom.trim()) return;

    try {
      const payload = {
        nom: draftNom.trim(),
        description: draftDesc.trim(),
        annee,
        shiftsMap,
        auteur: role === 'Admin' ? 'Administrateur / Manager' : 'Lead BA'
      };

      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdDraft = await res.json();
        showSuccess(`Scénario brouillon "${createdDraft.nom}" sauvegardé !`);
        setActiveDraftId(createdDraft._id);
        setActiveDraftNom(createdDraft.nom);
        setShowSaveModal(false);
        setDraftNom('');
        setDraftDesc('');
        fetchTimelineData(annee);
      }
    } catch (err) {
      console.error(err);
      showDanger('Erreur lors de la sauvegarde du brouillon.');
    }
  };

  // Load a saved draft into frontend simulation
  const handleLoadDraft = (draft: ISimulationDraft) => {
    setShiftsMap(draft.shiftsMap || {});
    setActiveDraftId(draft._id);
    setActiveDraftNom(draft.nom);
    showSuccess(`Scénario brouillon "${draft.nom}" chargé en mémoire !`);
  };

  // Delete a saved draft
  const handleDeleteDraft = async (draftId: string, nom: string) => {
    if (!window.confirm(`Supprimer le scénario brouillon "${nom}" ?`)) return;
    try {
      const res = await fetch(`/api/simulations/${draftId}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeDraftId === draftId) {
          setActiveDraftId(null);
          setActiveDraftNom('');
        }
        showSuccess(`Scénario "${nom}" supprimé.`);
        fetchTimelineData(annee);
      }
    } catch (err) {
      console.error(err);
      showDanger('Erreur lors de la suppression.');
    }
  };

  const isSimulationActive = Object.keys(shiftsMap).length > 0;

  // Calculer en direct la ventilation SIMULÉE pour des shifts donnés
  const computeSimulatedVentilationsForShifts = (targetShifts: ProjectShiftMap): ProjectVentilationMap => {
    const simulatedMap: ProjectVentilationMap = {};
    projets.forEach((p) => {
      const pid = p._id;
      const shift = targetShifts[pid] || 0;
      const origVent = realVentilations[pid] || [];

      if (shift === 0) {
        simulatedMap[pid] = origVent;
      } else {
        const newItems = Array.from({ length: 12 }, (_, i) => ({
          mois: i + 1,
          joursInternes: 0,
          joursExternes: 0
        }));

        origVent.forEach((item) => {
          const newMois = item.mois + shift;
          if (newMois >= 1 && newMois <= 12) {
            newItems[newMois - 1].joursInternes = item.joursInternes;
            newItems[newMois - 1].joursExternes = item.joursExternes;
          }
        });
        simulatedMap[pid] = newItems;
      }
    });
    return simulatedMap;
  };

  const simulatedVentilations = computeSimulatedVentilationsForShifts(shiftsMap);

  // Helper pour calculer les données mensuelles pour un scénario donné (pour jauges + histogrammes)
  const computeMoisDataForShifts = (targetShifts: ProjectShiftMap) => {
    const ventMap = computeSimulatedVentilationsForShifts(targetShifts);

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const capM = capaciteMensuelle.find((c) => c.mois === m) || {
        interne: { capaciteNette: 0, etp: 0 },
        externe: { capaciteNette: 0, etp: 0 },
        global: { capaciteNette: 0, etp: 0 }
      };

      const charges = {
        interne: { RUN: 0, P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, Autres: 0, total: 0 },
        externe: { RUN: 0, P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, Autres: 0, total: 0 },
        global: { RUN: 0, P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, Autres: 0, total: 0 }
      };

      projets.forEach((p) => {
        const vent = ventMap[p._id]?.find((v) => v.mois === m) || { joursInternes: 0, joursExternes: 0 };
        const ji = vent.joursInternes;
        const je = vent.joursExternes;
        const jt = ji + je;

        if (jt === 0) return;

        let category: 'RUN' | 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'Autres' = 'Autres';
        if (p.type === 'RUN') category = 'RUN';
        else if (p.priorite && ['P0', 'P1', 'P2', 'P3', 'P4'].includes(p.priorite)) category = p.priorite as any;
        else category = 'Autres';

        charges.interne[category] += ji;
        charges.interne.total += ji;

        charges.externe[category] += je;
        charges.externe.total += je;

        charges.global[category] += jt;
        charges.global.total += jt;
      });

      const capNette = capM[population].capaciteNette;
      const totalCharge = Number(charges[population].total.toFixed(1));
      const tauxOccupation = capNette > 0 ? Number(((totalCharge / capNette) * 100).toFixed(1)) : 0;

      return {
        mois: m,
        nomMois: NOMS_MOIS_COURTS[i],
        capaciteNette: capNette,
        totalCharge,
        tauxOccupation,
        RUN: Number(charges[population].RUN.toFixed(1)),
        P0: Number(charges[population].P0.toFixed(1)),
        P1: Number(charges[population].P1.toFixed(1)),
        P2: Number(charges[population].P2.toFixed(1)),
        P3: Number(charges[population].P3.toFixed(1)),
        P4: Number(charges[population].P4.toFixed(1)),
        Autres: Number(charges[population].Autres.toFixed(1))
      };
    });
  };

  const simulatedMoisData = computeMoisDataForShifts(shiftsMap);

  // Helper pour trouver les shifts d'un identifiant de scénario ('real' vs 'current' vs draftId)
  const getShiftsForScenarioKey = (key: string): ProjectShiftMap => {
    if (key === 'real') return {};
    if (key === 'current') return shiftsMap;
    const draft = savedDrafts.find((d) => d._id === key);
    return draft?.shiftsMap || {};
  };

  const scenarioAMoisData = computeMoisDataForShifts(getShiftsForScenarioKey(compareScenarioA));
  const scenarioBMoisData = computeMoisDataForShifts(getShiftsForScenarioKey(compareScenarioB));

  // Helper badge gauge
  const getGaugeBadgeClass = (taux: number) => {
    if (taux < 90) return 'badge-success';
    if (taux <= 100) return 'badge-warning';
    return 'badge-danger';
  };

  // Filtered projects
  const filteredProjets = projets.filter((p) => {
    const matchesSearch =
      p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codeProjet && p.codeProjet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (typeof p.leadBA === 'object' && p.leadBA?.nom.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.epicDomaine && p.epicDomaine.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === 'Tous' || p.type === filterType;

    // Filtre notes d'arbitrage
    let matchesArbitrage = true;
    if (filterNotesArbitrage !== 'tous') {
      const vList = realVentilations[p._id] || [];
      const currentMonthIndex = new Date().getMonth() + 1;
      const currentQuarter = Math.ceil(currentMonthIndex / 3);

      if (filterNotesArbitrage === 'notes_actives') {
        matchesArbitrage = vList.some((v) => (v.noteArbitrage || '').trim().length > 0);
      } else if (filterNotesArbitrage === 'notes_trimestre') {
        const monthsInQuarter = [
          (currentQuarter - 1) * 3 + 1,
          (currentQuarter - 1) * 3 + 2,
          (currentQuarter - 1) * 3 + 3
        ];
        matchesArbitrage = vList.some(
          (v) => monthsInQuarter.includes(v.mois) && (v.noteArbitrage || '').trim().length > 0
        );
      }
    }

    // Filtre Projets avec dépendances déclarées
    const matchesDependances = !filterDependances || (p.dependances && p.dependances.length > 0);

    return matchesSearch && matchesType && matchesArbitrage && matchesDependances;
  });

  // Regroupement hiérarchique Visual Planning (P2)
  interface ProjectGroupItem {
    id: string;
    label: string;
    projets: IProjet[];
  }

  const groupedProjets: ProjectGroupItem[] = React.useMemo(() => {
    if (groupBy === 'none') {
      return [{ id: 'all', label: 'Tous les projets', projets: filteredProjets }];
    }

    const map = new Map<string, IProjet[]>();
    filteredProjets.forEach((p) => {
      let groupKey = 'Non renseigné';
      if (groupBy === 'domaine') {
        groupKey = p.epicDomaine && p.epicDomaine.trim() ? p.epicDomaine.trim() : 'Sans Domaine';
      } else if (groupBy === 'leadBA') {
        groupKey = typeof p.leadBA === 'object' && p.leadBA?.nom ? p.leadBA.nom : 'Sans Lead BA';
      } else if (groupBy === 'priorite') {
        groupKey = p.priorite ? `Priorité ${p.priorite}` : 'Non priorisé';
      } else if (groupBy === 'type') {
        groupKey = p.type || 'Sans type';
      }

      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(p);
    });

    return Array.from(map.entries())
      .map(([label, list]) => ({
        id: `grp_${label.toLowerCase().replace(/\s+/g, '_')}`,
        label,
        projets: list
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredProjets, groupBy]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(groupedProjets.map((g) => g.id)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  // Calcul en direct des conflits de dépendances dans la simulation active
  const dependencyConflicts = React.useMemo(() => {
    // Calculer pour chaque projet sa plage active (premier et dernier mois avec charge > 0)
    const plages: Record<string, { minMois: number; maxMois: number }> = {};
    projets.forEach((p) => {
      const vent = simulatedVentilations[p._id] || [];
      vent.forEach((v) => {
        const total = (v.joursInternes || 0) + (v.joursExternes || 0);
        if (total > 0) {
          if (!plages[p._id]) {
            plages[p._id] = { minMois: v.mois, maxMois: v.mois };
          } else {
            plages[p._id].minMois = Math.min(plages[p._id].minMois, v.mois);
            plages[p._id].maxMois = Math.max(plages[p._id].maxMois, v.mois);
          }
        }
      });
    });

    const conflits: Array<{
      successeur: IProjet;
      prerequis: IProjet;
      moisSuccesseur: number;
      moisPrerequis: number;
      deltaSuggere: number;
      type: 'CRITIQUE' | 'TENSION';
    }> = [];

    const projetsMap = new Map(projets.map((p) => [p._id, p]));

    projets.forEach((p) => {
      if (p.dependances && p.dependances.length > 0) {
        const plageSucc = plages[p._id];
        if (!plageSucc) return;

        p.dependances.forEach((dep) => {
          const prereq = projetsMap.get(dep.projetId);
          if (!prereq) return;

          const plagePre = plages[prereq._id];
          if (!plagePre) return;

          if (plageSucc.minMois < plagePre.maxMois) {
            conflits.push({
              successeur: p,
              prerequis: prereq,
              moisSuccesseur: plageSucc.minMois,
              moisPrerequis: plagePre.maxMois,
              deltaSuggere: plagePre.maxMois + 1 - plageSucc.minMois,
              type: 'CRITIQUE'
            });
          } else if (plageSucc.minMois === plagePre.maxMois) {
            conflits.push({
              successeur: p,
              prerequis: prereq,
              moisSuccesseur: plageSucc.minMois,
              moisPrerequis: plagePre.maxMois,
              deltaSuggere: 1,
              type: 'TENSION'
            });
          }
        });
      }
    });

    return conflits;
  }, [projets, simulatedVentilations]);

  // Fonction de décalage en cascade automatique des successeurs en conflit
  const handleAutoCascadeShift = () => {
    if (dependencyConflicts.length === 0) return;
    setShiftsMap((prev) => {
      const next = { ...prev };
      dependencyConflicts.forEach((c) => {
        const curShift = next[c.successeur._id] || 0;
        next[c.successeur._id] = curShift + c.deltaSuggere;
      });
      return next;
    });
    showSuccess(`Décalage en cascade appliqué sur ${dependencyConflicts.length} projet(s) successeur(s).`);
  };

  return (
    <div style={{ width: '100%' }}>
      
      {/* BANDEAU MODE SIMULATION WHAT-IF & BROUILLON */}
      {isSimulationActive && (
        <div
          style={{
            background: 'linear-gradient(90deg, #b45309 0%, #d97706 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            boxShadow: '0 4px 16px rgba(217, 119, 6, 0.35)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap size={24} style={{ color: '#fef08a' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ MODE SIMULATION WHAT-IF ACTIF
                {activeDraftNom && (
                  <span className="badge badge-purple" style={{ background: 'rgba(0,0,0,0.3)', color: '#e9d5ff', borderColor: '#c084fc' }}>
                    📂 Brouillon: "{activeDraftNom}"
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.95, marginTop: '2px' }}>
                {Object.keys(shiftsMap).length} projet(s) décalé(s) en mémoire frontend. L'impact est calculé en direct sur les jauges et le graphique.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{ background: 'rgba(0, 0, 0, 0.3)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.4)', fontSize: '0.85rem' }}
              onClick={() => setShowSaveModal(true)}
            >
              <Save size={15} /> Sauvegarder Brouillon
            </button>

            <button
              className="btn"
              style={{ background: 'rgba(0, 0, 0, 0.25)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.3)', fontSize: '0.85rem' }}
              onClick={handleCancelSimulation}
              disabled={applyingSimulation}
            >
              <XCircle size={15} /> Reinitialiser
            </button>

            {!isReadOnly && (
              <button
                className="btn"
                style={{ background: '#10b981', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}
                onClick={handleApplySimulation}
                disabled={applyingSimulation}
              >
                <CheckCircle2 size={15} /> {applyingSimulation ? 'Enregistrement...' : 'Appliquer & Enregistrer en base'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* BANDEAU D'ALERTE DE CONFLITS DE DÉPENDANCE (Temps Réel) */}
      {dependencyConflicts.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, #881337 0%, #be123c 100%)',
            color: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            boxShadow: '0 4px 16px rgba(190, 18, 60, 0.35)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link2 size={22} style={{ color: '#fda4af' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ {dependencyConflicts.length} conflit(s) / tension(s) de dépendance détecté(s)
              </div>
              <div style={{ fontSize: '0.82rem', opacity: 0.95, marginTop: '2px' }}>
                {dependencyConflicts.map((c, i) => (
                  <span key={i} style={{ marginRight: '10px' }}>
                    • <strong>{c.successeur.nom}</strong> démarre en M{c.moisSuccesseur} avant la fin de <strong>{c.prerequis.nom}</strong> (M{c.moisPrerequis})
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={handleAutoCascadeShift}
            title="Décale automatiquement les projets successeurs pour résoudre les conflits chronologiques"
          >
            <Zap size={14} style={{ color: '#fef08a' }} />
            Décaler en cascade (+{dependencyConflicts[0]?.deltaSuggere}m suggéré)
          </button>
        </div>
      )}

      {/* En-tête de la page */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarDays style={{ color: 'var(--primary)' }} size={28} /> Timeline Capacitive & Multi-Scénarios What-If
          </h1>
          <p className="page-subtitle">
            Visualisez le Gantt des projets, simulez des décalages, sauvegardez vos brouillons de réarbitrage et comparez 2 scénarios côte à côte.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* SÉLECTEUR DE PERSPECTIVE STYLE VISUAL PLANNING */}
          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              className={`btn ${viewMode === 'projets' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setViewMode('projets')}
            >
              <CalendarDays size={16} /> Vue Portefeuille Projets
            </button>
            <button
              className={`btn ${viewMode === 'ressources' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setViewMode('ressources')}
            >
              <Users size={16} /> 👤 Vue Planning Ressources
            </button>
          </div>

          {/* Bouton Palette Ressources (Staffing Drag-and-Drop) */}
          <button
            className={`btn ${isDrawerOpen ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px', borderColor: isDrawerOpen ? 'var(--primary)' : 'rgba(6, 182, 212, 0.4)' }}
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            title="Ouvrir la palette latérale pour glisser-déposer des collaborateurs sur les projets"
          >
            <UserPlus size={16} style={{ color: isDrawerOpen ? '#ffffff' : 'var(--primary)' }} />
            {isDrawerOpen ? 'Fermer Staffing' : '👤 Palette Staffing'}
          </button>

          {/* Mode Comparateur Toggle */}
          <button
            className={`btn ${isCompareMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
            onClick={() => setIsCompareMode(!isCompareMode)}
          >
            <GitCompare size={16} /> {isCompareMode ? 'Fermer le Comparateur' : '📊 Comparer 2 Scénarios'}
          </button>

          {/* Bouton Synthèse des Arbitrages & Export COPROJ/COPIL */}
          <button
            className="btn btn-secondary"
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              gap: '6px',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#fbbf24'
            }}
            onClick={() => setIsRapportArbitrageOpen(true)}
            title="Ouvrir le rapport consolidé des notes d'arbitrage et exporter pour COPROJ / COPIL"
          >
            <FileText size={16} style={{ color: '#fbbf24' }} />
            📋 Synthèse des Arbitrages
          </button>

          {/* Selector Saved Drafts */}
          {savedDrafts.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select
                className="form-select"
                style={{ width: '220px', padding: '8px 12px', fontSize: '0.85rem', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                value={activeDraftId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleCancelSimulation();
                  } else {
                    const found = savedDrafts.find((d) => d._id === val);
                    if (found) handleLoadDraft(found);
                  }
                }}
              >
                <option value="">📂 Brouillons What-If ({savedDrafts.length})...</option>
                {savedDrafts.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.nom} ({Object.keys(d.shiftsMap || {}).length} proj.)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bascule Population */}
          {viewMode === 'projets' && (
            <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                className={`btn ${population === 'global' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem', border: 'none' }}
                onClick={() => setPopulation('global')}
              >
                Cumul Global
              </button>
              <button
                className={`btn ${population === 'interne' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem', border: 'none' }}
                onClick={() => setPopulation('interne')}
              >
                Internes
              </button>
              <button
                className={`btn ${population === 'externe' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem', border: 'none' }}
                onClick={() => setPopulation('externe')}
              >
                Externes
              </button>
            </div>
          )}

          {/* Sélecteur Année */}
          <select
            className="form-select"
            style={{ width: '90px', padding: '7px 10px', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027, 2028].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* MODE COMPARATEUR CÔTÉ À CÔTE DE 2 SCÉNARIOS */}
      {isCompareMode && (
        <div className="card card-neon-purple" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GitCompare style={{ color: '#c084fc' }} size={22} />
              Comparateur Côte à Côte de 2 Scénarios What-If ({annee})
            </h2>

            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => setIsCompareMode(false)}>
              Fermer la vue comparative
            </button>
          </div>

          {/* Dual Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            
            {/* Scenario A Selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary)' }}>Scénario A (Gauche) :</label>
              <select
                className="form-select"
                value={compareScenarioA}
                onChange={(e) => setCompareScenarioA(e.target.value)}
                style={{ backgroundColor: 'rgba(11, 17, 32, 0.9)', borderColor: 'rgba(6, 182, 212, 0.4)', padding: '10px' }}
              >
                <option value="real">🟢 Scénario Réel (Baseline Actuelle)</option>
                <option value="current">⚡ Simulation Actuelle en Mémoire</option>
                {savedDrafts.map((d) => (
                  <option key={d._id} value={d._id}>📂 Brouillon: {d.nom}</option>
                ))}
              </select>
            </div>

            {/* Scenario B Selector */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, color: '#c084fc' }}>Scénario B (Droite) :</label>
              <select
                className="form-select"
                value={compareScenarioB}
                onChange={(e) => setCompareScenarioB(e.target.value)}
                style={{ backgroundColor: 'rgba(11, 17, 32, 0.9)', borderColor: 'rgba(168, 85, 247, 0.4)', padding: '10px' }}
              >
                <option value="current">⚡ Simulation Actuelle en Mémoire</option>
                <option value="real">🟢 Scénario Réel (Baseline Actuelle)</option>
                {savedDrafts.map((d) => (
                  <option key={d._id} value={d._id}>📂 Brouillon: {d.nom}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Dual Stacked Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Chart A */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '12px' }}>
                Scénario A : {compareScenarioA === 'real' ? 'Portefeuille Réel' : compareScenarioA === 'current' ? 'Simulation Frontend' : savedDrafts.find(d => d._id === compareScenarioA)?.nom}
              </div>
              <div style={{ width: '100%', height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioAMoisData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="nomMois" stroke="var(--text-muted)" fontSize={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} unit="j" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', borderRadius: '6px' }} />
                    <Bar dataKey="RUN" stackId="a" fill={COLORS_STACK.RUN} />
                    <Bar dataKey="P0" stackId="a" fill={COLORS_STACK.P0} />
                    <Bar dataKey="P1" stackId="a" fill={COLORS_STACK.P1} />
                    <Bar dataKey="P2" stackId="a" fill={COLORS_STACK.P2} />
                    <Bar dataKey="P3" stackId="a" fill={COLORS_STACK.P3} />
                    <Bar dataKey="P4" stackId="a" fill={COLORS_STACK.P4} />
                    <Bar dataKey="Autres" stackId="a" fill={COLORS_STACK.Autres} />
                    <ReferenceLine y={scenarioAMoisData[0]?.capaciteNette || 0} stroke="#10b981" strokeDasharray="4 4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart B */}
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c084fc', marginBottom: '12px' }}>
                Scénario B : {compareScenarioB === 'real' ? 'Portefeuille Réel' : compareScenarioB === 'current' ? 'Simulation Frontend' : savedDrafts.find(d => d._id === compareScenarioB)?.nom}
              </div>
              <div style={{ width: '100%', height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioBMoisData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="nomMois" stroke="var(--text-muted)" fontSize={10} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} unit="j" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', borderRadius: '6px' }} />
                    <Bar dataKey="RUN" stackId="b" fill={COLORS_STACK.RUN} />
                    <Bar dataKey="P0" stackId="b" fill={COLORS_STACK.P0} />
                    <Bar dataKey="P1" stackId="b" fill={COLORS_STACK.P1} />
                    <Bar dataKey="P2" stackId="b" fill={COLORS_STACK.P2} />
                    <Bar dataKey="P3" stackId="b" fill={COLORS_STACK.P3} />
                    <Bar dataKey="P4" stackId="b" fill={COLORS_STACK.P4} />
                    <Bar dataKey="Autres" stackId="b" fill={COLORS_STACK.Autres} />
                    <ReferenceLine y={scenarioBMoisData[0]?.capaciteNette || 0} stroke="#10b981" strokeDasharray="4 4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VUE 2 : PLANNING DES RESSOURCES (STYLE VISUAL PLANNING) */}
      {viewMode === 'ressources' && (
        <PlanningRessourcesGantt annee={annee} onSwitchToProjets={() => setViewMode('projets')} />
      )}

      {/* VUE 1 : PORTEFEUILLE PROJETS & SIMULATION WHAT-IF */}
      {viewMode === 'projets' && (
        <>
          {/* PANNEAU DE FEEDBACK IMPACT EN DIRECT (JAUGES + HISTOGRAMME SIMULÉ) */}
          {!isCompareMode && (
            <div className="card" style={{ marginBottom: '24px', background: isSimulationActive ? 'rgba(30, 41, 59, 0.7)' : undefined, border: isSimulationActive ? '1px solid #d97706' : undefined }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Gauge size={18} style={{ color: isSimulationActive ? '#fbbf24' : 'var(--primary)' }} />
                <span>Impact Capacitif en Direct {isSimulationActive ? '(Mode Simulée)' : '(Mode Réel)'}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Population : <strong>{population.toUpperCase()}</strong>
            </span>
          </div>

          {/* Jauges synthétiques 12 mois */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              marginBottom: '16px'
            }}
          >
            {simulatedMoisData.map((m) => (
              <div
                key={m.mois}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {m.nomMois}
                </div>
                <span className={`badge ${getGaugeBadgeClass(m.tauxOccupation)}`} style={{ fontSize: '0.85rem', fontWeight: 700, margin: '4px 0', fontFamily: 'var(--font-mono)' }}>
                  {m.tauxOccupation}%
                </span>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {m.totalCharge}j / {m.capaciteNette}j
                </div>
              </div>
            ))}
          </div>

          {/* Histogramme empilé réactif */}
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={simulatedMoisData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="nomMois" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} unit="j" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'var(--border-color)', borderRadius: '6px' }}
                  formatter={(val: any, name: any) => [`${val} j`, name]}
                />
                <Bar dataKey="RUN" stackId="a" fill={COLORS_STACK.RUN} name="RUN" />
                <Bar dataKey="P0" stackId="a" fill={COLORS_STACK.P0} name="P0" />
                <Bar dataKey="P1" stackId="a" fill={COLORS_STACK.P1} name="P1" />
                <Bar dataKey="P2" stackId="a" fill={COLORS_STACK.P2} name="P2" />
                <Bar dataKey="P3" stackId="a" fill={COLORS_STACK.P3} name="P3" />
                <Bar dataKey="P4" stackId="a" fill={COLORS_STACK.P4} name="P4" />
                <Bar dataKey="Autres" stackId="a" fill={COLORS_STACK.Autres} name="Autres" />
                <ReferenceLine y={simulatedMoisData[0]?.capaciteNette || 0} stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Capacité', fill: '#10b981', fontSize: 10, position: 'top' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* GRILLE GANTT CHRONOLOGIQUE PAR PROJET */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={18} style={{ color: 'var(--primary)' }} />
            <span>Vue Gantt des Projets ({filteredProjets.length} projets)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Selector Granularité Temporielle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 0, 0, 0.25)', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <button
                className={`btn ${vueGranularite === 'semaine' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '4px 8px', border: 'none' }}
                onClick={() => setVueGranularite('semaine')}
                title="Zoomer sur le découpage par semaine pour un mois charnière (M à M+2)"
              >
                🔍 Semaines
              </button>
              <button
                className={`btn ${vueGranularite === 'mois' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '4px 8px', border: 'none' }}
                onClick={() => setVueGranularite('mois')}
              >
                Mois (12)
              </button>
              <button
                className={`btn ${vueGranularite === 'trimestre' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '4px 8px', border: 'none' }}
                onClick={() => setVueGranularite('trimestre')}
              >
                Trimestres (Q1-Q4)
              </button>
              <button
                className={`btn ${vueGranularite === 'semestre' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '4px 8px', border: 'none' }}
                onClick={() => setVueGranularite('semestre')}
              >
                Semestres (S1-S2)
              </button>
            </div>

            {/* Sélecteur de mois focalisé lorsque la vue Semaine est active (Design Segmenté Épuré) */}
            {vueGranularite === 'semaine' && (() => {
              const currentMonthIndex = new Date().getMonth() + 1; // 1-12
              const nextMonthIndex = currentMonthIndex === 12 ? 1 : currentMonthIndex + 1;
              const isCurrentMonth = moisFocusSemaine === currentMonthIndex;
              const isNextMonth = moisFocusSemaine === nextMonthIndex;

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '3px 4px',
                    borderRadius: '8px',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    boxShadow: '0 2px 8px -1px rgba(6, 182, 212, 0.15)'
                  }}
                >
                  {/* Flèche Mois Précédent */}
                  <button
                    type="button"
                    onClick={() => setMoisFocusSemaine((prev) => (prev > 1 ? prev - 1 : 12))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      height: '24px'
                    }}
                    title="Mois précédent"
                  >
                    ◀
                  </button>

                  {/* Sélecteur Déroulant Stylisé du Mois */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={13} style={{ color: '#38bdf8', marginLeft: '2px' }} />
                    <select
                      value={moisFocusSemaine}
                      onChange={(e) => setMoisFocusSemaine(Number(e.target.value))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {NOMS_MOIS.map((nomMoisComplet, idx) => (
                        <option
                          key={idx + 1}
                          value={idx + 1}
                          style={{ background: '#0f172a', color: '#f8fafc' }}
                        >
                          {nomMoisComplet} {annee}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Flèche Mois Suivant */}
                  <button
                    type="button"
                    onClick={() => setMoisFocusSemaine((prev) => (prev < 12 ? prev + 1 : 1))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px',
                      height: '24px'
                    }}
                    title="Mois suivant"
                  >
                    ▶
                  </button>

                  <div style={{ width: '1px', height: '18px', background: 'rgba(148, 163, 184, 0.2)', margin: '0 4px' }} />

                  {/* Boutons d'arbitrage M (Mois en cours) et M+1 (Mois prochain) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <button
                      type="button"
                      onClick={() => setMoisFocusSemaine(currentMonthIndex)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.73rem',
                        fontWeight: isCurrentMonth ? 700 : 500,
                        borderRadius: '5px',
                        border: isCurrentMonth ? '1px solid #06b6d4' : '1px solid rgba(148, 163, 184, 0.15)',
                        background: isCurrentMonth ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        color: isCurrentMonth ? '#38bdf8' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Aller directement au mois en cours (${NOMS_MOIS[currentMonthIndex - 1]})`}
                    >
                      <span>⚡ M</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>({NOMS_MOIS_COURTS[currentMonthIndex - 1]})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMoisFocusSemaine(nextMonthIndex)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.73rem',
                        fontWeight: isNextMonth ? 700 : 500,
                        borderRadius: '5px',
                        border: isNextMonth ? '1px solid #06b6d4' : '1px solid rgba(148, 163, 184, 0.15)',
                        background: isNextMonth ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        color: isNextMonth ? '#38bdf8' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'all 0.15s ease'
                      }}
                      title={`Aller directement au mois prochain (${NOMS_MOIS[nextMonthIndex - 1]})`}
                    >
                      <span>M+1</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>({NOMS_MOIS_COURTS[nextMonthIndex - 1]})</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Vues & Filtres sauvegardés (Workspaces Style Visual Planning) */}
            <WorkspaceManager
              storageKey="timeline"
              currentFilters={{
                population,
                annee,
                vueGranularite,
                moisFocusSemaine,
                groupBy,
                filterType,
                filterNotesArbitrage,
                filterDependances,
                searchTerm,
                isCompact
              }}
              defaultFilters={{
                population: 'global',
                annee: new Date().getFullYear(),
                vueGranularite: 'mois',
                moisFocusSemaine: new Date().getMonth() + 1,
                groupBy: 'none',
                filterType: 'Tous',
                filterNotesArbitrage: 'tous',
                filterDependances: false,
                searchTerm: '',
                isCompact: false
              }}
              onApplyFilters={(f) => {
                if (f.population) setPopulation(f.population as 'global' | 'interne' | 'externe');
                if (f.annee) setAnnee(f.annee);
                if (f.vueGranularite) setVueGranularite(f.vueGranularite as 'semaine' | 'mois' | 'trimestre' | 'semestre');
                if (f.moisFocusSemaine) setMoisFocusSemaine(f.moisFocusSemaine);
                if (f.groupBy) setGroupBy(f.groupBy as 'none' | 'domaine' | 'leadBA' | 'priorite' | 'type');
                if (f.filterType) setFilterType(f.filterType);
                if (f.filterNotesArbitrage) setFilterNotesArbitrage(f.filterNotesArbitrage as 'tous' | 'notes_actives' | 'notes_trimestre');
                if (f.filterDependances !== undefined) setFilterDependances(f.filterDependances);
                if (f.searchTerm !== undefined) setSearchTerm(f.searchTerm);
                if (f.isCompact !== undefined) setIsCompact(f.isCompact);
              }}
              systemPresets={[
                {
                  id: 'sys_arbitrage',
                  name: 'Comitologie / Arbitrages COPROJ',
                  icon: '💬',
                  description: 'Projets avec notes de cadrage & arbitrages en cours',
                  filters: {
                    population: 'global',
                    annee,
                    vueGranularite: 'mois',
                    moisFocusSemaine: new Date().getMonth() + 1,
                    groupBy: 'priorite',
                    filterType: 'Tous',
                    filterNotesArbitrage: 'notes_actives',
                    filterDependances: false,
                    searchTerm: '',
                    isCompact: false
                  }
                },
                {
                  id: 'sys_chaines_critiques',
                  name: 'Chaînes Critiques (Dépendances)',
                  icon: '🔗',
                  description: 'Afficher uniquement les projets liés par des dépendances',
                  filters: {
                    population: 'global',
                    annee,
                    vueGranularite: 'mois',
                    moisFocusSemaine: new Date().getMonth() + 1,
                    groupBy: 'domaine',
                    filterType: 'Tous',
                    filterNotesArbitrage: 'tous',
                    filterDependances: true,
                    searchTerm: '',
                    isCompact: false
                  }
                },
                {
                  id: 'sys_vue_leadba',
                  name: 'Vue Lead BAs Référents',
                  icon: '👥',
                  description: 'Regroupement du portefeuille par Lead BA',
                  filters: {
                    population: 'global',
                    annee,
                    vueGranularite: 'mois',
                    moisFocusSemaine: new Date().getMonth() + 1,
                    groupBy: 'leadBA',
                    filterType: 'Tous',
                    filterNotesArbitrage: 'tous',
                    filterDependances: false,
                    searchTerm: '',
                    isCompact: false
                  }
                },
                {
                  id: 'sys_zoom_semaines',
                  name: 'Zoom Opérationnel Semaines',
                  icon: '🔍',
                  description: 'Focalisation détaillée par semaine sur le mois en cours',
                  filters: {
                    population: 'global',
                    annee,
                    vueGranularite: 'semaine',
                    moisFocusSemaine: new Date().getMonth() + 1,
                    groupBy: 'none',
                    filterType: 'Tous',
                    filterNotesArbitrage: 'tous',
                    filterDependances: false,
                    searchTerm: '',
                    isCompact: true
                  }
                }
              ]}
            />

            {/* Regroupement Hiérarchique (P2 - Visual Planning) */}
            <GroupByDropdown
              value={groupBy}
              onChange={(val) => {
                setGroupBy(val);
                if (val !== 'none') {
                  setExpandedGroups(new Set());
                }
              }}
              onExpandAll={expandAllGroups}
              onCollapseAll={collapseAllGroups}
            />

            {/* Filter Type */}
            <select
              className="form-select"
              style={{ width: '130px', padding: '4px 8px', fontSize: '0.8rem' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="Tous">Tous Types</option>
              <option value="RUN">RUN</option>
              <option value="Projet">Projet</option>
              <option value="Projet Opex">Projet Opex</option>
              <option value="Reco">Reco</option>
              <option value="Vie d'entreprise">Vie d'entreprise</option>
            </select>

            {/* Filtre Notes d'Arbitrage */}
            <select
              className="form-select"
              style={{
                width: '175px',
                padding: '4px 8px',
                fontSize: '0.8rem',
                borderColor: filterNotesArbitrage !== 'tous' ? '#f59e0b' : 'var(--border-color)',
                backgroundColor: filterNotesArbitrage !== 'tous' ? 'rgba(245, 158, 11, 0.15)' : undefined,
                color: filterNotesArbitrage !== 'tous' ? '#fbbf24' : 'var(--text-main)',
                fontWeight: filterNotesArbitrage !== 'tous' ? 600 : 400
              }}
              value={filterNotesArbitrage}
              onChange={(e) => setFilterNotesArbitrage(e.target.value as any)}
              title="Filtrer les projets par présence de notes d'arbitrage"
            >
              <option value="tous">💬 Arbitrages : Tous</option>
              <option value="notes_actives">💬 Avec notes (Année)</option>
              <option value="notes_trimestre">💬 Avec notes (Trimestre en cours)</option>
            </select>

            {/* Filtre Bouton Bascule Dépendances */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: filterDependances ? '#38bdf8' : 'var(--border-color)',
                backgroundColor: filterDependances ? 'rgba(56, 189, 248, 0.18)' : undefined,
                color: filterDependances ? '#38bdf8' : 'var(--text-muted)',
                fontWeight: filterDependances ? 700 : 500
              }}
              onClick={() => setFilterDependances(!filterDependances)}
              title="Filtrer la liste pour n'afficher que les projets ayant des dépendances"
            >
              <Link2 size={13} />
              <span>Filtre Dépendances</span>
            </button>

            {/* Tracé Graphique des Flèches SVG (P2 - Visual Planning) */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 9px',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderColor: showDependencyLinks ? '#06b6d4' : 'var(--border-color)',
                  backgroundColor: showDependencyLinks ? 'rgba(6, 182, 212, 0.16)' : undefined,
                  color: showDependencyLinks ? '#06b6d4' : 'var(--text-muted)',
                  fontWeight: showDependencyLinks ? 700 : 500
                }}
                onClick={() => setShowDependencyLinks(!showDependencyLinks)}
                title="Afficher/masquer les flèches graphiques de dépendances Fin ➔ Début sur la grille Gantt (Style Visual Planning)"
              >
                <Link2 size={13} style={{ transform: 'rotate(-45deg)' }} />
                <span>Flèches SVG</span>
              </button>

              {showDependencyLinks && (
                <select
                  className="form-select"
                  style={{
                    padding: '4px 6px',
                    fontSize: '0.75rem',
                    height: '28px',
                    borderColor: 'rgba(6, 182, 212, 0.35)',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    color: dependencyLinkFilter === 'conflicts_only' ? '#f43f5e' : '#38bdf8',
                    fontWeight: 600
                  }}
                  value={dependencyLinkFilter}
                  onChange={(e) => setDependencyLinkFilter(e.target.value as any)}
                  title="Mode d'affichage des flèches SVG"
                >
                  <option value="all">🔗 Tous les liens</option>
                  <option value="conflicts_only">🚨 Conflits seuls</option>
                  <option value="focused_only">🎯 Projet survolé</option>
                </select>
              )}
            </div>

            {/* Bouton Inversion Dimensionnelle (P4 - Visual Planning) */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderColor: 'rgba(6, 182, 212, 0.4)',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                color: '#38bdf8',
                fontWeight: 600
              }}
              onClick={() => setViewMode('ressources')}
              title="Pivoter instantanément vers le Gantt & Planning des Ressources"
            >
              <Users size={13} />
              <span>Vue Ressources</span>
            </button>

            {/* Search */}
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '30px', fontSize: '0.8rem', padding: '4px 8px 4px 30px' }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chargement du Gantt...</div>
        ) : (
          <div
            className="table-container"
            ref={tableContainerRef}
            onScroll={() => setRepaintCount((c) => c + 1)}
            style={{ position: 'relative' }}
          >
            {/* Calque SVG des Flèches de Dépendance (P2 - Style Visual Planning) */}
            <GanttDependencyLinks
              projets={filteredProjets}
              simulatedVentilations={simulatedVentilations}
              periodes={periodes}
              containerRef={tableContainerRef}
              tableRef={ganttTableRef}
              showLinks={showDependencyLinks}
              linkFilter={dependencyLinkFilter}
              focusedProjectId={focusedProjectId}
              onSelectProject={(pId) => {
                setFocusedProjectId(pId);
                const targetRow = tableContainerRef.current?.querySelector(`[data-cell-project="${pId}"]`);
                if (targetRow) {
                  targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }}
            />
            <table ref={ganttTableRef}>
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Projet</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Prio</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Décalage</th>
                  {periodes.map((p) => (
                    <th key={p.key} style={{ textAlign: 'center', minWidth: '70px' }}>
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjets.length === 0 ? (
                  <tr>
                    <td colSpan={3 + periodes.length} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      Aucun projet ne correspond aux critères.
                    </td>
                  </tr>
                ) : (
                  groupedProjets.map((group) => {
                    const isGroupExpanded = expandedGroups.has(group.id);
                    const showGroupHeader = groupBy !== 'none';

                    // Calcul de la synthèse enveloppe du groupe sur chaque période
                    const groupTotalsByPeriode = periodes.map((pPeriode) => {
                      let sumGroup = 0;
                      group.projets.forEach((p) => {
                        const projectVentMap = simulatedVentilations[p._id] || [];
                        let ji = 0;
                        let je = 0;
                        pPeriode.moisList.forEach((mNum) => {
                          const vent = projectVentMap.find((v) => v.mois === mNum) || { joursInternes: 0, joursExternes: 0 };
                          ji += vent.joursInternes;
                          je += vent.joursExternes;
                        });
                        if (population === 'interne') sumGroup += ji;
                        else if (population === 'externe') sumGroup += je;
                        else sumGroup += (ji + je);
                      });
                      if ((pPeriode as any).isWeek && (pPeriode as any).weekFraction) {
                        sumGroup = sumGroup * (pPeriode as any).weekFraction;
                      }
                      return Number(sumGroup.toFixed(1));
                    });

                    const totalGroupJours = Number(groupTotalsByPeriode.reduce((s, v) => s + v, 0).toFixed(1));

                    return (
                      <React.Fragment key={group.id}>
                        {/* Ligne En-tête Synthétique du Groupe (Visual Planning P2) */}
                        {showGroupHeader && (
                          <tr
                            style={{
                              background: 'rgba(15, 23, 42, 0.95)',
                              borderTop: '2px solid rgba(6, 182, 212, 0.4)',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer'
                            }}
                            onClick={() => toggleGroup(group.id)}
                          >
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                                  {isGroupExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </span>
                                <strong style={{ fontSize: '0.88rem', color: '#ffffff' }}>
                                  {group.label}
                                </strong>
                                <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                                  {group.projets.length} projet{group.projets.length > 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>

                            <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              —
                            </td>

                            <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                              {totalGroupJours > 0 ? `${totalGroupJours} j` : '—'}
                            </td>

                            {/* Barres Enveloppes Macro du Groupe */}
                            {periodes.map((pPeriode, pIdx) => {
                              const groupVal = groupTotalsByPeriode[pIdx];
                              return (
                                <td key={`grp_${pPeriode.key}`} style={{ textAlign: 'center', padding: '4px' }}>
                                  {groupVal > 0 ? (
                                    <div
                                      style={{
                                        background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.25), rgba(59, 130, 246, 0.25))',
                                        border: '1px solid rgba(6, 182, 212, 0.6)',
                                        borderRadius: '4px',
                                        padding: '4px 2px',
                                        fontWeight: 800,
                                        fontSize: '0.78rem',
                                        fontFamily: 'var(--font-mono)',
                                        color: '#38bdf8'
                                      }}
                                      title={`Sous-total ${group.label} pour ${pPeriode.label} : ${groupVal} j`}
                                    >
                                      {groupVal}j
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', opacity: 0.4, fontSize: '0.75rem' }}>·</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        )}

                        {/* Lignes Projets Enfants (visibles si groupe non plié ou aucun groupe) */}
                        {(!showGroupHeader || isGroupExpanded) &&
                          group.projets.map((p) => {
                            const shift = shiftsMap[p._id] || 0;
                            const canShift = canUserShiftProject(p);
                            const projectVentMap = simulatedVentilations[p._id] || [];

                            return (
                              <tr
                                key={p._id}
                                style={{
                                  backgroundColor: shift !== 0 ? 'rgba(245, 158, 11, 0.06)' : undefined
                                }}
                              >
                                <td
                                  style={{ paddingLeft: showGroupHeader ? '28px' : '12px' }}
                                  onMouseEnter={(e) => {
                                    handleProjectMouseEnter(p, e);
                                    setFocusedProjectId(p._id);
                                  }}
                                  onMouseMove={handleProjectMouseMove}
                                  onMouseLeave={() => {
                                    handleProjectMouseLeave();
                                    setFocusedProjectId(null);
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {p.codeProjet && <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)' }}>{p.codeProjet}</span>}
                                        <span>{p.nom}</span>
                                        {p.dependances && p.dependances.length > 0 && (() => {
                                          const hasConflict = dependencyConflicts.some((c) => c.successeur._id === p._id);
                                          return (
                                            <span
                                              style={{
                                                fontSize: '0.68rem',
                                                padding: '1px 5px',
                                                borderRadius: '4px',
                                                background: hasConflict ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.15)',
                                                color: hasConflict ? '#fca5a5' : '#38bdf8',
                                                border: hasConflict ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.35)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                                fontWeight: 700
                                              }}
                                              title={
                                                hasConflict
                                                  ? `⚠️ Conflit de planning avec ses prérequis !`
                                                  : `Dépend de : ${p.dependances.map((d) => d.codeProjet ? `[${d.codeProjet}] ${d.nom}` : d.nom).join(', ')}`
                                              }
                                            >
                                              <Link2 size={11} />
                                              {hasConflict ? '⚠️ Conflit' : `${p.dependances.length} prérequis`}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {p.type} {typeof p.leadBA === 'object' && p.leadBA ? `• ${p.leadBA.nom}` : ''}
                                        {p.epicDomaine ? ` [${p.epicDomaine}]` : ''}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{
                                          padding: '3px 6px',
                                          fontSize: '0.72rem',
                                          height: '24px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          color: (projectVentMap.some((v) => v.noteArbitrage)) ? '#f59e0b' : 'var(--text-muted)',
                                          borderColor: (projectVentMap.some((v) => v.noteArbitrage)) ? 'rgba(245, 158, 11, 0.4)' : undefined,
                                          background: (projectVentMap.some((v) => v.noteArbitrage)) ? 'rgba(245, 158, 11, 0.1)' : undefined
                                        }}
                                        onClick={() => handleOpenNoteArbitrage(p, new Date().getMonth() + 1)}
                                        title="Ajouter ou consulter une note d'arbitrage sur ce projet"
                                      >
                                        <MessageSquare size={12} />
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{
                                          padding: '3px 6px',
                                          fontSize: '0.72rem',
                                          height: '24px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          color: p.jalons && p.jalons.length > 0 ? '#ef4444' : 'var(--text-muted)',
                                          borderColor: p.jalons && p.jalons.length > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined,
                                          background: p.jalons && p.jalons.length > 0 ? 'rgba(239, 68, 68, 0.1)' : undefined
                                        }}
                                        onClick={() => setSelectedProjectForJalons(p)}
                                        title={p.jalons && p.jalons.length > 0 ? `${p.jalons.length} jalon(s) défini(s). Cliquer pour modifier.` : 'Gérer les jalons / milestones de ce projet'}
                                      >
                                        <Flag size={12} />
                                        {p.jalons && p.jalons.length > 0 ? p.jalons.length : ''}
                                      </button>
                                    </div>
                                  </div>
                                </td>

                                <td style={{ textAlign: 'center' }}>
                                  {p.priorite ? (
                                    <span className="badge" style={{ backgroundColor: `${COLORS_STACK[p.priorite] || '#64748b'}25`, color: COLORS_STACK[p.priorite] || '#fff', border: `1px solid ${COLORS_STACK[p.priorite] || '#64748b'}50` }}>
                                      {p.priorite}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                  )}
                                </td>

                                {/* Shift Controls */}
                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {canShift ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                        onClick={() => handleShiftProject(p._id, -1)}
                                        title="Décaler de -1 mois vers le passé"
                                      >
                                        ◀ -1m
                                      </button>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: '28px', color: shift !== 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                                        {shift > 0 ? `+${shift}m` : shift < 0 ? `${shift}m` : '0'}
                                      </span>
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                        onClick={() => handleShiftProject(p._id, 1)}
                                        title="Décaler de +1 mois vers le futur"
                                      >
                                        +1m ▶
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                      {shift !== 0 ? `${shift > 0 ? '+' : ''}${shift}m` : '—'}
                                    </span>
                                  )}
                                </td>

                                {/* Grid cells */}
                                {periodes.map((pPeriode) => {
                                  let displayVal = 0;
                                  let jiTotal = 0;
                                  let jeTotal = 0;

                                  pPeriode.moisList.forEach((mNum) => {
                                    const vent = projectVentMap.find((v) => v.mois === mNum) || { joursInternes: 0, joursExternes: 0 };
                                    jiTotal += vent.joursInternes;
                                    jeTotal += vent.joursExternes;
                                  });

                                  if (population === 'interne') displayVal = jiTotal;
                                  else if (population === 'externe') displayVal = jeTotal;
                                  else displayVal = jiTotal + jeTotal;

                                  if ((pPeriode as any).isWeek && (pPeriode as any).weekFraction) {
                                    displayVal = displayVal * (pPeriode as any).weekFraction;
                                    jiTotal = jiTotal * (pPeriode as any).weekFraction;
                                    jeTotal = jeTotal * (pPeriode as any).weekFraction;
                                  }

                                  displayVal = Number(displayVal.toFixed(1));

                                  const hasCharge = displayVal > 0;
                                  const targetMoisForDrop = pPeriode.moisList[0];
                                  const cellKey = `${p._id}_${targetMoisForDrop}`;
                                  const isOverForProject = draggedProjectId === p._id && dragOverMois === targetMoisForDrop;
                                  const isOverForResource = dragOverCellKey === cellKey;
                                  const isOverThisCell = isOverForProject || isOverForResource;

                                  // Note d'arbitrage éventuelle sur ce mois
                                  const currentMoisVent = projectVentMap.find((v) => pPeriode.moisList.includes(v.mois) && v.noteArbitrage);
                                  const noteArbitrage = currentMoisVent?.noteArbitrage || '';

                                  return (
                                    <td
                                      key={pPeriode.key}
                                      data-cell-project={p._id}
                                      data-cell-month={targetMoisForDrop}
                                      className={isOverForResource ? 'drop-target-active' : undefined}
                                      onDoubleClick={() => handleOpenNoteArbitrage(p, targetMoisForDrop)}
                                      style={{
                                        textAlign: 'center',
                                        padding: '4px',
                                        backgroundColor: isOverThisCell ? 'rgba(6, 182, 212, 0.25)' : undefined,
                                        transition: 'background-color 0.2s ease',
                                        position: 'relative'
                                      }}
                                      onDragOver={(e) => {
                                        if (canShift) {
                                          e.preventDefault();
                                          setDragOverMois(targetMoisForDrop);
                                          setDragOverCellKey(cellKey);
                                        }
                                      }}
                                      onDragLeave={() => {
                                        setDragOverMois(null);
                                        setDragOverCellKey(null);
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverCellKey(null);

                                        // Cas 1 : Drop d'une ressource (Staffing)
                                        try {
                                          const customData = e.dataTransfer.getData('application/json');
                                          if (customData) {
                                            const parsed = JSON.parse(customData);
                                            if (parsed.type === 'RESSOURCE_STAFFING' && parsed.ressource) {
                                              handleResourceDropOnProjectMonth(parsed.ressource, p, targetMoisForDrop);
                                              setDragOverMois(null);
                                              return;
                                            }
                                          }
                                        } catch (err) {
                                          // fallback
                                        }

                                        // Cas 2 : Drop de décalage de projet
                                        if (canShift && draggedProjectId) {
                                          handleSetProjectStartMonth(draggedProjectId, targetMoisForDrop);
                                          setDraggedProjectId(null);
                                          setDragOverMois(null);
                                        }
                                      }}
                                    >
                                      {/* Marqueur d'Angle : Note d'Arbitrage & Contexte (Axe 4) */}
                                      {noteArbitrage && (
                                        <div
                                          onClick={(e) => handleOpenNoteArbitrage(p, targetMoisForDrop, e)}
                                          title={`Note d'arbitrage :\n"${noteArbitrage}"\n(Cliquer pour modifier/consulter)`}
                                          style={{
                                            position: 'absolute',
                                            top: '0px',
                                            left: '0px',
                                            width: '0',
                                            height: '0',
                                            borderTop: '9px solid #f59e0b',
                                            borderRight: '9px solid transparent',
                                            zIndex: 7,
                                            cursor: 'pointer',
                                            filter: 'drop-shadow(0 0 2px rgba(245, 158, 11, 0.8))'
                                          }}
                                        />
                                      )}

                                      {/* Badges Jalons / Milestones (Losanges colorés) */}
                                      {p.jalons && p.jalons.filter((j) => {
                                        const matchAnnee = j.annee ? j.annee === annee : true;
                                        if (!matchAnnee) return false;

                                        // Si on est en mode semaine
                                        if ((pPeriode as any).isWeek) {
                                          const currentPeriodWeek = (pPeriode as any).weekNum;
                                          if (j.semaine) {
                                            return j.semaine === currentPeriodWeek;
                                          }
                                          // Si pas de semaine spécifique définie, afficher sur la première semaine du mois
                                          return pPeriode.moisList.includes(j.mois) && (pPeriode.key.includes('_0') || (pPeriode as any).weekFraction);
                                        }

                                        return pPeriode.moisList.includes(j.mois);
                                      }).map((j, jIdx) => {
                                        const jColor = j.couleur || '#ef4444';
                                        const weekText = j.semaine ? ` [Semaine S${j.semaine}]` : '';
                                        return (
                                          <div
                                            key={`jalon_${jIdx}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedProjectForJalons(p);
                                            }}
                                            title={`Jalon : ${j.nom} (${j.type || 'MEP'})${weekText} - Cliquer pour modifier`}
                                            style={{
                                              position: 'absolute',
                                              top: '-4px',
                                              right: `${4 + jIdx * 14}px`,
                                              width: '10px',
                                              height: '10px',
                                              backgroundColor: jColor,
                                              transform: 'rotate(45deg)',
                                              boxShadow: `0 0 6px ${jColor}`,
                                              border: '1.5px solid #ffffff',
                                              zIndex: 6,
                                              cursor: 'pointer'
                                            }}
                                          />
                                        );
                                      })}

                                      {hasCharge ? (
                                        <div
                                          draggable={canShift}
                                          onDragStart={() => {
                                            if (canShift) setDraggedProjectId(p._id);
                                            handleProjectMouseLeave();
                                          }}
                                          onDragEnd={() => {
                                            setDraggedProjectId(null);
                                            setDragOverMois(null);
                                          }}
                                          onMouseEnter={(e) => handleProjectMouseEnter(p, e)}
                                          onMouseMove={handleProjectMouseMove}
                                          onMouseLeave={handleProjectMouseLeave}
                                          style={{
                                            background: shift !== 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.2)',
                                            border: shift !== 0 ? '1px solid rgba(245, 158, 11, 0.6)' : '1px solid rgba(59, 130, 246, 0.4)',
                                            borderRadius: '4px',
                                            padding: '4px 2px',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            fontFamily: 'var(--font-mono)',
                                            color: shift !== 0 ? '#fbbf24' : '#60a5fa',
                                            cursor: canShift ? 'grab' : 'default',
                                            userSelect: 'none'
                                          }}
                                        >
                                          {displayVal}j
                                        </div>
                                      ) : (
                                        <span
                                          style={{
                                            color: 'var(--text-muted)',
                                            fontSize: '0.8rem',
                                            display: 'inline-block',
                                            width: '100%',
                                            padding: '4px 0'
                                          }}
                                          title={canShift ? "Glisser une ressource ici pour démarrer l'affectation sur ce mois" : undefined}
                                        >
                                          -
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Modal Sauvegarder Brouillon What-If */}
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Save style={{ color: 'var(--primary)' }} size={22} /> Sauvegarder un Brouillon de Scénario What-If
              </h3>
              <button className="toast-close-btn" onClick={() => setShowSaveModal(false)} style={{ fontSize: '1.2rem' }}>×</button>
            </div>

            <form onSubmit={handleSaveDraftSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  Enregistre les <strong>{Object.keys(shiftsMap).length} décalage(s) de projets</strong> sous forme de brouillon réutilisable et comparable pour l'année <strong>{annee}</strong>. La base de données réelle restera inchangée.
                </div>

                <div className="form-group">
                  <label className="form-label">Nom du Scénario Brouillon *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Scénario Décalage Projet X + Arrivée Externe Y"
                    value={draftNom}
                    onChange={(e) => setDraftNom(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Contextualisation (optionnel)</label>
                  <textarea
                    rows={3}
                    placeholder="Raisons du décalage, hypothèses retenues..."
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Sauvegarder le Brouillon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tiroir Latéral Palette Ressources (Staffing Nominatif Style Visual Planning) */}
      <ResourceDrawer
        ressources={toutesRessources}
        planningMap={planningRessourcesMap}
        isOpen={isDrawerOpen}
        onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
        annee={annee}
        moisFocus={vueGranularite === 'semaine' ? moisFocusSemaine : (new Date().getMonth() + 1)}
        onDragStartResource={(r) => setDraggedResource(r)}
        onDragEndResource={() => {
          setDraggedResource(null);
          setDragOverCellKey(null);
        }}
      />

      {/* Modal d'Affectation Rapide (Staffing Prompt au drop) */}
      {quickStaffingTarget && (
        <QuickStaffingModal
          isOpen={Boolean(quickStaffingTarget)}
          onClose={() => setQuickStaffingTarget(null)}
          ressource={quickStaffingTarget.ressource}
          projet={quickStaffingTarget.projet}
          mois={quickStaffingTarget.mois}
          annee={annee}
          joursExistants={quickStaffingTarget.joursExistants}
          onConfirm={handleConfirmQuickStaffing}
        />
      )}

      {/* Modal de Gestion des Jalons / Milestones (Visual Planning) */}
      {selectedProjectForJalons && (
        <JalonsManagerModal
          isOpen={Boolean(selectedProjectForJalons)}
          onClose={() => setSelectedProjectForJalons(null)}
          projet={selectedProjectForJalons}
          annee={annee}
          onSaveJalons={handleSaveJalonsProjet}
        />
      )}

      {/* Fiche 360° Synthétique Flottante au Survol (Visual Planning) */}
      {hoveredProject360 && (
        <Project360Tooltip
          projet={hoveredProject360.projet}
          rapprochement={rapprochementMap[hoveredProject360.projet._id]}
          staffedResources={projectStaffedMap[hoveredProject360.projet._id] || []}
          position={hoveredProject360.position}
          annee={annee}
        />
      )}

      {/* Modal de Note d'Arbitrage et de Contexte (Axe 4) */}
      {noteArbitrageTarget && (
        <NoteArbitrageModal
          isOpen={Boolean(noteArbitrageTarget)}
          onClose={() => setNoteArbitrageTarget(null)}
          projet={noteArbitrageTarget.projet}
          mois={noteArbitrageTarget.mois}
          annee={annee}
          existingNote={noteArbitrageTarget.existingNote}
          onSave={handleSaveNoteArbitrage}
          canEdit={noteArbitrageTarget.canEdit}
        />
      )}

      {/* Modal Rapport d'Arbitrage & Synthèse des Notes (COPROJ / COPIL) */}
      {isRapportArbitrageOpen && (
        <RapportArbitrageModal
          isOpen={isRapportArbitrageOpen}
          onClose={() => setIsRapportArbitrageOpen(false)}
          annee={annee}
          projets={projets}
          realVentilations={realVentilations}
          onSelectProject={(targetP) => {
            setIsRapportArbitrageOpen(false);
            setSearchTerm(targetP.nom);
          }}
        />
      )}

    </div>
  );
};
