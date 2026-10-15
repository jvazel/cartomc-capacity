import React, { useState } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  X,
  Filter,
  Calendar,
  Layers,
  Search,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { IProjet } from '../types';

export interface IArbitrationNoteRow {
  projetId: string;
  codeProjet?: string;
  nomProjet: string;
  priorite?: string;
  leadBANom: string;
  typeProjet: string;
  mois: number;
  nomMois: string;
  trimestre: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  joursPlanifies: number;
  noteArbitrage: string;
  estimationRetenue: number;
  statutEstimation: 'B0' | 'B1' | 'NC';
}

interface RapportArbitrageModalProps {
  isOpen: boolean;
  onClose: () => void;
  annee: number;
  projets: IProjet[];
  realVentilations: { [projetId: string]: Array<{ mois: number; joursInternes: number; joursExternes: number; noteArbitrage?: string }> };
  onSelectProject?: (projet: IProjet) => void;
}

const NOMS_MOIS = [
  '',
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const RapportArbitrageModal: React.FC<RapportArbitrageModalProps> = ({
  isOpen,
  onClose,
  annee,
  projets,
  realVentilations,
  onSelectProject
}) => {
  const [periodeFilter, setPeriodeFilter] = useState<'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  // Extraire toutes les notes d'arbitrage
  const allRows: IArbitrationNoteRow[] = [];

  projets.forEach((p) => {
    const vList = realVentilations[p._id] || [];
    const leadNom = typeof p.leadBA === 'object' && p.leadBA ? p.leadBA.nom : 'Non assigné';

    let estimationRetenue = 0;
    let statutEst: 'B0' | 'B1' | 'NC' = 'NC';
    if (p.estimationB1 && p.estimationB1 > 0) {
      statutEst = 'B1';
      estimationRetenue = p.estimationB1;
    } else if (p.estimationB0 && p.estimationB0 > 0) {
      statutEst = 'B0';
      estimationRetenue = p.estimationB0;
    }

    vList.forEach((v) => {
      const note = (v.noteArbitrage || '').trim();
      if (note.length > 0) {
        const m = v.mois;
        const trim: 'Q1' | 'Q2' | 'Q3' | 'Q4' =
          m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';

        allRows.push({
          projetId: p._id,
          codeProjet: p.codeProjet,
          nomProjet: p.nom,
          priorite: p.priorite || 'NC',
          leadBANom: leadNom,
          typeProjet: p.type,
          mois: m,
          nomMois: NOMS_MOIS[m] || `Mois ${m}`,
          trimestre: trim,
          joursPlanifies: Number(((v.joursInternes || 0) + (v.joursExternes || 0)).toFixed(1)),
          noteArbitrage: note,
          estimationRetenue,
          statutEstimation: statutEst
        });
      }
    });
  });

  // Filtrer
  const filteredRows = allRows.filter((r) => {
    const matchSearch =
      r.nomProjet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.codeProjet && r.codeProjet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.leadBANom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.noteArbitrage.toLowerCase().includes(searchTerm.toLowerCase());

    let matchPeriode = true;
    if (periodeFilter === 'Q1' || periodeFilter === 'Q2' || periodeFilter === 'Q3' || periodeFilter === 'Q4') {
      matchPeriode = r.trimestre === periodeFilter;
    } else if (periodeFilter !== 'ALL') {
      matchPeriode = r.mois === Number(periodeFilter);
    }

    return matchSearch && matchPeriode;
  });

  // Trier par mois chronologique, puis par priorité
  filteredRows.sort((a, b) => {
    if (a.mois !== b.mois) return a.mois - b.mois;
    const prioOrder: { [key: string]: number } = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, NC: 5 };
    return (prioOrder[a.priorite || 'NC'] ?? 9) - (prioOrder[b.priorite || 'NC'] ?? 9);
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Année',
      'Trimestre',
      'Mois',
      'Code Projet',
      'Nom Projet',
      'Priorité',
      'Type',
      'Lead BA',
      'Charge Planifiée Mois (j)',
      'Estimation Retenue (j)',
      'Statut Estimation',
      'Note d\'Arbitrage / Décision'
    ];

    const escapeCSV = (val: any) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredRows.map((r) => [
      escapeCSV(annee),
      escapeCSV(r.trimestre),
      escapeCSV(r.nomMois),
      escapeCSV(r.codeProjet || ''),
      escapeCSV(r.nomProjet),
      escapeCSV(r.priorite || 'NC'),
      escapeCSV(r.typeProjet),
      escapeCSV(r.leadBANom),
      escapeCSV(r.joursPlanifies),
      escapeCSV(r.estimationRetenue),
      escapeCSV(r.statutEstimation),
      escapeCSV(r.noteArbitrage)
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Synthese_Arbitrages_CartOMC_${annee}_${periodeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copier pour Email / Teams / Slack
  const handleCopyText = () => {
    const titre = `📌 SYNTHÈSE DES ARBITRAGES & NOTES DÉCISIONNELLES (${annee}${periodeFilter !== 'ALL' ? ` - ${periodeFilter}` : ''}) :\n\n`;
    const lignes = filteredRows.map((r) => {
      return `• [${r.priorite || 'NC'}] ${r.nomProjet} (${r.nomMois} ${annee} • ${r.joursPlanifies}j planifiés • Lead: ${r.leadBANom}) :\n   ↳ "${r.noteArbitrage}"`;
    }).join('\n\n');

    const total = `\n\nTotal : ${filteredRows.length} arbitrage(s) recensé(s).`;
    navigator.clipboard.writeText(titre + lignes + total);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="card card-neon-purple"
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(168, 85, 247, 0.25)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.15), rgba(6, 182, 212, 0.08))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(168, 85, 247, 0.25)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc'
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                Rapport d'Arbitrage & Synthèse des Notes
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                    color: '#e9d5ff',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    fontSize: '0.78rem'
                  }}
                >
                  {filteredRows.length} note{filteredRows.length > 1 ? 's' : ''}
                </span>
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Ordre du jour & compte-rendu décisionnel pour comités de pilotage (COPROJ / COPIL {annee})
              </p>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent' }}
            onClick={onClose}
          >
            <X size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Barre de Filtres & Actions d'Export */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'rgba(11, 17, 32, 0.6)'
          }}
        >
          {/* Filtres Période et Recherche */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Période :</span>
              <select
                className="form-select"
                value={periodeFilter}
                onChange={(e) => setPeriodeFilter(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '4px 10px', height: '32px', width: 'auto' }}
              >
                <option value="ALL">🗓️ Toute l'année {annee}</option>
                <option value="Q1">Q1 (Janv - Mars)</option>
                <option value="Q2">Q2 (Avril - Juin)</option>
                <option value="Q3">Q3 (Juil - Sept)</option>
                <option value="Q4">Q4 (Oct - Déc)</option>
                <option disabled>──────────</option>
                {NOMS_MOIS.slice(1).map((m, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {m} {annee}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Rechercher un projet, note..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '30px', fontSize: '0.82rem', height: '32px' }}
              />
            </div>
          </div>

          {/* Boutons d'Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: copied ? '#10b981' : 'rgba(255, 255, 255, 0.2)',
                color: copied ? '#10b981' : '#ffffff'
              }}
              onClick={handleCopyText}
              disabled={filteredRows.length === 0}
              title="Copier le texte formaté pour e-mail, Teams ou compte-rendu"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copié dans le presse-papier !' : 'Copier pour CR / Teams'}
            </button>

            <button
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                border: 'none',
                fontWeight: 600
              }}
              onClick={handleExportCSV}
              disabled={filteredRows.length === 0}
              title="Exporter sous format Excel / CSV (point-virgule UTF-8 BOM)"
            >
              <Download size={15} />
              Exporter CSV (Excel)
            </button>
          </div>
        </div>

        {/* Liste / Tableau des Arbitrages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filteredRows.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <MessageSquare size={36} style={{ color: 'rgba(255, 255, 255, 0.2)' }} />
              <div>
                <strong style={{ fontSize: '1rem', color: '#ffffff' }}>Aucune note d'arbitrage trouvée</strong>
                <p style={{ fontSize: '0.85rem', marginTop: '4px', maxWidth: '460px' }}>
                  {allRows.length === 0
                    ? `Aucune note n'a encore été saisie sur les cellules de ventilation pour l'année ${annee}. Vous pouvez en ajouter par double-clic sur les cellules du Gantt.`
                    : "Aucun résultat ne correspond aux filtres appliqués."}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredRows.map((row, index) => {
                const targetProject = projets.find((p) => p._id === row.projetId);
                return (
                  <div
                    key={`${row.projetId}_${row.mois}_${index}`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Ligne En-tête : Projet & Contexte */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {row.priorite && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor:
                                row.priorite === 'P0'
                                  ? '#ef4444'
                                  : row.priorite === 'P1'
                                  ? '#f97316'
                                  : row.priorite === 'P2'
                                  ? '#fbbf24'
                                  : '#3b82f6',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.74rem'
                            }}
                          >
                            {row.priorite}
                          </span>
                        )}

                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            color: '#ffffff',
                            cursor: targetProject && onSelectProject ? 'pointer' : 'default',
                            textDecoration: targetProject && onSelectProject ? 'underline' : 'none'
                          }}
                          onClick={() => targetProject && onSelectProject && onSelectProject(targetProject)}
                          title="Cliquer pour focaliser ce projet sur la Timeline"
                        >
                          {row.codeProjet ? `[${row.codeProjet}] ` : ''}{row.nomProjet}
                        </span>

                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          • Lead : <strong style={{ color: 'var(--text-main)' }}>{row.leadBANom}</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'rgba(6, 182, 212, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            fontSize: '0.74rem'
                          }}
                        >
                          📅 {row.nomMois} {annee} ({row.trimestre})
                        </span>

                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-main)',
                            fontSize: '0.74rem'
                          }}
                        >
                          Charge : <strong>{row.joursPlanifies} j</strong>
                        </span>
                      </div>
                    </div>

                    {/* Contenu de la Note d'Arbitrage */}
                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        borderLeft: '3px solid #f59e0b',
                        padding: '8px 12px',
                        borderRadius: '0 6px 6px 0',
                        fontSize: '0.88rem',
                        color: '#fef08a',
                        lineHeight: 1.45
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#fbbf24', marginRight: '6px' }}>Arbitrage :</span>
                      {row.noteArbitrage}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de modal */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(11, 17, 32, 0.9)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}
        >
          <div>
            Astuce : Les notes d'arbitrage s'ajoutent directement par <strong>double-clic</strong> sur une cellule mensuelle du Gantt.
          </div>
          <button className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 16px' }} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
