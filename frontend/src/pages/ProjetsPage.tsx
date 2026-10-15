import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IProjet, IRessource, IVentilationMensuelleDTO, IEcartB0B1KPI, IRapprochementProjetItem } from '../types';
import { MatriceVentilationProjets } from '../components/MatriceVentilationProjets';
import { RapprochementTempoTable } from '../components/RapprochementTempoTable';
import { PortfolioKanban } from '../components/PortfolioKanban';
import { getCompletudeVentilation } from '../utils/completude';
import { ConfirmModal } from '../components/ConfirmModal';
import { WorkspaceManager } from '../components/WorkspaceManager';
import {
  FolderKanban,
  LayoutGrid,
  Plus,
  Edit2,
  Trash2,
  CalendarDays,
  Search,
  AlertTriangle,
  TrendingUp,
  SlidersHorizontal,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  Info,
  Layers,
  Link2,
  BarChart3,
  PieChart,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Users,
  Zap,
  FileText,
  ShieldAlert,
  Sparkles,
  Compass,
  Check,
  ArrowRight,
  Save
} from 'lucide-react';

interface ContributorInfo {
  nom: string;
  type: string;
  joursTempo: number;
  joursStaffes: number;
}

interface ProjetsPageProps {
  initialFilterPriorite?: string;
  initialFilterStatutEst?: string;
}

export const ProjetsPage: React.FC<ProjetsPageProps> = ({
  initialFilterPriorite = 'Tous',
  initialFilterStatutEst = 'Tous'
}) => {
  const { role, leadBARessource } = useAuth();
  const { showSuccess, showDanger } = useToast();
  const isReadOnly = role === 'Lecteur';
  const isLeadBA = role === 'LeadBA';
  const isAdmin = role === 'Admin';

  const [projets, setProjets] = useState<IProjet[]>([]);
  const [ressourcesBA, setRessourcesBA] = useState<IRessource[]>([]);
  const [toutesLesRessources, setToutesLesRessources] = useState<IRessource[]>([]);
  const [kpiEcart, setKpiEcart] = useState<IEcartB0B1KPI | null>(null);
  const [rapprochementMap, setRapprochementMap] = useState<{ [projetId: string]: IRapprochementProjetItem }>({});
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const currentYear = new Date().getFullYear();

  // Auto-complétion mapping Tempo/Jira
  const [mappingOptions, setMappingOptions] = useState<{
    budgetLines: string[];
    epics: { summary: string; issueKey: string }[];
    featureIds: string[];
  }>({ budgetLines: [], epics: [], featureIds: [] });

  // Filtres
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatut, setFilterStatut] = useState<string>('Tous');
  const [filterType, setFilterType] = useState<string>('Tous');
  const [filterB0B1, setFilterB0B1] = useState<string>(initialFilterStatutEst);
  const [filterPriorite, setFilterPriorite] = useState<string>(initialFilterPriorite);
  const [filterLeadBA, setFilterLeadBA] = useState<string>('Tous');
  const [filterRisque, setFilterRisque] = useState<string>('Tous');

  // Modal Projet (Création / Édition)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [codeWarning, setCodeWarning] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    codeProjet: '',
    nom: '',
    type: 'Projet' as 'RUN' | 'Projet' | 'Projet Opex' | 'Reco' | "Vie d'entreprise",
    epicDomaine: '',
    leadBA: '',
    priorite: 'P2' as 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | null,
    statut: "À l'étude" as "À l'étude" | 'Validé' | 'En cours' | 'Terminé',
    estimationB0: '' as number | '',
    estimationB1: '' as number | '',
    epicJiraLie: 'NC' as 'Oui' | 'Non' | 'NC',
    donneesAJour: '',
    jiraBudgetLine: '',
    jiraEpicKey: '',
    jiraFeatureId: '',
    dependances: [] as Array<{ projetId: string; codeProjet?: string; nom?: string; typeLien?: 'FIN_DEBUT'; jalonRequisId?: string }>
  });

  const [isB1Activated, setIsB1Activated] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'chiffrage' | 'jira' | 'dependances'>('general');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Modal Ventilation Mensuelle
  const [selectedVentilationProjet, setSelectedVentilationProjet] = useState<IProjet | null>(null);
  const [ventilationAnnee, setVentilationAnnee] = useState<number>(new Date().getFullYear());
  const [ventilationItems, setVentilationItems] = useState<IVentilationMensuelleDTO[]>([]);
  const [loadingVentilation, setLoadingVentilation] = useState<boolean>(false);
  const [savingVentilation, setSavingVentilation] = useState<boolean>(false);
  const [ventilationSuccessMsg, setVentilationSuccessMsg] = useState<boolean>(false);
  const [matriceRefreshKey, setMatriceRefreshKey] = useState<number>(0);

  const toggleExpand = (pid: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  // Chargement initial
  const fetchProjets = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/projets').then((r) => r.json()),
      fetch(`/api/projets/rapprochement-tempo?annee=${currentYear}`).then((r) => r.json()).catch(() => null)
    ])
      .then(([projetsData, tempoData]) => {
        setProjets(projetsData || []);
        if (tempoData && Array.isArray(tempoData.items)) {
          const rapMap: { [projetId: string]: IRapprochementProjetItem } = {};
          tempoData.items.forEach((item: IRapprochementProjetItem) => {
            rapMap[item.projetId] = item;
          });
          setRapprochementMap(rapMap);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement projets:', err);
        setLoading(false);
      });
  };

  const fetchKPIEcart = () => {
    fetch('/api/projets/kpi/ecart-b0-b1')
      .then((res) => res.json())
      .then((data) => setKpiEcart(data))
      .catch((err) => console.error('Erreur KPI Ecart B0/B1:', err));
  };

  const fetchRessourcesBA = () => {
    fetch('/api/ressources')
      .then((res) => res.json())
      .then((data: IRessource[]) => {
        setToutesLesRessources(data.filter((r) => r.actif));
        // Filtrer les ressources BA
        const listBA = data.filter((r) => r.actif && (r.role.toUpperCase().includes('BA') || r.estLeadBA));
        setRessourcesBA(listBA);
      })
      .catch((err) => console.error('Erreur chargement ressources BA:', err));
  };

  const fetchMappingOptions = () => {
    fetch('/api/projets/tempo-mapping-options')
      .then((res) => res.json())
      .then((data) => setMappingOptions(data))
      .catch((err) => console.error('Erreur chargement options mapping:', err));
  };

  useEffect(() => {
    fetchProjets();
    fetchKPIEcart();
    fetchRessourcesBA();
    fetchMappingOptions();
  }, []);

  useEffect(() => {
    if (initialFilterPriorite) setFilterPriorite(initialFilterPriorite);
    if (initialFilterStatutEst) setFilterB0B1(initialFilterStatutEst);
  }, [initialFilterPriorite, initialFilterStatutEst]);

  // Vérification d'unicité du code projet en direct
  const checkCodeUnicite = async (code: string, currentId: string | null) => {
    if (!code || code.trim() === '') {
      setCodeWarning(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/projets/check-code?code=${encodeURIComponent(code.trim())}${currentId ? `&excludeId=${currentId}` : ''
        }`
      );
      const data = await res.json();
      setCodeWarning(data.exists);
    } catch (err) {
      console.error(err);
    }
  };

  // Ouverture modal Ajout
  const handleOpenAdd = () => {
    setEditingProjectId(null);
    setCodeWarning(false);
    setErrorMsg('');
    setIsB1Activated(false);
    setActiveModalTab('general');

    // Si Lead BA connecté, auto-assignation
    const defaultLeadBA = isLeadBA && leadBARessource ? leadBARessource._id : '';

    setFormData({
      codeProjet: '',
      nom: '',
      type: 'Projet',
      epicDomaine: '',
      leadBA: defaultLeadBA,
      priorite: 'P2',
      statut: "À l'étude",
      estimationB0: '',
      estimationB1: '',
      epicJiraLie: 'NC',
      donneesAJour: '',
      jiraBudgetLine: '',
      jiraEpicKey: '',
      jiraFeatureId: '',
      dependances: []
    });
    setIsProjectModalOpen(true);
  };

  // Ouverture modal Édition
  const handleOpenEdit = (p: IProjet) => {
    setEditingProjectId(p._id);
    setCodeWarning(false);
    setErrorMsg('');

    const leadId = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : (p.leadBA as string) || '';

    const hasB1 = p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0;
    setIsB1Activated(hasB1);
    setActiveModalTab('general');

    setFormData({
      codeProjet: p.codeProjet || '',
      nom: p.nom,
      type: p.type,
      epicDomaine: p.epicDomaine || '',
      leadBA: leadId,
      priorite: p.priorite || 'P2',
      statut: p.statut,
      estimationB0: p.estimationB0 !== undefined && p.estimationB0 !== null ? p.estimationB0 : '',
      estimationB1: p.estimationB1 !== undefined && p.estimationB1 !== null ? p.estimationB1 : '',
      epicJiraLie: p.epicJiraLie || 'NC',
      donneesAJour: p.donneesAJour || '',
      jiraBudgetLine: p.jiraBudgetLine || '',
      jiraEpicKey: p.jiraEpicKey || '',
      jiraFeatureId: p.jiraFeatureId || '',
      dependances: (p.dependances || []).map((d) => ({
        projetId: typeof d.projetId === 'object' && (d.projetId as any)?._id ? (d.projetId as any)._id : String(d.projetId),
        codeProjet: d.codeProjet,
        nom: d.nom,
        typeLien: d.typeLien || 'FIN_DEBUT',
        jalonRequisId: d.jalonRequisId
      }))
    });

    setIsProjectModalOpen(true);
  };

  // Mise à jour rapide de statut (Kanban Drag & Drop)
  const handleQuickUpdateStatut = async (projetId: string, nouveauStatut: IProjet['statut']) => {
    try {
      const p = projets.find((item) => item._id === projetId);
      if (!p) return;
      const res = await fetch(`/api/projets/${projetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...p,
          leadBA: typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : p.leadBA,
          statut: nouveauStatut
        })
      });
      if (res.ok) {
        showSuccess(`Statut de "${p.nom}" mis à jour : ${nouveauStatut}`);
        fetchProjets();
      } else {
        const err = await res.json();
        showDanger(err.message || 'Erreur lors de la mise à jour du statut.');
      }
    } catch (err: any) {
      showDanger(err.message || 'Erreur réseau');
    }
  };

  // Mise à jour rapide de priorité (Kanban Drag & Drop)
  const handleQuickUpdatePriorite = async (projetId: string, nouvellePrio: IProjet['priorite']) => {
    try {
      const p = projets.find((item) => item._id === projetId);
      if (!p) return;
      const res = await fetch(`/api/projets/${projetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...p,
          leadBA: typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : p.leadBA,
          priorite: nouvellePrio
        })
      });
      if (res.ok) {
        showSuccess(`Priorité de "${p.nom}" mise à jour : ${nouvellePrio || 'Non défini'}`);
        fetchProjets();
      } else {
        const err = await res.json();
        showDanger(err.message || 'Erreur lors de la mise à jour de la priorité.');
      }
    } catch (err: any) {
      showDanger(err.message || 'Erreur réseau');
    }
  };

  // Suppression de projet via ConfirmModal
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; nom: string } | null>(null);
  const [deletingProject, setDeletingProject] = useState<boolean>(false);

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projets/${projectToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        showDanger(`Erreur: ${data.message}`);
        return;
      }
      fetchProjets();
      fetchKPIEcart();
      showSuccess(`Le projet "${projectToDelete.nom}" a été supprimé avec succès.`);
      setProjectToDelete(null);
    } catch (err: any) {
      showDanger(`Erreur lors de la suppression: ${err.message}`);
    } finally {
      setDeletingProject(false);
    }
  };

  const handleDelete = (id: string, nom: string) => {
    setProjectToDelete({ id, nom });
  };

  // Soumission Formulaire Projet
  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const isEdit = !!editingProjectId;
    const projetNom = formData.nom;

    const payload = {
      ...formData,
      codeProjet: formData.codeProjet.trim() ? formData.codeProjet.trim() : undefined,
      estimationB0: formData.estimationB0 !== '' ? Number(formData.estimationB0) : undefined,
      estimationB1: isB1Activated && formData.estimationB1 !== '' ? Number(formData.estimationB1) : undefined,
      leadBA: formData.leadBA !== '' ? formData.leadBA : undefined,
      jiraBudgetLine: formData.jiraBudgetLine.trim() ? formData.jiraBudgetLine.trim() : undefined,
      jiraEpicKey: formData.jiraEpicKey.trim() ? formData.jiraEpicKey.trim() : undefined,
      jiraFeatureId: formData.jiraFeatureId.trim() ? formData.jiraFeatureId.trim() : undefined
    };

    try {
      const url = isEdit ? `/api/projets/${editingProjectId}` : '/api/projets';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.message || 'Une erreur est survenue lors de l\'enregistrement.');
        showDanger(result.message || 'Erreur lors de la sauvegarde du projet.');
        return;
      }

      setIsProjectModalOpen(false);
      fetchProjets();
      fetchKPIEcart();
      showSuccess(
        isEdit
          ? `Le projet "${projetNom}" a été mis à jour avec succès.`
          : `Le projet "${projetNom}" a été créé avec succès.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau');
      showDanger(err.message || 'Erreur réseau');
    }
  };

  // Chargement de la ventilation d'un projet
  const fetchVentilation = (projetId: string, annee: number) => {
    setLoadingVentilation(true);
    fetch(`/api/projets/${projetId}/ventilation?annee=${annee}`)
      .then((res) => res.json())
      .then((data) => {
        setVentilationItems(data);
        setLoadingVentilation(false);
      })
      .catch((err) => {
        console.error('Erreur ventilation:', err);
        setLoadingVentilation(false);
      });
  };

  // Ouverture Modal Ventilation
  const handleOpenVentilation = (p: IProjet) => {
    setSelectedVentilationProjet(p);
    setVentilationAnnee(new Date().getFullYear());
    fetchVentilation(p._id, new Date().getFullYear());
  };

  // Mois dépliés pour le staffing nominatif
  const [expandedMonths, setExpandedMonths] = useState<{ [mois: number]: boolean }>({});

  const toggleMonthExpanded = (mois: number) => {
    setExpandedMonths((prev) => ({ ...prev, [mois]: !prev[mois] }));
  };

  // Ajout d'une affectation sur un mois
  const handleAddAffectation = (mois: number, ressourceId: string) => {
    const ressource = toutesLesRessources.find((r) => r._id === ressourceId);
    if (!ressource) return;

    setVentilationItems((prev) =>
      prev.map((item) => {
        if (item.mois === mois) {
          const currentAffs = item.affectations || [];
          if (currentAffs.some((a) => a.ressourceId === ressourceId)) {
            return item; // Déjà présent
          }
          const updatedAffs = [
            ...currentAffs,
            {
              ressourceId: ressource._id,
              matricule: ressource.matricule,
              nom: ressource.nom,
              type: ressource.type,
              jours: 0
            }
          ];
          return { ...item, affectations: updatedAffs };
        }
        return item;
      })
    );
  };

  // Suppression d'une affectation
  const handleRemoveAffectation = (mois: number, ressourceId: string) => {
    setVentilationItems((prev) =>
      prev.map((item) => {
        if (item.mois === mois) {
          const updatedAffs = (item.affectations || []).filter((a) => a.ressourceId !== ressourceId);
          return { ...item, affectations: updatedAffs };
        }
        return item;
      })
    );
  };

  // Modification jours d'une affectation
  const handleAffectationJoursChange = (mois: number, ressourceId: string, valStr: string) => {
    const jours = Math.max(0, Number(valStr || 0));
    setVentilationItems((prev) =>
      prev.map((item) => {
        if (item.mois === mois) {
          const updatedAffs = (item.affectations || []).map((a) =>
            a.ressourceId === ressourceId ? { ...a, jours } : a
          );
          return { ...item, affectations: updatedAffs };
        }
        return item;
      })
    );
  };

  // Modification cellule ventilation
  const handleVentilationCellChange = (mois: number, field: 'joursInternes' | 'joursExternes', valStr: string) => {
    const numVal = Math.max(0, Number(valStr || 0));
    setVentilationItems((prev) =>
      prev.map((item) => {
        if (item.mois === mois) {
          const updated = { ...item, [field]: numVal };
          updated.totalMois = Number((updated.joursInternes + updated.joursExternes).toFixed(1));
          return updated;
        }
        return item;
      })
    );
  };

  const [syncingTempo, setSyncingTempo] = useState<boolean>(false);
  const [syncingGlobal, setSyncingGlobal] = useState<boolean>(false);
  const [showConfirmGlobalModal, setShowConfirmGlobalModal] = useState<boolean>(false);

  // Synchronisation globale de tous les projets depuis Tempo
  const handleExecuteSyncTempoGlobal = async () => {
    const currentYear = new Date().getFullYear();
    setSyncingGlobal(true);
    try {
      const res = await fetch('/api/projets/ventilation/sync-tempo-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annee: currentYear })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la synchronisation globale.');
      }

      showSuccess(data.message);
      setShowConfirmGlobalModal(false);
      fetchProjets();
      fetchKPIEcart();
      setMatriceRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      console.error(err);
      showDanger(err.message || 'Erreur lors de la synchronisation globale.');
    } finally {
      setSyncingGlobal(false);
    }
  };

  // Synchronisation automatique de la ventilation depuis Tempo (projet individuel)
  const handleSyncTempoVentilation = async () => {
    if (!selectedVentilationProjet) return;
    setSyncingTempo(true);

    try {
      const res = await fetch(`/api/projets/${selectedVentilationProjet._id}/ventilation/sync-tempo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annee: ventilationAnnee })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la synchronisation Tempo.');
      }

      showSuccess(data.message);
      // Rafraîchir les ventilations
      fetchVentilation(selectedVentilationProjet._id, ventilationAnnee);
      fetchProjets();
      fetchKPIEcart();
      setMatriceRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      console.error(err);
      showDanger(err.message || 'Erreur lors de la synchronisation Tempo.');
    } finally {
      setSyncingTempo(false);
    }
  };

  // Sauvegarde Batch de la ventilation
  const handleSaveVentilation = async () => {
    if (!selectedVentilationProjet) return;
    setSavingVentilation(true);
    setVentilationSuccessMsg(false);

    const projetNom = selectedVentilationProjet.nom;

    try {
      const res = await fetch(`/api/projets/${selectedVentilationProjet._id}/ventilation/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annee: ventilationAnnee,
          items: ventilationItems
        })
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la sauvegarde de la ventilation.');
      }

      setSavingVentilation(false);
      setSelectedVentilationProjet(null); // Ferme la popin de ventilation
      fetchProjets(); // Rafraîchit la liste des projets
      fetchKPIEcart(); // Rafraîchit les KPIs d'écart et de complétude
      setMatriceRefreshKey((prev) => prev + 1); // Rafraîchit la vue matrice globale
      showSuccess(`La ventilation mensuelle du projet "${projetNom}" (${ventilationAnnee}) a été enregistrée avec succès.`);
    } catch (err: any) {
      console.error(err);
      setSavingVentilation(false);
      showDanger(err.message || 'Erreur lors de la sauvegarde de la ventilation.');
    }
  };

  // Vérification si l'utilisateur actuel peut éditer un projet
  const canUserEditProject = (p: IProjet): boolean => {
    if (isReadOnly) return false;
    if (isAdmin) return true;
    if (isLeadBA && leadBARessource) {
      const leadId = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : p.leadBA;
      return leadId === leadBARessource._id;
    }
    return false;
  };

  // Filtrage des projets
  const filteredProjets = projets.filter((p) => {
    const leadNom = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA.nom : '';
    const leadId = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : (p.leadBA as string) || '';

    const matchesSearch =
      p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codeProjet && p.codeProjet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.epicDomaine && p.epicDomaine.toLowerCase().includes(searchTerm.toLowerCase())) ||
      leadNom.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatut = filterStatut === 'Tous' || p.statut === filterStatut;
    const matchesType = filterType === 'Tous' || p.type === filterType;
    const matchesB0B1 = filterB0B1 === 'Tous' || p.statutEstimation === filterB0B1;
    const matchesPriorite = filterPriorite === 'Tous' || (p.priorite && p.priorite === filterPriorite);
    const matchesLeadBA = filterLeadBA === 'Tous' || leadId === filterLeadBA;

    let matchesRisque = true;
    if (filterRisque === 'Critique') {
      // Projets en dérapage rouge OU non chiffrés OU dérapage orange
      matchesRisque = p.couleurStatut === 'ROUGE' || p.couleurStatut === 'ORANGE' || p.statutEstimation === 'NC' || (!p.estimationB0 && !p.estimationB1);
    } else if (filterRisque === 'Rouge') {
      matchesRisque = p.couleurStatut === 'ROUGE';
    } else if (filterRisque === 'NonChiffre') {
      matchesRisque = p.statutEstimation === 'NC' || (!p.estimationB0 && !p.estimationB1);
    }

    return matchesSearch && matchesStatut && matchesType && matchesB0B1 && matchesPriorite && matchesLeadBA && matchesRisque;
  });

  const nomsMoisCourts = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  // Pastille de couleur pour le statut capacitif
  const renderBadgeStatutCouleur = (p: IProjet) => {
    switch (p.couleurStatut) {
      case 'VERT':
        return (
          <span
            className="badge badge-success"
            title={`Vert : Charge planifiée (${p.totalPlanifie}j) ≤ Estimation (${p.estimationRetenue}j)`}
          >
            Sous l'estimation
          </span>
        );
      case 'ORANGE':
        return (
          <span
            className="badge badge-warning"
            title={`Orange : Charge planifiée (${p.totalPlanifie}j) entre estimation (${p.estimationRetenue}j) et charge max tolérée (${p.chargeMaxToleree}j)`}
          >
            Dépassement toléré
          </span>
        );
      case 'ROUGE':
        return (
          <span
            className="badge badge-danger"
            title={`Rouge : Dépassement critique (${p.totalPlanifie}j > charge max ${p.chargeMaxToleree}j)`}
          >
            Dépassement critique
          </span>
        );
      default:
        return <span className="badge badge-secondary">Non chiffré</span>;
    }
  };

  // Calculs dynamiques pour les KPIs
  const totalChargeJH = projets.reduce((acc, p) => acc + (p.estimationRetenue || 0), 0);
  const totalPlanifieJH = projets.reduce((acc, p) => acc + (p.totalPlanifie || 0), 0);

  const projetsB1Count = projets.filter((p) => p.statutEstimation === 'B1' || (p.estimationB1 !== undefined && p.estimationB1 !== null && p.estimationB1 > 0)).length;
  const completudeB1Pct = projets.length > 0 ? Math.round((projetsB1Count / projets.length) * 100) : 0;

  const projetsNonChiffres = projets.filter((p) => p.statutEstimation === 'NC' || (!p.estimationB0 && !p.estimationB1)).length;
  const projetsDerapageCritique = projets.filter((p) => p.couleurStatut === 'ROUGE').length;

  const [activeTab, setActiveTab] = useState<'liste' | 'kanban' | 'matrice' | 'rapprochement'>('liste');

  return (
    <div>
      {/* En-tête avec titre et bouton d'ajout */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Portefeuille Projets</h1>
          <p className="page-subtitle">
            Gérez l'ensemble des projets CartOMC, suivez l'estimation B0/B1, la ventilation mensuelle, le Kanban de gouvernance et le rapprochement Consommé Tempo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              className={`btn ${activeTab === 'liste' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', border: 'none' }}
              onClick={() => setActiveTab('liste')}
            >
              <FolderKanban size={16} /> Synthèse & Revue
            </button>
            <button
              className={`btn ${activeTab === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', border: 'none' }}
              onClick={() => setActiveTab('kanban')}
              title="Vue Kanban dynamique pour les comités d'arbitrage et gouvernance agile"
            >
              <LayoutGrid size={16} /> Vue Kanban Agile
            </button>
            <button
              className={`btn ${activeTab === 'matrice' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', border: 'none' }}
              onClick={() => setActiveTab('matrice')}
            >
              <CalendarDays size={16} /> Vue Matrice Globale
            </button>
            <button
              className={`btn ${activeTab === 'rapprochement' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem', border: 'none' }}
              onClick={() => setActiveTab('rapprochement')}
            >
              <Layers size={16} /> Consommé Tempo vs Planifié
            </button>
          </div>

          {!isReadOnly && (
            <button
              className="btn btn-secondary"
              style={{
                borderColor: '#06b6d4',
                color: '#06b6d4',
                fontSize: '0.85rem',
                gap: '6px'
              }}
              onClick={() => setShowConfirmGlobalModal(true)}
              disabled={syncingGlobal}
              title="Synchronise la ventilation et le staffing de tous les projets ayant des liaisons Jira (Code projet, Ligne budget, Epic, Feature)"
            >
              <Zap size={16} />
              {syncingGlobal ? 'Synchronisation globale...' : '⚡ Synchroniser tout depuis Tempo'}
            </button>
          )}

          {!isReadOnly && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={18} /> Nouveau projet
            </button>
          )}
        </div>
      </div>

      {activeTab === 'rapprochement' ? (
        <RapprochementTempoTable annee={new Date().getFullYear()} />
      ) : activeTab === 'matrice' ? (
        <MatriceVentilationProjets
          key={matriceRefreshKey}
          onOpenVentilationProjet={(p: IProjet) => handleOpenVentilation(p)}
        />
      ) : activeTab === 'kanban' ? (
        <PortfolioKanban
          projets={projets}
          ressourcesBA={ressourcesBA}
          isReadOnly={isReadOnly}
          onUpdateStatut={handleQuickUpdateStatut}
          onUpdatePriorite={handleQuickUpdatePriorite}
          onOpenEdit={handleOpenEdit}
          onOpenVentilation={handleOpenVentilation}
        />
      ) : (
        <>
          {/* Cartes KPI d'ensemble */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
              marginBottom: '20px'
            }}
          >
            {/* KPI 1 : Total Projets */}
            <div className="card" style={{ margin: 0, padding: '16px 18px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FolderKanban size={16} style={{ color: 'var(--primary-light)' }} /> Total Projets
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>
                {projets.length} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>projets</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {projets.filter(p => p.statut === 'En cours').length} en cours, {projets.filter(p => p.statut === "À l'étude").length} à l'étude
              </div>
            </div>

            {/* KPI 2 : Charge Totale Portefeuille */}
            <div className="card" style={{ margin: 0, padding: '16px 18px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart3 size={16} style={{ color: 'var(--accent-color, #3b82f6)' }} /> Charge Estimée Totale
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>
                {totalChargeJH} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>J.H</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Planifié : {totalPlanifieJH} J.H
              </div>
            </div>

            {/* KPI 3 : Écart Moyen B0 / B1 */}
            <div className="card" style={{ margin: 0, padding: '16px 18px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} style={{ color: (kpiEcart?.ecartMoyenPct || 0) > 0 ? '#fbbf24' : 'var(--success)' }} /> Écart Moyen B0/B1
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: (kpiEcart?.ecartMoyenPct || 0) > 0 ? '#fbbf24' : 'var(--success)' }}>
                {kpiEcart ? `${kpiEcart.ecartMoyenPct > 0 ? '+' : ''}${kpiEcart.ecartMoyenPct}%` : '0%'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Sur {kpiEcart?.nombreProjetsEvalues || 0} projet(s) B0 & B1
              </div>
            </div>

            {/* KPI 4 : Complétude Chiffrage B1 (Cliquable pour filtrer) */}
            <div
              className="card"
              style={{
                margin: 0,
                padding: '16px 18px',
                cursor: 'pointer',
                border: filterB0B1 === 'B1' ? '1px solid var(--primary-light)' : undefined,
                background: filterB0B1 === 'B1' ? 'rgba(6, 182, 212, 0.1)' : undefined
              }}
              onClick={() => setFilterB0B1(filterB0B1 === 'B1' ? 'Tous' : 'B1')}
              title="Cliquer pour filtrer uniquement les projets en B1"
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PieChart size={16} style={{ color: 'var(--info, #06b6d4)' }} /> Complétude B1
                </span>
                {filterB0B1 === 'B1' && (
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>Filtré</span>
                )}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: completudeB1Pct >= 75 ? 'var(--success)' : completudeB1Pct >= 50 ? '#fbbf24' : 'var(--danger, #ef4444)' }}>
                {completudeB1Pct}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {projetsB1Count} / {projets.length} projet(s) en B1 🔍
              </div>
            </div>

            {/* KPI 5 : Alertes & Risques (Cliquable pour filtrer) */}
            <div
              className="card"
              style={{
                margin: 0,
                padding: '16px 18px',
                cursor: 'pointer',
                border: filterRisque !== 'Tous' ? '1px solid var(--danger, #ef4444)' : undefined,
                background: filterRisque !== 'Tous' ? 'rgba(239, 68, 68, 0.1)' : undefined
              }}
              onClick={() => setFilterRisque(filterRisque === 'Critique' ? 'Tous' : 'Critique')}
              title="Cliquer pour filtrer les projets nécessitant une attention (alertes / dérapages / non chiffrés)"
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} style={{ color: (projetsNonChiffres > 0 || projetsDerapageCritique > 0) ? '#f59e0b' : 'var(--success)' }} /> Suivi des Risques
                </span>
                {filterRisque !== 'Tous' && (
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>Filtré</span>
                )}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: projetsDerapageCritique > 0 ? 'var(--danger, #ef4444)' : projetsNonChiffres > 0 ? '#f59e0b' : 'var(--success)' }}>
                {projetsNonChiffres + projetsDerapageCritique} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>alertes</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {projetsNonChiffres} non chiffré(s) · {projetsDerapageCritique} dérapage(s) 🔍
              </div>
            </div>
          </div>

          {/* Barre de filtres */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Vues & Filtres sauvegardés (Workspaces) */}
              <WorkspaceManager
                storageKey="projets"
                currentFilters={{
                  searchTerm,
                  filterStatut,
                  filterType,
                  filterB0B1,
                  filterPriorite,
                  filterLeadBA,
                  filterRisque
                }}
                defaultFilters={{
                  searchTerm: '',
                  filterStatut: 'Tous',
                  filterType: 'Tous',
                  filterB0B1: 'Tous',
                  filterPriorite: 'Tous',
                  filterLeadBA: 'Tous',
                  filterRisque: 'Tous'
                }}
                onApplyFilters={(f) => {
                  setSearchTerm(f.searchTerm ?? '');
                  setFilterStatut(f.filterStatut ?? 'Tous');
                  setFilterType(f.filterType ?? 'Tous');
                  setFilterB0B1(f.filterB0B1 ?? 'Tous');
                  setFilterPriorite(f.filterPriorite ?? 'Tous');
                  setFilterLeadBA(f.filterLeadBA ?? 'Tous');
                  setFilterRisque(f.filterRisque ?? 'Tous');
                }}
                systemPresets={[
                  {
                    id: 'sys_p0_p1',
                    name: 'Projets Stratégiques (P0 / P1)',
                    icon: '🔥',
                    description: 'Focalisation sur les chantiers critiques et haute priorité',
                    filters: {
                      searchTerm: '',
                      filterStatut: 'Tous',
                      filterType: 'Tous',
                      filterB0B1: 'Tous',
                      filterPriorite: 'P0',
                      filterLeadBA: 'Tous',
                      filterRisque: 'Tous'
                    }
                  },
                  {
                    id: 'sys_risques',
                    name: 'Alertes & Dépassements',
                    icon: '⚠️',
                    description: 'Projets en dérapage ou non chiffrés',
                    filters: {
                      searchTerm: '',
                      filterStatut: 'Tous',
                      filterType: 'Tous',
                      filterB0B1: 'Tous',
                      filterPriorite: 'Tous',
                      filterLeadBA: 'Tous',
                      filterRisque: 'Critique'
                    }
                  },
                  {
                    id: 'sys_en_cours',
                    name: 'Chantiers En Cours',
                    icon: '🚀',
                    description: 'Projets actuellement en cours de production',
                    filters: {
                      searchTerm: '',
                      filterStatut: 'En cours',
                      filterType: 'Tous',
                      filterB0B1: 'Tous',
                      filterPriorite: 'Tous',
                      filterLeadBA: 'Tous',
                      filterRisque: 'Tous'
                    }
                  },
                  ...(leadBARessource
                    ? [
                        {
                          id: 'sys_mon_perimetre',
                          name: `Mon Périmètre (${leadBARessource.nom})`,
                          icon: '👤',
                          description: 'Projets dont vous êtes le Lead BA référent',
                          filters: {
                            searchTerm: '',
                            filterStatut: 'Tous',
                            filterType: 'Tous',
                            filterB0B1: 'Tous',
                            filterPriorite: 'Tous',
                            filterLeadBA: leadBARessource._id,
                            filterRisque: 'Tous'
                          }
                        }
                      ]
                    : [])
                ]}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                <Search size={18} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1, border: 'none', background: 'transparent' }}
                  placeholder="Rechercher par nom, code, epic ou Lead BA..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
                  <select
                    className="form-select"
                    style={{ width: '130px', fontSize: '0.85rem' }}
                    value={filterStatut}
                    onChange={(e) => setFilterStatut(e.target.value)}
                  >
                    <option value="Tous">Tous statuts</option>
                    <option value="À l'étude">À l'étude</option>
                    <option value="Validé">Validé</option>
                    <option value="En cours">En cours</option>
                    <option value="Terminé">Terminé</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="form-select"
                    style={{ width: '140px', fontSize: '0.85rem' }}
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="Tous">Tous types</option>
                    <option value="RUN">RUN</option>
                    <option value="Projet">Projet</option>
                    <option value="Projet Opex">Projet Opex</option>
                    <option value="Reco">Reco</option>
                    <option value="Vie d'entreprise">Vie d'entreprise</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="form-select"
                    style={{ width: '130px', fontSize: '0.85rem' }}
                    value={filterB0B1}
                    onChange={(e) => setFilterB0B1(e.target.value)}
                  >
                    <option value="Tous">Tous B0/B1</option>
                    <option value="B0">Macro B0</option>
                    <option value="B1">Chiffré B1</option>
                    <option value="NC">Non chiffré</option>
                  </select>
                </div>

                {/* Filtre Priorité */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="form-select"
                    style={{ width: '110px', fontSize: '0.85rem' }}
                    value={filterPriorite}
                    onChange={(e) => setFilterPriorite(e.target.value)}
                  >
                    <option value="Tous">Toutes prios</option>
                    <option value="P0">P0 (Critique)</option>
                    <option value="P1">P1 (Élevée)</option>
                    <option value="P2">P2 (Moyenne)</option>
                    <option value="P3">P3 (Basse)</option>
                    <option value="P4">P4</option>
                  </select>
                </div>

                {/* Filtre Lead BA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="form-select"
                    style={{ width: '135px', fontSize: '0.85rem' }}
                    value={filterLeadBA}
                    onChange={(e) => setFilterLeadBA(e.target.value)}
                  >
                    <option value="Tous">Tous Lead BA</option>
                    {ressourcesBA.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.nom}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtre Suivi des Risques & Alertes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    className="form-select"
                    style={{
                      width: '160px',
                      fontSize: '0.85rem',
                      borderColor: filterRisque !== 'Tous' ? 'var(--danger, #ef4444)' : undefined,
                      color: filterRisque !== 'Tous' ? 'var(--danger, #ef4444)' : undefined,
                      fontWeight: filterRisque !== 'Tous' ? 600 : undefined
                    }}
                    value={filterRisque}
                    onChange={(e) => setFilterRisque(e.target.value)}
                  >
                    <option value="Tous">Tous les risques</option>
                    <option value="Critique">⚠️ Projets à risques (Tous)</option>
                    <option value="Rouge">🔴 Dépassement critique</option>
                    <option value="NonChiffre">⚪ Projets non chiffrés</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau des projets */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chargement du portefeuille projets...
            </div>
          ) : (
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '38px', textAlign: 'center' }}></th>
                    <th>Code</th>
                    <th>Nom du projet</th>
                    <th>Type</th>
                    <th>Epic / Domaine</th>
                    <th>Lead BA</th>
                    <th>Prio</th>
                    <th>Statut</th>
                    <th>Estimation B0/B1</th>
                    <th style={{ textAlign: 'right' }}>Planifié (J.H)</th>
                    <th style={{ textAlign: 'right' }}>Réalisé Tempo / Jira</th>
                    <th style={{ textAlign: 'center' }}>Contributeurs</th>
                    <th style={{ textAlign: 'center' }}>Santé B0/B1</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjets.length === 0 ? (
                    <tr>
                      <td colSpan={14} style={{ textAlign: 'center', padding: '32px' }}>
                        Aucun projet correspondant aux critères.
                      </td>
                    </tr>
                  ) : (
                    filteredProjets.map((p) => {
                      const canEdit = canUserEditProject(p);
                      const leadNom = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA.nom : '-';
                      const isExpanded = expandedProjectIds.has(p._id);

                      // Données Rapprochement Tempo pour ce projet
                      const rap = rapprochementMap[p._id];
                      const consommeTempo = rap?.consommeTempo || 0;

                      // Extraction et fusion des contributeurs (Tempo + Staffing)
                      const contribMap = new Map<string, ContributorInfo>();
                      if (rap?.tempoContributors) {
                        rap.tempoContributors.forEach((tc) => {
                          const nomClean = tc.collaborator.trim();
                          contribMap.set(nomClean, {
                            nom: nomClean,
                            type: tc.type || 'Inconnu',
                            joursTempo: tc.timeInDays || 0,
                            joursStaffes: 0
                          });
                        });
                      }
                      if (rap?.staffedContributors) {
                        rap.staffedContributors.forEach((sc) => {
                          const nomClean = sc.nom.trim();
                          const existing = contribMap.get(nomClean);
                          if (existing) {
                            existing.joursStaffes = sc.jours || 0;
                          } else {
                            contribMap.set(nomClean, {
                              nom: nomClean,
                              type: sc.type || 'Interne',
                              joursTempo: 0,
                              joursStaffes: sc.jours || 0
                            });
                          }
                        });
                      }
                      const contributors = Array.from(contribMap.values()).sort(
                        (a, b) => (b.joursTempo + b.joursStaffes) - (a.joursTempo + a.joursStaffes)
                      );
                      const topContribs = contributors.slice(0, 2);
                      const remainingContribs = contributors.length - topContribs.length;

                      return (
                        <React.Fragment key={p._id}>
                          <tr
                            style={{
                              background: isExpanded ? 'rgba(6, 182, 212, 0.08)' : undefined
                            }}
                          >
                            {/* Chevron Déplier / Replier le volet de contributeurs */}
                            <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '2px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: isExpanded ? 'var(--primary)' : 'var(--text-muted)',
                                  cursor: 'pointer'
                                }}
                                onClick={() => toggleExpand(p._id)}
                                title={isExpanded ? 'Masquer les contributeurs et détails Tempo' : 'Déplier les contributeurs et détails Tempo'}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            </td>

                            <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                              {p.codeProjet || '-'}
                            </td>

                            <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span>{p.nom}</span>
                                {p.dependances && p.dependances.length > 0 && (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(56, 189, 248, 0.12)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontWeight: 600
                                    }}
                                    title={`Dépend de : ${p.dependances.map((d) => d.codeProjet ? `[${d.codeProjet}] ${d.nom}` : d.nom).join(', ')}`}
                                  >
                                    <Link2 size={11} />
                                    {p.dependances.length} prérequis
                                  </span>
                                )}
                                {contributors.length > 0 && (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      color: 'var(--text-muted)'
                                    }}
                                  >
                                    {contributors.length} pers.
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <span className="badge badge-secondary">{p.type}</span>
                            </td>

                            <td style={{ fontSize: '0.85rem' }}>{p.epicDomaine || '-'}</td>

                            <td>
                              <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{leadNom}</span>
                            </td>

                            <td>
                              {p.priorite ? (
                                <span
                                  className={`badge ${
                                    p.priorite === 'P0' || p.priorite === 'P1'
                                      ? 'badge-danger'
                                      : p.priorite === 'P2'
                                      ? 'badge-warning'
                                      : 'badge-secondary'
                                  }`}
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  {p.priorite}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>

                            <td>
                              <span
                                className={`badge ${
                                  p.statut === 'Validé' || p.statut === 'En cours'
                                    ? 'badge-success'
                                    : p.statut === 'Terminé'
                                    ? 'badge-secondary'
                                    : 'badge-warning'
                                }`}
                                style={{ fontSize: '0.75rem' }}
                              >
                                {p.statut}
                              </span>
                            </td>

                            {/* Estimation B0 / B1 */}
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    className={`badge ${
                                      p.statutEstimation === 'B1'
                                        ? 'badge-success'
                                        : p.statutEstimation === 'B0'
                                        ? 'badge-purple'
                                        : 'badge-secondary'
                                    }`}
                                    style={{
                                      fontWeight: 700,
                                      letterSpacing: '0.5px',
                                      border: p.statutEstimation === 'B1' ? '1px solid rgba(34, 197, 94, 0.4)' : undefined,
                                      boxShadow: p.statutEstimation === 'B1' ? '0 0 8px rgba(34, 197, 94, 0.25)' : undefined
                                    }}
                                  >
                                    {p.statutEstimation === 'B1' ? '🔒 B1' : p.statutEstimation === 'B0' ? '⚡ B0' : 'NC'}
                                  </span>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: p.statutEstimation === 'B1' ? 'var(--success)' : 'var(--text-main)' }}>
                                    {p.estimationRetenue > 0 ? `${p.estimationRetenue} j` : '-'}
                                  </span>
                                </div>
                                {p.statutEstimation === 'B1' && p.estimationB0 && p.estimationB0 > 0 && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    (B0 : {p.estimationB0} j)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Planifié */}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
                              {p.totalPlanifie > 0 ? `${p.totalPlanifie} j` : '-'}
                            </td>

                            {/* Réalisé Tempo / Jira */}
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                              {consommeTempo > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                                    {consommeTempo} j
                                  </span>
                                  {p.totalPlanifie > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                      ({Math.round((consommeTempo / p.totalPlanifie) * 100)}%)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>0 j</span>
                              )}
                            </td>

                            {/* Puces Contributeurs */}
                            <td>
                              {contributors.length === 0 ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>—</span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {topContribs.map((c, cIdx) => (
                                    <span
                                      key={cIdx}
                                      className="badge"
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '1px 5px',
                                        backgroundColor: c.joursTempo > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                        color: c.joursTempo > 0 ? '#10b981' : '#38bdf8',
                                        border: `1px solid ${c.joursTempo > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
                                      }}
                                      title={`${c.nom} (${c.type}) : ${c.joursTempo > 0 ? `${c.joursTempo}j saisis Jira` : ''}${c.joursStaffes > 0 ? ` [${c.joursStaffes}j planifiés]` : ''}`}
                                    >
                                      {c.nom.split(' ')[0]} ({c.joursTempo > 0 ? `${c.joursTempo}j` : `${c.joursStaffes}j`})
                                    </span>
                                  ))}
                                  {remainingContribs > 0 && (
                                    <span
                                      className="badge badge-secondary"
                                      style={{ fontSize: '0.68rem', padding: '1px 4px' }}
                                      title={`${remainingContribs} autre(s) personne(s)`}
                                    >
                                      +{remainingContribs}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Statut Couleur / Alerte */}
                            <td style={{ textAlign: 'center' }}>{renderBadgeStatutCouleur(p)}</td>

                            {/* Actions unifiées */}
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 8px', marginRight: '4px', fontSize: '0.78rem' }}
                                title="Ventiler la charge mensuelle"
                                onClick={() => handleOpenVentilation(p)}
                              >
                                <CalendarDays size={13} /> Ventiler
                              </button>

                              {canEdit && (
                                <>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '5px 8px', marginRight: '4px' }}
                                    title="Modifier le projet"
                                    onClick={() => handleOpenEdit(p)}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '5px 8px' }}
                                    title="Supprimer le projet"
                                    onClick={() => handleDelete(p._id, p.nom)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>

                          {/* LIGNE DÉPLIÉE : DÉTAIL DES PERSONNES & DES TEMPS JIRA SAISIS */}
                          {isExpanded && (
                            <tr style={{ background: 'rgba(15, 23, 42, 0.85)' }}>
                              <td colSpan={14} style={{ padding: '16px 24px', borderTop: 'none', borderBottom: '1px solid rgba(6, 182, 212, 0.3)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                  
                                  {/* En-tête du volet détaillé */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <Users size={18} style={{ color: 'var(--primary)' }} />
                                      <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>
                                        Personnes actives & Temps Jira saisis sur "{p.nom}" ({currentYear})
                                      </strong>
                                    </div>

                                    {/* Résumé synthétique Temps Jira */}
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.78rem' }}>
                                        Temps Réel Jira : <strong>{consommeTempo} j</strong> ({Math.round(consommeTempo * 8)} h)
                                      </span>
                                      <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '0.78rem' }}>
                                        Total Planifié : <strong>{p.totalPlanifie} j</strong>
                                      </span>
                                      {p.jiraBudgetLine && (
                                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                          Ligne Budget : {p.jiraBudgetLine}
                                        </span>
                                      )}
                                      {p.jiraEpicKey && (
                                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                          Epic : {p.jiraEpicKey}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Tableau des contributeurs */}
                                  {contributors.length === 0 ? (
                                    <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center' }}>
                                      Aucun collaborateur n'est encore staffé et aucune imputation Tempo n'a été trouvée sur ce projet pour l'année {currentYear}.
                                    </div>
                                  ) : (
                                    <div style={{ background: 'rgba(11, 17, 32, 0.9)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                        <thead>
                                          <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                            <th style={{ padding: '8px 14px', textAlign: 'left' }}>Collaborateur</th>
                                            <th style={{ padding: '8px 14px', textAlign: 'left' }}>Type</th>
                                            <th style={{ padding: '8px 14px', textAlign: 'right' }}>Temps Jira Réel (Jours)</th>
                                            <th style={{ padding: '8px 14px', textAlign: 'right' }}>Temps Jira Réel (Heures)</th>
                                            <th style={{ padding: '8px 14px', textAlign: 'right' }}>Staffing Planifié (Jours)</th>
                                            <th style={{ padding: '8px 14px', textAlign: 'left' }}>Statut d'Imputation</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {contributors.map((c, cIdx) => {
                                            const heuresTempo = Math.round(c.joursTempo * 8);
                                            const hasTempo = c.joursTempo > 0;
                                            const hasStaffing = c.joursStaffes > 0;

                                            return (
                                              <tr key={cIdx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                                <td style={{ padding: '8px 14px', fontWeight: 600, color: '#ffffff' }}>
                                                  {c.nom}
                                                </td>
                                                <td style={{ padding: '8px 14px' }}>
                                                  <span
                                                    className="badge"
                                                    style={{
                                                      fontSize: '0.72rem',
                                                      backgroundColor: c.type === 'Interne' || c.type === 'INT' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                                      color: c.type === 'Interne' || c.type === 'INT' ? '#38bdf8' : '#c084fc',
                                                      border: `1px solid ${c.type === 'Interne' || c.type === 'INT' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                                                    }}
                                                  >
                                                    {c.type === 'INT' ? 'Interne' : c.type === 'EXT' ? 'Externe' : c.type}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: hasTempo ? '#10b981' : 'var(--text-muted)' }}>
                                                  {hasTempo ? `${c.joursTempo} j` : '0 j'}
                                                </td>
                                                <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: hasTempo ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                  {hasTempo ? `${heuresTempo} h` : '0 h'}
                                                </td>
                                                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', color: hasStaffing ? '#38bdf8' : 'var(--text-muted)' }}>
                                                  {hasStaffing ? `${c.joursStaffes} j` : '—'}
                                                </td>
                                                <td style={{ padding: '8px 14px' }}>
                                                  {hasTempo && hasStaffing ? (
                                                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                                      ✓ Staffé & Actif Jira
                                                    </span>
                                                  ) : hasTempo ? (
                                                    <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                      Actif Jira (Non staffé)
                                                    </span>
                                                  ) : (
                                                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                                                      Staffé prévisionnel
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal Création / Édition de Projet - Design Modernisé Glassmorphism & Tabs */}
      {isProjectModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: '820px',
              width: '95%',
              padding: 0,
              background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(11, 17, 32, 0.99) 100%)',
              border: '1px solid rgba(249, 115, 22, 0.45)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(249, 115, 22, 0.22)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
          >
            {/* 1. En-tête Premium avec Dégradé et Badges Récapitulatifs */}
            <div
              style={{
                padding: '20px 24px 16px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 88, 12, 0.05) 50%, transparent 100%)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(249, 115, 22, 0.15)',
                      border: '1px solid rgba(249, 115, 22, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      boxShadow: '0 0 15px rgba(249, 115, 22, 0.25)'
                    }}
                  >
                    <FolderKanban size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)', color: '#ffffff', letterSpacing: '-0.01em' }}>
                        {editingProjectId ? 'Modifier le projet' : 'Créer un nouveau projet'}
                      </h2>
                      {formData.priorite && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background:
                              formData.priorite === 'P0' || formData.priorite === 'P1'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : formData.priorite === 'P2'
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(148, 163, 184, 0.2)',
                            color:
                              formData.priorite === 'P0' || formData.priorite === 'P1'
                                ? '#f87171'
                                : formData.priorite === 'P2'
                                ? '#fbbf24'
                                : '#94a3b8',
                            border: '1px solid currentColor'
                          }}
                        >
                          {formData.priorite}
                        </span>
                      )}
                      <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                        {formData.type}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      {formData.nom ? formData.nom : 'Définition des paramètres, du chiffrage budgétaire et des prérequis.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)'
                  }}
                  onClick={() => setIsProjectModalOpen(false)}
                  title="Fermer (Échap)"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 2. Barre d'Onglets Ergonomique */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '12px'
                }}
              >
                {[
                  { id: 'general', label: 'Général & Pilotage', icon: Compass, count: null },
                  {
                    id: 'chiffrage',
                    label: 'Chiffrage B0 / B1',
                    icon: TrendingUp,
                    count: formData.estimationB1 || formData.estimationB0 ? `${formData.estimationB1 || formData.estimationB0}j` : null
                  },
                  {
                    id: 'jira',
                    label: 'Jira & Tempo',
                    icon: Link2,
                    count: formData.jiraEpicKey || formData.jiraBudgetLine ? 'Lié' : null
                  },
                  {
                    id: 'dependances',
                    label: 'Prérequis',
                    icon: Layers,
                    count: formData.dependances.length > 0 ? formData.dependances.length : null
                  }
                ].map((tab) => {
                  const isActive = activeModalTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveModalTab(tab.id as any)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? 700 : 500,
                        border: isActive ? '1px solid rgba(249, 115, 22, 0.6)' : '1px solid transparent',
                        background: isActive ? 'rgba(249, 115, 22, 0.2)' : 'transparent',
                        color: isActive ? '#f97316' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            background: isActive ? 'rgba(249, 115, 22, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                            color: isActive ? '#ffffff' : 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Corps défilable du formulaire */}
            <div style={{ padding: '24px', maxHeight: 'calc(80vh - 150px)', overflowY: 'auto' }}>
              {errorMsg && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form id="projectMainForm" onSubmit={handleSubmitProject}>
                {/* ONGLET 1 : GÉNÉRAL & PILOTAGE */}
                {activeModalTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          Code Projet
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optionnel)</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="ex: PRJ-001"
                          value={formData.codeProjet}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({ ...formData, codeProjet: val });
                            checkCodeUnicite(val, editingProjectId);
                          }}
                        />
                        {codeWarning && (
                          <span style={{ color: '#fbbf24', fontSize: '0.73rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={13} /> Attention : code déjà utilisé.
                          </span>
                        )}
                      </div>

                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">
                          Nom du projet <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          required
                          placeholder="ex: Refonte Module Cartographie..."
                          value={formData.nom}
                          onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">
                          Typologie <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          className="form-select"
                          value={formData.type}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              type: e.target.value as 'RUN' | 'Projet' | 'Projet Opex' | 'Reco' | "Vie d'entreprise"
                            })
                          }
                        >
                          <option value="Projet">Projet (Build)</option>
                          <option value="RUN">RUN / MCO</option>
                          <option value="Projet Opex">Projet Opex</option>
                          <option value="Reco">Reco (Opportunité)</option>
                          <option value="Vie d'entreprise">Vie d'entreprise</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">Epic / Domaine Fonctionnel</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="ex: POS, Cart, Payment..."
                          value={formData.epicDomaine}
                          onChange={(e) => setFormData({ ...formData, epicDomaine: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">Lead BA Référent</label>
                        <select
                          className="form-select"
                          value={formData.leadBA}
                          disabled={isLeadBA && !!leadBARessource}
                          onChange={(e) => setFormData({ ...formData, leadBA: e.target.value })}
                        >
                          <option value="">Aucun Lead BA</option>
                          {/* Cas où le projet a déjà un Lead BA affecté qui ne serait pas dans la liste filtrée */}
                          {formData.leadBA &&
                            !toutesLesRessources.some((r) => r._id === formData.leadBA && r.estLeadBA) && (() => {
                              const currentRes = toutesLesRessources.find((r) => r._id === formData.leadBA);
                              return currentRes ? (
                                <option key={currentRes._id} value={currentRes._id}>
                                  {currentRes.nom} ({currentRes.matricule}) (Non Lead BA)
                                </option>
                              ) : null;
                            })()}
                          {toutesLesRessources
                            .filter((r) => r.actif && r.estLeadBA)
                            .map((ba) => (
                              <option key={ba._id} value={ba._id}>
                                {ba.nom} ({ba.matricule})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">Niveau de Priorité</label>
                        <select
                          className="form-select"
                          value={formData.priorite || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              priorite: e.target.value ? (e.target.value as 'P0' | 'P1' | 'P2' | 'P3' | 'P4') : null
                            })
                          }
                        >
                          <option value="P0">🔴 P0 - Critique (Bloquant)</option>
                          <option value="P1">🟠 P1 - Stratégique (Haute)</option>
                          <option value="P2">🟡 P2 - Normale</option>
                          <option value="P3">🟢 P3 - Basse</option>
                          <option value="P4">⚪ P4 - Optionnelle</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">
                          Statut <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          className="form-select"
                          value={formData.statut}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              statut: e.target.value as "À l'étude" | 'Validé' | 'En cours' | 'Terminé'
                            })
                          }
                        >
                          <option value="À l'étude">⏳ À l'étude / Cadrage</option>
                          <option value="Validé">✅ Validé / Prêt</option>
                          <option value="En cours">🚀 En cours (Actif)</option>
                          <option value="Terminé">🏁 Terminé / Livré</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                      <label className="form-label">Données à jour & Remarques libres</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Notes de cadrage, liens documentaires, avancement, contexte..."
                        value={formData.donneesAJour}
                        onChange={(e) => setFormData({ ...formData, donneesAJour: e.target.value })}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : MOTEUR DE CHIFFRAGE B0 / B1 */}
                {activeModalTab === 'chiffrage' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div
                      style={{
                        padding: '14px 18px',
                        background: 'rgba(249, 115, 22, 0.08)',
                        border: '1px solid rgba(249, 115, 22, 0.3)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <Sparkles size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                        <strong>Gouvernance Budgétaire CartOMC</strong> : Renseignez d'abord une estimation macro <strong>B0</strong> (+100% tolérance). Figez-la ensuite pour activer le chiffrage fin <strong>B1</strong> (+20% tolérance) qui sera la référence retenue.
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {/* Carte B0 */}
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={15} /> Estimation B0 (Macro)
                          </span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>Tolérance +100%</span>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="form-input"
                              placeholder="ex: 120"
                              value={formData.estimationB0}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  estimationB0: e.target.value !== '' ? Number(e.target.value) : ''
                                })
                              }
                              style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', paddingRight: '40px' }}
                            />
                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                              J.H
                            </span>
                          </div>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                            Charge estimée lors de la phase initiale d'opportunité ou de cadrage.
                          </span>
                        </div>
                      </div>

                      {/* Carte B1 */}
                      <div
                        style={{
                          background: isB1Activated ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                          border: isB1Activated ? '1px solid rgba(16, 185, 129, 0.35)' : '1px dashed rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          padding: '18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isB1Activated ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={15} /> Estimation B1 (Affinée)
                          </span>
                          {!isB1Activated ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setIsB1Activated(true)}
                              disabled={formData.estimationB0 === ''}
                              title={formData.estimationB0 === '' ? 'Renseignez un B0 d\'abord' : 'Figer le B0 et déverrouiller la saisie B1'}
                            >
                              <Lock size={12} /> Figer B0 ➔ Passer en B1
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                              <Unlock size={12} /> B1 Actif (Verrou B0)
                            </span>
                          )}
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="form-input"
                              disabled={!isB1Activated}
                              placeholder={isB1Activated ? 'ex: 95' : 'Verrouillé tant que B0 non figé'}
                              value={formData.estimationB1}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  estimationB1: e.target.value !== '' ? Number(e.target.value) : ''
                                })
                              }
                              style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                paddingRight: '40px',
                                opacity: isB1Activated ? 1 : 0.6
                              }}
                            />
                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                              J.H
                            </span>
                          </div>
                          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                            Chiffrage détaillé post-spécifications servant d'engagement capacitif.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET 3 : JIRA & EXTRACTION TEMPO */}
                {activeModalTab === 'jira' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div
                      style={{
                        padding: '14px 18px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <Link2 size={22} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                        Ce raccordement permet de synchroniser automatiquement les consommés réels Tempo et de générer le rapprochement budgétaire, le reste à faire (RAF) et l'atterrissage prévisionnel.
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">Ligne Budget Jira (customfield_10806)</label>
                        <input
                          type="text"
                          list="budgetLinesList"
                          className="form-input"
                          placeholder="ex: Produit_0110"
                          value={formData.jiraBudgetLine}
                          onChange={(e) => setFormData({ ...formData, jiraBudgetLine: e.target.value })}
                        />
                        <datalist id="budgetLinesList">
                          {mappingOptions.budgetLines.map((bl) => (
                            <option key={bl} value={bl} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">Clé ou Titre Epic Jira</label>
                        <input
                          type="text"
                          list="epicList"
                          className="form-input"
                          placeholder="ex: GTEP-1668 ou Mon Titre"
                          value={formData.jiraEpicKey}
                          onChange={(e) => setFormData({ ...formData, jiraEpicKey: e.target.value })}
                        />
                        <datalist id="epicList">
                          {mappingOptions.epics.map((ep) => (
                            <option key={ep.summary} value={ep.summary} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-group" style={{ minWidth: 0, margin: 0 }}>
                        <label className="form-label">ID Feature Jira (Regex ou valeur)</label>
                        <input
                          type="text"
                          list="featureList"
                          className="form-input"
                          placeholder="ex: 1668"
                          value={formData.jiraFeatureId}
                          onChange={(e) => setFormData({ ...formData, jiraFeatureId: e.target.value })}
                        />
                        <datalist id="featureList">
                          {mappingOptions.featureIds.map((fId) => (
                            <option key={fId} value={fId} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="form-group" style={{ maxWidth: '300px', margin: 0 }}>
                      <label className="form-label">Epic Jira formellement Lié ?</label>
                      <select
                        className="form-select"
                        value={formData.epicJiraLie}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            epicJiraLie: e.target.value as 'Oui' | 'Non' | 'NC'
                          })
                        }
                      >
                        <option value="NC">⚪ NC (Non Connu)</option>
                        <option value="Oui">🟢 Oui (Ticket Epic rattaché)</option>
                        <option value="Non">🔴 Non (Pas d'Epic)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* ONGLET 4 : PRÉREQUIS & DÉPENDANCES (FIN -> DÉBUT) */}
                {activeModalTab === 'dependances' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div
                      style={{
                        padding: '14px 18px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <Layers size={22} style={{ color: '#38bdf8', flexShrink: 0 }} />
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                        <strong>Règle chronologique Fin ➔ Début</strong> : Déclarez les projets qui doivent impérativement être terminés avant que <strong>{formData.nom || 'ce projet'}</strong> ne commence. Une alerte rouge de conflit sera levée sur le Gantt si le calendrier se chevauche.
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Ajouter un projet prérequis</label>
                      <select
                        className="form-select"
                        id="selectPrereqProject"
                        style={{ fontSize: '0.88rem' }}
                        defaultValue=""
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          if (!selectedId) return;
                          const targetP = projets.find((p) => p._id === selectedId);
                          if (!targetP) return;

                          if (formData.dependances.some((d) => d.projetId === selectedId)) {
                            e.target.value = '';
                            return;
                          }

                          setFormData({
                            ...formData,
                            dependances: [
                              ...formData.dependances,
                              {
                                projetId: selectedId,
                                codeProjet: targetP.codeProjet,
                                nom: targetP.nom,
                                typeLien: 'FIN_DEBUT'
                              }
                            ]
                          });
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Sélectionner un projet indispensable au lancement...</option>
                        {projets
                          .filter((p) => p._id !== editingProjectId && !formData.dependances.some((d) => d.projetId === p._id))
                          .sort((a, b) => a.nom.localeCompare(b.nom))
                          .map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.codeProjet ? `[${p.codeProjet}] ` : ''}{p.nom} ({p.priorite || 'NC'} - {p.type})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                        Chaîne des prérequis déclarés ({formData.dependances.length})
                      </div>
                      {formData.dependances.length === 0 ? (
                        <div
                          style={{
                            padding: '16px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '8px',
                            border: '1px dashed rgba(255, 255, 255, 0.1)',
                            textAlign: 'center',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)'
                          }}
                        >
                          Aucun prérequis. Ce projet peut être planifié indépendamment de tout autre chantier.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {formData.dependances.map((dep, idx) => (
                            <div
                              key={dep.projetId || idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: 'rgba(56, 189, 248, 0.08)',
                                border: '1px solid rgba(56, 189, 248, 0.25)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Link2 size={16} style={{ color: '#38bdf8' }} />
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                                    {dep.codeProjet && <span style={{ color: '#38bdf8', marginRight: '6px' }}>[{dep.codeProjet}]</span>}
                                    {dep.nom}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Relation : Doit se terminer avant le démarrage de ce projet (Fin ➔ Début)
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', borderRadius: '6px', color: '#f87171' }}
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    dependances: formData.dependances.filter((_, i) => i !== idx)
                                  });
                                }}
                                title="Supprimer ce lien de prérequis"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* 3. Footer Moderne Fixé */}
            <div
              style={{
                padding: '16px 24px',
                background: 'rgba(11, 17, 32, 0.95)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} style={{ color: '#10b981' }} />
                <span>Tous les champs avec astérisque (*) sont obligatoires</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                  onClick={() => setIsProjectModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  form="projectMainForm"
                  className="btn btn-primary"
                  style={{
                    padding: '8px 22px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(249, 115, 22, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={15} />
                  <span>{editingProjectId ? 'Enregistrer les modifications' : 'Créer le projet'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grille de Ventilation Mensuelle */}
      {selectedVentilationProjet && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '980px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Ventilation mensuelle de la charge — {selectedVentilationProjet.nom}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Ventilez la charge estimée en jours Internes et Externes mois par mois.
                </div>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => setSelectedVentilationProjet(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Barre de sélection d'année et synthèse de charge */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Année :</label>
                <select
                  className="form-select"
                  style={{ width: '100px' }}
                  value={ventilationAnnee}
                  onChange={(e) => {
                    const a = Number(e.target.value);
                    setVentilationAnnee(a);
                    fetchVentilation(selectedVentilationProjet._id, a);
                  }}
                >
                  {[2024, 2025, 2026, 2027, 2028].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Résumé de charge en direct & Bouton Synchroniser Tempo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {(() => {
                  const totalSaisi = Number(
                    ventilationItems.reduce((sum, item) => sum + item.joursInternes + item.joursExternes, 0).toFixed(1)
                  );
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.88rem' }}>
                      <span>Statut : <strong>{selectedVentilationProjet.statutEstimation}</strong> ({selectedVentilationProjet.estimationRetenue}j)</span>
                      <span>Total {ventilationAnnee} : <strong>{totalSaisi}j</strong></span>
                      <span>Max : <strong>{selectedVentilationProjet.chargeMaxToleree}j</strong></span>
                    </div>
                  );
                })()}

                {/* Bouton Synchro Tempo */}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderColor: '#06b6d4',
                    color: '#06b6d4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={handleSyncTempoVentilation}
                  disabled={syncingTempo}
                  title="Récupère les temps réels saisis dans Jira pour ce projet et met à jour automatiquement la ventilation et les collaborateurs"
                >
                  <Zap size={14} />
                  {syncingTempo ? 'Synchronisation...' : '⚡ Remplir depuis Tempo'}
                </button>
              </div>
            </div>

            {/* Table Grille de Ventilation 12 mois en lignes */}
            {loadingVentilation ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Chargement de la ventilation...
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}></th>
                      <th style={{ minWidth: '130px' }}>Mois</th>
                      <th style={{ textAlign: 'center', minWidth: '140px', color: 'var(--primary-light)' }}>Jours Internes</th>
                      <th style={{ textAlign: 'center', minWidth: '140px', color: '#c084fc' }}>Jours Externes</th>
                      <th style={{ textAlign: 'center', minWidth: '160px', color: '#e2e8f0' }}>Staffing Nominatif</th>
                      <th style={{ textAlign: 'center', minWidth: '110px', background: 'rgba(59, 130, 246, 0.15)' }}>Total Mois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventilationItems.map((item) => {
                      const nomsMoisComplets = [
                        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                      ];
                      const nomMois = nomsMoisComplets[item.mois - 1] || `Mois ${item.mois}`;
                      const isExpanded = !!expandedMonths[item.mois];
                      const affs = item.affectations || [];
                      
                      const affecteInterne = affs.filter((a) => a.type === 'Interne').reduce((s, a) => s + (a.jours || 0), 0);
                      const affecteExterne = affs.filter((a) => a.type === 'Externe').reduce((s, a) => s + (a.jours || 0), 0);
                      const resteInterne = Number((item.joursInternes - affecteInterne).toFixed(1));
                      const resteExterne = Number((item.joursExternes - affecteExterne).toFixed(1));

                      return (
                        <React.Fragment key={item.mois}>
                          <tr style={{ background: isExpanded ? 'rgba(30, 41, 59, 0.5)' : undefined }}>
                            <td style={{ textAlign: 'center', padding: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px', border: 'none', background: 'transparent' }}
                                onClick={() => toggleMonthExpanded(item.mois)}
                                title={isExpanded ? 'Replier le staffing' : 'Déplier le staffing nominatif'}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{nomMois}</span>
                                {affs.length > 0 && (
                                  <span className="badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                                    {affs.length} affecté{affs.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                className="form-input"
                                style={{ textAlign: 'center', padding: '6px', maxWidth: '120px', margin: '0 auto' }}
                                value={item.joursInternes || ''}
                                onChange={(e) => handleVentilationCellChange(item.mois, 'joursInternes', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                className="form-input"
                                style={{ textAlign: 'center', padding: '6px', maxWidth: '120px', margin: '0 auto' }}
                                value={item.joursExternes || ''}
                                onChange={(e) => handleVentilationCellChange(item.mois, 'joursExternes', e.target.value)}
                              />
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.8rem',
                                  padding: '4px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  borderColor: isExpanded ? 'var(--primary)' : undefined
                                }}
                                onClick={() => toggleMonthExpanded(item.mois)}
                              >
                                <Users size={14} />
                                {affs.length === 0 ? 'Attribuer (0)' : `${affs.length} personne${affs.length > 1 ? 's' : ''}`}
                              </button>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                              {item.totalMois} j
                            </td>
                          </tr>

                          {/* Ligne détaillée de staffing dépliable */}
                          {isExpanded && (
                            <tr style={{ background: 'rgba(15, 23, 42, 0.75)' }}>
                              <td colSpan={6} style={{ padding: '12px 20px', borderLeft: '3px solid var(--primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <UserPlus size={16} color="var(--primary)" />
                                    <span>Staffing nominatif — {nomMois}</span>
                                    <span style={{ fontSize: '0.8rem', color: resteInterne >= 0 ? '#94a3b8' : '#ef4444' }}>
                                      (Reste non assigné : <strong>{resteInterne}j</strong> Internes / <strong>{resteExterne}j</strong> Externes)
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <select
                                      className="form-select"
                                      style={{ fontSize: '0.8rem', padding: '4px 8px', minWidth: '180px' }}
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleAddAffectation(item.mois, e.target.value);
                                          e.target.value = '';
                                        }
                                      }}
                                    >
                                      <option value="" disabled>+ Assigner un membre...</option>
                                      {toutesLesRessources
                                        .filter((r) => !affs.some((a) => a.ressourceId === r._id))
                                        .map((r) => (
                                          <option key={r._id} value={r._id}>
                                            {r.nom} ({r.role} - {r.type})
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>

                                {affs.length === 0 ? (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                                    Aucune affectation nominative pour ce mois. La totalité de la charge est classée en "Non assignée".
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {affs.map((aff) => (
                                      <div
                                        key={aff.ressourceId}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          background: 'rgba(30, 41, 59, 0.8)',
                                          border: '1px solid rgba(148, 163, 184, 0.2)',
                                          borderRadius: '6px',
                                          padding: '4px 8px',
                                          fontSize: '0.85rem'
                                        }}
                                      >
                                        <span style={{ fontWeight: 600, color: aff.type === 'Interne' ? '#38bdf8' : '#c084fc' }}>
                                          {aff.nom}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({aff.type}) :</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          className="form-input"
                                          style={{ width: '60px', padding: '2px 4px', textAlign: 'center', fontSize: '0.85rem' }}
                                          value={aff.jours || ''}
                                          onChange={(e) => handleAffectationJoursChange(item.mois, aff.ressourceId, e.target.value)}
                                        />
                                        <span style={{ fontSize: '0.8rem' }}>j</span>
                                        <button
                                          type="button"
                                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                          onClick={() => handleRemoveAffectation(item.mois, aff.ressourceId)}
                                          title="Retirer cette affectation"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-hover)', fontWeight: 700 }}>
                      <td colSpan={2}>TOTAL ANNÉE</td>
                      <td style={{ textAlign: 'center', color: 'var(--primary-light)', fontSize: '0.95rem' }}>
                        {Number(ventilationItems.reduce((sum, i) => sum + i.joursInternes, 0).toFixed(1))} j
                      </td>
                      <td style={{ textAlign: 'center', color: '#c084fc', fontSize: '0.95rem' }}>
                        {Number(ventilationItems.reduce((sum, i) => sum + i.joursExternes, 0).toFixed(1))} j
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {Number(
                          ventilationItems.reduce(
                            (sum, i) => sum + (i.affectations || []).reduce((s, a) => s + (a.jours || 0), 0),
                            0
                          ).toFixed(1)
                        )} j staffés
                      </td>
                      <td style={{ textAlign: 'center', color: '#38bdf8', fontSize: '1.05rem' }}>
                        {Number(ventilationItems.reduce((sum, i) => sum + i.totalMois, 0).toFixed(1))} j
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <div>
                {ventilationSuccessMsg && (
                  <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <CheckCircle2 size={18} /> Ventilation sauvegardée avec succès !
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedVentilationProjet(null)} disabled={savingVentilation}>
                  Fermer
                </button>
                <button className="btn btn-primary" onClick={handleSaveVentilation} disabled={savingVentilation}>
                  {savingVentilation ? 'Enregistrement...' : 'Enregistrer la ventilation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popin de confirmation stylée pour la synchronisation globale Tempo */}
      <ConfirmModal
        isOpen={showConfirmGlobalModal}
        type="primary"
        icon="zap"
        title="Synchroniser le Portefeuille avec Tempo Jira"
        confirmLabel="Lancer la synchronisation"
        cancelLabel="Annuler"
        loading={syncingGlobal}
        onConfirm={handleExecuteSyncTempoGlobal}
        onCancel={() => setShowConfirmGlobalModal(false)}
        message={
          <div>
            <p style={{ margin: '0 0 10px 0' }}>
              Cette action va analyser l'ensemble des <strong>temps réels passés dans Jira</strong> pour l'année <strong>{new Date().getFullYear()}</strong> et les rapprocher automatiquement de vos projets :
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
              <li>
                <strong>Charge macro</strong> : Mise à jour automatique des jours Internes et Externes pour chaque mois où des imputations existent.
              </li>
              <li>
                <strong>Staffing nominatif</strong> : Affectation automatique des collaborateurs de l'équipe identifiés avec leurs jours réels.
              </li>
              <li>
                <strong>Sécurité</strong> : Les projets sans lien Jira ou sans travail logué ne seront pas altérés.
              </li>
            </ul>
          </div>
        }
      />

      {/* Popin de confirmation stylée pour la suppression de projet */}
      <ConfirmModal
        isOpen={!!projectToDelete}
        type="danger"
        icon="warning"
        title="Supprimer définitivement le projet"
        confirmLabel="Supprimer le projet"
        cancelLabel="Annuler"
        loading={deletingProject}
        onConfirm={handleConfirmDelete}
        onCancel={() => setProjectToDelete(null)}
        message={
          projectToDelete ? (
            <div>
              <p style={{ margin: '0 0 8px 0' }}>
                Êtes-vous sûr de vouloir supprimer définitivement le projet <strong style={{ color: '#fff' }}>"{projectToDelete.nom}"</strong> ?
              </p>
              <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.82rem' }}>
                ⚠️ Cette action est irréversible et supprimera l'intégralité de ses ventilations mensuelles ainsi que son historique.
              </p>
            </div>
          ) : ''
        }
      />
    </div>
  );
};
