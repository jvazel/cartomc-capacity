import React, { useState, useEffect } from 'react';
import { IMoisCapacite, ICapacitePopulation } from '../types';
import { Calculator, AlertCircle, RefreshCw } from 'lucide-react';
import { getAbsenceHeatmapStyle } from '../utils/heatmap';

interface VerifCapaciteTableProps {
  anneeInitiale?: number;
}

export const VerifCapaciteTable: React.FC<VerifCapaciteTableProps> = ({
  anneeInitiale = new Date().getFullYear()
}) => {
  const [annee, setAnnee] = useState<number>(anneeInitiale);
  const [population, setPopulation] = useState<'global' | 'interne' | 'externe' | 'cote_a_cote'>('global');
  const [capaciteData, setCapaciteData] = useState<IMoisCapacite[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCapacite = (anneeTarget: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/capacite?annee=${anneeTarget}`)
      .then((res) => {
        if (!res.ok) throw new Error('Erreur lors de la récupération des capacités.');
        return res.json();
      })
      .then((data) => {
        setCapaciteData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur capacité:', err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCapacite(annee);
  }, [annee]);

  // Calcul des totaux annuels
  const calculerTotalAnnuel = (popKey: 'interne' | 'externe' | 'global') => {
    let totCapaciteTheo = 0;
    let totDeperdition = 0;
    let totCapaciteNette = 0;
    let totalJoursOuvres = 0;
    let sumEtp = 0;

    capaciteData.forEach((m) => {
      const pop: ICapacitePopulation = m[popKey];
      totCapaciteTheo += pop.capaciteTheorique;
      totDeperdition += pop.deperdition;
      totCapaciteNette += pop.capaciteNette;
      totalJoursOuvres += pop.joursOuvres;
      sumEtp += pop.etp;
    });

    const avgEtp = capaciteData.length > 0 ? sumEtp / capaciteData.length : 0;

    return {
      avgEtp: Number(avgEtp.toFixed(2)),
      totalJoursOuvres,
      totCapaciteTheo: Number(totCapaciteTheo.toFixed(2)),
      totDeperdition: Number(totDeperdition.toFixed(2)),
      totCapaciteNette: Number(totCapaciteNette.toFixed(2))
    };
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={20} style={{ color: 'var(--primary-light)' }} />
          <span>Tableau de vérification des capacités mensuelles</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Sélection Année */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>
              Année :
            </label>
            <select
              className="form-select"
              style={{ width: '100px', padding: '4px 8px' }}
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
            onClick={() => fetchCapacite(annee)}
            title="Rafraîchir les données"
          >
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>
      </div>

      {/* Onglets de population */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          className={`btn ${population === 'global' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          onClick={() => setPopulation('global')}
        >
          Population Globale (Total)
        </button>
        <button
          className={`btn ${population === 'interne' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          onClick={() => setPopulation('interne')}
        >
          Internes uniquement
        </button>
        <button
          className={`btn ${population === 'externe' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          onClick={() => setPopulation('externe')}
        >
          Externes uniquement
        </button>
        <button
          className={`btn ${population === 'cote_a_cote' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.85rem', padding: '6px 14px' }}
          onClick={() => setPopulation('cote_a_cote')}
        >
          Vue détaillée Côte à Côte
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Calcul et agrégation des capacités en cours...
        </div>
      ) : error ? (
        <div style={{ padding: '16px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {error}
        </div>
      ) : population === 'cote_a_cote' ? (
        /* Vue Côte à côte */
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>Mois</th>
                <th rowSpan={2}>Jours Ouvrés</th>
                <th colSpan={4} style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}>
                  Internes
                </th>
                <th colSpan={4} style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)' }}>
                  Externes
                </th>
                <th colSpan={3} style={{ textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
                  Global (Total)
                </th>
              </tr>
              <tr>
                <th>ETP</th>
                <th>Cap. Th.</th>
                <th>Déperd.</th>
                <th>Cap. Nette</th>

                <th>ETP</th>
                <th>Cap. Th.</th>
                <th>Déperd.</th>
                <th>Cap. Nette</th>

                <th>ETP</th>
                <th>Déperd.</th>
                <th>Cap. Nette</th>
              </tr>
            </thead>
            <tbody>
              {capaciteData.map((m) => (
                <tr key={m.mois}>
                  <td style={{ fontWeight: 600 }}>{m.nomMois}</td>
                  <td>
                    {m.joursOuvres} j {m.estJoursOuvresForces && <span style={{ color: '#fbbf24' }}>*</span>}
                  </td>

                  {/* Interne */}
                  <td style={{ color: 'var(--text-muted)' }}>{m.interne.etp}</td>
                  <td>{m.interne.capaciteTheorique} j</td>
                  <td>
                    {(() => {
                      const hs = getAbsenceHeatmapStyle(m.interne.deperdition, m.interne.capaciteTheorique);
                      return (
                        <span className="badge" style={{ backgroundColor: hs.bg, color: hs.color, borderColor: hs.border, borderWidth: '1px', borderStyle: 'solid', fontSize: '0.75rem' }}>
                          {m.interne.deperdition}j ({hs.label})
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{m.interne.capaciteNette} j</td>

                  {/* Externe */}
                  <td style={{ color: 'var(--text-muted)' }}>{m.externe.etp}</td>
                  <td>{m.externe.capaciteTheorique} j</td>
                  <td>
                    {(() => {
                      const hs = getAbsenceHeatmapStyle(m.externe.deperdition, m.externe.capaciteTheorique);
                      return (
                        <span className="badge" style={{ backgroundColor: hs.bg, color: hs.color, borderColor: hs.border, borderWidth: '1px', borderStyle: 'solid', fontSize: '0.75rem' }}>
                          {m.externe.deperdition}j ({hs.label})
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>{m.externe.capaciteNette} j</td>

                  {/* Global */}
                  <td style={{ fontWeight: 600 }}>{m.global.etp}</td>
                  <td>
                    {(() => {
                      const hs = getAbsenceHeatmapStyle(m.global.deperdition, m.global.capaciteTheorique);
                      return (
                        <span className="badge" style={{ backgroundColor: hs.bg, color: hs.color, borderColor: hs.border, borderWidth: '1px', borderStyle: 'solid', fontSize: '0.75rem' }}>
                          {m.global.deperdition}j ({hs.label})
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ fontWeight: 700, color: '#38bdf8' }}>{m.global.capaciteNette} j</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(() => {
                const totInt = calculerTotalAnnuel('interne');
                const totExt = calculerTotalAnnuel('externe');
                const totGlob = calculerTotalAnnuel('global');
                return (
                  <tr style={{ background: 'var(--surface-hover)', fontWeight: 700 }}>
                    <td>TOTAL ANNUEL</td>
                    <td>{totGlob.totalJoursOuvres} j</td>

                    <td>Moy. {totInt.avgEtp}</td>
                    <td>{totInt.totCapaciteTheo} j</td>
                    <td style={{ color: 'var(--warning)' }}>{totInt.totDeperdition} j</td>
                    <td style={{ color: 'var(--primary-light)' }}>{totInt.totCapaciteNette} j</td>

                    <td>Moy. {totExt.avgEtp}</td>
                    <td>{totExt.totCapaciteTheo} j</td>
                    <td style={{ color: 'var(--warning)' }}>{totExt.totDeperdition} j</td>
                    <td style={{ color: 'var(--success)' }}>{totExt.totCapaciteNette} j</td>

                    <td>Moy. {totGlob.avgEtp}</td>
                    <td style={{ color: 'var(--warning)' }}>{totGlob.totDeperdition} j</td>
                    <td style={{ color: '#38bdf8', fontSize: '1.05rem' }}>{totGlob.totCapaciteNette} j</td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      ) : (
        /* Vue Tableau Standard pour 1 population choisie */
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mois</th>
                <th>ETP (Somme taux d'activité)</th>
                <th>Jours ouvrés</th>
                <th>Capacité Théorique (ETP × Jours)</th>
                <th>Déperdition (Absences CSV)</th>
                <th>Capacité Nette (Théorique − Déperdition)</th>
              </tr>
            </thead>
            <tbody>
              {capaciteData.map((m) => {
                const pop: ICapacitePopulation = m[population as 'interne' | 'externe' | 'global'];
                return (
                  <tr key={m.mois}>
                    <td style={{ fontWeight: 600 }}>{m.nomMois}</td>
                    <td>
                      <span className="badge badge-secondary">{pop.etp} ETP</span>
                    </td>
                    <td>
                      {pop.joursOuvres} jours {m.estJoursOuvresForces && <span style={{ color: '#fbbf24', fontWeight: 600 }}>(Forcé)</span>}
                    </td>
                    <td style={{ fontWeight: 500 }}>{pop.capaciteTheorique} j</td>
                    <td>
                      {(() => {
                        const heatStyle = getAbsenceHeatmapStyle(pop.deperdition, pop.capaciteTheorique);
                        return (
                          <span
                            className="badge"
                            title={`Taux d'absentéisme : ${heatStyle.label}`}
                            style={{
                              backgroundColor: heatStyle.bg,
                              color: heatStyle.color,
                              borderColor: heatStyle.border,
                              borderStyle: 'solid',
                              borderWidth: '1px',
                              fontWeight: 700
                            }}
                          >
                            {pop.deperdition} j ({heatStyle.label})
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          borderColor: 'rgba(56, 189, 248, 0.3)',
                          fontSize: '0.9rem',
                          padding: '4px 10px'
                        }}
                      >
                        {pop.capaciteNette} j
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const tot = calculerTotalAnnuel(population as 'interne' | 'externe' | 'global');
                return (
                  <tr style={{ background: 'var(--surface-hover)', fontWeight: 700 }}>
                    <td>TOTAL / MOYENNE ANNUELLE</td>
                    <td>Moyenne : {tot.avgEtp} ETP</td>
                    <td>{tot.totalJoursOuvres} jours</td>
                    <td>{tot.totCapaciteTheo} j</td>
                    <td style={{ color: 'var(--warning)' }}>{tot.totDeperdition} j</td>
                    <td>
                      <span style={{ color: '#38bdf8', fontSize: '1.05rem' }}>
                        {tot.totCapaciteNette} j
                      </span>
                    </td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
