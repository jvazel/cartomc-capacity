import React, { useState, useEffect } from 'react';
import { AlertTriangle, Users, Calendar, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface DateSimultaneeItem {
  dateStr: string;
  totalDeperdition: number;
  ressources: Array<{
    matricule: string;
    nom: string;
    type: string;
    role: string;
    valeur: number;
  }>;
}

interface PicsAbsencesWidgetProps {
  annee: number;
  mois?: number | '';
}

export const PicsAbsencesWidget: React.FC<PicsAbsencesWidgetProps> = ({ annee, mois }) => {
  const [seuilMin, setSeuilMin] = useState<number>(3);
  const [datesCritiques, setDatesCritiques] = useState<DateSimultaneeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const fetchPicsSimultanes = () => {
    setLoading(true);
    const mQuery = mois !== undefined && mois !== '' ? `&mois=${mois}` : '';
    fetch(`/api/absences/pics-simultanes?annee=${annee}${mQuery}&seuilMin=${seuilMin}`)
      .then((res) => res.json())
      .then((data) => {
        setDatesCritiques(data.datesSimultanees || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur pics simultanés:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPicsSimultanes();
  }, [annee, mois, seuilMin]);

  const formatDateFr = (dateStr: string) => {
    const parts = dateStr.split('-');
    const dateObj = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    return dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div
      className="card"
      style={{
        marginTop: '20px',
        marginBottom: '20px',
        borderLeft: datesCritiques.length > 0 ? '4px solid #fbbf24' : '4px solid var(--border-color)',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header Widget */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          flexWrap: 'wrap',
          gap: '12px'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {datesCritiques.length > 0 ? (
            <AlertTriangle size={20} style={{ color: '#fbbf24' }} />
          ) : (
            <Users size={20} style={{ color: 'var(--primary-light)' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              Détection des absences simultanées & pics d'absentéisme
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Identifie les jours où plusieurs ressources sont absentes en même temps.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
          {/* Sélecteur de seuil */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              Seuil d'alerte :
            </label>
            <select
              className="form-select"
              style={{ width: '110px', padding: '4px 8px', fontSize: '0.85rem' }}
              value={seuilMin}
              onChange={(e) => setSeuilMin(Number(e.target.value))}
            >
              <option value={2}>≥ 2 absents</option>
              <option value={3}>≥ 3 absents</option>
              <option value={4}>≥ 4 absents</option>
              <option value={5}>≥ 5 absents</option>
            </select>
          </div>

          <span
            className="badge"
            style={{
              backgroundColor: datesCritiques.length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.1)',
              color: datesCritiques.length > 0 ? '#fbbf24' : '#10b981',
              borderColor: datesCritiques.length > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.3)',
              fontWeight: 700,
              fontSize: '0.85rem',
              padding: '6px 12px'
            }}
          >
            {datesCritiques.length} date(s) critique(s)
          </span>

          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px' }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Contenu Dépliable */}
      {isExpanded && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          {loading ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Analyse des absences simultanées en cours...
            </div>
          ) : datesCritiques.length === 0 ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--success)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={18} /> Aucun pic d'absentéisme (≥ {seuilMin} personnes) détecté sur cette période.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date concernée</th>
                    <th>Nombre d'absents</th>
                    <th>Déperdition cumulée</th>
                    <th>Ressources absentes (Nom, Rôle & Type)</th>
                  </tr>
                </thead>
                <tbody>
                  {datesCritiques.map((item) => (
                    <tr key={item.dateStr}>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} style={{ color: '#fbbf24' }} />
                          {formatDateFr(item.dateStr)}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            borderColor: 'rgba(239, 68, 68, 0.4)',
                            fontWeight: 700
                          }}
                        >
                          ⚠️ {item.ressources.length} absents
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#fbbf24' }}>
                        {item.totalDeperdition} j
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {item.ressources.map((r, idx) => (
                            <span
                              key={idx}
                              className="badge badge-secondary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.8rem',
                                padding: '3px 8px',
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <strong>{r.nom}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>({r.role} - {r.type})</span>
                              <span
                                style={{
                                  color: r.valeur === 1 ? '#f87171' : '#fbbf24',
                                  fontWeight: 700,
                                  marginLeft: '4px'
                                }}
                              >
                                {r.valeur === 1 ? '1.0j' : '0.5j'}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
