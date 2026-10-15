import React, { useState, useEffect, useMemo } from 'react';
import { IProjet } from '../types';
import { getCompletudeVentilation } from '../utils/completude';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  CalendarDays,
  Search,
  RefreshCw,
  FolderKanban,
  Edit2,
  Edit3,
  SlidersHorizontal,
  Users,
  Briefcase,
  Zap,
  Clock,
  Maximize2,
  Minimize2,
  Save,
  RotateCcw,
  Check,
  X,
  FolderTree,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { GroupByDropdown, GroupByOption } from './GroupByDropdown';

interface PopulationCapacite {
  etp: number;
  joursOuvres: number;
  capaciteTheorique: number;
  deperdition: number;
  capaciteNette: number;
}

interface MoisCapacite {
  annee: number;
  mois: number;
  nomMois: string;
  joursOuvres: number;
  estJoursOuvresForces: boolean;
  interne: PopulationCapacite;
  externe: PopulationCapacite;
  global: PopulationCapacite;
}

interface MatriceProjetItem {
  projet: IProjet;
  annee: number;
  moisDetails: Array<{
    mois: number;
    joursInternes: number;
    joursExternes: number;
    totalMois: number;
  }>;
  totalAnneeInternes: number;
  totalAnneeExternes: number;
  totalAnneeCumul: number;
}

interface MatriceVentilationProjetsProps {
  anneeInitiale?: number;
  onOpenVentilationProjet?: (projet: IProjet) => void;
}

const NOMS_MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const formatNumber = (num: number, decimals: number = 1): string => {
  return num.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const MatriceVentilationProjets: React.FC<MatriceVentilationProjetsProps> = ({
  anneeInitiale = new Date().getFullYear(),
  onOpenVentilationProjet
}) => {
  const { role, leadBARessource } = useAuth();
  const { showSuccess, showDanger, showWarning, showInfo } = useToast();

  const [annee, setAnnee] = useState<number>(anneeInitiale);
  const [criterePopulation, setCriterePopulation] = useState<'cumul' | 'internes' | 'externes'>('cumul');
  const [matriceData, setMatriceData] = useState<MatriceProjetItem[]>([]);
  const [capaciteMensuelle, setCapaciteMensuelle] = useState<MoisCapacite[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Mode Édition Rapide & State des modifications non enregistrées
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [modifiedVentilations, setModifiedVentilations] = useState<{
    [projetId: string]: {
      [mois: number]: { joursInternes: number; joursExternes: number };
    };
  }>({});
  const [editingCell, setEditingCell] = useState<{ projetId: string; mois: number } | null>(null);
  const [editValues, setEditValues] = useState<{ joursInternes: string; joursExternes: string }>({
    joursInternes: '0',
    joursExternes: '0'
  });
  const [saving, setSaving] = useState<boolean>(false);

  // Filtres
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('Tous');
  const [groupBy, setGroupBy] = useState<'none' | 'domaine' | 'leadBA' | 'priorite' | 'type'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchMatrice = (anneeTarget: number) => {
    setLoading(true);
    fetch(`/api/projets/matrice-ventilation?annee=${anneeTarget}`)
      .then((res) => res.json())
      .then((data) => {
        setMatriceData(data.matrice || []);
        setCapaciteMensuelle(data.capaciteMensuelle || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur matrice ventilation:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMatrice(annee);
    setModifiedVentilations({});
    setEditingCell(null);
  }, [annee]);

  // Détermination des droits d'édition sur un projet spécifique
  const canEditProjet = (projet: IProjet): boolean => {
    if (!role || role === 'Lecteur') return false;
    if (role === 'Admin') return true;
    if (role === 'LeadBA') {
      if (!leadBARessource) return false;
      const leadId = typeof projet.leadBA === 'object' && projet.leadBA !== null ? projet.leadBA._id : projet.leadBA;
      return leadId === leadBARessource._id || (typeof projet.leadBA === 'object' && projet.leadBA?.nom === leadBARessource.nom);
    }
    return false;
  };

  // Calcul dynamique de la matrice consolidée en fusionnant les modifications locales non enregistrées
  const computedMatriceData = useMemo(() => {
    return matriceData.map((item) => {
      const pId = item.projet._id;
      const projectModifs = modifiedVentilations[pId];
      if (!projectModifs) return item;

      let newTotalInt = 0;
      let newTotalExt = 0;

      const newMoisDetails = item.moisDetails.map((md) => {
        const mod = projectModifs[md.mois];
        const joursInternes = mod !== undefined ? mod.joursInternes : md.joursInternes;
        const joursExternes = mod !== undefined ? mod.joursExternes : md.joursExternes;
        const totalMois = Number((joursInternes + joursExternes).toFixed(1));

        newTotalInt += joursInternes;
        newTotalExt += joursExternes;

        return {
          ...md,
          joursInternes,
          joursExternes,
          totalMois
        };
      });

      const totalAnneeInternes = Number(newTotalInt.toFixed(1));
      const totalAnneeExternes = Number(newTotalExt.toFixed(1));
      const totalAnneeCumul = Number((totalAnneeInternes + totalAnneeExternes).toFixed(1));

      const updatedProjet = {
        ...item.projet,
        totalPlanifie: totalAnneeCumul
      };

      return {
        ...item,
        projet: updatedProjet,
        moisDetails: newMoisDetails,
        totalAnneeInternes,
        totalAnneeExternes,
        totalAnneeCumul
      };
    });
  }, [matriceData, modifiedVentilations]);

  // Filtrage des lignes de projets
  const filteredMatrice = computedMatriceData.filter((item) => {
    const p = item.projet;
    const matchesSearch =
      p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codeProjet && p.codeProjet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (typeof p.leadBA === 'object' && p.leadBA?.nom.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.epicDomaine && p.epicDomaine.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === 'Tous' || p.type === filterType;

    return matchesSearch && matchesType;
  });

  // Regroupement hiérarchique Visual Planning (P2)
  interface MatriceGroupItem {
    id: string;
    label: string;
    items: MatriceProjetItem[];
  }

  const groupedMatrice: MatriceGroupItem[] = useMemo(() => {
    if (groupBy === 'none') {
      return [{ id: 'all', label: 'Tous les projets', items: filteredMatrice }];
    }

    const map = new Map<string, MatriceProjetItem[]>();
    filteredMatrice.forEach((item) => {
      const p = item.projet;
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
      map.get(groupKey)!.push(item);
    });

    return Array.from(map.entries())
      .map(([label, items]) => ({
        id: `grp_mat_${label.toLowerCase().replace(/\s+/g, '_')}`,
        label,
        items
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredMatrice, groupBy]);

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
    setExpandedGroups(new Set(groupedMatrice.map((g) => g.id)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  // Granularité temporelle (mois | trimestre | semestre)
  const [vueGranularite, setVueGranularite] = useState<'mois' | 'trimestre' | 'semestre'>('mois');

  // Actions d'édition inline
  const startEditingCell = (item: MatriceProjetItem, moisNumber: number) => {
    if (!isEditMode) return;
    if (vueGranularite !== 'mois') {
      showWarning("L'édition rapide s'effectue en vue Mois (12 mois).");
      return;
    }
    if (!canEditProjet(item.projet)) {
      showWarning("Vous n'avez pas les droits d'édition sur ce projet.");
      return;
    }

    const mDetail = item.moisDetails.find((md) => md.mois === moisNumber);
    const valInt = mDetail ? mDetail.joursInternes : 0;
    const valExt = mDetail ? mDetail.joursExternes : 0;

    setEditingCell({ projetId: item.projet._id, mois: moisNumber });
    setEditValues({
      joursInternes: valInt.toString(),
      joursExternes: valExt.toString()
    });
  };

  const commitEditingCell = () => {
    if (!editingCell) return;
    const { projetId, mois } = editingCell;

    const parsedInt = parseFloat(editValues.joursInternes.replace(',', '.')) || 0;
    const parsedExt = parseFloat(editValues.joursExternes.replace(',', '.')) || 0;

    const cleanInt = Math.max(0, Number(parsedInt.toFixed(1)));
    const cleanExt = Math.max(0, Number(parsedExt.toFixed(1)));

    setModifiedVentilations((prev) => {
      const projModifs = { ...(prev[projetId] || {}) };
      projModifs[mois] = {
        joursInternes: cleanInt,
        joursExternes: cleanExt
      };
      return {
        ...prev,
        [projetId]: projModifs
      };
    });

    setEditingCell(null);
  };

  const handleKeyDownCell = (e: React.KeyboardEvent, item: MatriceProjetItem, moisNumber: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEditingCell();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEditingCell();
      const nextMois = e.shiftKey ? moisNumber - 1 : moisNumber + 1;
      if (nextMois >= 1 && nextMois <= 12) {
        setTimeout(() => startEditingCell(item, nextMois), 50);
      }
    }
  };

  const handleSaveAll = async () => {
    const pIds = Object.keys(modifiedVentilations);
    if (pIds.length === 0) return;

    setSaving(true);
    try {
      const savePromises = pIds.map(async (projetId) => {
        const item = computedMatriceData.find((m) => m.projet._id === projetId);
        if (!item) return;

        const items = item.moisDetails.map((md) => ({
          mois: md.mois,
          joursInternes: md.joursInternes,
          joursExternes: md.joursExternes
        }));

        const res = await fetch(`/api/projets/${projetId}/ventilation/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ annee, items })
        });
        if (!res.ok) {
          throw new Error(`Erreur lors de la sauvegarde du projet ${item.projet.nom}`);
        }
      });

      await Promise.all(savePromises);
      showSuccess(`Ventilation de ${pIds.length} projet(s) enregistrée avec succès.`);
      setModifiedVentilations({});
      fetchMatrice(annee);
    } catch (err: any) {
      console.error('Erreur sauvegarde batch:', err);
      showDanger(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAll = () => {
    setModifiedVentilations({});
    setEditingCell(null);
    showInfo('Modifications annulées.');
  };

  // Configuration des périodes d'affichage
  const periodes = useMemo(() => {
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
  }, [vueGranularite]);

  // Helper pour vérifier si une période est en surcharge (charge planifiée > capacité nette)
  const isPeriodeEnSurcharge = (moisList: number[]): boolean => {
    let capaciteNetteTotal = 0;
    let sumPlanifieeTotal = 0;

    moisList.forEach((mNum) => {
      const moisCapacite = capaciteMensuelle.find((c) => c.mois === mNum);
      if (moisCapacite) {
        if (criterePopulation === 'internes') capaciteNetteTotal += moisCapacite.interne.capaciteNette;
        else if (criterePopulation === 'externes') capaciteNetteTotal += moisCapacite.externe.capaciteNette;
        else capaciteNetteTotal += moisCapacite.global.capaciteNette;
      }

      filteredMatrice.forEach((item) => {
        const mDetail = item.moisDetails.find((md) => md.mois === mNum);
        if (mDetail) {
          if (criterePopulation === 'internes') sumPlanifieeTotal += mDetail.joursInternes;
          else if (criterePopulation === 'externes') sumPlanifieeTotal += mDetail.joursExternes;
          else sumPlanifieeTotal += mDetail.totalMois;
        }
      });
    });

    return sumPlanifieeTotal > capaciteNetteTotal && capaciteNetteTotal > 0;
  };

  const countModifiedProjects = Object.keys(modifiedVentilations).length;

  return (
    <div className="card" style={{ marginTop: '20px', position: 'relative' }}>
      {/* En-tête du composant */}
      <div
        className="card-title"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FolderKanban size={20} style={{ color: 'var(--primary-light)' }} />
          <span>Matrice de Ventilation Globale de la Charge & Capacitif (Projets × Mois)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Toggle Mode Édition Rapide */}
          {role !== 'Lecteur' && (
            <button
              className={`btn ${isEditMode ? 'btn-warning' : 'btn-secondary'}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: isEditMode ? '1px solid #f59e0b' : undefined
              }}
              onClick={() => {
                if (!isEditMode && vueGranularite !== 'mois') {
                  setVueGranularite('mois');
                }
                setIsEditMode(!isEditMode);
              }}
              title="Activer la saisie directe en cellule style Excel"
            >
              <Edit3 size={15} />
              <span>{isEditMode ? 'Quitter Édition Rapide' : 'Édition Rapide (Excel)'}</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Année :</label>
            <select
              className="form-select"
              style={{ width: '95px', padding: '4px 8px' }}
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            onClick={() => fetchMatrice(annee)}
          >
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>
      </div>

      {/* Barre de critères (Toggles Population & Filtres) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          background: isEditMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(15, 23, 42, 0.6)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: isEditMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)'
        }}
      >
        {/* Toggle Critères Population & Granularité */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Affichage :</span>
            <button
              className={`btn ${criterePopulation === 'cumul' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setCriterePopulation('cumul')}
            >
              Cumul Total
            </button>
            <button
              className={`btn ${criterePopulation === 'internes' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setCriterePopulation('internes')}
            >
              Internes
            </button>
            <button
              className={`btn ${criterePopulation === 'externes' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setCriterePopulation('externes')}
            >
              Externes
            </button>
          </div>

          {/* Selector Granularité Temporielle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-hover)', padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <CalendarDays size={15} style={{ color: 'var(--primary-light)' }} />
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
        </div>

        {/* Filtres Recherche & Type + Toggle Compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className={`btn ${isCompact ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setIsCompact(!isCompact)}
            title={isCompact ? "Passer en vue standard" : "Passer en vue compacte"}
          >
            {isCompact ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
            <span>{isCompact ? 'Vue Standard' : 'Vue Compacte'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ width: '160px', padding: '4px 8px', fontSize: '0.85rem' }}
              placeholder="Filtrer projets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ width: '120px', padding: '4px 8px', fontSize: '0.85rem' }}
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
        </div>
      </div>

      {/* Grille Matrice (Projets x Périodes) avec Sticky Headers et Mode Compact */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Calcul de la matrice de ventilation et capacitif...
        </div>
      ) : (
        <div className="table-sticky-wrapper">
          <table className={isCompact ? 'grid-table-compact' : ''}>
            <thead>
              <tr>
                <th className="sticky-col-left" style={{ minWidth: '180px' }}>Projet</th>
                <th style={{ minWidth: '100px' }}>Type</th>
                <th style={{ minWidth: '120px' }}>Lead BA</th>
                {periodes.map((p, i) => {
                  const enSurcharge = isPeriodeEnSurcharge(p.moisList);
                  return (
                    <th
                      key={p.key}
                      style={{
                        textAlign: 'center',
                        minWidth: '85px',
                        backgroundColor: enSurcharge ? 'rgba(239, 68, 68, 0.35)' : undefined,
                        color: enSurcharge ? '#f87171' : undefined
                      }}
                      title={enSurcharge ? `⚠️ Surcharge sur ${p.label} : Production prévue > Capacité nette` : undefined}
                    >
                      {enSurcharge && '⚠️ '}{p.label}
                    </th>
                  );
                })}
                <th style={{ textAlign: 'center', minWidth: '95px', background: 'rgba(59, 130, 246, 0.25)' }}>
                  Total {annee}
                </th>
                {onOpenVentilationProjet && <th style={{ textAlign: 'right', minWidth: '70px' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {/* === SECTION INDICATEURS PÉRIODIQUES CONSOLIDÉS === */}
              {/* Ligne 1 : Jours Ouvrés */}
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid var(--border-color)' }}>
                <td className="sticky-col-left" colSpan={3} style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} style={{ color: 'var(--primary-light)' }} />
                    <span>Jours Ouvrés</span>
                  </div>
                </td>
                {periodes.map((p) => {
                  const totalJo = p.moisList.reduce((sum, mNum) => {
                    const c = capaciteMensuelle.find((cm) => cm.mois === mNum);
                    return sum + (c ? c.joursOuvres : 0);
                  }, 0);
                  const hasForced = p.moisList.some((mNum) => {
                    const c = capaciteMensuelle.find((cm) => cm.mois === mNum);
                    return c?.estJoursOuvresForces;
                  });
                  return (
                    <td key={p.key} style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {totalJo}j {hasForced ? '⚡' : ''}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', background: 'rgba(59, 130, 246, 0.15)' }}>
                  {capaciteMensuelle.reduce((sum, c) => sum + c.joursOuvres, 0)}j
                </td>
                {onOpenVentilationProjet && <td></td>}
              </tr>

              {/* Ligne 2 : Nombre d'ETP */}
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid var(--border-color)' }}>
                <td className="sticky-col-left" colSpan={3} style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={15} style={{ color: '#38bdf8' }} />
                    <span>Nombre d'ETP Actifs (moy)</span>
                  </div>
                </td>
                {periodes.map((p) => {
                  let sumEtpInt = 0;
                  let sumEtpExt = 0;
                  let sumEtpGlob = 0;
                  p.moisList.forEach((mNum) => {
                    const c = capaciteMensuelle.find((cm) => cm.mois === mNum);
                    if (c) {
                      sumEtpInt += c.interne.etp;
                      sumEtpExt += c.externe.etp;
                      sumEtpGlob += c.global.etp;
                    }
                  });
                  const count = p.moisList.length;
                  const avgInt = count > 0 ? sumEtpInt / count : 0;
                  const avgExt = count > 0 ? sumEtpExt / count : 0;
                  const avgGlob = count > 0 ? sumEtpGlob / count : 0;

                  return (
                    <td key={p.key} style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                      {criterePopulation === 'internes' && (
                        <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{formatNumber(avgInt, 2)}</span>
                      )}
                      {criterePopulation === 'externes' && (
                        <span style={{ color: '#c084fc', fontWeight: 700 }}>{formatNumber(avgExt, 2)}</span>
                      )}
                      {criterePopulation === 'cumul' && (
                        <div>
                          <div style={{ fontWeight: 700, color: '#38bdf8' }}>{formatNumber(avgGlob, 2)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--primary-light)' }}>{formatNumber(avgInt, 1)}I</span>
                            <span> / </span>
                            <span style={{ color: '#c084fc' }}>{formatNumber(avgExt, 1)}E</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(59, 130, 246, 0.15)' }}>
                  {capaciteMensuelle.length > 0
                    ? formatNumber(
                        capaciteMensuelle.reduce(
                          (sum, c) =>
                            sum +
                            (criterePopulation === 'internes'
                              ? c.interne.etp
                              : criterePopulation === 'externes'
                              ? c.externe.etp
                              : c.global.etp),
                          0
                        ) / capaciteMensuelle.length,
                        2
                      ) + ' (moy)'
                    : '-'}
                </td>
                {onOpenVentilationProjet && <td></td>}
              </tr>

              {/* Ligne 3 : Capacitif Actuel (ETP * Jours Ouvrés - Déperdition Absences) */}
              <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid var(--border-color)' }}>
                <td className="sticky-col-left" colSpan={3} style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} style={{ color: 'var(--success)' }} />
                    <span>Capacitif Actuel (Nette en jours)</span>
                  </div>
                </td>
                {periodes.map((p) => {
                  let capNetteInt = 0;
                  let capNetteExt = 0;
                  let capNetteGlob = 0;
                  p.moisList.forEach((mNum) => {
                    const c = capaciteMensuelle.find((cm) => cm.mois === mNum);
                    if (c) {
                      capNetteInt += c.interne.capaciteNette;
                      capNetteExt += c.externe.capaciteNette;
                      capNetteGlob += c.global.capaciteNette;
                    }
                  });

                  return (
                    <td key={p.key} style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                      {criterePopulation === 'internes' && (
                        <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{formatNumber(capNetteInt, 1)}j</span>
                      )}
                      {criterePopulation === 'externes' && (
                        <span style={{ color: '#c084fc', fontWeight: 700 }}>{formatNumber(capNetteExt, 1)}j</span>
                      )}
                      {criterePopulation === 'cumul' && (
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatNumber(capNetteGlob, 1)}j</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--primary-light)' }}>{formatNumber(capNetteInt, 1)}I</span>
                            <span> / </span>
                            <span style={{ color: '#c084fc' }}>{formatNumber(capNetteExt, 1)}E</span>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--success)', background: 'rgba(59, 130, 246, 0.15)' }}>
                  {formatNumber(
                    capaciteMensuelle.reduce(
                      (sum, c) =>
                        sum +
                        (criterePopulation === 'internes'
                          ? c.interne.capaciteNette
                          : criterePopulation === 'externes'
                          ? c.externe.capaciteNette
                          : c.global.capaciteNette),
                      0
                    ),
                    1
                  )}j
                </td>
                {onOpenVentilationProjet && <td></td>}
              </tr>

              {/* Ligne 4 : Production Prévue (Somme des projets renseignés) */}
              <tr style={{ background: 'rgba(30, 41, 59, 0.95)', borderBottom: '2px solid var(--border-color)' }}>
                <td className="sticky-col-left" colSpan={3} style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Briefcase size={15} style={{ color: '#38bdf8' }} />
                    <span>Production Prévue (Projets en jours)</span>
                  </div>
                </td>
                {periodes.map((p) => {
                  const enSurcharge = isPeriodeEnSurcharge(p.moisList);
                  let sumInternes = 0;
                  let sumExternes = 0;

                  filteredMatrice.forEach((item) => {
                    p.moisList.forEach((mNum) => {
                      const mDetail = item.moisDetails.find((md) => md.mois === mNum);
                      if (mDetail) {
                        sumInternes += mDetail.joursInternes;
                        sumExternes += mDetail.joursExternes;
                      }
                    });
                  });

                  const sumCumul = Number((sumInternes + sumExternes).toFixed(1));
                  sumInternes = Number(sumInternes.toFixed(1));
                  sumExternes = Number(sumExternes.toFixed(1));

                  return (
                    <td
                      key={p.key}
                      style={{
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        backgroundColor: enSurcharge ? 'rgba(239, 68, 68, 0.15)' : undefined
                      }}
                    >
                      {criterePopulation === 'internes' && (
                        <span style={{ color: enSurcharge ? '#f87171' : 'var(--primary-light)', fontWeight: 700 }}>
                          {sumInternes > 0 ? `${formatNumber(sumInternes, 1)}j` : '-'}
                        </span>
                      )}
                      {criterePopulation === 'externes' && (
                        <span style={{ color: enSurcharge ? '#f87171' : '#c084fc', fontWeight: 700 }}>
                          {sumExternes > 0 ? `${formatNumber(sumExternes, 1)}j` : '-'}
                        </span>
                      )}
                      {criterePopulation === 'cumul' && (
                        <div>
                          <div style={{ fontWeight: 700, color: enSurcharge ? '#f87171' : '#38bdf8' }}>
                            {sumCumul > 0 ? `${formatNumber(sumCumul, 1)}j` : '-'}
                          </div>
                          {sumCumul > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              <span style={{ color: enSurcharge ? '#f87171' : 'var(--primary-light)' }}>{formatNumber(sumInternes, 1)}I</span>
                              <span> / </span>
                              <span style={{ color: enSurcharge ? '#f87171' : '#c084fc' }}>{formatNumber(sumExternes, 1)}E</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(59, 130, 246, 0.15)' }}>
                  {(() => {
                    let totInt = 0;
                    let totExt = 0;
                    filteredMatrice.forEach((item) => {
                      totInt += item.totalAnneeInternes;
                      totExt += item.totalAnneeExternes;
                    });
                    const totCumul = Number((totInt + totExt).toFixed(1));
                    if (criterePopulation === 'internes') return `${formatNumber(totInt, 1)} j`;
                    if (criterePopulation === 'externes') return `${formatNumber(totExt, 1)} j`;
                    return `${formatNumber(totCumul, 1)} j`;
                  })()}
                </td>
                {onOpenVentilationProjet && <td></td>}
              </tr>

              {/* Ligne de séparation explicite des projets */}
              <tr style={{ background: 'var(--surface-hover)' }}>
                <td colSpan={periodes.length + 4 + (onOpenVentilationProjet ? 1 : 0)} style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Détail des charges projet par projet ({filteredMatrice.length} projet{filteredMatrice.length > 1 ? 's' : ''})
                </td>
              </tr>

              {/* === SECTION DÉTAIL DES PROJETS === */}
              {filteredMatrice.length === 0 ? (
                <tr>
                  <td colSpan={periodes.length + 4 + (onOpenVentilationProjet ? 1 : 0)} style={{ textAlign: 'center', padding: '32px' }}>
                    Aucun projet à afficher.
                  </td>
                </tr>
              ) : (
                groupedMatrice.map((group) => {
                  const showGroupHeader = groupBy !== 'none';
                  const isExpanded = expandedGroups.has(group.id);

                  // Calcul des sous-totaux pour l'en-tête de groupe
                  const groupTotalAnnee = group.items.reduce((sum, item) => {
                    let val = item.totalAnneeCumul;
                    if (criterePopulation === 'internes') val = item.totalAnneeInternes;
                    if (criterePopulation === 'externes') val = item.totalAnneeExternes;
                    return sum + (val || 0);
                  }, 0);

                  const groupPeriodTotals = periodes.map((pPeriode) => {
                    return group.items.reduce((sum, item) => {
                      let cellVal = 0;
                      pPeriode.moisList.forEach((m) => {
                        const mObj = item.moisDetails.find((x) => x.mois === m);
                        if (mObj) {
                          if (criterePopulation === 'internes') cellVal += mObj.joursInternes || 0;
                          else if (criterePopulation === 'externes') cellVal += mObj.joursExternes || 0;
                          else cellVal += mObj.totalMois || 0;
                        }
                      });
                      return sum + cellVal;
                    }, 0);
                  });

                  return (
                    <React.Fragment key={group.id}>
                      {showGroupHeader && (
                        <tr
                          onClick={() => toggleGroup(group.id)}
                          style={{
                            background: '#1e293b',
                            cursor: 'pointer',
                            userSelect: 'none',
                            borderTop: '2px solid rgba(56, 189, 248, 0.4)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
                          }}
                        >
                          <td className="sticky-col-left" style={{ fontWeight: 700, padding: '10px 14px', background: '#1e293b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center' }}>
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                              <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 700 }}>{group.label}</span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  fontWeight: 700
                                }}
                              >
                                {group.items.length} projet{group.items.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>—</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>—</td>

                          {/* Sous-totaux par période du groupe */}
                          {groupPeriodTotals.map((subTot, idx) => (
                            <td
                              key={`grp_${group.id}_p_${idx}`}
                              style={{
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                color: subTot > 0 ? '#38bdf8' : 'var(--text-muted)',
                                background: 'rgba(56, 189, 248, 0.05)'
                              }}
                            >
                              {subTot > 0 ? `${formatNumber(subTot, 1)}j` : '-'}
                            </td>
                          ))}

                          {/* Total annuel du groupe */}
                          <td
                            style={{
                              textAlign: 'center',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              color: '#38bdf8',
                              background: 'rgba(56, 189, 248, 0.15)'
                            }}
                          >
                            {groupTotalAnnee > 0 ? `${formatNumber(groupTotalAnnee, 1)} j` : '-'}
                          </td>

                          {onOpenVentilationProjet && <td></td>}
                        </tr>
                      )}

                      {(!showGroupHeader || isExpanded) &&
                        group.items.map((item) => {
                          const p = item.projet;
                          const leadNom = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA.nom : '-';

                          let totalAnneeDisplay = item.totalAnneeCumul;
                          if (criterePopulation === 'internes') totalAnneeDisplay = item.totalAnneeInternes;
                          if (criterePopulation === 'externes') totalAnneeDisplay = item.totalAnneeExternes;

                          return (
                            <tr key={p._id}>
                              <td
                                className="sticky-col-left"
                                style={{
                                  fontWeight: 600,
                                  paddingLeft: showGroupHeader ? '28px' : '12px'
                                }}
                              >
                                <div style={{ color: 'var(--text-main)' }}>{p.nom}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                                  {p.codeProjet && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {p.codeProjet}
                            </span>
                          )}
                          {(() => {
                            const comp = getCompletudeVentilation(p.totalPlanifie || 0, p.estimationRetenue || 0);
                            return (
                              <span className={`badge ${comp.badgeClass}`} style={{ fontSize: '0.68rem', padding: '1px 5px' }} title={comp.description}>
                                {comp.libelle}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                          {p.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{leadNom}</td>

                      {/* Ventilation selon la période sélectionnée */}
                      {periodes.map((pPeriode) => {
                        const moisNumber = pPeriode.moisList[0];
                        const isSingleMois = pPeriode.moisList.length === 1;

                        let valInt = 0;
                        let valExt = 0;

                        pPeriode.moisList.forEach((mNum) => {
                          const mDetail = item.moisDetails.find((md) => md.mois === mNum);
                          if (mDetail) {
                            valInt += mDetail.joursInternes;
                            valExt += mDetail.joursExternes;
                          }
                        });

                        const valCumul = valInt + valExt;
                        let valDisplay = valCumul;
                        if (criterePopulation === 'internes') valDisplay = valInt;
                        if (criterePopulation === 'externes') valDisplay = valExt;

                        const hasCharge = valDisplay > 0;
                        const enSurcharge = isPeriodeEnSurcharge(pPeriode.moisList);

                        const isCellEditing =
                          editingCell?.projetId === p._id && editingCell?.mois === moisNumber && isSingleMois;
                        const isCellModified = Boolean(
                          modifiedVentilations[p._id]?.[moisNumber] !== undefined && isSingleMois
                        );
                        const userCanEdit = isEditMode && canEditProjet(p) && isSingleMois;

                        return (
                          <td
                            key={pPeriode.key}
                            style={{
                              textAlign: 'center',
                              fontWeight: hasCharge ? 600 : 'normal',
                              color: hasCharge
                                ? enSurcharge
                                  ? '#f87171'
                                  : criterePopulation === 'internes'
                                  ? 'var(--primary-light)'
                                  : criterePopulation === 'externes'
                                  ? '#c084fc'
                                  : '#38bdf8'
                                : 'var(--text-muted)',
                              backgroundColor: isCellModified
                                ? 'rgba(245, 158, 11, 0.25)'
                                : enSurcharge
                                ? 'rgba(239, 68, 68, 0.15)'
                                : hasCharge
                                ? 'rgba(30, 41, 59, 0.4)'
                                : undefined,
                              border: isCellModified
                                ? '1px dashed #f59e0b'
                                : userCanEdit
                                ? '1px stroke rgba(245, 158, 11, 0.15)'
                                : undefined,
                              cursor: userCanEdit ? 'pointer' : 'default',
                              position: 'relative',
                              padding: isCellEditing ? '2px' : undefined
                            }}
                            onClick={() => {
                              if (userCanEdit && !isCellEditing) {
                                startEditingCell(item, moisNumber);
                              }
                            }}
                            title={
                              isCellModified
                                ? 'Modifié en mémoire (Non enregistré)'
                                : userCanEdit
                                ? 'Cliquer pour éditer cette cellule'
                                : undefined
                            }
                          >
                            {/* Pastille visuelle modification ambre */}
                            {isCellModified && !isCellEditing && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '2px',
                                  right: '3px',
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f59e0b'
                                }}
                              />
                            )}

                            {isCellEditing ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: criterePopulation === 'cumul' ? 'column' : 'row',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '2px',
                                  background: 'rgba(15, 23, 42, 0.95)',
                                  borderRadius: '4px',
                                  border: '1px solid #f59e0b'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {criterePopulation !== 'externes' && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    {criterePopulation === 'cumul' && (
                                      <span style={{ fontSize: '0.65rem', color: 'var(--primary-light)' }}>I:</span>
                                    )}
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      className="form-input"
                                      style={{
                                        width: criterePopulation === 'cumul' ? '52px' : '65px',
                                        padding: '2px 4px',
                                        fontSize: '0.78rem',
                                        textAlign: 'center',
                                        height: '24px'
                                      }}
                                      autoFocus
                                      value={editValues.joursInternes}
                                      onChange={(e) =>
                                        setEditValues({ ...editValues, joursInternes: e.target.value })
                                      }
                                      onKeyDown={(e) => handleKeyDownCell(e, item, moisNumber)}
                                    />
                                  </div>
                                )}

                                {criterePopulation !== 'internes' && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    {criterePopulation === 'cumul' && (
                                      <span style={{ fontSize: '0.65rem', color: '#c084fc' }}>E:</span>
                                    )}
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      className="form-input"
                                      style={{
                                        width: criterePopulation === 'cumul' ? '52px' : '65px',
                                        padding: '2px 4px',
                                        fontSize: '0.78rem',
                                        textAlign: 'center',
                                        height: '24px'
                                      }}
                                      autoFocus={criterePopulation === 'externes'}
                                      value={editValues.joursExternes}
                                      onChange={(e) =>
                                        setEditValues({ ...editValues, joursExternes: e.target.value })
                                      }
                                      onKeyDown={(e) => handleKeyDownCell(e, item, moisNumber)}
                                    />
                                  </div>
                                )}

                                <div style={{ display: 'flex', gap: '2px' }}>
                                  <button
                                    className="btn btn-success"
                                    style={{ padding: '1px 3px', height: '20px', fontSize: '0.7rem' }}
                                    onClick={commitEditingCell}
                                    title="Valider"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '1px 3px', height: '20px', fontSize: '0.7rem' }}
                                    onClick={() => setEditingCell(null)}
                                    title="Annuler"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span>{hasCharge ? `${formatNumber(valDisplay, 1)}j` : '-'}</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Année du Projet */}
                      <td
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          color: '#38bdf8',
                          background: 'rgba(59, 130, 246, 0.1)'
                        }}
                      >
                        {totalAnneeDisplay > 0 ? `${formatNumber(totalAnneeDisplay, 1)} j` : '-'}
                      </td>

                      {onOpenVentilationProjet && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            title="Modifier la ventilation de ce projet"
                            onClick={() => onOpenVentilationProjet(p)}
                          >
                            <Edit2 size={13} />
                          </button>
                        </td>
                      )}
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

      {/* Bandeau d'Action Flottant lors de modifications non enregistrées */}
      {countModifiedProjects > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            marginTop: '16px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid #f59e0b',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            zIndex: 50
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                boxShadow: '0 0 8px #f59e0b'
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fef08a' }}>
              ⚠️ {countModifiedProjects} projet(s) avec des modifications de ventilation non enregistrées
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleCancelAll}
              disabled={saving}
            >
              <RotateCcw size={15} /> Annuler les modifications
            </button>

            <button
              className="btn btn-success"
              style={{
                fontSize: '0.85rem',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700
              }}
              onClick={handleSaveAll}
              disabled={saving}
            >
              <Save size={15} /> {saving ? 'Enregistrement...' : 'Enregistrer tout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
