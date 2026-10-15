import React, { useState, useEffect } from 'react';
import { IRessource } from '../types';
import { ChevronLeft, ChevronRight, X, User, Briefcase, Award, AlertCircle } from 'lucide-react';
import { getAbsenceHeatmapStyle } from '../utils/heatmap';

interface RessourceCalendarModalProps {
  ressource: IRessource;
  anneeInitiale?: number;
  moisInitial?: number;
  onClose: () => void;
}

const NOMS_MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

function formatDateUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const RessourceCalendarModal: React.FC<RessourceCalendarModalProps> = ({
  ressource,
  anneeInitiale = new Date().getFullYear(),
  moisInitial = new Date().getMonth() + 1,
  onClose
}) => {
  const [annee, setAnnee] = useState<number>(anneeInitiale);
  const [mois, setMois] = useState<number>(moisInitial); // 1 à 12
  const [absencesMap, setAbsencesMap] = useState<{ [dateStr: string]: number }>({});
  const [picsMap, setPicsMap] = useState<{ [dateStr: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [joursOuvres, setJoursOuvres] = useState<number>(22);

  // Charger les absences et pics d'absences de la ressource pour le mois et l'année
  const fetchCalendarData = async (a: number, m: number) => {
    setLoading(true);
    try {
      const [resAbs, resCap, resPics] = await Promise.all([
        fetch(`/api/absences/calendrier-ressource?matricule=${encodeURIComponent(ressource.matricule)}&annee=${a}&mois=${m}`).then((r) => r.json()),
        fetch(`/api/capacite?annee=${a}&moisDebut=${m}&moisFin=${m}`).then((r) => r.json()),
        fetch(`/api/absences/pics-simultanes?annee=${a}&mois=${m}&seuilMin=3`).then((r) => r.json())
      ]);

      setAbsencesMap(resAbs.absencesMap || {});
      if (resCap && resCap.length > 0) {
        setJoursOuvres(resCap[0].joursOuvres || 22);
      }

      const pMap: { [dateStr: string]: number } = {};
      if (resPics && resPics.datesSimultanees) {
        resPics.datesSimultanees.forEach((dItem: any) => {
          pMap[dItem.dateStr] = dItem.ressources.length;
        });
      }
      setPicsMap(pMap);

      setLoading(false);
    } catch (err) {
      console.error('Erreur chargement calendrier ressource:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData(annee, mois);
  }, [annee, mois, ressource.matricule]);

  const handlePrevMonth = () => {
    if (mois === 1) {
      setMois(12);
      setAnnee(annee - 1);
    } else {
      setMois(mois - 1);
    }
  };

  const handleNextMonth = () => {
    if (mois === 12) {
      setMois(1);
      setAnnee(annee + 1);
    } else {
      setMois(mois + 1);
    }
  };

  // Calculs capacitifs pour la ressource sur ce mois
  const totalDeperdition = Number(Object.values(absencesMap).reduce((sum, v) => sum + (v || 0), 0).toFixed(1));
  const etp = ressource.tauxActivite || 1;
  const capaciteTheorique = Number((etp * joursOuvres).toFixed(1));
  const capaciteNette = Number((capaciteTheorique - totalDeperdition).toFixed(1));

  // Helper calcul Pâques et jours fériés légaux français (Zone B)
  const getJoursFeriesSet = (a: number): Set<string> => {
    const setFeries = new Set<string>();
    const addDate = (m: number, d: number) => {
      const monthStr = String(m).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      setFeries.add(`${a}-${monthStr}-${dayStr}`);
    };

    // Fixes
    addDate(1, 1);   // Jour de l'an
    addDate(5, 1);   // Fête du travail
    addDate(5, 8);   // Victoire 1945
    addDate(7, 14);  // Fête nationale
    addDate(8, 15);  // Assomption
    addDate(11, 1);  // Toussaint
    addDate(11, 11); // Armistice 1918
    addDate(12, 25); // Noël

    // Mobiles (Pâques)
    const ma = a % 19;
    const mb = Math.floor(a / 100);
    const mc = a % 100;
    const md = Math.floor(mb / 4);
    const me = mb % 4;
    const mf = Math.floor((mb + 8) / 25);
    const mg = Math.floor((mb - mf + 1) / 3);
    const mh = (19 * ma + mb - md - mg + 15) % 30;
    const mi = Math.floor(mc / 4);
    const mk = mc % 4;
    const ml = (32 + 2 * me + 2 * mi - mh - mk) % 7;
    const mm = Math.floor((ma + 11 * mh + 22 * ml) / 451);
    const moisP = Math.floor((mh + ml - 7 * mm + 114) / 31);
    const jourP = ((mh + ml - 7 * mm + 114) % 31) + 1;
    const paques = new Date(Date.UTC(a, moisP - 1, jourP));

    const lundiP = new Date(paques);
    lundiP.setUTCDate(paques.getUTCDate() + 1);
    addDate(lundiP.getUTCMonth() + 1, lundiP.getUTCDate());

    const asc = new Date(paques);
    asc.setUTCDate(paques.getUTCDate() + 39);
    addDate(asc.getUTCMonth() + 1, asc.getUTCDate());

    const pent = new Date(paques);
    pent.setUTCDate(paques.getUTCDate() + 50);
    addDate(pent.getUTCMonth() + 1, pent.getUTCDate());

    return setFeries;
  };

  // Génération des jours de la grille calendaire (du Lundi au Dimanche)
  const getDaysGrid = () => {
    const days: Array<{
      date: Date;
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isPublicHoliday: boolean;
      valeurAbsence: number;
    }> = [];

    const feriesSet = getJoursFeriesSet(annee);

    const firstDayOfMonth = new Date(Date.UTC(annee, mois - 1, 1));
    const lastDayOfMonth = new Date(Date.UTC(annee, mois, 0));
    const daysInMonth = lastDayOfMonth.getDate();

    // Jour de la semaine du 1er du mois (0 = Dim, 1 = Lun ... 6 = Sam)
    let startDayOfWeek = firstDayOfMonth.getUTCDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Convertir Dimanche à 7

    // Jours du mois précédent pour compléter la 1ère semaine
    const prevMonthLastDay = new Date(Date.UTC(annee, mois - 1, 0)).getDate();
    for (let i = startDayOfWeek - 1; i > 0; i--) {
      const pDay = prevMonthLastDay - i + 1;
      const d = new Date(Date.UTC(annee, mois - 2, pDay));
      const dateStr = formatDateUTC(d);
      days.push({
        date: d,
        dateStr,
        dayNum: pDay,
        isCurrentMonth: false,
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        isPublicHoliday: feriesSet.has(dateStr),
        valeurAbsence: 0
      });
    }

    // Jours du mois courant
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(annee, mois - 1, day));
      const dateStr = formatDateUTC(d);
      const valeurAbsence = absencesMap[dateStr] || 0;

      days.push({
        date: d,
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        isPublicHoliday: feriesSet.has(dateStr),
        valeurAbsence
      });
    }

    // Completer les jours du mois suivant pour boucler la dernière semaine (42 cases = 6 semaines)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const d = new Date(Date.UTC(annee, mois, day));
      const dateStr = formatDateUTC(d);
      days.push({
        date: d,
        dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
        isPublicHoliday: feriesSet.has(dateStr),
        valeurAbsence: 0
      });
    }

    return days;
  };

  const gridDays = getDaysGrid();

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-card" style={{ maxWidth: '840px', width: '95%' }}>
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                Planning & Absences — {ressource.nom}
              </h2>
              <span className={`badge ${ressource.type === 'Interne' ? 'badge-primary' : 'badge-purple'}`}>
                {ressource.type}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span><User size={13} style={{ display: 'inline', marginRight: '4px' }} />Matricule : <strong>{ressource.matricule}</strong></span>
              <span><Briefcase size={13} style={{ display: 'inline', marginRight: '4px' }} />Rôle : <strong>{ressource.role}</strong></span>
              <span><Award size={13} style={{ display: 'inline', marginRight: '4px' }} />Taux : <strong>{etp} ETP</strong></span>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Barre de navigation temporelle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={handlePrevMonth}>
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontWeight: 700, fontSize: '1.05rem', minWidth: '150px', textAlign: 'center' }}>
              {NOMS_MOIS[mois - 1]} {annee}
            </span>

            <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={handleNextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Mois :</label>
              <select
                className="form-select"
                style={{ width: '130px', padding: '4px 8px' }}
                value={mois}
                onChange={(e) => setMois(Number(e.target.value))}
              >
                {NOMS_MOIS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>Année :</label>
              <select
                className="form-select"
                style={{ width: '90px', padding: '4px 8px' }}
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
          </div>
        </div>

        {/* Cards de synthèse capacitive du mois */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}
        >
          <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jours ouvrés</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{joursOuvres} j</div>
          </div>

          <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cap. Théorique</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{capaciteTheorique} j</div>
          </div>

          {(() => {
            const heatStyle = getAbsenceHeatmapStyle(totalDeperdition, capaciteTheorique);
            return (
              <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', borderLeft: `3px solid ${heatStyle.color}` }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Absences & Déperdition</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: heatStyle.color, marginTop: '2px' }}>
                  {totalDeperdition} j ({heatStyle.label})
                </div>
              </div>
            );
          })()}

          <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Capacité Nette</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
              {capaciteNette} j
            </div>
          </div>
        </div>

        {/* Notice si 0 jour d'absence sur ce mois */}
        {totalDeperdition === 0 && !loading && (
          <div
            style={{
              padding: '8px 14px',
              fontSize: '0.8rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '6px',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            <AlertCircle size={15} />
            <span>
              Aucune absence déclarée pour <strong>{ressource.nom}</strong> en <strong>{NOMS_MOIS[mois - 1]} {annee}</strong>. Si vous venez d'importer un fichier CSV, réimportez-le avec la convention <em>0 = Absent (Vacances)</em> pour synchroniser les données.
            </span>
          </div>
        )}

        {/* Grille Calendrier 7x6 */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chargement du calendrier en cours...
          </div>
        ) : (
          <div>
            {/* Headers Jours de la semaine */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                marginBottom: '8px'
              }}
            >
              <div>Lundi</div>
              <div>Mardi</div>
              <div>Mercredi</div>
              <div>Jeudi</div>
              <div>Vendredi</div>
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>Samedi</div>
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>Dimanche</div>
            </div>

            {/* Cases de jours */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px'
              }}
            >
              {gridDays.map((dayObj, index) => {
                const { dayNum, isCurrentMonth, isWeekend, isPublicHoliday, valeurAbsence, dateStr } = dayObj;

                let bg = 'rgba(30, 41, 59, 0.6)';
                let border = '1px solid var(--border-color)';
                let textColor = 'var(--text-main)';
                let statusBadge = null;

                if (!isCurrentMonth) {
                  bg = 'rgba(15, 23, 42, 0.2)';
                  textColor = 'rgba(255, 255, 255, 0.2)';
                  border = '1px solid rgba(255, 255, 255, 0.05)';
                } else if (isWeekend) {
                  bg = 'rgba(15, 23, 42, 0.5)';
                  textColor = 'rgba(255, 255, 255, 0.35)';
                  border = '1px solid rgba(255, 255, 255, 0.08)';
                } else if (isPublicHoliday) {
                  // Jour Férié Légal France (Zone B)
                  bg = 'rgba(147, 51, 234, 0.2)';
                  border = '1px solid rgba(147, 51, 234, 0.5)';
                  textColor = '#c084fc';
                  statusBadge = (
                    <span
                      style={{
                        background: 'rgba(147, 51, 234, 0.35)',
                        color: '#e9d5ff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px'
                      }}
                    >
                      🎉 Férié
                    </span>
                  );
                } else if (valeurAbsence === 1) {
                  // Absence complète (Rouge/Corail)
                  bg = 'rgba(239, 68, 68, 0.25)';
                  border = '1px solid rgba(239, 68, 68, 0.6)';
                  textColor = '#f87171';
                  statusBadge = (
                    <span
                      style={{
                        background: 'rgba(239, 68, 68, 0.35)',
                        color: '#f87171',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px'
                      }}
                    >
                      1.0j Absent
                    </span>
                  );
                } else if (valeurAbsence === 0.5) {
                  // Demi-journée d'absence (Orange/Ambre)
                  bg = 'rgba(245, 158, 11, 0.25)';
                  border = '1px solid rgba(245, 158, 11, 0.6)';
                  textColor = '#fbbf24';
                  statusBadge = (
                    <span
                      style={{
                        background: 'rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px'
                      }}
                    >
                      0.5j Congé
                    </span>
                  );
                } else {
                  // Présent (Vert discret / Slate)
                  bg = 'rgba(16, 185, 129, 0.08)';
                  border = '1px solid rgba(16, 185, 129, 0.2)';
                }

                return (
                  <div
                    key={index}
                    title={`${dateStr} : ${isPublicHoliday ? "Jour Férié Légal (France)" : valeurAbsence > 0 ? `${valeurAbsence} jour(s) d'absence` : 'Présent'}`}
                    style={{
                      background: bg,
                      border,
                      borderRadius: '6px',
                      padding: '6px 8px',
                      minHeight: '58px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: isCurrentMonth ? 1 : 0.35
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: textColor }}>
                        {dayNum}
                      </span>
                      {picsMap[dateStr] && isCurrentMonth && !isWeekend && !isPublicHoliday && (
                        <span
                          title={`Alerte : ${picsMap[dateStr]} ressources absentes ce jour-là`}
                          style={{
                            fontSize: '0.62rem',
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.25)',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontWeight: 700
                          }}
                        >
                          ⚠️ {picsMap[dateStr]} abs.
                        </span>
                      )}
                      {isWeekend && isCurrentMonth && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>W.E</span>
                      )}
                    </div>

                    {statusBadge ? (
                      <div style={{ marginTop: '2px' }}>{statusBadge}</div>
                    ) : isCurrentMonth && !isWeekend && !isPublicHoliday ? (
                      <div style={{ fontSize: '0.65rem', color: 'rgba(16, 185, 129, 0.7)', fontWeight: 500 }}>
                        Présent
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Légende en bas de modal */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '16px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.4)', border: '1px solid #10b981' }}></span>
            <span>Présent (0j déperdition)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.4)', border: '1px solid #fbbf24' }}></span>
            <span>Demi-journée (0.5j congé)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.4)', border: '1px solid #f87171' }}></span>
            <span>Absence complète (1.0j congé)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)' }}></span>
            <span>Week-end / Non-ouvré</span>
          </div>
        </div>
      </div>
    </div>
  );
};
