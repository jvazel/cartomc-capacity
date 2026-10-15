import React, { useState, useEffect } from 'react';
import { IPlanningMatriceResponse, IPlanningRessourceItem, INonAssigneItem, IRessource } from '../types';
import {
  Users,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Calendar,
  Layers,
  Shield,
  Info,
  ChevronDown,
  ChevronRight,
  BarChart2,
  ListFilter,
  X,
  UserCheck,
  Columns,
  Sparkles,
  MoveDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { QuickStaffingModal } from './QuickStaffingModal';

interface PlanningRessourcesGanttProps {
  annee: number;
  onSwitchToProjets?: () => void;
}

const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const NOMS_MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const COLORS_PRIORITE: { [key: string]: string } = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#3b82f6',
  P4: '#8b5cf6',
  RUN: '#0284c7',
  Autres: '#64748b'
};

const COLORS_TYPES: { [key: string]: string } = {
  RUN: '#0284c7',
  Projet: '#06b6d4',
  'Projet Opex': '#8b5cf6',
  Reco: '#10b981',
  "Vie d'entreprise": '#ec4899'
};

export const PlanningRessourcesGantt: React.FC<PlanningRessourcesGanttProps> = ({ annee, onSwitchToProjets }) => {
  const { role, leadBARessource } = useAuth();
  const { showSuccess, showDanger } = useToast();

  const [data, setData] = useState<IPlanningMatriceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'Tous' | 'Interne' | 'Externe'>('Tous');
  const [filterRole, setFilterRole] = useState<string>('Tous');
  const [filterCharge, setFilterCharge] = useState<'Tous' | 'Surcharges' | 'Disponibles'>('Tous');

  // Mode de visualisation : 'cartes' (cellules synthétiques mensuelles) vs 'barres' (Timeline Gantt détaillée)
  const [displayMode, setDisplayMode] = useState<'barres' | 'cartes'>('barres');

  // Granularité temporelle : 'mois' (12 mois) ou 'semaine' (découpage chirurgical par semaine du mois ciblé)
  const [granularite, setGranularite] = useState<'mois' | 'semaine'>('mois');
  const [moisFocusSemaine, setMoisFocusSemaine] = useState<number>(new Date().getMonth() + 1);

  // Split-Screen : volet dédié au Panier de Charge Non Staffée
  const [splitScreenOpen, setSplitScreenOpen] = useState<boolean>(true);
  const [filterBasketMois, setFilterBasketMois] = useState<number | 'tous'>('tous');

  // Drag and Drop d'un projet non staffé vers une cellule de collaborateur
  const [draggedProject, setDraggedProject] = useState<{
    projetId: string;
    codeProjet?: string;
    nomProjet: string;
    typeProjet: string;
    priorite?: string | null;
    mois: number;
    joursRestants: number;
  } | null>(null);

  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null); // `${ressourceId}_${mois}`

  // Cible de staffing modal (lors du drop ou clic rapide)
  const [quickStaffingTarget, setQuickStaffingTarget] = useState<{
    ressource: IRessource;
    projet: { _id: string; nom: string; codeProjet?: string };
    mois: number;
    joursExistants: number;
  } | null>(null);


  // Collaborateurs dont le sous-détail Gantt par projet est déplié
  const [expandedRessources, setExpandedRessources] = useState<Set<string>>(new Set());

  // Mois sélectionné pour popin ou focus (1-12)
  const [hoveredDetail, setHoveredDetail] = useState<{
    nom: string;
    mois: number;
    projets: any[];
    capaciteNette: number;
    absences: number;
    totalAffecte: number;
  } | null>(null);

  const fetchPlanning = () => {
    setLoading(true);
    fetch(`/api/ressources/planning/matrice?annee=${annee}`)
      .then((res) => res.json())
      .then((resData: IPlanningMatriceResponse) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement planning ressources:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPlanning();
  }, [annee]);

  const canUserStaff = (): boolean => {
    if (role === 'Admin') return true;
    if (role === 'LeadBA') return true;
    return false;
  };

  const handleOpenStaffing = async (
    targetRessource: IRessource,
    targetProject: { projetId: string; nomProjet: string; codeProjet?: string },
    mois: number,
    suggestedJours?: number
  ) => {
    if (!canUserStaff()) {
      showDanger('Action réservée aux Administrateurs et Lead BAs.');
      return;
    }

    try {
      const res = await fetch(`/api/projets/${targetProject.projetId}/ventilation?annee=${annee}`);
      const ventilations = await res.json();
      const currentMonthVent = Array.isArray(ventilations) ? ventilations.find((v: any) => v.mois === mois) : null;
      const currentAffs = currentMonthVent?.affectations || [];
      const existingAff = currentAffs.find((a: any) => a.ressourceId === targetRessource._id);

      setQuickStaffingTarget({
        ressource: targetRessource,
        projet: {
          _id: targetProject.projetId,
          nom: targetProject.nomProjet,
          codeProjet: targetProject.codeProjet
        },
        mois,
        joursExistants: existingAff ? existingAff.jours : (suggestedJours || 0)
      });
    } catch (err: any) {
      setQuickStaffingTarget({
        ressource: targetRessource,
        projet: {
          _id: targetProject.projetId,
          nom: targetProject.nomProjet,
          codeProjet: targetProject.codeProjet
        },
        mois,
        joursExistants: suggestedJours || 0
      });
    }
  };

  const handleConfirmStaffing = async (jours: number) => {
    if (!quickStaffingTarget) return;
    const { ressource, projet, mois } = quickStaffingTarget;

    try {
      const res = await fetch(`/api/projets/${projet._id}/ventilation?annee=${annee}`);
      const ventilations = await res.json();
      if (!Array.isArray(ventilations)) {
        throw new Error('Impossible de charger la ventilation.');
      }

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

        return {
          mois: v.mois,
          joursInternes: v.joursInternes,
          joursExternes: v.joursExternes,
          affectations: affs
        };
      });

      const saveRes = await fetch(`/api/projets/${projet._id}/ventilation/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annee, items: updatedItems })
      });

      if (!saveRes.ok) {
        throw new Error("Erreur lors de l'enregistrement de l'affectation.");
      }

      showSuccess(`Staffing validé : ${ressource.nom} affecté(e) à ${projet.nom} (${jours}j en ${NOMS_MOIS[mois - 1]})`);
      setQuickStaffingTarget(null);
      setDraggedProject(null);
      setDragOverCellKey(null);
      fetchPlanning();
    } catch (err: any) {
      showDanger(err.message || 'Erreur lors du staffing.');
    }
  };


  // Configuration dynamique des périodes (Mois ou Semaines du mois sélectionné) - DOIT ÊTRE AVANT TOUT RETURN CONDITIONNEL (Rules of Hooks)
  const periodesPlanning = React.useMemo(() => {
    if (granularite === 'semaine') {
      const nbJoursDansMois = new Date(annee, moisFocusSemaine, 0).getDate();
      const nomMoisCourt = NOMS_MOIS_COURTS[moisFocusSemaine - 1];

      const getISOWeekNumber = (date: Date): number => {
        const target = new Date(date.valueOf());
        const dayNr = (date.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
          target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      };

      const tranches = [
        { start: 1, end: 7, refDay: 4 },
        { start: 8, end: 14, refDay: 11 },
        { start: 15, end: 21, refDay: 18 },
        { start: 22, end: 28, refDay: 25 },
        ...(nbJoursDansMois > 28 ? [{ start: 29, end: nbJoursDansMois, refDay: Math.min(29, nbJoursDansMois) }] : [])
      ];

      const totalTranches = tranches.length;

      return tranches.map((t, idx) => {
        const refDate = new Date(annee, moisFocusSemaine - 1, t.refDay);
        const isoWeekNum = getISOWeekNumber(refDate);

        return {
          key: `W_${moisFocusSemaine}_${isoWeekNum}_${idx}`,
          label: `S${isoWeekNum} (${t.start}-${t.end} ${nomMoisCourt})`,
          mois: moisFocusSemaine,
          isWeek: true,
          weekFraction: 1 / totalTranches,
          weekNum: isoWeekNum
        };
      });
    }

    return Array.from({ length: 12 }, (_, i) => ({
      key: `M_${i + 1}`,
      label: `${NOMS_MOIS_COURTS[i]} ${annee}`,
      mois: i + 1,
      isWeek: false,
      weekFraction: 1,
      weekNum: undefined
    }));
  }, [granularite, annee, moisFocusSemaine]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Chargement du planning individuel des ressources...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Aucune donnée disponible pour l'année {annee}.
      </div>
    );
  }

  // Filtrage des ressources
  const filteredRessources = (data.ressources || []).filter((item) => {
    const r = item.ressource;
    const matchSearch =
      r.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'Tous' || r.type === filterType;
    const matchRole = filterRole === 'Tous' || r.role === filterRole;

    // Filtre sur état de charge annuel
    let matchCharge = true;
    if (filterCharge === 'Surcharges') {
      matchCharge = item.moisPlanning.some((m) => m.statutCharge === 'SURCHARGE');
    } else if (filterCharge === 'Disponibles') {
      matchCharge = item.moisPlanning.some((m) => m.statutCharge === 'DISPONIBLE' && m.capaciteNette > m.totalJoursAffectes);
    }

    return matchSearch && matchType && matchRole && matchCharge;
  });

  const uniqueRoles = Array.from(new Set((data.ressources || []).map((r) => r.ressource.role))).filter(Boolean);

  // Calcul synthétique du non assigné annuel
  let totalNonAssigneInterneAn = 0;
  let totalNonAssigneExterneAn = 0;
  for (let m = 1; m <= 12; m++) {
    const nonAssMois = data.nonAssignesParMois[m] || { totalInterne: 0, totalExterne: 0 };
    totalNonAssigneInterneAn += nonAssMois.totalInterne || 0;
    totalNonAssigneExterneAn += nonAssMois.totalExterne || 0;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Barre de Filtres & Contrôles Épurée */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Ligne 1 : Filtres de recherche, typologie et santé de charge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
            {/* Champ de recherche stylisé */}
            <div className="search-box" style={{ minWidth: '280px', maxWidth: '360px', height: '36px' }}>
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filtrer collaborateur, rôle, matricule..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  title="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sélecteur Population */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.5)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Type :</span>
              <select
                className="form-select"
                style={{ width: '105px', padding: '3px 6px', fontSize: '0.8rem', height: '28px', border: 'none', background: 'transparent' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="Tous">Tous</option>
                <option value="Interne">Internes</option>
                <option value="Externe">Externes</option>
              </select>
            </div>

            {/* Sélecteur Rôle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.5)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Rôle :</span>
              <select
                className="form-select"
                style={{ width: '130px', padding: '3px 6px', fontSize: '0.8rem', height: '28px', border: 'none', background: 'transparent' }}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="Tous">Tous ({uniqueRoles.length})</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* Sélecteur Santé Charge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.5)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Charge :</span>
              <select
                className="form-select"
                style={{ width: '150px', padding: '3px 6px', fontSize: '0.8rem', height: '28px', border: 'none', background: 'transparent' }}
                value={filterCharge}
                onChange={(e) => setFilterCharge(e.target.value as any)}
              >
                <option value="Tous">Toutes charges</option>
                <option value="Surcharges">🚨 En surcharge (&gt;100%)</option>
                <option value="Disponibles">🟢 Avec dispo (&lt;85%)</option>
              </select>
            </div>
          </div>

          {/* Raccourci Dépliage Global */}
          {displayMode === 'barres' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem', height: '28px', border: '1px solid rgba(148, 163, 184, 0.2)' }}
                onClick={() => {
                  const allIds = new Set(filteredRessources.map((it) => it.ressource._id));
                  setExpandedRessources(allIds);
                }}
                title="Déplier tous les projets sous chaque collaborateur"
              >
                Tout déplier
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem', height: '28px', border: '1px solid rgba(148, 163, 184, 0.2)' }}
                onClick={() => setExpandedRessources(new Set())}
                title="Replier tous les projets"
              >
                Tout replier
              </button>
            </div>
          )}
        </div>

        {/* Ligne 2 : Toggles Granularité, Arbitrage Court Terme M/M+1, Mode Barres/Grille et Légende */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.08)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Bascule Granularité Mois vs Semaine */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <button
                type="button"
                className={`btn ${granularite === 'mois' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.78rem', height: '28px', border: 'none', borderRadius: '6px' }}
                onClick={() => setGranularite('mois')}
                title="Afficher la vision annuelle sur 12 mois"
              >
                12 Mois
              </button>
              <button
                type="button"
                className={`btn ${granularite === 'semaine' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.78rem', height: '28px', border: 'none', borderRadius: '6px' }}
                onClick={() => setGranularite('semaine')}
                title="Zoomer sur le découpage chirurgical par semaines (S1 à S5) du mois focus"
              >
                🔍 Semaines
              </button>
            </div>

            {/* Sélecteur de Mois Focus & Raccourcis d'Arbitrage M / M+1 (Design Segmenté Épuré) */}
            {granularite === 'semaine' && (() => {
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

            {/* Bascule Mode Barres Gantt vs Grille Synthétique */}
            <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <button
                type="button"
                className={`btn ${displayMode === 'barres' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.78rem', height: '28px', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setDisplayMode('barres')}
                title="Afficher sous forme de Timeline Gantt avec barres horizontales colorées par projet"
              >
                <BarChart2 size={13} /> Barres Gantt
              </button>
              <button
                type="button"
                className={`btn ${displayMode === 'cartes' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.78rem', height: '28px', border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setDisplayMode('cartes')}
                title="Afficher sous forme de grille compacte avec cartes chiffrées"
              >
                <Calendar size={13} /> Grille Synthétique
              </button>
            </div>

            {/* Bouton Split-Screen Panier Non Staffé */}
            <button
              type="button"
              className={`btn ${splitScreenOpen ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '4px 12px',
                fontSize: '0.78rem',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: splitScreenOpen ? '#f59e0b' : 'rgba(245, 158, 11, 0.4)',
                background: splitScreenOpen ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: splitScreenOpen ? '#fbbf24' : 'var(--text-muted)'
              }}
              onClick={() => setSplitScreenOpen(!splitScreenOpen)}
              title="Afficher/masquer le volet supérieur Split-Screen de charge non staffée"
            >
              <Columns size={13} />
              <span>🛒 Panier Split-Screen</span>
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.3)',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#fef08a'
                }}
              >
                {(totalNonAssigneInterneAn + totalNonAssigneExterneAn).toFixed(0)}j
              </span>
            </button>

            {/* Bouton Inversion Dimensionnelle (P4 - Visual Planning) */}
            {onSwitchToProjets && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: 'rgba(6, 182, 212, 0.4)',
                  background: 'rgba(6, 182, 212, 0.1)',
                  color: '#38bdf8'
                }}
                onClick={onSwitchToProjets}
                title="Pivoter instantanément vers la vue chronologique Portefeuille Projets"
              >
                <span>🔄 Vue Projets</span>
              </button>
            )}

          </div>

          {/* Légende épurée */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              Dispo (&lt;85%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }}></span>
              Optimal (85-100%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span>
              Surcharge (&gt;100%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }}></span>
              CP / Absences
            </span>
          </div>
        </div>
      </div>

      {/* VOLET SUPÉRIEUR SPLIT-SCREEN : PANIER DE CHARGE NON STAFFÉE (STYLE VISUAL PLANNING) */}
      {splitScreenOpen && (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'linear-gradient(180deg, rgba(20, 26, 38, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
            boxShadow: '0 8px 30px -5px rgba(245, 158, 11, 0.15)'
          }}
        >
          {/* Header du Panier */}
          <div className="split-screen-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Layers size={18} color="#fbbf24" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🛒 Panier de Charge Projets Non Staffée</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: '#fef08a'
                    }}
                  >
                    {(totalNonAssigneInterneAn + totalNonAssigneExterneAn).toFixed(1)} J.H à pourvoir en {annee}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={12} color="#38bdf8" />
                  <span>
                    Glissez-déposez un bloc projet ci-dessous vers le collaborateur de votre choix, ou cliquez sur <strong>[+ Affecter]</strong>.
                  </span>
                </div>
              </div>
            </div>

            {/* Filtre par mois du panier */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Mois :</span>
              <select
                className="form-select"
                style={{ width: '135px', padding: '3px 8px', fontSize: '0.78rem', height: '28px', background: 'rgba(15, 23, 42, 0.7)' }}
                value={filterBasketMois}
                onChange={(e) => setFilterBasketMois(e.target.value === 'tous' ? 'tous' : Number(e.target.value))}
              >
                <option value="tous">Tous les mois ({annee})</option>
                {NOMS_MOIS.map((nm, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {nm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grille horizontale des projets du Panier */}
          <div style={{ padding: '14px 18px', overflowX: 'auto', display: 'flex', gap: '14px', alignItems: 'stretch' }}>
            {(() => {
              // Filtrer et agréger les items non assignés
              const basketItems: Array<{
                mois: number;
                nomMois: string;
                items: INonAssigneItem[];
                totalJours: number;
              }> = [];

              for (let m = 1; m <= 12; m++) {
                if (filterBasketMois !== 'tous' && filterBasketMois !== m) continue;
                const mData = data.nonAssignesParMois[m];
                if (!mData) continue;
                const allProjects = [...(mData.interne || []), ...(mData.externe || [])];
                if (allProjects.length > 0) {
                  basketItems.push({
                    mois: m,
                    nomMois: NOMS_MOIS_COURTS[m - 1],
                    items: allProjects,
                    totalJours: Number((mData.totalInterne + mData.totalExterne).toFixed(1))
                  });
                }
              }

              if (basketItems.length === 0) {
                return (
                  <div style={{ width: '100%', padding: '20px', textAlign: 'center', color: '#10b981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <CheckCircle size={18} color="#10b981" />
                    <span>Tous les projets sont 100% staffés pour la sélection. Aucune charge orpheline !</span>
                  </div>
                );
              }

              return basketItems.map((bGroup) => (
                <div
                  key={bGroup.mois}
                  style={{
                    minWidth: '220px',
                    maxWidth: '240px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flexShrink: 0
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#38bdf8' }}>
                      📅 {bGroup.nomMois} {annee}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {bGroup.totalJours}j
                    </span>
                  </div>

                  {/* Cartes Projets Draggables */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {bGroup.items.map((proj, pIdx) => {
                      const pColor = COLORS_TYPES[proj.typeProjet] || COLORS_PRIORITE[proj.priorite || 'Autres'] || '#06b6d4';
                      const isBeingDragged = draggedProject?.projetId === proj.projetId && draggedProject?.mois === bGroup.mois;

                      return (
                        <div
                          key={`${proj.projetId}_${pIdx}`}
                          draggable={canUserStaff()}
                          onDragStart={(e) => {
                            setDraggedProject({
                              projetId: proj.projetId,
                              codeProjet: proj.codeProjet,
                              nomProjet: proj.nomProjet,
                              typeProjet: proj.typeProjet,
                              priorite: proj.priorite,
                              mois: bGroup.mois,
                              joursRestants: proj.jours
                            });
                            e.dataTransfer.setData('text/plain', proj.projetId);
                            e.dataTransfer.effectAllowed = 'copyMove';
                          }}
                          onDragEnd={() => {
                            setDraggedProject(null);
                            setDragOverCellKey(null);
                          }}
                          className="unstaffed-draggable-chip"
                          style={{
                            background: isBeingDragged ? 'rgba(6, 182, 212, 0.25)' : 'rgba(30, 41, 59, 0.85)',
                            border: `1px solid ${pColor}70`,
                            borderLeft: `4px solid ${pColor}`,
                            borderRadius: '6px',
                            padding: '6px 8px',
                            opacity: isBeingDragged ? 0.5 : 1,
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                          }}
                          title={`Glissez ce projet sur la grille d'un collaborateur pour le mois de ${bGroup.nomMois}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  color: '#f8fafc',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {proj.codeProjet ? `[${proj.codeProjet}] ` : ''}{proj.nomProjet}
                              </div>
                              <div style={{ fontSize: '0.64rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{proj.typeProjet}</span>
                                {proj.priorite && <span>• {proj.priorite}</span>}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: '#fbbf24',
                                background: 'rgba(0, 0, 0, 0.4)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                flexShrink: 0
                              }}
                            >
                              {proj.jours}j
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Grille Planning Multidimensionnelle */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="table-container" style={{ maxHeight: '720px', overflowX: 'auto', overflowY: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead>
              <tr style={{ background: '#0b1329' }}>
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 20,
                    minWidth: '280px',
                    maxWidth: '300px',
                    background: '#0b1329',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRight: '1px solid rgba(148, 163, 184, 0.15)',
                    padding: '12px 18px',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={15} style={{ color: 'var(--primary)' }} />
                    <span>Collaborateurs ({filteredRessources.length})</span>
                  </div>
                </th>
                {periodesPlanning.map((p) => (
                  <th
                    key={p.key}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      minWidth: p.isWeek ? '105px' : '95px',
                      textAlign: 'center',
                      background: '#0b1329',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                      borderRight: '1px solid rgba(148, 163, 184, 0.08)',
                      padding: '10px 6px',
                      color: p.isWeek ? '#38bdf8' : 'var(--text-main)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      letterSpacing: '0.02em'
                    }}
                  >
                    <div>{p.label}</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* SECTION 1 : RÉSERVOIR DE CHARGE NON ASSIGNÉE (STYLE VISUAL PLANNING) */}
              <tr
                style={{
                  background: 'linear-gradient(90deg, rgba(217, 119, 6, 0.12) 0%, rgba(217, 119, 6, 0.03) 100%)',
                  borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.3)'
                }}
              >
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    background: '#161a24',
                    padding: '10px 18px',
                    borderRight: '1px solid rgba(245, 158, 11, 0.25)',
                    borderBottom: '1px solid rgba(245, 158, 11, 0.2)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Layers size={16} color="#fbbf24" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.85rem' }}>
                        📥 Charge Non Staffée
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {granularite === 'semaine'
                          ? `Focus : ${NOMS_MOIS_COURTS[moisFocusSemaine - 1]} ${annee}`
                          : `Total : ${(totalNonAssigneInterneAn + totalNonAssigneExterneAn).toFixed(1)}j (${totalNonAssigneInterneAn.toFixed(1)}j Int / ${totalNonAssigneExterneAn.toFixed(1)}j Ext)`}
                      </div>
                    </div>
                  </div>
                </td>

                {periodesPlanning.map((pPeriode) => {
                  const m = pPeriode.mois;
                  const nonAss = data.nonAssignesParMois[m] || { interne: [], externe: [], totalInterne: 0, totalExterne: 0 };
                  let rawNonAss = (nonAss.totalInterne + nonAss.totalExterne);
                  if (pPeriode.isWeek && pPeriode.weekFraction) {
                    rawNonAss = rawNonAss * pPeriode.weekFraction;
                  }
                  const totalNonAss = Number(rawNonAss.toFixed(1));

                  return (
                    <td
                      key={pPeriode.key}
                      style={{
                        padding: '6px 4px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        background: totalNonAss > 0 ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
                        borderRight: '1px solid rgba(148, 163, 184, 0.08)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.2)'
                      }}
                    >
                      {totalNonAss > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                          <span
                            style={{
                              background: 'rgba(217, 119, 6, 0.25)',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              color: '#fef08a',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                            title={`${nonAss.totalInterne}j Internes + ${nonAss.totalExterne}j Externes non staffés`}
                          >
                            {totalNonAss}j
                          </span>

                          {/* Liste compacte des projets non staffés cliquables et draggables */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', maxWidth: '90px' }}>
                            {[...nonAss.interne, ...nonAss.externe].slice(0, 1).map((p, idx) => (
                              <div
                                key={idx}
                                draggable={canUserStaff()}
                                onDragStart={(e) => {
                                  setDraggedProject({
                                    projetId: p.projetId,
                                    codeProjet: p.codeProjet,
                                    nomProjet: p.nomProjet,
                                    typeProjet: p.typeProjet,
                                    priorite: p.priorite,
                                    mois: m,
                                    joursRestants: p.jours
                                  });
                                  e.dataTransfer.setData('text/plain', p.projetId);
                                  e.dataTransfer.effectAllowed = 'copyMove';
                                }}
                                onDragEnd={() => {
                                  setDraggedProject(null);
                                  setDragOverCellKey(null);
                                }}
                                className="unstaffed-draggable-chip"
                                style={{
                                  fontSize: '0.65rem',
                                  background: 'rgba(0, 0, 0, 0.6)',
                                  borderRadius: '3px',
                                  padding: '1px 3px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: '#e2e8f0',
                                  border: '1px dashed rgba(245, 158, 11, 0.4)'
                                }}
                                title={`${p.nomProjet} (${p.jours}j) - Glissez sur une ressource`}
                              >
                                {p.nomProjet}
                              </div>
                            ))}
                            {[...nonAss.interne, ...nonAss.externe].length > 1 && (
                              <div style={{ fontSize: '0.62rem', color: '#fbbf24' }}>
                                +{[...nonAss.interne, ...nonAss.externe].length - 1} proj.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'rgba(148, 163, 184, 0.2)' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>


              {/* SECTION 2 : LIGNES PAR COLLABORATEUR */}
              {filteredRessources.map((item) => {
                const r = item.ressource;
                const totalJoursAn = item.moisPlanning.reduce((s, m) => s + m.totalJoursAffectes, 0);
                const totalCapNetteAn = item.moisPlanning.reduce((s, m) => s + m.capaciteNette, 0);
                const tauxOccupationAn = totalCapNetteAn > 0 ? Math.round((totalJoursAn / totalCapNetteAn) * 100) : 0;
                const isExpanded = expandedRessources.has(r._id);

                // Extraction de tous les projets distincts sur lesquels la ressource intervient cette année
                const projetsDistinctsMap = new Map<string, {
                  projetId: string;
                  nomProjet: string;
                  codeProjet?: string;
                  typeProjet: string;
                  priorite?: string | null;
                  totalJours: number;
                  moisAffectes: { [mois: number]: number };
                }>();

                item.moisPlanning.forEach((m) => {
                  (m.projets || []).forEach((p) => {
                    const pid = p.projetId ? p.projetId.toString() : p.nomProjet;
                    if (!projetsDistinctsMap.has(pid)) {
                      projetsDistinctsMap.set(pid, {
                        projetId: pid,
                        nomProjet: p.nomProjet,
                        codeProjet: p.codeProjet,
                        typeProjet: p.typeProjet,
                        priorite: p.priorite,
                        totalJours: 0,
                        moisAffectes: {}
                      });
                    }
                    const entry = projetsDistinctsMap.get(pid)!;
                    entry.totalJours = Number((entry.totalJours + p.jours).toFixed(1));
                    entry.moisAffectes[m.mois] = Number(((entry.moisAffectes[m.mois] || 0) + p.jours).toFixed(1));
                  });
                });

                const projetsList = Array.from(projetsDistinctsMap.values()).sort((a, b) => b.totalJours - a.totalJours);

                const toggleExpand = () => {
                  const next = new Set(expandedRessources);
                  if (next.has(r._id)) {
                    next.delete(r._id);
                  } else {
                    next.add(r._id);
                  }
                  setExpandedRessources(next);
                };

                return (
                  <React.Fragment key={r._id}>
                    {/* LIGNE PRINCIPALE DE SYNTHÈSE DU COLLABORATEUR */}
                    <tr
                      style={{
                        borderBottom: isExpanded && displayMode === 'barres' ? '1px dashed rgba(148, 163, 184, 0.2)' : '1px solid rgba(148, 163, 184, 0.1)',
                        background: isExpanded && displayMode === 'barres' ? 'rgba(30, 41, 59, 0.35)' : 'transparent'
                      }}
                    >
                      {/* Colonne Figée Collaborateur Élégante */}
                      <td
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          background: isExpanded && displayMode === 'barres' ? '#111b2e' : '#0d1527',
                          padding: '10px 14px',
                          borderRight: '1px solid rgba(148, 163, 184, 0.15)',
                          borderBottom: isExpanded && displayMode === 'barres' ? '1px dashed rgba(148, 163, 184, 0.15)' : '1px solid rgba(148, 163, 184, 0.08)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            {displayMode === 'barres' && (
                              <button
                                type="button"
                                onClick={toggleExpand}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(148, 163, 184, 0.15)',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '22px',
                                  height: '22px',
                                  flexShrink: 0
                                }}
                                title={isExpanded ? 'Replier les projets' : 'Déplier les barres Gantt de chaque projet'}
                              >
                                {isExpanded ? <ChevronDown size={14} color="var(--primary)" /> : <ChevronRight size={14} />}
                              </button>
                            )}

                            {/* Avatar circulaire élégant avec initiales */}
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: r.type === 'Interne'
                                  ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                                  : 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                flexShrink: 0,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                              }}
                              title={`${r.nom} (${r.type})`}
                            >
                              {r.nom
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>

                            {/* Informations Nominatives */}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }} title={r.nom}>
                                  {r.nom}
                                </span>
                                {r.estLeadBA && (
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: 'rgba(192, 132, 252, 0.18)',
                                      color: '#d8b4fe',
                                      border: '1px solid rgba(192, 132, 252, 0.35)',
                                      fontWeight: 600
                                    }}
                                  >
                                    Lead
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ whiteSpace: 'nowrap' }}>{r.role}</span>
                                <span>•</span>
                                <span style={{ color: r.type === 'Interne' ? '#38bdf8' : '#c084fc', fontWeight: 500 }}>{r.type}</span>
                                <span>•</span>
                                <span>{Math.round(r.tauxActivite * 100)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Badge Taux d'occupation global annuel */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background:
                                  tauxOccupationAn > 100
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : tauxOccupationAn >= 85
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : 'rgba(16, 185, 129, 0.2)',
                                border:
                                  tauxOccupationAn > 100
                                    ? '1px solid rgba(239, 68, 68, 0.4)'
                                    : tauxOccupationAn >= 85
                                    ? '1px solid rgba(245, 158, 11, 0.4)'
                                    : '1px solid rgba(16, 185, 129, 0.4)',
                                color:
                                  tauxOccupationAn > 100
                                    ? '#f87171'
                                    : tauxOccupationAn >= 85
                                    ? '#fbbf24'
                                    : '#34d399'
                              }}
                              title={`Total affecté: ${totalJoursAn.toFixed(1)}j / Capacité nette: ${totalCapNetteAn.toFixed(1)}j`}
                            >
                              {tauxOccupationAn}%
                            </div>
                            {displayMode === 'barres' && projetsList.length > 0 && (
                              <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                {projetsList.length} proj.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Heatstrip Annuel Continu (12 Segments Mensuels avec Code Couleur Saturation / Congés) */}
                          <div
                            className="heatstrip-container"
                            title="Heatstrip annuel : Vert (<85%), Ambre (85-100%), Rouge (>100% Surcharge), Violet (≥50% Congés)"
                          >
                            {Array.from({ length: 12 }, (_, idx) => {
                              const moisNum = idx + 1;
                              const mData = item.moisPlanning.find((mp) => mp.mois === moisNum);
                              if (!mData || !mData.estActif) {
                                return (
                                  <div
                                    key={moisNum}
                                    className="heatstrip-segment"
                                    style={{ background: 'rgba(148, 163, 184, 0.15)' }}
                                    title={`${NOMS_MOIS_COURTS[idx]} : Inactif`}
                                  />
                                );
                              }

                              const jAffectes = mData.totalJoursAffectes;
                              const capNette = mData.capaciteNette;
                              const capTheo = mData.capaciteTheorique;
                              const abs = mData.absences;
                              const pct = mData.tauxOccupation;
                              const isOverbooked = jAffectes > capNette;
                              const isHeavyAbsences = capTheo > 0 && abs / capTheo >= 0.5;

                              let segColor = '#10b981'; // Vert
                              let segClass = '';

                              if (isOverbooked) {
                                segColor = '#ef4444'; // Rouge vif surcharge
                                segClass = 'surcharge';
                              } else if (isHeavyAbsences) {
                                segColor = '#c084fc'; // Violet congés massifs
                              } else if (pct >= 85) {
                                segColor = '#f59e0b'; // Ambre optimal
                              } else if (pct === 0) {
                                segColor = 'rgba(16, 185, 129, 0.35)'; // Disponible libre
                              }

                              const isFocused = granularite === 'semaine' && moisFocusSemaine === moisNum;

                              return (
                                <div
                                  key={moisNum}
                                  onClick={() => {
                                    setGranularite('semaine');
                                    setMoisFocusSemaine(moisNum);
                                  }}
                                  className={`heatstrip-segment ${segClass} ${isFocused ? 'is-focus-month' : ''}`}
                                  style={{
                                    background: segColor,
                                    color: segColor
                                  }}
                                  title={`${NOMS_MOIS[idx]} ${annee} : ${jAffectes}j affectés / ${capNette}j nets (${pct}%) • ${abs}j congés (Cliquer pour zoomer S1-S5)`}
                                />
                              );
                            })}
                          </div>
                      </td>

                      {/* Colonnes de Périodes (12 Mois ou Semaines ISO du mois focus) pour ce Collaborateur */}
                      {periodesPlanning.map((pPeriode) => {
                        const m = item.moisPlanning.find((mp) => mp.mois === pPeriode.mois);
                        if (!m || !m.estActif) {
                          return (
                            <td
                              key={pPeriode.key}
                              style={{
                                background: 'rgba(15, 23, 42, 0.4)',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                color: 'rgba(148, 163, 184, 0.4)',
                                borderRight: '1px solid rgba(148, 163, 184, 0.05)'
                              }}
                            >
                              Inactif
                            </td>
                          );
                        }

                        // Données adaptées à la fraction de semaine
                        const fraction = pPeriode.isWeek && pPeriode.weekFraction ? pPeriode.weekFraction : 1;
                        const totalJoursPeriod = Number((m.totalJoursAffectes * fraction).toFixed(1));
                        const capNettePeriod = Number((m.capaciteNette * fraction).toFixed(1));
                        const absencesPeriod = Number((m.absences * fraction).toFixed(1));
                        const pctPeriod = capNettePeriod > 0 ? Math.round((totalJoursPeriod / capNettePeriod) * 100) : 0;
                        const isOverbookedPeriod = totalJoursPeriod > capNettePeriod;

                        // Code couleur de charge
                        let bgCard = 'rgba(16, 185, 129, 0.06)';
                        let borderCard = 'rgba(16, 185, 129, 0.25)';
                        let badgeBg = 'rgba(16, 185, 129, 0.25)';
                        let badgeColor = '#34d399';

                        if (isOverbookedPeriod) {
                          bgCard = 'rgba(239, 68, 68, 0.16)';
                          borderCard = 'rgba(239, 68, 68, 0.5)';
                          badgeBg = '#ef4444';
                          badgeColor = '#ffffff';
                        } else if (pctPeriod >= 85) {
                          bgCard = 'rgba(245, 158, 11, 0.1)';
                          borderCard = 'rgba(245, 158, 11, 0.3)';
                          badgeBg = 'rgba(245, 158, 11, 0.25)';
                          badgeColor = '#fbbf24';
                        }

                        const cellKey = `${r._id}_${pPeriode.mois}`;
                        const isDragOver = dragOverCellKey === cellKey;

                        // EN MODE BARRES GANTT : Affichage synthétique de la saturation avec barre de progression de charge épurée
                        if (displayMode === 'barres') {
                          const barWidth = Math.min(100, pctPeriod);
                          const barColor = isOverbookedPeriod ? '#ef4444' : pctPeriod >= 85 ? '#f59e0b' : '#10b981';

                          return (
                            <td
                              key={pPeriode.key}
                              onDragOver={(e) => {
                                if (draggedProject && canUserStaff()) {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'copy';
                                  setDragOverCellKey(cellKey);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverCellKey === cellKey) {
                                  setDragOverCellKey(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedProject && canUserStaff()) {
                                  handleOpenStaffing(
                                    r,
                                    {
                                      projetId: draggedProject.projetId,
                                      nomProjet: draggedProject.nomProjet,
                                      codeProjet: draggedProject.codeProjet
                                    },
                                    pPeriode.mois,
                                    draggedProject.joursRestants
                                  );
                                  setDragOverCellKey(null);
                                }
                              }}
                              className={`droppable-resource-cell ${isDragOver ? 'is-drag-over' : ''}`}
                              style={{
                                padding: '6px 6px',
                                verticalAlign: 'middle',
                                background: isDragOver ? 'rgba(6, 182, 212, 0.25)' : bgCard,
                                borderRight: '1px solid rgba(148, 163, 184, 0.08)',
                                borderBottom: isExpanded ? '1px dashed rgba(148, 163, 184, 0.15)' : '1px solid rgba(148, 163, 184, 0.08)',
                                cursor: draggedProject ? 'copy' : 'default'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.72rem', color: isOverbookedPeriod ? '#f87171' : '#f1f5f9' }}>
                                    {totalJoursPeriod}j
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: badgeBg,
                                      color: badgeColor,
                                      fontSize: '0.64rem'
                                    }}
                                    title={isOverbookedPeriod ? `SURCHARGE de ${(totalJoursPeriod - capNettePeriod).toFixed(1)}j sur capacité nette de ${capNettePeriod}j` : undefined}
                                  >
                                    {pctPeriod > 200 ? '>200%' : `${pctPeriod}%`}
                                  </span>
                                </div>

                                {/* Mini jauge horizontale de charge de la période */}
                                <div
                                  style={{
                                    height: '4px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    borderRadius: '2px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                  }}
                                  title={`Affecté: ${totalJoursPeriod}j / Capacité nette: ${capNettePeriod}j (${absencesPeriod}j CP)`}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${barWidth}%`,
                                      background: barColor,
                                      borderRadius: '2px',
                                      boxShadow: isOverbookedPeriod ? '0 0 6px #ef4444' : undefined
                                    }}
                                  />
                                </div>

                                <div style={{ fontSize: '0.62rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Net {capNettePeriod}j</span>
                                  {absencesPeriod > 0 && <span style={{ color: '#c084fc', fontWeight: 600 }}>{absencesPeriod}j CP</span>}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        // EN MODE CARTES SYNTHÉTIQUES CLASSIQUE
                        return (
                          <td
                            key={pPeriode.key}
                            onDragOver={(e) => {
                              if (draggedProject && canUserStaff()) {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                                setDragOverCellKey(cellKey);
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverCellKey === cellKey) {
                                setDragOverCellKey(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedProject && canUserStaff()) {
                                handleOpenStaffing(
                                  r,
                                  {
                                    projetId: draggedProject.projetId,
                                    nomProjet: draggedProject.nomProjet,
                                    codeProjet: draggedProject.codeProjet
                                  },
                                  pPeriode.mois,
                                  draggedProject.joursRestants
                                );
                                setDragOverCellKey(null);
                              }
                            }}
                            className={`droppable-resource-cell ${isDragOver ? 'is-drag-over' : ''}`}
                            style={{
                              padding: '5px',
                              verticalAlign: 'top',
                              background: isDragOver ? 'rgba(6, 182, 212, 0.25)' : bgCard,
                              borderRight: '1px solid rgba(148, 163, 184, 0.08)',
                              borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                              transition: 'background 0.2s ease',
                              cursor: draggedProject ? 'copy' : 'default'
                            }}
                          >
                            <div
                              style={{
                                borderRadius: '6px',
                                padding: '5px 7px',
                                border: `1px solid ${borderCard}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px',
                                minHeight: '68px',
                                background: 'rgba(15, 23, 42, 0.6)'
                              }}
                            >
                              {/* En-tête de cellule : Charge affectée vs Capacité nette */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f8fafc' }}>
                                  {totalJoursPeriod}j
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    background: badgeBg,
                                    color: badgeColor
                                  }}
                                >
                                  {pctPeriod > 200 ? '>200%' : `${pctPeriod}%`}
                                </span>
                              </div>

                              {/* Barre sous-jacente : Disponibilité nette & congés */}
                              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                Dispo: <strong style={{ color: '#e2e8f0' }}>{capNettePeriod}j</strong>
                                {absencesPeriod > 0 && (
                                  <span style={{ color: '#c084fc', marginLeft: '3px' }}>
                                    ({absencesPeriod}j CP)
                                  </span>
                                )}
                              </div>

                              {/* Pilules des projets affectés */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                {m.projets.slice(0, 2).map((p, idx) => {
                                  const jProj = Number((p.jours * fraction).toFixed(1));
                                  return (
                                    <div
                                      key={idx}
                                      onClick={() => {
                                        if (canUserStaff()) {
                                          handleOpenStaffing(
                                            r,
                                            {
                                              projetId: p.projetId,
                                              nomProjet: p.nomProjet,
                                              codeProjet: p.codeProjet
                                            },
                                            pPeriode.mois,
                                            p.jours
                                          );
                                        }
                                      }}
                                      style={{
                                        fontSize: '0.65rem',
                                        background: 'rgba(30, 41, 59, 0.95)',
                                        borderRadius: '3px',
                                        padding: '1px 4px',
                                        border: '1px solid rgba(148, 163, 184, 0.15)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: '#f8fafc',
                                        cursor: canUserStaff() ? 'pointer' : 'default'
                                      }}
                                      title={canUserStaff() ? `${p.nomProjet} (${jProj}j) - Cliquer pour ajuster l'affectation` : `${p.nomProjet} (${jProj}j)`}
                                    >
                                      {p.nomProjet} : <strong>{jProj}j</strong>
                                    </div>
                                  );
                                })}
                                {m.projets.length > 2 && (
                                  <div style={{ fontSize: '0.62rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                                    +{m.projets.length - 2} autre(s)
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* SOUS-LIGNES GANTT : DÉTAIL PAR PROJET EN MODE BARRES */}
                    {displayMode === 'barres' && isExpanded && (
                      <>
                        {projetsList.length === 0 ? (
                          <tr style={{ background: 'rgba(15, 23, 42, 0.25)' }}>
                            <td
                              style={{
                                position: 'sticky',
                                left: 0,
                                zIndex: 5,
                                background: '#0b1324',
                                padding: '8px 16px 8px 36px',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                                borderRight: '1px solid rgba(148, 163, 184, 0.15)',
                                borderBottom: '1px solid rgba(148, 163, 184, 0.08)'
                              }}
                            >
                              Aucun projet staffé pour ce collaborateur cette année.
                            </td>
                            <td colSpan={periodesPlanning.length} style={{ background: 'rgba(15, 23, 42, 0.25)', borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }} />
                          </tr>
                        ) : (
                          projetsList.map((p) => {
                            const pColor = COLORS_TYPES[p.typeProjet] || COLORS_PRIORITE[p.priorite || 'Autres'] || 'var(--primary)';

                            return (
                              <tr
                                key={p.projetId}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.25)',
                                  borderBottom: '1px solid rgba(148, 163, 184, 0.06)'
                                }}
                              >
                                {/* Nom du projet indenté */}
                                <td
                                  style={{
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 5,
                                    background: '#0b1324',
                                    padding: '5px 14px 5px 36px',
                                    borderRight: '1px solid rgba(148, 163, 184, 0.15)',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                                    fontSize: '0.76rem'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                      <span
                                        style={{
                                          width: '7px',
                                          height: '7px',
                                          borderRadius: '2px',
                                          background: pColor,
                                          flexShrink: 0
                                        }}
                                      />
                                      <span
                                        style={{
                                          color: '#cbd5e1',
                                          fontWeight: 500,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          maxWidth: '170px'
                                        }}
                                        title={p.nomProjet}
                                      >
                                        {p.codeProjet ? `[${p.codeProjet}] ` : ''}{p.nomProjet}
                                      </span>
                                    </div>

                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: pColor,
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${pColor}40`,
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        flexShrink: 0
                                      }}
                                    >
                                      {p.totalJours}j
                                    </span>
                                  </div>
                                </td>

                                {/* Barres Gantt mensuelles ou hebdomadaires pour ce projet */}
                                {periodesPlanning.map((pPeriode) => {
                                  const mNum = pPeriode.mois;
                                  const fraction = pPeriode.isWeek && pPeriode.weekFraction ? pPeriode.weekFraction : 1;
                                  const rawAffectes = (p.moisAffectes[mNum] || 0) * fraction;
                                  const jAffectes = Number(rawAffectes.toFixed(1));
                                  const moisCollab = item.moisPlanning.find((mp) => mp.mois === mNum);
                                  const capNettePeriod = (moisCollab?.capaciteNette || 20) * fraction;
                                  const widthPct = Math.min(100, Math.max(14, capNettePeriod > 0 ? (jAffectes / capNettePeriod) * 100 : 50));

                                  return (
                                    <td
                                      key={pPeriode.key}
                                      style={{
                                        padding: '3px 4px',
                                        verticalAlign: 'middle',
                                        borderRight: '1px solid rgba(148, 163, 184, 0.06)',
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {jAffectes > 0 ? (
                                        <div
                                          style={{
                                            background: `linear-gradient(90deg, ${pColor}ee, ${pColor}bb)`,
                                            border: `1px solid ${pColor}`,
                                            color: '#ffffff',
                                            borderRadius: '3px',
                                            padding: '2px 4px',
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            boxShadow: `0 1px 4px ${pColor}35`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '3px',
                                            width: `${widthPct}%`,
                                            minWidth: '34px',
                                            margin: '0 auto',
                                            transition: 'all 0.15s ease'
                                          }}
                                          title={`${p.nomProjet} (${r.nom}) : ${jAffectes}j sur ${pPeriode.label}`}
                                        >
                                          <span>{jAffectes}j</span>
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: '0.65rem', color: 'rgba(148, 163, 184, 0.12)' }}>•</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Staffing Rapide (Invoqué au Drag & Drop ou au Clic sur une affectation) */}
      {quickStaffingTarget && (
        <QuickStaffingModal
          isOpen={Boolean(quickStaffingTarget)}
          onClose={() => setQuickStaffingTarget(null)}
          ressource={quickStaffingTarget.ressource}
          projet={quickStaffingTarget.projet}
          mois={quickStaffingTarget.mois}
          annee={annee}
          joursExistants={quickStaffingTarget.joursExistants}
          onConfirm={handleConfirmStaffing}
        />
      )}

    </div>
  );
};

