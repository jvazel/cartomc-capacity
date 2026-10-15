import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Table as TableIcon, Download, PlusSquare, MinusSquare, ExternalLink } from 'lucide-react';
import { TempoEntry, IPivotNode } from '../../types/tempo';
import { aggregatePivotData } from '../../utils/aggregatePivotData';

interface TempoPivotTableProps {
  entries: TempoEntry[];
}

const formatNumber = (val: number): string => {
  if (!val || val === 0) return '';
  const rounded = Number(val.toFixed(2));
  return rounded.toString().replace('.', ',');
};

const LevelRow: React.FC<{
  node: IPivotNode;
  depth: number;
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
}> = ({ node, depth, expandedKeys, onToggle }) => {
  const isExpanded = expandedKeys.has(node.key);
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = node.level === 'entryTask';

  // Determine row background
  const getRowBackground = () => {
    if (node.level === 'year') return 'rgba(30, 41, 59, 0.9)';
    if (node.level === 'month') return 'rgba(15, 23, 42, 0.6)';
    if (!hasChildren) return 'transparent';
    return 'rgba(255, 255, 255, 0.02)';
  };

  return (
    <>
      <tr style={{ background: getRowBackground(), borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        {/* Col A: year */}
        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: node.level === 'year' ? 700 : 400 }}>
          {node.level === 'year' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <button
                  onClick={() => onToggle(node.key)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                </button>
              )}
              <span>{isExpanded ? node.yearVal : node.title}</span>
            </div>
          ) : (
            <span>{node.yearVal}</span>
          )}
        </td>

        {/* Col B: month */}
        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: node.level === 'month' ? 600 : 400 }}>
          {node.level === 'month' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <button
                  onClick={() => onToggle(node.key)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                </button>
              )}
              <span>{isExpanded ? node.monthVal : node.title}</span>
            </div>
          ) : (
            <span>{node.monthVal}</span>
          )}
        </td>

        {/* Col C: budgetLine */}
        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: node.level === 'budgetLine' ? 600 : 400 }}>
          {node.level === 'budgetLine' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <button
                  onClick={() => onToggle(node.key)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                </button>
              )}
              <span>{isExpanded ? node.budgetLineVal : node.title}</span>
            </div>
          ) : (
            <span>{node.budgetLineVal}</span>
          )}
        </td>

        {/* Col D: category */}
        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', fontWeight: node.level === 'category' ? 600 : 400 }}>
          {node.level === 'category' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <button
                  onClick={() => onToggle(node.key)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                </button>
              )}
              <span>{isExpanded ? node.categoryVal : node.title}</span>
            </div>
          ) : (
            <span>{node.categoryVal}</span>
          )}
        </td>

        {/* Col E: lot */}
        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
          {node.level === 'lot' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <button
                  onClick={() => onToggle(node.key)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                </button>
              )}
              <span>{isExpanded ? (node.lotVal || '-') : node.title}</span>
            </div>
          ) : (
            <span>{node.lotVal}</span>
          )}
        </td>

        {/* Col F: featureId */}
        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
          {node.level === 'featureId' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {hasChildren && (
                <button
                  onClick={() => onToggle(node.key)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />}
                </button>
              )}
              <span>{isExpanded ? node.featureIdVal : node.title}</span>
            </div>
          ) : (
            <span>{node.featureIdVal}</span>
          )}
        </td>

        {/* Col G: entryTask */}
        <td style={{ padding: '5px 8px', minWidth: '240px' }}>
          {node.level === 'entryTask' ? (
            node.ticketLinkVal ? (
              <a
                href={node.ticketLinkVal}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#60a5fa',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                <span>{node.entryTaskVal}</span>
                <ExternalLink size={12} style={{ opacity: 0.8 }} />
              </a>
            ) : (
              <span>{node.entryTaskVal}</span>
            )
          ) : (
            <span style={{ fontStyle: 'italic', opacity: 0.75 }}>
              {isExpanded ? '' : node.title}
            </span>
          )}
        </td>

        {/* Col H: EXT (Consommé Externe) */}
        <td style={{ padding: '5px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: '#c084fc' }}>
          {formatNumber(node.extDays)}
        </td>

        {/* Col I: INT (Consommé Interne - Highlighted Yellow like Google Sheet!) */}
        <td
          style={{
            padding: '5px 10px',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            background: 'rgba(234, 179, 8, 0.22)',
            color: '#fef08a',
            fontWeight: node.intDays > 0 ? 600 : 400
          }}
        >
          {formatNumber(node.intDays)}
        </td>

        {/* Col J: Total général */}
        <td style={{ padding: '5px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>
          {formatNumber(node.totalDays)}
        </td>
      </tr>

      {/* Render children if expanded */}
      {isExpanded &&
        hasChildren &&
        node.children!.map((child) => (
          <LevelRow
            key={child.key}
            node={child}
            depth={depth + 1}
            expandedKeys={expandedKeys}
            onToggle={onToggle}
          />
        ))}
    </>
  );
};

export const TempoPivotTable: React.FC<TempoPivotTableProps> = ({ entries }) => {
  const treeData = useMemo(() => aggregatePivotData(entries), [entries]);

  // Grand totals
  const grandTotal = useMemo(() => {
    let intDays = 0;
    let extDays = 0;
    let totalDays = 0;
    treeData.forEach((y) => {
      intDays += y.intDays;
      extDays += y.extDays;
      totalDays += y.totalDays;
    });
    return {
      intDays: Number(intDays.toFixed(2)),
      extDays: Number(extDays.toFixed(2)),
      totalDays: Number(totalDays.toFixed(2))
    };
  }, [treeData]);

  // Expand keys state (Default: Year and Month open to match drill-down view)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    treeData.forEach((year) => {
      keys.add(year.key);
      if (year.children) {
        year.children.forEach((month) => {
          keys.add(month.key);
          if (month.children) {
            month.children.forEach((b) => {
              keys.add(b.key);
              if (b.children) {
                b.children.forEach((c) => {
                  keys.add(c.key);
                  if (c.children) {
                    c.children.forEach((l) => {
                      keys.add(l.key);
                      if (l.children) {
                        l.children.forEach((f) => keys.add(f.key));
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
    return keys;
  });

  const handleToggle = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const keys = new Set<string>();
    const collect = (nodes?: IPivotNode[]) => {
      if (!nodes) return;
      nodes.forEach((n) => {
        keys.add(n.key);
        collect(n.children);
      });
    };
    collect(treeData);
    setExpandedKeys(keys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys(new Set());
  };

  // Export 10-column TCD CSV matching exact Google Sheet layout
  const handleExportPivotCSV = () => {
    if (!treeData || treeData.length === 0) return;

    const rows: string[] = [];
    rows.push('"SUM de timeInDays";"";"";"";"";"";"";"type";"";""');
    rows.push('"year";"month";"budgetLine";"category";"lot";"featureId";"entryTask";"EXT";"INT";"Total général"');

    const escapeCSV = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const formatNumCSV = (val: number) => (val ? Number(val.toFixed(2)).toString().replace('.', ',') : '');

    const traverse = (node: IPivotNode) => {
      const row = [
        escapeCSV(node.yearVal),
        escapeCSV(node.monthVal),
        escapeCSV(node.budgetLineVal),
        escapeCSV(node.categoryVal),
        escapeCSV(node.lotVal),
        escapeCSV(node.featureIdVal),
        escapeCSV(node.level === 'entryTask' ? node.entryTaskVal : node.title),
        escapeCSV(formatNumCSV(node.extDays)),
        escapeCSV(formatNumCSV(node.intDays)),
        escapeCSV(formatNumCSV(node.totalDays))
      ];
      rows.push(row.join(';'));

      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    treeData.forEach(traverse);

    // Add Grand Total row
    rows.push([
      '"Total général"', '""', '""', '""', '""', '""', '""',
      escapeCSV(formatNumCSV(grandTotal.extDays)),
      escapeCSV(formatNumCSV(grandTotal.intDays)),
      escapeCSV(formatNumCSV(grandTotal.totalDays))
    ].join(';'));

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TCD_Detail_par_Ligne_Budget.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="card-title" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TableIcon size={18} color="var(--primary)" />
          <span>Feuille TCD : Détail par Ligne Budget</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExpandAll} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Tout déplier
          </button>
          <button onClick={handleCollapseAll} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Tout replier
          </button>
          <button onClick={handleExportPivotCSV} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Download size={14} /> Exporter Synthèse TCD (10 colonnes)
          </button>
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: '0.8rem', borderCollapse: 'collapse' }}>
          <thead>
            {/* Header Row 1 */}
            <tr style={{ background: '#0b1329', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <th colSpan={7} style={{ textAlign: 'left', fontStyle: 'italic', borderRight: '1px solid var(--border-color)', padding: '6px 10px' }}>
                SUM de timeInDays
              </th>
              <th colSpan={2} style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)', padding: '6px 10px', background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd' }}>
                type
              </th>
              <th style={{ textAlign: 'right', padding: '6px 10px', background: '#1e293b' }}>
                Total
              </th>
            </tr>

            {/* Header Row 2: A2 to J2 */}
            <tr style={{ background: '#1e293b' }}>
              <th style={{ width: '70px', padding: '8px' }}>year</th>
              <th style={{ width: '70px', padding: '8px' }}>month</th>
              <th style={{ width: '150px', padding: '8px' }}>budgetLine</th>
              <th style={{ width: '130px', padding: '8px' }}>category</th>
              <th style={{ width: '100px', padding: '8px' }}>lot</th>
              <th style={{ width: '90px', padding: '8px' }}>featureId</th>
              <th style={{ minWidth: '240px', padding: '8px' }}>entryTask</th>
              <th style={{ width: '90px', textAlign: 'right', padding: '8px', color: '#c084fc', background: 'rgba(147, 51, 234, 0.2)' }}>
                EXT
              </th>
              <th style={{ width: '90px', textAlign: 'right', padding: '8px', background: 'rgba(234, 179, 8, 0.45)', color: '#fef08a' }}>
                INT
              </th>
              <th style={{ width: '110px', textAlign: 'right', padding: '8px', background: '#334155' }}>
                Total général
              </th>
            </tr>
          </thead>
          <tbody>
            {treeData.map((yearNode) => (
              <LevelRow
                key={yearNode.key}
                node={yearNode}
                depth={0}
                expandedKeys={expandedKeys}
                onToggle={handleToggle}
              />
            ))}

            {/* Total Général Global row */}
            {treeData.length > 0 && (
              <tr style={{ background: 'rgba(59, 130, 246, 0.3)', fontWeight: 700, borderTop: '2px solid var(--primary)' }}>
                <td colSpan={7} style={{ padding: '8px 10px', color: '#ffffff' }}>
                  Total général
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#c084fc' }}>
                  {formatNumber(grandTotal.extDays)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', background: 'rgba(234, 179, 8, 0.4)', color: '#fef08a' }}>
                  {formatNumber(grandTotal.intDays)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.9rem' }}>
                  {formatNumber(grandTotal.totalDays)}
                </td>
              </tr>
            )}

            {treeData.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Aucune donnée disponible. Lancez une extraction pour générer la vue TCD.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
