import React, { useState, useEffect } from 'react';
import { IPlanningMatriceResponse, IPlanningRessourceItem, IProjetAffecteRessource } from '../types';
import {
  FolderKanban,
  Search,
  Calendar,
  Users,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Briefcase,
  Clock,
  Zap,
  Activity,
  X
} from 'lucide-react';

interface RessourceProjetsViewProps {
  annee: number;
}

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
const NOMS_MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const PRIORITY_COLORS: { [key: string]: string } = {
  RUN: '#0284c7',
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#3b82f6',
  P4: '#8b5cf6',
  Autres: '#64748b'
};

export const RessourceProjetsView: React.FC<RessourceProjetsViewProps> = ({ annee: initialAnnee }) => {
  const [annee, setAnnee] = useState<number>(initialAnnee);
  const [selectedMois, setSelectedMois] = useState<number | ''>(''); // '' = Année entière
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'Tous' | 'Interne' | 'Externe'>('Tous');
  const [roleFilter, setRoleFilter] = useState<string>('Tous');

  const [data, setData] = useState<IPlanningMatriceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRessourceId, setSelectedRessourceId] = useState<string | null>(null);

  const fetchPlanning = () => {
    setLoading(true);
    fetch(`/api/ressources/planning/matrice?annee=${annee}`)
      .then((res) => res.json())
      .then((resData: IPlanningMatriceResponse) => {
        setData(resData);
        if (resData.ressources && resData.ressources.length > 0 && !selectedRessourceId) {
          setSelectedRessourceId(resData.ressources[0].ressource._id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement planning:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPlanning();
  }, [annee]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Chargement des affectations et des saisies réelles Jira...
      </div>
    );
  }

  if (!data || !data.ressources) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Aucune donnée disponible pour l'année {annee}.
      </div>
    );
  }

  const uniqueRoles = Array.from(new Set(data.ressources.map((r) => r.ressource.role))).filter(Boolean);

  // Filtrer les ressources
  const filteredRessources = data.ressources.filter((item) => {
    const r = item.ressource;
    const matchSearch =
      r.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'Tous' || r.type === typeFilter;
    const matchRole = roleFilter === 'Tous' || r.role === roleFilter;
    return matchSearch && matchType && matchRole;
  });

  const selectedItem = data.ressources.find((r) => r.ressource._id === selectedRessourceId) || filteredRessources[0];

  // Calcul des projets pour la ressource sélectionnée selon le filtre temporel (Mois ou Année)
  const getProjetsDetailForRessource = (item?: IPlanningRessourceItem) => {
    if (!item) {
      return {
        projetsList: [],
        totalJours: 0,
        totalTempoJours: 0,
        totalTempoHeures: 0,
        capaciteNette: 0,
        absences: 0,
        tauxOcc: 0,
        tauxConsommeTempo: 0
      };
    }

    const moisCibles = selectedMois !== ''
      ? item.moisPlanning.filter((m) => m.mois === selectedMois)
      : item.moisPlanning;

    const totalCapNette = Number(moisCibles.reduce((s, m) => s + m.capaciteNette, 0).toFixed(1));
    const totalAbsences = Number(moisCibles.reduce((s, m) => s + m.absences, 0).toFixed(1));
    const totalJours = Number(moisCibles.reduce((s, m) => s + m.totalJoursAffectes, 0).toFixed(1));
    const totalTempoJours = Number(moisCibles.reduce((s, m) => s + (m.tempoTotalJours || 0), 0).toFixed(2));
    const totalTempoHeures = Number(moisCibles.reduce((s, m) => s + (m.tempoTotalHeures || 0), 0).toFixed(1));

    const tauxOcc = totalCapNette > 0 ? Math.round((totalJours / totalCapNette) * 100) : 0;
    const tauxConsommeTempo = totalCapNette > 0 ? Math.round((totalTempoJours / totalCapNette) * 100) : 0;

    // Regrouper par projet combiné (Staffé prévisionnel OU Saisi dans Tempo)
    const projetsMap = new Map<string, {
      projetId?: string;
      codeProjet: string;
      nomProjet: string;
      typeProjet: string;
      priorite: string | null;
      jours: number; // Staffé CartOMC
      tempoJours: number; // Réalisé Jira Tempo
      tempoHeures: number;
      isHorsStaffing: boolean;
      moisRepart: { [mois: number]: { staffe: number; tempo: number } };
    }>();

    // 1. Ajouter les projets staffés
    moisCibles.forEach((mItem) => {
      mItem.projets.forEach((p) => {
        const key = p.projetId || p.nomProjet;
        if (!projetsMap.has(key)) {
          projetsMap.set(key, {
            projetId: p.projetId,
            codeProjet: p.codeProjet || '',
            nomProjet: p.nomProjet,
            typeProjet: p.typeProjet,
            priorite: p.priorite || 'Autres',
            jours: 0,
            tempoJours: 0,
            tempoHeures: 0,
            isHorsStaffing: false,
            moisRepart: {}
          });
        }
        const obj = projetsMap.get(key)!;
        obj.jours = Number((obj.jours + p.jours).toFixed(1));
        if (!obj.moisRepart[mItem.mois]) obj.moisRepart[mItem.mois] = { staffe: 0, tempo: 0 };
        obj.moisRepart[mItem.mois].staffe = Number(((obj.moisRepart[mItem.mois].staffe || 0) + p.jours).toFixed(1));
      });

      // 2. Réconcilier les saisies Tempo réelles (staffées ou hors staffing)
      (mItem.tempoProjets || []).forEach((tp) => {
        let key = tp.projetId || '';
        if (!key) {
          // Chercher si un projet existant porte le même code ou nom
          for (const [k, pObj] of projetsMap.entries()) {
            if (pObj.codeProjet && tp.codeProjet && pObj.codeProjet.toLowerCase() === tp.codeProjet.toLowerCase()) {
              key = k;
              break;
            }
          }
        }
        if (!key) {
          key = `tempo_${tp.nomProjet}_${tp.codeProjet || ''}`;
        }

        if (!projetsMap.has(key)) {
          projetsMap.set(key, {
            projetId: tp.projetId,
            codeProjet: tp.codeProjet || '',
            nomProjet: tp.nomProjet,
            typeProjet: tp.typeProjet,
            priorite: tp.priorite || 'Autres',
            jours: 0,
            tempoJours: 0,
            tempoHeures: 0,
            isHorsStaffing: true, // Non prévu initialement dans CartOMC !
            moisRepart: {}
          });
        }

        const obj = projetsMap.get(key)!;
        obj.tempoJours = Number((obj.tempoJours + tp.jours).toFixed(2));
        obj.tempoHeures = Number((obj.tempoHeures + tp.heures).toFixed(1));
        if (!obj.moisRepart[mItem.mois]) obj.moisRepart[mItem.mois] = { staffe: 0, tempo: 0 };
        obj.moisRepart[mItem.mois].tempo = Number(((obj.moisRepart[mItem.mois].tempo || 0) + tp.jours).toFixed(2));
      });
    });

    const projetsList = Array.from(projetsMap.values()).sort((a, b) => {
      // Prioriser les projets avec le plus d'activité cumulée (tempo ou staffé)
      const totA = Math.max(a.jours, a.tempoJours);
      const totB = Math.max(b.jours, b.tempoJours);
      return totB - totA;
    });

    return {
      projetsList,
      totalJours,
      totalTempoJours,
      totalTempoHeures,
      capaciteNette: totalCapNette,
      absences: totalAbsences,
      tauxOcc,
      tauxConsommeTempo
    };
  };

  const currentStats = getProjetsDetailForRessource(selectedItem);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Barre de filtres supérieurs */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Sélecteur Année */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Année :</span>
            <select
              className="form-select"
              style={{ minWidth: '95px', height: '36px', fontSize: '0.84rem' }}
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Sélecteur Période / Mois */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Période :</span>
            <select
              className="form-select"
              style={{ minWidth: '175px', height: '36px', fontSize: '0.84rem' }}
              value={selectedMois}
              onChange={(e) => setSelectedMois(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Année entière {annee}</option>
              {NOMS_MOIS.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m} {annee}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre Population */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Population :</span>
            <select
              className="form-select"
              style={{ minWidth: '135px', height: '36px', fontSize: '0.84rem' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="Tous">Tous types</option>
              <option value="Interne">🔵 Internes</option>
              <option value="Externe">🟣 Externes</option>
            </select>
          </div>

          {/* Filtre Rôle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rôle :</span>
            <select
              className="form-select"
              style={{ minWidth: '155px', height: '36px', fontSize: '0.84rem' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="Tous">Tous ({uniqueRoles.length})</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Barre de recherche ressource stylée */}
        <div className="search-box" style={{ minWidth: '260px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule ou rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
      </div>

      {/* Disposition en 2 Colonnes : Liste des Ressources (Gauche) | Fiche Projets (Droite) */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* COLONNE GAUCHE : ANNUAIRE COLLABORATEURS AVEC BADGES */}
        <div className="card" style={{ padding: '16px', maxHeight: '720px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Collaborateurs ({filteredRessources.length})</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{selectedMois !== '' ? NOMS_MOIS[selectedMois - 1] : `Année ${annee}`}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredRessources.map((item) => {
              const r = item.ressource;
              const isSelected = selectedItem?.ressource._id === r._id;
              const stats = getProjetsDetailForRessource(item);

              return (
                <div
                  key={r._id}
                  onClick={() => setSelectedRessourceId(r._id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(148, 163, 184, 0.1)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                      {r.nom}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <span>{r.role}</span>
                      <span>•</span>
                      <span style={{ color: r.type === 'Interne' ? '#38bdf8' : '#c084fc' }}>{r.type}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: stats.totalJours > 0 ? '#38bdf8' : 'var(--text-muted)' }} title="Temps staffé prévisionnel">
                        {stats.totalJours}j
                      </span>
                      {stats.totalTempoJours > 0 && (
                        <>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#10b981' }} title="Réel Jira Tempo saisi">
                            {stats.totalTempoJours}j
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: stats.projetsList.length > 0 ? '#94a3b8' : 'var(--text-muted)' }}>
                      {stats.projetsList.length} projet{stats.projetsList.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLONNE DROITE : FICHE DÉTAIL DES PROJETS DE LA RESSOURCE */}
        {selectedItem ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Carte Synthèse Collaborateur */}
            <div className="card" style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.6) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                      {selectedItem.ressource.nom}
                    </h2>
                    {selectedItem.ressource.estLeadBA && (
                      <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>Lead BA</span>
                    )}
                    <span className="badge" style={{ fontSize: '0.75rem', background: selectedItem.ressource.type === 'Interne' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(192, 132, 252, 0.2)', color: selectedItem.ressource.type === 'Interne' ? '#38bdf8' : '#c084fc' }}>
                      {selectedItem.ressource.type}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Matricule: <strong>{selectedItem.ressource.matricule}</strong> • Rôle: <strong>{selectedItem.ressource.role}</strong> • Activité: <strong>{selectedItem.ressource.tauxActivite * 100}% ETP</strong>
                  </div>
                </div>

                {/* 4 Blocs KPI Rapides (Staffé + Réalisé Jira) */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Capacité Nette</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                      {currentStats.capaciteNette}j
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#7dd3fc' }}>Staffé CartOMC</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                      {currentStats.totalJours}j
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentStats.tauxOcc}% cap.</div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>Réel Jira Tempo</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                      {currentStats.totalTempoJours}j
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{currentStats.totalTempoHeures}h ({currentStats.tauxConsommeTempo}%)</div>
                  </div>

                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Écart Réel vs Staffé</div>
                    {(() => {
                      const delta = Number((currentStats.totalTempoJours - currentStats.totalJours).toFixed(1));
                      const isPositive = delta > 0;
                      const isZero = delta === 0;
                      return (
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: isZero ? 'var(--text-muted)' : isPositive ? '#f59e0b' : '#38bdf8'
                        }}>
                          {isZero ? '0j' : `${isPositive ? '+' : ''}${delta}j`}
                        </div>
                      );
                    })()}
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>delta net</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tableau des Projets de la Ressource */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Briefcase size={18} color="var(--primary)" />
                  Activité & Projets ({currentStats.projetsList.length}) — {selectedMois !== '' ? NOMS_MOIS[selectedMois - 1] : `Année ${annee}`}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {currentStats.absences > 0 && (
                    <span style={{ fontSize: '0.8rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                      🏖️ {currentStats.absences}j d'absences
                    </span>
                  )}
                  {currentStats.projetsList.some((p) => p.isHorsStaffing) && (
                    <span style={{ fontSize: '0.78rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      ⚡ Activité Jira hors staffing détectée
                    </span>
                  )}
                </div>
              </div>

              {currentStats.projetsList.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px' }}>
                  Aucune affectation ni imputation Jira pour {selectedItem.ressource.nom} sur {selectedMois !== '' ? NOMS_MOIS[selectedMois - 1] : `l'année ${annee}`}.
                  <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                    Cette ressource dispose de <strong>{currentStats.capaciteNette} jours nets</strong> disponibles.
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '220px' }}>Projet / Activité</th>
                        <th style={{ width: '85px', textAlign: 'center' }}>Type</th>
                        <th style={{ width: '75px', textAlign: 'center' }}>Priorité</th>
                        <th style={{ width: '95px', textAlign: 'center', color: '#38bdf8' }}>Staffé</th>
                        <th style={{ width: '120px', textAlign: 'center', color: '#10b981' }}>Réel Jira</th>
                        <th style={{ width: '90px', textAlign: 'center' }}>Écart</th>
                        <th style={{ width: '110px', textAlign: 'center' }}>Part Réel</th>
                        {selectedMois === '' && (
                          <th style={{ textAlign: 'center', minWidth: '240px' }}>Répartition (Staffé / Réel)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {currentStats.projetsList.map((p, pIdx) => {
                        const partTempoPct = currentStats.totalTempoJours > 0
                          ? Math.round((p.tempoJours / currentStats.totalTempoJours) * 100)
                          : (currentStats.totalJours > 0 ? Math.round((p.jours / currentStats.totalJours) * 100) : 0);
                        const prioColor = PRIORITY_COLORS[p.priorite || 'Autres'] || '#64748b';
                        const delta = Number((p.tempoJours - p.jours).toFixed(1));

                        return (
                          <tr key={p.projetId || `p_${pIdx}`} style={{ background: p.isHorsStaffing ? 'rgba(56, 189, 248, 0.04)' : undefined }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.nomProjet}</div>
                                {p.isHorsStaffing && (
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: '0.68rem',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.4)'
                                    }}
                                    title="Cette activité n'était pas prévue au staffing CartOMC"
                                  >
                                    ⚡ Hors staffing
                                  </span>
                                )}
                              </div>
                              {p.codeProjet && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                  {p.codeProjet}
                                </div>
                              )}
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{p.typeProjet}</span>
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              <span
                                className="badge"
                                style={{
                                  background: `${prioColor}20`,
                                  color: prioColor,
                                  borderColor: `${prioColor}50`,
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}
                              >
                                {p.priorite || '—'}
                              </span>
                            </td>

                            {/* Staffé CartOMC */}
                            <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.92rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                              {p.jours > 0 ? `${p.jours} j` : <span style={{ color: 'var(--text-muted)' }}>0 j</span>}
                            </td>

                            {/* Réel Jira Tempo */}
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                              {p.tempoJours > 0 ? (
                                <div>
                                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#10b981' }}>{p.tempoJours} j</span>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.tempoHeures} h</div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>0 j</span>
                              )}
                            </td>

                            {/* Écart Delta */}
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700 }}>
                              {delta === 0 ? (
                                <span style={{ color: 'var(--text-muted)' }}>=</span>
                              ) : delta > 0 ? (
                                <span style={{ color: '#f59e0b' }}>+{delta} j</span>
                              ) : (
                                <span style={{ color: '#38bdf8' }}>{delta} j</span>
                              )}
                            </td>

                            {/* Part de l'activité réelle */}
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                <div style={{ width: '50px', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, partTempoPct)}%`, height: '100%', background: p.tempoJours > 0 ? '#10b981' : '#38bdf8' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{partTempoPct}%</span>
                              </div>
                            </td>

                            {/* Répartition mensuelle miniature si vue Année */}
                            {selectedMois === '' && (
                              <td style={{ padding: '4px 8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', textAlign: 'center' }}>
                                  {NOMS_MOIS_COURTS.map((mCourt, idx) => {
                                    const mRep = p.moisRepart[idx + 1] || { staffe: 0, tempo: 0 };
                                    const hasActivity = mRep.staffe > 0 || mRep.tempo > 0;
                                    return (
                                      <div
                                        key={idx + 1}
                                        style={{
                                          fontSize: '0.62rem',
                                          padding: '2px 1px',
                                          borderRadius: '2px',
                                          background: mRep.tempo > 0 ? 'rgba(16, 185, 129, 0.2)' : mRep.staffe > 0 ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                          color: mRep.tempo > 0 ? '#10b981' : mRep.staffe > 0 ? '#38bdf8' : 'var(--text-muted)',
                                          fontWeight: hasActivity ? 700 : 400
                                        }}
                                        title={`${mCourt} : Staffé ${mRep.staffe}j | Jira ${mRep.tempo}j`}
                                      >
                                        <div>{mCourt[0]}</div>
                                        <div>{mRep.tempo > 0 ? mRep.tempo : mRep.staffe > 0 ? mRep.staffe : '·'}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--surface-hover)', fontWeight: 700 }}>
                        <td colSpan={3}>TOTAL CUMULÉ SUR LA PÉRIODE</td>
                        <td style={{ textAlign: 'center', color: '#38bdf8', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                          {currentStats.totalJours} j
                        </td>
                        <td style={{ textAlign: 'center', color: '#10b981', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                          {currentStats.totalTempoJours} j
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{currentStats.totalTempoHeures} h</div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                          {(() => {
                            const totDelta = Number((currentStats.totalTempoJours - currentStats.totalJours).toFixed(1));
                            return totDelta === 0 ? '=' : (totDelta > 0 ? `+${totDelta} j` : `${totDelta} j`);
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>100%</td>
                        {selectedMois === '' && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Sélectionnez un collaborateur dans la liste de gauche pour visualiser ses projets.
          </div>
        )}

      </div>
    </div>
  );
};
