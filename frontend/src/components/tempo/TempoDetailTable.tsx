import React, { useState, useMemo } from 'react';
import { Download, Search, ExternalLink, AlertCircle, ArrowUpDown, Table as TableIcon } from 'lucide-react';
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

  const handleSort = (field: keyof TempoEntry) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const term = search.toLowerCase();
    return entries.filter((e) => {
      return (
        e.issueKey.toLowerCase().includes(term) ||
        e.collaborator.toLowerCase().includes(term) ||
        e.entryTask.toLowerCase().includes(term) ||
        e.budgetLine.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term) ||
        e.lot.toLowerCase().includes(term)
      );
    });
  }, [entries, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortAsc]);

  const totalDays = useMemo(() => {
    return sorted.reduce((sum, e) => sum + (e.timeInDays || 0), 0);
  }, [sorted]);

  return (
    <div className="card">
      <div className="card-title" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TableIcon size={18} color="var(--primary)" />
          <span>Détail des temps Tempo ({sorted.length} lignes - {totalDays.toFixed(2)} J/H)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filtrer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '34px', width: '100%' }}
            />
          </div>

          <button
            onClick={() => exportTempoToCSV(sorted)}
            className="btn btn-secondary"
          >
            <Download size={16} />
            Exporter CSV (24 colonnes)
          </button>
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
            {sorted.map((row, idx) => {
              const isUnknownCollab = row.type === 'Unknown' || row.role === 'Unknown';
              return (
                <tr key={idx}>
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
                <td colSpan={24} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Aucun résultat à afficher. Lancez une extraction pour voir le détail des 24 colonnes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
