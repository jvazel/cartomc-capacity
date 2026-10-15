import React, { useState, useEffect } from 'react';
import { IProjet, IRessource, IRapprochementProjetItem } from '../types';
import {
  KanbanSquare,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Clock,
  Users,
  ChevronRight,
  ChevronDown,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  UserCheck
} from 'lucide-react';

interface ContributorInfo {
  nom: string;
  type: string;
  joursTempo: number;
  joursStaffes: number;
}

interface ProjetRevueItem {
  _id: string;
  codeProjet?: string;
  nom: string;
  type: string;
  epicDomaine?: string;
  leadBANom: string;
  leadBAId?: string;
  priorite?: string;
  statut: string;
  statutEstimation: 'B0' | 'B1' | 'NC';
  estimationInitiale: number;
  totalPlanifie: number;
  chargeMaxToleree: number;
  couleurStatut: 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS';
  // Données Tempo Jira & Staffing enrichies
  consommeTempo: number;
  resteAFaire: number;
  atterrissagePrevu: number;
  deriveADate: number;
  santeConsommation: 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS';
  jiraBudgetLine?: string;
  jiraEpicKey?: string;
  jiraFeatureId?: string;
  contributors: ContributorInfo[];
}

type SortField =
  | 'codeProjet'
  | 'nom'
  | 'type'
  | 'epicDomaine'
  | 'leadBANom'
  | 'priorite'
  | 'statut'
  | 'statutEstimation'
  | 'estimationInitiale'
  | 'totalPlanifie'
  | 'consommeTempo'
  | 'couleurStatut';

interface RevuePortefeuillePageProps {
  onNavigateToPortefeuille?: () => void;
  initialFilterPriorite?: string;
  initialFilterStatutEst?: string;
}

export const RevuePortefeuillePage: React.FC<RevuePortefeuillePageProps> = ({
  onNavigateToPortefeuille,
  initialFilterPriorite = 'Tous',
  initialFilterStatutEst = 'Tous'
}) => {
  const [projets, setProjets] = useState<IProjet[]>([]);
  const [ressourcesBA, setRessourcesBA] = useState<IRessource[]>([]);
  const [rapprochementMap, setRapprochementMap] = useState<{ [projetId: string]: IRapprochementProjetItem }>({});
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const currentYear = new Date().getFullYear();

  // Filtres
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterLeadBA, setFilterLeadBA] = useState<string>('Tous');
  const [filterPriorite, setFilterPriorite] = useState<string>(initialFilterPriorite);
  const [filterStatutEstimation, setFilterStatutEstimation] = useState<string>(initialFilterStatutEst);
  const [filterType, setFilterType] = useState<string>('Tous');
  const [filterStatut, setFilterStatut] = useState<string>('Tous');

  // Tri
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const toggleExpand = (pid: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const fetchRevueData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/projets').then((r) => r.json()),
      fetch('/api/ressources').then((r) => r.json()),
      fetch(`/api/projets/rapprochement-tempo?annee=${currentYear}`).then((r) => r.json())
    ])
      .then(([projetsData, ressourcesData, tempoData]) => {
        setProjets(projetsData || []);
        setRessourcesBA((ressourcesData || []).filter((r: IRessource) => r.actif && (r.role.toUpperCase().includes('BA') || r.estLeadBA)));

        const rapMap: { [projetId: string]: IRapprochementProjetItem } = {};
        if (tempoData && Array.isArray(tempoData.items)) {
          tempoData.items.forEach((item: IRapprochementProjetItem) => {
            rapMap[item.projetId] = item;
          });
        }
        setRapprochementMap(rapMap);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement revue de portefeuille:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRevueData();
  }, []);

  useEffect(() => {
    if (initialFilterPriorite) setFilterPriorite(initialFilterPriorite);
    if (initialFilterStatutEst) setFilterStatutEstimation(initialFilterStatutEst);
  }, [initialFilterPriorite, initialFilterStatutEst]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Mapper les projets avec leurs calculs et données Tempo
  const mappedItems: ProjetRevueItem[] = projets.map((p) => {
    const leadNom = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA.nom : '-';
    const leadId = typeof p.leadBA === 'object' && p.leadBA !== null ? p.leadBA._id : (p.leadBA as string) || '';

    const rap = rapprochementMap[p._id];
    const consommeTempo = rap?.consommeTempo || 0;
    const resteAFaire = rap?.resteAFaire || 0;
    const atterrissagePrevu = rap?.atterrissagePrevu || 0;
    const deriveADate = rap?.deriveADate || 0;
    const santeConsommation = rap?.santeConsommation || 'GRIS';

    // Fusion des contributeurs (Tempo + Staffing)
    const contribMap = new Map<string, ContributorInfo>();

    // 1. Depuis Tempo (temps réellement imputés)
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

    // 2. Depuis le staffing nominatif (affectations planifiées)
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

    const contributors = Array.from(contribMap.values()).sort((a, b) => (b.joursTempo + b.joursStaffes) - (a.joursTempo + a.joursStaffes));

    return {
      _id: p._id,
      codeProjet: p.codeProjet,
      nom: p.nom,
      type: p.type,
      epicDomaine: p.epicDomaine,
      leadBANom: leadNom,
      leadBAId: leadId,
      priorite: p.priorite || undefined,
      statut: p.statut,
      statutEstimation: p.statutEstimation || 'NC',
      estimationInitiale: p.estimationRetenue || 0,
      totalPlanifie: p.totalPlanifie || 0,
      chargeMaxToleree: p.chargeMaxToleree || 0,
      couleurStatut: p.couleurStatut || 'GRIS',
      consommeTempo,
      resteAFaire,
      atterrissagePrevu,
      deriveADate,
      santeConsommation,
      jiraBudgetLine: p.jiraBudgetLine,
      jiraEpicKey: p.jiraEpicKey,
      jiraFeatureId: p.jiraFeatureId,
      contributors
    };
  });

  // Filtrage combinable
  const filteredItems = mappedItems.filter((item) => {
    const matchesSearch =
      item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.codeProjet && item.codeProjet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.epicDomaine && item.epicDomaine.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.leadBANom.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLeadBA = filterLeadBA === 'Tous' || item.leadBAId === filterLeadBA;
    const matchesPriorite = filterPriorite === 'Tous' || (item.priorite && item.priorite === filterPriorite);
    const matchesStatutEst = filterStatutEstimation === 'Tous' || item.statutEstimation === filterStatutEstimation;
    const matchesType = filterType === 'Tous' || item.type === filterType;
    const matchesStatut = filterStatut === 'Tous' || item.statut === filterStatut;

    return matchesSearch && matchesLeadBA && matchesPriorite && matchesStatutEst && matchesType && matchesStatut;
  });

  // Tri dynamique sur colonne
  const sortedItems = [...filteredItems].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'string') {
      const cmp = valA.localeCompare(valB, 'fr', { numeric: true, sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  // Rendu de l'icône de tri
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    }
    return sortAsc ? (
      <ArrowUp size={13} style={{ color: 'var(--primary-light)', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={13} style={{ color: 'var(--primary-light)', marginLeft: '4px' }} />
    );
  };

  // Pastille de couleur de santé
  const renderBadgeStatutCouleur = (couleur: string) => {
    switch (couleur) {
      case 'VERT':
        return <span className="badge badge-success">Sous l'estimation</span>;
      case 'ORANGE':
        return <span className="badge badge-warning">Dépassement toléré</span>;
      case 'ROUGE':
        return <span className="badge badge-danger">Dépassement critique</span>;
      default:
        return <span className="badge badge-secondary">Non chiffré</span>;
    }
  };

  return (
    <div>
      {/* En-tête de la page */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KanbanSquare style={{ color: 'var(--primary-light)' }} /> Revue de portefeuille
          </h1>
          <p className="page-subtitle">
            Vue tabulaire interactive et filtrable de l'ensemble des projets et de leur santé capaciti-chiffrage.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchRevueData}>
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {/* Barre de filtres combinables */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Recherche textuelle */}
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
            {/* Filtre Lead BA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal size={15} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-select"
                style={{ width: '130px', fontSize: '0.83rem' }}
                value={filterLeadBA}
                onChange={(e) => setFilterLeadBA(e.target.value)}
              >
                <option value="Tous">Tous Lead BA</option>
                {ressourcesBA.map((ba) => (
                  <option key={ba._id} value={ba._id}>
                    {ba.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre Priorité */}
            <select
              className="form-select"
              style={{ width: '110px', fontSize: '0.83rem' }}
              value={filterPriorite}
              onChange={(e) => setFilterPriorite(e.target.value)}
            >
              <option value="Tous">Toutes prio</option>
              <option value="P0">P0 - Critique</option>
              <option value="P1">P1 - Élevée</option>
              <option value="P2">P2 - Normale</option>
              <option value="P3">P3 - Basse</option>
              <option value="P4">P4 - Optionnelle</option>
            </select>

            {/* Filtre Statut Estimation */}
            <select
              className="form-select"
              style={{ width: '110px', fontSize: '0.83rem' }}
              value={filterStatutEstimation}
              onChange={(e) => setFilterStatutEstimation(e.target.value)}
            >
              <option value="Tous">Tous B0/B1</option>
              <option value="B0">Macro B0</option>
              <option value="B1">Chiffré B1</option>
              <option value="NC">Non chiffré</option>
            </select>

            {/* Filtre Type */}
            <select
              className="form-select"
              style={{ width: '120px', fontSize: '0.83rem' }}
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

            {/* Filtre Statut */}
            <select
              className="form-select"
              style={{ width: '120px', fontSize: '0.83rem' }}
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
        </div>
      </div>

      {/* Tableau interactif avec tri sur chaque colonne */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Chargement de la revue de portefeuille...
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}></th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('codeProjet')}>
                  Code {renderSortIcon('codeProjet')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('nom')}>
                  Nom du projet {renderSortIcon('nom')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('type')}>
                  Type {renderSortIcon('type')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('epicDomaine')}>
                  Epic / Domaine {renderSortIcon('epicDomaine')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('leadBANom')}>
                  Lead BA {renderSortIcon('leadBANom')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('priorite')}>
                  Prio {renderSortIcon('priorite')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('statut')}>
                  Statut {renderSortIcon('statut')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('statutEstimation')}>
                  Est. {renderSortIcon('statutEstimation')}
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('estimationInitiale')}>
                  Est. Initiale {renderSortIcon('estimationInitiale')}
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalPlanifie')}>
                  Total Planifié {renderSortIcon('totalPlanifie')}
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('consommeTempo')}>
                  Réalisé Tempo / Jira {renderSortIcon('consommeTempo')}
                </th>
                <th style={{ textAlign: 'center' }}>
                  Contributeurs
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('couleurStatut')}>
                  Santé B0/B1 {renderSortIcon('couleurStatut')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '32px' }}>
                    Aucun projet correspondant aux critères de recherche.
                  </td>
                </tr>
              ) : (
                sortedItems.map((p) => {
                  const isExpanded = expandedProjectIds.has(p._id);
                  const topContribs = p.contributors.slice(0, 2);
                  const remainingContribs = p.contributors.length - topContribs.length;

                  return (
                    <React.Fragment key={p._id}>
                      <tr
                        style={{
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(6, 182, 212, 0.08)' : undefined
                        }}
                        onClick={() => toggleExpand(p._id)}
                      >
                        {/* Flèche Déplier */}
                        <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px', border: 'none', background: 'transparent', color: isExpanded ? 'var(--primary)' : 'var(--text-muted)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(p._id);
                            }}
                            title={isExpanded ? 'Masquer les contributeurs et temps Jira' : 'Déplier les contributeurs et temps Jira'}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>

                        <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {p.codeProjet || '-'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{p.nom}</span>
                            {p.contributors.length > 0 && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-muted)'
                                }}
                              >
                                {p.contributors.length} pers.
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                            {p.type}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{p.epicDomaine || '-'}</td>
                        <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{p.leadBANom}</td>
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
                        <td>
                          <span
                            className={`badge ${
                              p.statutEstimation === 'B1'
                                ? 'badge-primary'
                                : p.statutEstimation === 'B0'
                                ? 'badge-purple'
                                : 'badge-secondary'
                            }`}
                            style={{ fontSize: '0.75rem' }}
                          >
                            {p.statutEstimation}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>
                          {p.estimationInitiale > 0 ? `${p.estimationInitiale} j` : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
                          {p.totalPlanifie > 0 ? `${p.totalPlanifie} j` : '-'}
                        </td>

                        {/* Réalisé Tempo / Jira */}
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                          {p.consommeTempo > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                                {p.consommeTempo} j
                              </span>
                              {p.totalPlanifie > 0 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  ({Math.round((p.consommeTempo / p.totalPlanifie) * 100)}%)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>0 j</span>
                          )}
                        </td>

                        {/* Badges Contributeurs Principaux */}
                        <td>
                          {p.contributors.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>Aucun</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              {topContribs.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="badge"
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 6px',
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
                                  style={{ fontSize: '0.7rem', padding: '1px 5px' }}
                                  title={`${remainingContribs} autre(s) personne(s)`}
                                >
                                  +{remainingContribs}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'center' }}>{renderBadgeStatutCouleur(p.couleurStatut)}</td>
                      </tr>

                      {/* LIGNE DÉPLIÉE : DÉTAIL DES PERSONNES & DES TEMPS JIRA SAISIS */}
                      {isExpanded && (
                        <tr style={{ background: 'rgba(15, 23, 42, 0.75)' }}>
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
                                    Temps Réel Jira : <strong>{p.consommeTempo} j</strong> ({Math.round(p.consommeTempo * 8)} h)
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
                              {p.contributors.length === 0 ? (
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
                                      {p.contributors.map((c, cIdx) => {
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
    </div>
  );
};
