import React, { useState, useEffect } from 'react';
import { VersionItem, VersionTicket } from './types';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface VersionTicketsModalProps {
  version: VersionItem | null;
  isOpen: boolean;
  onClose: () => void;
  projectKey?: string;
}

export const VersionTicketsModal: React.FC<VersionTicketsModalProps> = ({ version, isOpen, onClose, projectKey = 'GTEP' }) => {
  const [tickets, setTickets] = useState<VersionTicket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'blocked' | 'anomalies' | 'a_decaler' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const isUnassignedView = version?._id === 'unassigned';

  // Vérification si un statut est considéré comme "Blocked" (bloqué)
  const isBlockedStatus = (statusName: string = ''): boolean => {
    const s = statusName.toLowerCase().trim();
    return s.includes('block') || s.includes('bloqu') || s.includes('impediment') || s.includes('on hold');
  };

  // Vérification si un statut est considéré comme Terminé / Fini
  const isDoneStatus = (statusName: string = '', category: string = ''): boolean => {
    if (category === 'done') return true;
    const s = statusName.toLowerCase().trim();
    return ['terminé', 'termine', 'fini', 'done', 'closed', 'fermé', 'ferme', 'résolu', 'resolu', 'resolved', 'livré', 'livre', 'en prod'].includes(s);
  };

  // Ordre de priorité des statuts pour le tri
  const getStatusPriority = (t: VersionTicket): number => {
    // Statut Blocked / Bloqué prioritaire absolu
    if (isBlockedStatus(t.status)) return 0;

    // Anomalie critique / retard
    if (t.anomaly === 'a_decaler') return 1;

    if (isDoneStatus(t.status, t.statusCategory)) return 6;

    switch (t.statusCategory) {
      case 'inprogress':
        return 2;
      case 'review':
        return 3;
      case 'qa':
        return 4;
      case 'todo':
        return 5;
      default:
        return 5;
    }
  };

  useEffect(() => {
    if (version && isOpen) {
      setIsLoading(true);
      const url = version._id === 'unassigned'
        ? `/api/versions/unassigned/tickets?projectKey=${encodeURIComponent(version.projectKey || projectKey)}`
        : `/api/versions/${version._id}/tickets`;

      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          setTickets(data.tickets || []);
        })
        .catch((err) => console.error('Erreur chargement tickets:', err))
        .finally(() => setIsLoading(false));
    }
  }, [version, isOpen, projectKey]);

  // Remise à la page 1 si les filtres ou la taille de page changent
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchQuery, pageSize, version?._id]);

  if (!isOpen || !version) return null;

  // Filtrage
  const filteredTickets = tickets.filter((t) => {
    // Filtre texte
    const matchesSearch =
      t.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.collaborator.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'blocked') {
      return isBlockedStatus(t.status);
    }
    if (filterType === 'anomalies') {
      return t.anomaly !== 'none' || isBlockedStatus(t.status);
    }
    if (filterType === 'a_decaler') {
      return t.anomaly === 'a_decaler';
    }
    if (filterType === 'done') {
      return isDoneStatus(t.status, t.statusCategory);
    }
    return true;
  }).sort((a, b) => {
    // 1. Ordre de priorité des catégories (Blocked = 0, En cours, etc.)
    const prioA = getStatusPriority(a);
    const prioB = getStatusPriority(b);
    if (prioA !== prioB) return prioA - prioB;

    // 2. Par nom de statut exact alphabétique
    const statusComp = a.status.localeCompare(b.status);
    if (statusComp !== 0) return statusComp;

    // 3. Par clé de ticket
    return a.key.localeCompare(b.key);
  });

  // Pagination calculée
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredTickets.length);
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  const blockedCount = tickets.filter((t) => isBlockedStatus(t.status)).length;
  const anomaliesCount = tickets.filter((t) => t.anomaly !== 'none' || isBlockedStatus(t.status)).length;
  const aDecalerCount = tickets.filter((t) => t.anomaly === 'a_decaler').length;

  const handleCopyAnomalyKeys = () => {
    const keys = tickets.filter((t) => t.anomaly !== 'none' || isBlockedStatus(t.status)).map((t) => t.key).join(' ');
    if (keys) {
      navigator.clipboard.writeText(keys);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: isFullscreen ? '98vw' : '1360px',
          width: isFullscreen ? '98vw' : '96%',
          maxHeight: isFullscreen ? '96vh' : '92vh',
          height: isFullscreen ? '96vh' : undefined,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.25s ease'
        }}
      >
        {/* En-tête */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.35)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.01em'
                }}
              >
                {isUnassignedView ? (
                  <>Tickets Jira non affectés à une version (<span style={{ color: '#fb923c' }}>Orphelins</span>)</>
                ) : (
                  <>Tickets Jira de la version : <span style={{ color: 'var(--primary)' }}>{version.versionName}</span></>
                )}
              </h2>
              {isUnassignedView ? (
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(251, 146, 60, 0.2)',
                    color: '#fb923c',
                    border: '1px solid rgba(251, 146, 60, 0.4)',
                    padding: '3px 8px'
                  }}
                >
                  ⚠️ Sans version / FixVersion vide
                </span>
              ) : (
                <span className={`badge ${version.released ? 'badge-success' : 'badge-primary'}`}>
                  {version.released ? 'Publiée' : 'Non publiée (En cours)'}
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total : <strong style={{ color: 'var(--text-main)' }}>{tickets.length}</strong> tickets répertoriés dans les extractions Tempo Jira
              {isUnassignedView && ' sans aucune version renseignée'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Réduire' : 'Agrandir en plein écran'}
              className="btn-change-role"
              style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? 'Réduire' : 'Plein écran'}</span>
            </button>
            <button
              onClick={onClose}
              className="btn-change-role"
              style={{ padding: '6px', borderRadius: '8px' }}
              title="Fermer la popin"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barre d'outils & Actions */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          {/* Filtres par boutons compteurs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterType('all')}
              className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
            >
              Tous ({tickets.length})
            </button>
            {blockedCount > 0 && (
              <button
                onClick={() => setFilterType('blocked')}
                className={`btn ${filterType === 'blocked' ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  backgroundColor: filterType === 'blocked' ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                  color: filterType === 'blocked' ? '#ffffff' : '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  fontWeight: 700
                }}
              >
                ⛔ Bloqués / Blocked ({blockedCount})
              </button>
            )}
            <button
              onClick={() => setFilterType('anomalies')}
              className={`btn ${filterType === 'anomalies' ? 'btn-danger' : 'btn-secondary'}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                color: filterType === 'anomalies' ? '#ffffff' : '#f87171'
              }}
            >
              <AlertTriangle size={14} /> Toutes anomalies ({anomaliesCount})
            </button>
            <button
              onClick={() => setFilterType('a_decaler')}
              className={`btn ${filterType === 'a_decaler' ? 'btn-danger' : 'btn-secondary'}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                color: filterType === 'a_decaler' ? '#ffffff' : 'var(--danger)',
                fontWeight: 600
              }}
            >
              <AlertCircle size={14} /> À décaler ({aDecalerCount})
            </button>
            <button
              onClick={() => setFilterType('done')}
              className={`btn ${filterType === 'done' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                color: filterType === 'done' ? '#ffffff' : 'var(--success)'
              }}
            >
              <CheckCircle2 size={14} /> Terminés
            </button>
          </div>

          {/* Recherche & Copie rapide */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Rechercher ticket / assigné..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  padding: '6px 10px 6px 30px',
                  fontSize: '0.82rem',
                  width: '210px'
                }}
              />
            </div>

            {anomaliesCount > 0 && (
              <button
                type="button"
                onClick={handleCopyAnomalyKeys}
                title="Copier les clés Jira des tickets en anomalie pour les reporter"
                className="btn btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color-glow)'
                }}
              >
                {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                {copied ? 'Clés copiées !' : 'Copier clés à décaler'}
              </button>
            )}
          </div>
        </div>

        {/* Tableau des tickets */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px 24px' }}>
          {isLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chargement des tickets Jira...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aucun ticket ne correspond aux filtres sélectionnés.
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ width: '130px', whiteSpace: 'nowrap' }}>Clé</th>
                    <th style={{ minWidth: '320px' }}>Résumé du ticket</th>
                    <th style={{ width: '180px', whiteSpace: 'nowrap' }}>Assigné</th>
                    <th style={{ width: '180px', whiteSpace: 'nowrap' }}>Statut Jira</th>
                    <th style={{ width: '100px', whiteSpace: 'nowrap', textAlign: 'center' }}>Temps (J)</th>
                    <th style={{ minWidth: '240px', whiteSpace: 'nowrap' }}>Diagnostic Jalon</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTickets.map((t) => {
                    const hasAnomaly = t.anomaly !== 'none';
                    const isDone = isDoneStatus(t.status, t.statusCategory);
                    const isBlocked = isBlockedStatus(t.status);

                    return (
                      <tr
                        key={t.key}
                        style={{
                          backgroundColor: isBlocked
                            ? 'rgba(239, 68, 68, 0.16)'
                            : hasAnomaly
                            ? 'rgba(239, 68, 68, 0.08)'
                            : undefined,
                          borderLeft: isBlocked ? '4px solid #ef4444' : undefined
                        }}
                      >
                        <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {t.ticketLink ? (
                            <a
                              href={t.ticketLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: isBlocked ? '#f87171' : 'var(--primary)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {t.key} <ExternalLink size={12} />
                            </a>
                          ) : (
                            t.key
                          )}
                        </td>
                        <td title={t.summary}>
                          <div style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                            {t.summary}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {t.collaborator}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span
                            className={`badge ${
                              isBlocked
                                ? 'badge-danger'
                                : isDone
                                ? 'badge-success'
                                : t.statusCategory === 'inprogress'
                                ? 'badge-warning'
                                : t.statusCategory === 'review'
                                ? 'badge-purple'
                                : 'badge-secondary'
                            }`}
                            style={{
                              backgroundColor: isBlocked ? '#ef4444' : undefined,
                              color: isBlocked ? '#ffffff' : undefined,
                              fontWeight: isBlocked ? 800 : 600,
                              boxShadow: isBlocked ? '0 0 10px rgba(239, 68, 68, 0.5)' : undefined,
                              border: isBlocked ? '1px solid #dc2626' : undefined
                            }}
                          >
                            {isBlocked ? `⛔ ${t.status}` : t.status}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {t.timeInDays > 0 ? `${t.timeInDays} j` : '-'}
                        </td>
                        <td>
                          {isBlocked ? (
                            <span
                              className="badge badge-danger"
                              style={{
                                padding: '4px 10px',
                                gap: '6px',
                                fontSize: '0.78rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.45)'
                              }}
                            >
                              <AlertTriangle size={14} /> Attention : Ticket bloqué (Blocked)
                            </span>
                          ) : hasAnomaly ? (
                            <span
                              className="badge badge-danger"
                              style={{
                                padding: '4px 10px',
                                gap: '6px',
                                fontSize: '0.78rem'
                              }}
                            >
                              <AlertCircle size={14} /> {t.anomalyLabel}
                            </span>
                          ) : isDone ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.8rem',
                                color: 'var(--success)',
                                fontWeight: 500
                              }}
                            >
                              <CheckCircle2 size={14} /> Conforme (Terminé)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                              Conforme au planning
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

        {/* Barre de pagination en pied de modale */}
        {!isLoading && filteredTickets.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 24px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid var(--border-color, #334155)',
              flexShrink: 0
            }}
          >
            {/* Décompte et sélecteur de taille par page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Affichage de <strong style={{ color: 'var(--text-main)' }}>{startIndex + 1}</strong> à{' '}
                <strong style={{ color: 'var(--text-main)' }}>{endIndex}</strong> sur{' '}
                <strong style={{ color: 'var(--accent-primary, #06b6d4)' }}>{filteredTickets.length}</strong> tickets
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label htmlFor="modal-page-size" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Par page :
                </label>
                <select
                  id="modal-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="form-control"
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.8rem',
                    height: '28px',
                    width: 'auto',
                    borderRadius: '6px'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
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
                  padding: '4px 8px',
                  height: '30px',
                  fontSize: '0.8rem',
                  opacity: validCurrentPage <= 1 ? 0.4 : 1,
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronsLeft size={14} />
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={validCurrentPage <= 1}
                title="Page précédente"
                style={{
                  padding: '4px 10px',
                  height: '30px',
                  fontSize: '0.8rem',
                  opacity: validCurrentPage <= 1 ? 0.4 : 1,
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} /> Précédent
              </button>

              {/* Raccourcis de pages */}
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
                        key={`modal-page-${pageItem}`}
                        type="button"
                        onClick={() => setCurrentPage(pageItem)}
                        className={pageItem === validCurrentPage ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{
                          minWidth: '28px',
                          height: '28px',
                          padding: '0 6px',
                          fontSize: '0.78rem',
                          fontWeight: pageItem === validCurrentPage ? 700 : 500
                        }}
                      >
                        {pageItem}
                      </button>
                    ) : (
                      <span
                        key={`modal-ellipsis-${idx}`}
                        style={{
                          padding: '0 3px',
                          color: 'var(--text-dim)',
                          fontSize: '0.78rem',
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
                  padding: '4px 10px',
                  height: '30px',
                  fontSize: '0.8rem',
                  opacity: validCurrentPage >= totalPages ? 0.4 : 1,
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Suivant <ChevronRight size={14} />
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage >= totalPages}
                title="Dernière page"
                style={{
                  padding: '4px 8px',
                  height: '30px',
                  fontSize: '0.8rem',
                  opacity: validCurrentPage >= totalPages ? 0.4 : 1,
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
