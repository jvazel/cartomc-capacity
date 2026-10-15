import React, { useState, useEffect } from 'react';
import { IRapprochementProjetItem } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Layers,
  TrendingUp,
  FolderKanban,
  Target,
  LineChart as LineChartIcon,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Props {
  annee: number;
}

export const RapprochementTempoTable: React.FC<Props> = ({ annee }) => {
  const [items, setItems] = useState<IRapprochementProjetItem[]>([]);
  const [currentMois, setCurrentMois] = useState<number>(new Date().getMonth() + 1);
  const [dernierImportAt, setDernierImportAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Projet sélectionné pour la modal d'atterrissage
  const [selectedProjetChart, setSelectedProjetChart] = useState<IRapprochementProjetItem | null>(null);

  // Filtres
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterSante, setFilterSante] = useState<string>('Tous');

  const loadData = () => {
    setLoading(true);
    fetch(`/api/projets/rapprochement-tempo?annee=${annee}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setCurrentMois(data.currentMois || (new Date().getMonth() + 1));
        setDernierImportAt(data.dernierImportAt || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur chargement rapprochement Tempo:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [annee]);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      item.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.codeProjet && item.codeProjet.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.jiraBudgetLine && item.jiraBudgetLine.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.jiraEpicKey && item.jiraEpicKey.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.leadBANom && item.leadBANom.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSante = filterSante === 'Tous' || item.santeConsommation === filterSante;

    return matchesSearch && matchesSante;
  });

  // Cumuls globaux
  const totalConsomme = filteredItems.reduce((acc, i) => acc + i.consommeTempo, 0);
  const totalPlanifieADate = filteredItems.reduce((acc, i) => acc + i.planifieADate, 0);
  const totalEstimationRetenue = filteredItems.reduce((acc, i) => acc + i.estimationRetenue, 0);
  const totalAtterrissage = filteredItems.reduce((acc, i) => acc + i.atterrissagePrevu, 0);

  const renderSanteBadge = (sante: 'VERT' | 'ORANGE' | 'ROUGE') => {
    switch (sante) {
      case 'VERT':
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Maîtrisé
          </span>
        );
      case 'ORANGE':
        return (
          <span className="badge badge-warning">
            <AlertTriangle size={12} style={{ marginRight: '4px' }} /> Surconsommé à date
          </span>
        );
      case 'ROUGE':
        return (
          <span className="badge badge-danger">
            <AlertOctagon size={12} style={{ marginRight: '4px' }} /> Dérive critique
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cards KPI d'Ensemble alignées sur la charte CartOMC */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}
      >
        <div className="card card-neon-blue" style={{ margin: 0, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} style={{ color: '#60a5fa' }} /> Consommé Tempo ({annee})
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px', color: '#60a5fa' }}>
            {totalConsomme.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>j</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            vs {totalPlanifieADate.toFixed(1)}j planifiés à date (Mois {currentMois})
          </div>
        </div>

        <div className="card card-neon-purple" style={{ margin: 0, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={16} style={{ color: '#c084fc' }} /> Total Estimation (B1/B0)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px', color: '#c084fc' }}>
            {totalEstimationRetenue.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>j</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Budget total validé sur les projets filtrés
          </div>
        </div>

        <div
          className={`card ${totalAtterrissage > totalEstimationRetenue && totalEstimationRetenue > 0 ? 'card-neon-red' : ''}`}
          style={{ margin: 0, padding: '16px 20px' }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp
              size={16}
              style={{
                color:
                  totalAtterrissage > totalEstimationRetenue && totalEstimationRetenue > 0
                    ? 'var(--danger)'
                    : 'var(--success)'
              }}
            />
            Atterrissage Prévisionnel
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              marginTop: '4px',
              color:
                totalAtterrissage > totalEstimationRetenue && totalEstimationRetenue > 0
                  ? 'var(--danger)'
                  : 'var(--success)'
            }}
          >
            {totalAtterrissage.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>j</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Consommé à date + Planifié futur (M{currentMois + 1}-M12)
          </div>
        </div>

        <div className="card" style={{ margin: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} style={{ color: 'var(--primary-light)' }} /> Horodatage Extraction
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '6px', color: 'var(--text-main)' }}>
              {dernierImportAt ? new Date(dernierImportAt).toLocaleString('fr-FR') : 'Aucune extraction'}
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: '8px', width: 'fit-content' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="card" style={{ padding: '16px 20px', margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ width: '100%' }}
              placeholder="Rechercher par nom, code projet, clé Jira, Lead BA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Santé Consommation :
            </label>
            <select
              className="form-select"
              style={{ width: '190px' }}
              value={filterSante}
              onChange={(e) => setFilterSante(e.target.value)}
            >
              <option value="Tous">Tous les statuts</option>
              <option value="VERT">🟩 Maîtrisé</option>
              <option value="ORANGE">🟧 Surconsommé à date</option>
              <option value="ROUGE">🔴 Dérive critique</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau de Rapprochement aux standards CartOMC */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Projet / Code</th>
              <th>Correspondance Jira</th>
              <th style={{ textAlign: 'right' }}>Est. Retenue</th>
              <th style={{ textAlign: 'right' }}>Planifié Total</th>
              <th style={{ textAlign: 'right' }}>Planifié à date</th>
              <th style={{ textAlign: 'right', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                Consommé Tempo
              </th>
              <th style={{ textAlign: 'right' }}>RAF</th>
              <th style={{ textAlign: 'right' }}>Atterrissage</th>
              <th style={{ textAlign: 'right' }}>Dérive à date</th>
              <th style={{ textAlign: 'center' }}>Santé</th>
              <th style={{ textAlign: 'center' }}>Atterrissage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: 'var(--primary)' }} />
                  Chargement des données de rapprochement...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Aucun projet ne correspond à votre recherche.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const hasMapping =
                  item.jiraBudgetLine || item.jiraEpicKey || item.jiraFeatureId || item.codeProjet;

                const ratioConsomme =
                  item.planifieADate > 0
                    ? Math.min(100, Math.round((item.consommeTempo / item.planifieADate) * 100))
                    : 0;

                return (
                  <tr key={item.projetId}>
                    {/* Nom Projet & Code */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.nom}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.codeProjet && (
                          <span className="badge badge-secondary" style={{ fontFamily: 'monospace', padding: '1px 6px' }}>
                            {item.codeProjet}
                          </span>
                        )}
                        <span>{item.type}</span>
                        {item.leadBANom && <span>• BA : {item.leadBANom}</span>}
                      </div>
                    </td>

                    {/* Mapping Jira */}
                    <td>
                      {hasMapping ? (
                        <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {item.jiraBudgetLine && (
                            <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>Ligne: {item.jiraBudgetLine}</span>
                          )}
                          {item.jiraEpicKey && (
                            <span style={{ color: '#c084fc', fontFamily: 'monospace' }}>Epic: {item.jiraEpicKey}</span>
                          )}
                          {item.jiraFeatureId && (
                            <span style={{ color: '#34d399', fontFamily: 'monospace' }}>Feature: #{item.jiraFeatureId}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>Non associé</span>
                      )}
                    </td>

                    {/* Estimation Retenue */}
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {item.estimationRetenue > 0 ? (
                        <div>
                          {item.estimationRetenue.toFixed(1)}j
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            ({item.statutEstimation})
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>NC</span>
                      )}
                    </td>

                    {/* Total Planifié */}
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {item.totalPlanifie.toFixed(1)}j
                    </td>

                    {/* Planifié à date */}
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {item.planifieADate.toFixed(1)}j
                    </td>

                    {/* Consommé Tempo */}
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        background: 'rgba(59, 130, 246, 0.08)',
                        color: '#60a5fa'
                      }}
                    >
                      {item.consommeTempo > 0 ? (
                        <div>
                          {item.consommeTempo.toFixed(1)}j
                          {item.planifieADate > 0 && (
                            <div
                              style={{
                                height: '3px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '2px',
                                marginTop: '4px',
                                overflow: 'hidden'
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${ratioConsomme}%`,
                                  background: item.consommeTempo > item.planifieADate ? 'var(--warning)' : 'var(--primary)'
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* RAF */}
                    <td style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 500 }}>
                      {item.resteAFaire.toFixed(1)}j
                    </td>

                    {/* Atterrissage */}
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      <span
                        style={{
                          color:
                            item.atterrissagePrevu > item.chargeMaxToleree && item.chargeMaxToleree > 0
                              ? 'var(--danger)'
                              : 'var(--success)'
                        }}
                      >
                        {item.atterrissagePrevu.toFixed(1)}j
                      </span>
                    </td>

                    {/* Dérive à date */}
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      <span
                        style={{
                          color:
                            item.deriveADate > 0
                              ? 'var(--warning)'
                              : item.deriveADate < 0
                              ? 'var(--success)'
                              : 'var(--text-muted)'
                        }}
                      >
                        {item.deriveADate > 0 ? `+${item.deriveADate.toFixed(1)}j` : `${item.deriveADate.toFixed(1)}j`}
                      </span>
                    </td>

                    {/* Santé Badge */}
                    <td style={{ textAlign: 'center' }}>{renderSanteBadge(item.santeConsommation)}</td>

                    {/* Action Graphique Atterrissage */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto' }}
                        title="Voir la courbe d'atterrissage Burn-down / Burn-up"
                        onClick={() => setSelectedProjetChart(item)}
                      >
                        <LineChartIcon size={14} style={{ color: '#38bdf8' }} />
                        <span>Courbe</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal / Overlay Graphique d'Atterrissage Burn-down / Burn-up */}
      {selectedProjetChart && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedProjetChart(null)}
        >
          <div
            className="card"
            style={{
              width: '900px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '16px',
                marginBottom: '20px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TrendingUp size={22} style={{ color: '#38bdf8' }} />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>
                    Courbe d'Atterrissage & Burn-up — {selectedProjetChart.nom}
                  </h3>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {selectedProjetChart.codeProjet && <span>Code: {selectedProjetChart.codeProjet} • </span>}
                  <span>Budget Retenu ({selectedProjetChart.statutEstimation}) : <strong>{selectedProjetChart.estimationRetenue}j</strong></span>
                  <span> (Tolérance Max : {selectedProjetChart.chargeMaxToleree}j)</span>
                </div>
              </div>

              <button
                className="btn btn-secondary"
                style={{ padding: '6px' }}
                onClick={() => setSelectedProjetChart(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Badges de synthèse en modal */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Réel Consommé</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#60a5fa' }}>{selectedProjetChart.consommeTempo} j</div>
              </div>
              <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reste À Faire (RAF)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24' }}>{selectedProjetChart.resteAFaire} j</div>
              </div>
              <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Atterrissage Estimé</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: selectedProjetChart.atterrissagePrevu > selectedProjetChart.chargeMaxToleree ? '#f87171' : 'var(--success)' }}>
                  {selectedProjetChart.atterrissagePrevu} j
                </div>
              </div>
              <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Santé d'Exécution</div>
                <div style={{ marginTop: '4px' }}>{renderSanteBadge(selectedProjetChart.santeConsommation)}</div>
              </div>
            </div>

            {/* Recharts Chart Burn-up / Burn-down */}
            <div style={{ height: '320px', width: '100%', marginBottom: '24px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedProjetChart.moisDetails || []} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="nomMois" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} unit="j" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '0.82rem' }} />

                  {/* Ligne de budget retenu */}
                  {selectedProjetChart.estimationRetenue > 0 && (
                    <ReferenceLine
                      y={selectedProjetChart.estimationRetenue}
                      stroke="#c084fc"
                      strokeDasharray="4 4"
                      label={{
                        value: `Budget Retenu (${selectedProjetChart.estimationRetenue}j)`,
                        fill: '#c084fc',
                        fontSize: 11,
                        position: 'insideTopRight'
                      }}
                    />
                  )}

                  {/* Courbe Planifié Cumulé CartOMC */}
                  <Line
                    type="monotone"
                    dataKey="planifieCumule"
                    name="Planifié Cumulé (CartOMC)"
                    stroke="#60a5fa"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />

                  {/* Courbe Réel Consommé Tempo */}
                  <Line
                    type="monotone"
                    dataKey="consommeCumule"
                    name="Réel Consommé (Tempo)"
                    stroke="#34d399"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    connectNulls={false}
                  />

                  {/* Courbe Forecast Atterrissage */}
                  <Line
                    type="monotone"
                    dataKey="forecastCumule"
                    name="Projection Atterrissage"
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Matrice Mensuelle Comparatif Détail (12 Mois) */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Détail Mensuel : Planifié CartOMC vs Réel Tempo ({annee})
              </h4>

              <div className="table-sticky-wrapper">
                <table style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th className="sticky-col-left" style={{ minWidth: '130px' }}>Indicateur</th>
                      {(selectedProjetChart.moisDetails || []).map((m) => (
                        <th key={m.mois} style={{ textAlign: 'center', minWidth: '55px', backgroundColor: m.mois === currentMois ? 'rgba(59, 130, 246, 0.2)' : undefined }}>
                          {m.nomMois}
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.25)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Ligne 1 : Planifié CartOMC */}
                    <tr>
                      <td className="sticky-col-left" style={{ fontWeight: 600, color: '#60a5fa' }}>Planifié (CartOMC)</td>
                      {(selectedProjetChart.moisDetails || []).map((m) => (
                        <td key={m.mois} style={{ textAlign: 'center' }}>
                          {m.planifieMois > 0 ? `${m.planifieMois}j` : '-'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#60a5fa' }}>
                        {selectedProjetChart.totalPlanifie}j
                      </td>
                    </tr>

                    {/* Ligne 2 : Consommé Tempo */}
                    <tr>
                      <td className="sticky-col-left" style={{ fontWeight: 600, color: '#34d399' }}>Consommé (Tempo)</td>
                      {(selectedProjetChart.moisDetails || []).map((m) => (
                        <td key={m.mois} style={{ textAlign: 'center', fontWeight: m.consommeMois > 0 ? 600 : 'normal', color: m.mois <= currentMois ? '#34d399' : 'var(--text-dim)' }}>
                          {m.mois <= currentMois ? (m.consommeMois > 0 ? `${m.consommeMois}j` : '0j') : '-'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#34d399' }}>
                        {selectedProjetChart.consommeTempo}j
                      </td>
                    </tr>

                    {/* Ligne 3 : Écart Mensuel */}
                    <tr>
                      <td className="sticky-col-left" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Écart ($\Delta$)</td>
                      {(selectedProjetChart.moisDetails || []).map((m) => {
                        if (m.mois > currentMois) {
                          return <td key={m.mois} style={{ textAlign: 'center', color: 'var(--text-dim)' }}>-</td>;
                        }
                        const diff = Number((m.consommeMois - m.planifieMois).toFixed(1));
                        const isSurconsomme = diff > 0;
                        return (
                          <td key={m.mois} style={{ textAlign: 'center', fontWeight: 600, color: isSurconsomme ? '#f87171' : 'var(--success)' }}>
                            {diff > 0 ? `+${diff}j` : `${diff}j`}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: selectedProjetChart.deriveADate > 0 ? '#f87171' : 'var(--success)' }}>
                        {selectedProjetChart.deriveADate > 0 ? `+${selectedProjetChart.deriveADate}j` : `${selectedProjetChart.deriveADate}j`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
