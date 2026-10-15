import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  Search,
  ExternalLink,
  AlertCircle,
  ArrowUpDown,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X
} from 'lucide-react';
import { TempoEntry } from '../../types/tempo';
import { exportTempoToCSV } from '../../utils/csvExporter';

interface TempoDetailTableProps {
  entries: TempoEntry[];
  anomalies?: string[];
}

export const TempoDetailTable: React.FC<TempoDetailTableProps> = ({ entries, anomalies = [] }) => {
  const [search, setSearch] = useState<string>('');
  const [sortField, setSortField] = useState<keyof TempoEntry>('worklogDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Quick filters
  const [selectedType, setSelectedType] = useState<string>('all'); // all, INT, EXT, Unknown
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleSort = (field: keyof TempoEntry) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Liste distincte des catégories disponibles
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'Unknown') {
          if (e.type !== 'Unknown' && e.role !== 'Unknown') return false;
        } else if (e.type !== selectedType) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        return false;
      }

      // Text search
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        (e.issueKey && e.issueKey.toLowerCase().includes(term)) ||
        (e.collaborator && e.collaborator.toLowerCase().includes(term)) ||
        (e.entryTask && e.entryTask.toLowerCase().includes(term)) ||
        (e.budgetLine && e.budgetLine.toLowerCase().includes(term)) ||
        (e.category && e.category.toLowerCase().includes(term)) ||
        (e.lot && e.lot.toLowerCase().includes(term)) ||
        (e.comment && e.comment.toLowerCase().includes(term)) ||
        (e.epicSummary && e.epicSummary.toLowerCase().includes(term)) ||
        (e.fixVersions && e.fixVersions.toLowerCase().includes(term))
      );
    });
  }, [entries, search, selectedType, selectedCategory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortAsc]);

  // Réinitialiser la page courante lors d'une modification des filtres ou de la taille de page
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedType, selectedCategory, pageSize]);

  // Pagination calculée
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sorted.length);
  const paginatedEntries = sorted.slice(startIndex, endIndex);

  const totalDays = useMemo(() => {
    return sorted.reduce((sum, e) => sum + (e.timeInDays || 0), 0);
  }, [sorted]);

  const pageDays = useMemo(() => {
    return paginatedEntries.reduce((sum, e) => sum + (e.timeInDays || 0), 0);
  }, [paginatedEntries]);

  return (
    <div className="card">
      {/* En-tête et barre d'outils avec KPIs rapides */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(249, 115, 22, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}
            >
              <TableIcon size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Détail des temps Tempo
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(249, 115, 22, 0.2)',
                    color: 'var(--primary)',
                    fontWeight: 700
                  }}
                >
                  {sorted.length.toLocaleString('fr-FR')} lignes
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Cumul total : <strong style={{ color: 'var(--text-main)' }}>{totalDays.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} J/H</strong>
                {sorted.length > 0 && (
                  <span style={{ marginLeft: '8px', color: 'var(--text-dim)' }}>
                    • Sur cette page ({paginatedEntries.length} lignes) : <strong style={{ color: 'var(--primary)' }}>{pageDays.toFixed(2)} J/H</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Champ de recherche avec icône et bouton effacer */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Rechercher ticket, nom, tâche, lot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '36px', paddingRight: search ? '32px' : '12px', width: '100%', height: '36px', fontSize: '0.85rem' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={() => exportTempoToCSV(sorted)}
              className="btn btn-secondary"
              style={{ height: '36px', fontSize: '0.85rem' }}
              title="Exporter toutes les lignes filtrées au format CSV (24 colonnes)"
            >
              <Download size={15} />
              Exporter CSV
            </button>
          </div>
        </div>

        {/* Filtres rapides & sélecteur de catégorie */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '10px 14px',
            background: 'rgba(15, 23, 42, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px'
          }}
        >
          {/* Pastilles Type de Collaborateur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={13} /> Population :
            </span>
            {[
              { id: 'all', label: 'Tous' },
              { id: 'INT', label: 'Internes (INT)' },
              { id: 'EXT', label: 'Externes (EXT)' },
              { id: 'Unknown', label: '⚠️ Non répertoriés' }
            ].map((p) => {
              const isActive = selectedType === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedType(p.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 600 : 500,
                    border: isActive ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isActive ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Filtre par Catégorie métier */}
          {availableCategories.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="tempo-cat-filter" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Catégorie :
              </label>
              <select
                id="tempo-cat-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-select"
                style={{
                  padding: '4px 28px 4px 8px',
                  fontSize: '0.8rem',
                  height: '32px',
                  width: 'auto',
                  borderRadius: '6px'
                }}
              >
                <option value="all">Toutes les catégories ({availableCategories.length})</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Anomalies notice if any */}
      {anomalies.length > 0 && (
        <div className="card card-neon-red" style={{ padding: '12px 16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
            <AlertCircle size={16} />
            <span>Anomalies détectées lors de l'extraction ({anomalies.length})</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {anomalies.slice(0, 5).map((ano, i) => (
              <li key={i}>{ano}</li>
            ))}
            {anomalies.length > 5 && <li>... et {anomalies.length - 5} autres anomalies.</li>}
          </ul>
        </div>
      )}

      {/* 24-Column Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {[
                { key: 'budgetLine', label: '1. BudgetLine' },
                { key: 'project', label: '2. Project' },
                { key: 'issueKey', label: '3. IssueKey' },
                { key: 'category', label: '4. Category' },
                { key: 'lot', label: '5. Lot' },
                { key: 'entryTask', label: '6. EntryTask' },
                { key: 'comment', label: '7. Comment' },
                { key: 'ticketLink', label: '8. TicketLink' },
                { key: 'collaborator', label: '9. Collaborator' },
                { key: 'type', label: '10. Type' },
                { key: 'timeInHours', label: '11. Hours' },
                { key: 'timeInDays', label: '12. Days' },
                { key: 'estimatedInDays', label: '13. Est (j)' },
                { key: 'status', label: '14. Status' },
                { key: 'issueType', label: '15. IssueType' },
                { key: 'worklogDate', label: '16. Date' },
                { key: 'month', label: '17. Month' },
                { key: 'year', label: '18. Year' },
                { key: 'epicSummary', label: '19. EpicSummary' },
                { key: 'featureId', label: '20. FeatureId' },
                { key: 'role', label: '21. Role' },
                { key: 'labels', label: '22. Labels' },
                { key: 'businessChange', label: '23. BusinessChange' },
                { key: 'fixVersions', label: '24. FixVersions' }
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key as keyof TempoEntry)}
                  style={{ whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{col.label}</span>
                    <ArrowUpDown size={12} opacity={sortField === col.key ? 1 : 0.4} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedEntries.map((row, idx) => {
              const isUnknownCollab = row.type === 'Unknown' || row.role === 'Unknown';
              return (
                <tr key={`${row.issueKey}-${row.worklogDate}-${startIndex + idx}`}>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.budgetLine}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.project}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{row.issueKey}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.category}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.lot}</td>
                  <td style={{ minWidth: '180px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.entryTask}
                  </td>
                  <td style={{ minWidth: '150px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {row.comment}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <a href={row.ticketLink} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                      Jira <ExternalLink size={12} />
                    </a>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {row.collaborator}
                    {isUnknownCollab && (
                      <span className="badge badge-warning" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>
                        Non répertorié
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`badge ${row.type === 'INT' ? 'badge-primary' : row.type === 'EXT' ? 'badge-purple' : 'badge-warning'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.timeInHours != null ? Number(row.timeInHours.toFixed(2)) : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{row.timeInDays != null ? Number(row.timeInDays.toFixed(2)) : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{row.estimatedInDays != null ? Number(row.estimatedInDays.toFixed(2)) : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.status}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.issueType}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.worklogDate}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.month}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.year}</td>
                  <td style={{ minWidth: '140px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.epicSummary}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.featureId}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{row.role}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{row.labels || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ color: row.businessChange === 'TRUE' ? 'var(--success)' : 'var(--text-muted)' }}>
                      {row.businessChange}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{row.fixVersions || '-'}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={24} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Aucun résultat ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Barre de pagination inférieure */}
      {sorted.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '14px 18px',
            marginTop: '16px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px'
          }}
        >
          {/* Compteur & Sélecteur de taille par page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Affichage de <strong style={{ color: 'var(--text-main)' }}>{startIndex + 1}</strong> à{' '}
              <strong style={{ color: 'var(--text-main)' }}>{endIndex}</strong> sur{' '}
              <strong style={{ color: 'var(--primary)' }}>{sorted.length.toLocaleString('fr-FR')}</strong> lignes
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="tempo-page-size" style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                Par page :
              </label>
              <select
                id="tempo-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="form-select"
                style={{
                  padding: '4px 28px 4px 8px',
                  fontSize: '0.82rem',
                  height: '32px',
                  width: 'auto',
                  borderRadius: '6px'
                }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>

          {/* Boutons de pagination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage(1)}
              disabled={validCurrentPage <= 1}
              title="Première page"
              style={{
                padding: '6px 10px',
                height: '32px',
                fontSize: '0.82rem',
                opacity: validCurrentPage <= 1 ? 0.35 : 1,
                cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronsLeft size={15} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={validCurrentPage <= 1}
              title="Page précédente"
              style={{
                padding: '6px 12px',
                height: '32px',
                fontSize: '0.82rem',
                opacity: validCurrentPage <= 1 ? 0.35 : 1,
                cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ChevronLeft size={15} /> Précédent
            </button>

            {/* Numéros de page avec ellipses */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 2)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((pageItem, idx) =>
                  typeof pageItem === 'number' ? (
                    <button
                      key={`page-${pageItem}`}
                      type="button"
                      onClick={() => setCurrentPage(pageItem)}
                      className={pageItem === validCurrentPage ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{
                        minWidth: '32px',
                        height: '32px',
                        padding: '0 8px',
                        fontSize: '0.82rem',
                        fontWeight: pageItem === validCurrentPage ? 700 : 500
                      }}
                    >
                      {pageItem}
                    </button>
                  ) : (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{
                        padding: '0 4px',
                        color: 'var(--text-dim)',
                        fontSize: '0.82rem',
                        userSelect: 'none'
                      }}
                    >
                      ...
                    </span>
                  )
                )}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={validCurrentPage >= totalPages}
              title="Page suivante"
              style={{
                padding: '6px 12px',
                height: '32px',
                fontSize: '0.82rem',
                opacity: validCurrentPage >= totalPages ? 0.35 : 1,
                cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Suivant <ChevronRight size={15} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentPage(totalPages)}
              disabled={validCurrentPage >= totalPages}
              title="Dernière page"
              style={{
                padding: '6px 10px',
                height: '32px',
                fontSize: '0.82rem',
                opacity: validCurrentPage >= totalPages ? 0.35 : 1,
                cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronsRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
