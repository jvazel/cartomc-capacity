import React, { useState } from 'react';
import { VersionItem } from './types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  Info,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface VersionMilestoneEvent {
  dateStr: string;
  day: number;
  month: number; // 0-11
  year: number;
  version: VersionItem;
  milestoneType: string;
  label: string;
  color: string;
}

interface DashboardVersionsCalendarProps {
  annee: number;
  mois?: number; // 1-12 or undefined (year view)
  onConfigureMilestones?: (version: VersionItem) => void;
  onViewTickets?: (version: VersionItem) => void;
  projectKey?: string;
  onSelectMois?: (mois: number | undefined) => void;
}

// Calcul du numéro de semaine ISO-8601
function getISOWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MILESTONE_DEFS = [
  { key: 'dateFinAFaire', label: 'Fin À faire', color: '#38bdf8' },
  { key: 'dateFinEnCours', label: 'Fin En cours', color: '#fbbf24' },
  { key: 'dateFinMR', label: 'Fin MR', color: '#c084fc' },
  { key: 'dateFinRecette', label: 'Fin Recette', color: '#fb923c' },
  { key: 'dateMEPP', label: 'MEPP', color: '#34d399' },
  { key: 'dateMEP', label: 'MEP', color: '#f472b6' }
];

export const DashboardVersionsCalendar: React.FC<DashboardVersionsCalendarProps> = ({
  annee,
  mois,
  onConfigureMilestones,
  onViewTickets,
  onSelectMois
}) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMilestoneType, setSelectedMilestoneType] = useState<string>('all');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('all');

  // Chargement des versions depuis l'API backend
  React.useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch('/api/versions?filter=all')
      .then((res) => {
        if (!res.ok) throw new Error('Erreur chargement versions');
        return res.json();
      })
      .then((data: VersionItem[]) => {
        if (isMounted) {
          setVersions(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erreur chargement versions dans DashboardVersionsCalendar:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [annee]);

  // Extraction de tous les jalons de toutes les versions
  const allEvents: VersionMilestoneEvent[] = [];
  versions.forEach((v) => {
    if (selectedVersionId !== 'all' && v._id !== selectedVersionId) return;

    MILESTONE_DEFS.forEach((mDef) => {
      if (selectedMilestoneType !== 'all' && mDef.key !== selectedMilestoneType) return;

      const rawDate = (v as any)[mDef.key] || (mDef.key === 'dateMEP' ? v.jiraReleaseDate : null);
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          allEvents.push({
            dateStr: d.toISOString().split('T')[0],
            day: d.getDate(),
            month: d.getMonth(), // 0..11
            year: d.getFullYear(),
            version: v,
            milestoneType: mDef.key,
            label: mDef.label,
            color: mDef.color
          });
        }
      }
    });
  });

  // Événements filtrés selon l'année et éventuellement le mois
  const currentPeriodEvents = allEvents.filter((ev) => {
    if (ev.year !== annee) return false;
    if (mois !== undefined && ev.month !== mois - 1) return false;
    return true;
  });

  const today = new Date();
  const isCurrentYear = today.getFullYear() === annee;
  const currentMonthIdx = today.getMonth();
  const currentDay = today.getDate();

  // Rendu de la grille pour un mois spécifique (0-indexed)
  const renderMonthGrid = (targetMonth: number, isCompact: boolean = false) => {
    const daysInMonth = new Date(annee, targetMonth + 1, 0).getDate();
    let firstDayIndex = new Date(annee, targetMonth, 1).getDay();
    // Lundi = 0 ... Dimanche = 6
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const totalCells = firstDayIndex + daysInMonth;
    const numRows = Math.ceil(totalCells / 7);

    const weeks: Array<{
      weekNumber: number;
      days: Array<number | null>;
    }> = [];

    for (let r = 0; r < numRows; r++) {
      const rowDays: Array<number | null> = [];
      let representativeDate: Date | null = null;

      for (let c = 0; c < 7; c++) {
        const cellIndex = r * 7 + c;
        const day = cellIndex - firstDayIndex + 1;
        if (day >= 1 && day <= daysInMonth) {
          rowDays.push(day);
          if (!representativeDate) {
            representativeDate = new Date(annee, targetMonth, day);
          }
        } else {
          rowDays.push(null);
        }
      }

      if (!representativeDate) {
        representativeDate = new Date(annee, targetMonth, 1);
      }
      const weekNumber = getISOWeekNumber(representativeDate);
      weeks.push({ weekNumber, days: rowDays });
    }

    const monthEvents = allEvents.filter((ev) => ev.year === annee && ev.month === targetMonth);

    return (
      <div
        key={`month-block-${targetMonth}`}
        style={{
          background: isCompact ? 'rgba(15, 23, 42, 0.65)' : 'rgba(15, 23, 42, 0.85)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: isCompact ? '12px' : '18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.2s ease'
        }}
      >
        {/* Titre du mois */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isCompact ? '10px' : '14px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: isCompact ? '0.92rem' : '1.15rem',
                color: isCurrentYear && currentMonthIdx === targetMonth ? '#38bdf8' : 'var(--text-main)'
              }}
            >
              {MONTH_NAMES[targetMonth]}
            </span>
            {isCurrentYear && currentMonthIdx === targetMonth && (
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}
              >
                En cours
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                color: monthEvents.length > 0 ? '#38bdf8' : 'var(--text-muted)',
                fontWeight: monthEvents.length > 0 ? 600 : 400,
                background: monthEvents.length > 0 ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                padding: '2px 6px',
                borderRadius: '6px'
              }}
            >
              {monthEvents.length} jalon{monthEvents.length > 1 ? 's' : ''}
            </span>
            {isCompact && onSelectMois && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 7px',
                  fontSize: '0.68rem',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.04)'
                }}
                onClick={() => onSelectMois(targetMonth + 1)}
                title="Agrandir et afficher uniquement ce mois"
              >
                Zoomer
              </button>
            )}
          </div>
        </div>

        {/* Grille du calendrier avec colonne des Semaines */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isCompact ? '32px repeat(7, 1fr)' : '48px repeat(7, 1fr)',
            gap: isCompact ? '4px' : '6px'
          }}
        >
          {/* Header Sem. */}
          <div
            style={{
              textAlign: 'center',
              fontWeight: 700,
              fontSize: isCompact ? '0.65rem' : '0.74rem',
              color: '#38bdf8',
              paddingBottom: '4px',
              textTransform: 'uppercase'
            }}
            title="Numéro de semaine ISO-8601"
          >
            Sem.
          </div>

          {/* Jours de la semaine LUN..DIM */}
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, dIdx) => (
            <div
              key={`hdr-${targetMonth}-${dIdx}`}
              style={{
                textAlign: 'center',
                fontWeight: 600,
                fontSize: isCompact ? '0.68rem' : '0.76rem',
                color: 'var(--text-muted)',
                paddingBottom: '4px'
              }}
            >
              {isCompact ? d : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][dIdx]}
            </div>
          ))}

          {/* Lignes de semaines */}
          {weeks.map((week) => (
            <React.Fragment key={`week-row-${targetMonth}-${week.weekNumber}`}>
              {/* Colonne Numéro de Semaine */}
              <div
                style={{
                  minHeight: isCompact ? '44px' : '82px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(6, 182, 212, 0.06)',
                  border: '1px solid rgba(6, 182, 212, 0.18)',
                  borderRadius: '4px',
                  padding: '2px'
                }}
                title={`Semaine ${week.weekNumber}`}
              >
                <span
                  style={{
                    fontSize: isCompact ? '0.65rem' : '0.74rem',
                    fontWeight: 700,
                    color: '#38bdf8'
                  }}
                >
                  S{week.weekNumber}
                </span>
              </div>

              {/* 7 Jours de la semaine */}
              {week.days.map((day, dIdx) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${targetMonth}-${week.weekNumber}-${dIdx}`}
                      style={{
                        minHeight: isCompact ? '44px' : '82px',
                        backgroundColor: 'rgba(0, 0, 0, 0.12)',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.02)',
                        opacity: 0.25
                      }}
                    />
                  );
                }

                const isToday = isCurrentYear && currentMonthIdx === targetMonth && day === currentDay;
                const dayMilestones = monthEvents.filter((ev) => ev.day === day);

                return (
                  <div
                    key={`day-${targetMonth}-${day}`}
                    style={{
                      minHeight: isCompact ? '44px' : '82px',
                      padding: isCompact ? '3px 2px' : '6px',
                      borderRadius: '5px',
                      border: isToday
                        ? '1.5px solid #06b6d4'
                        : dayMilestones.length > 0
                        ? '1px solid rgba(56, 189, 248, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isToday
                        ? 'rgba(6, 182, 212, 0.12)'
                        : dayMilestones.length > 0
                        ? 'rgba(15, 23, 42, 0.9)'
                        : 'rgba(0, 0, 0, 0.22)',
                      boxShadow: isToday ? '0 0 10px rgba(6, 182, 212, 0.25)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: isToday ? 800 : 600,
                        fontSize: isCompact ? '0.68rem' : '0.78rem',
                        color: isToday ? '#38bdf8' : 'var(--text-main)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        lineHeight: 1
                      }}
                    >
                      <span>{day}</span>
                      {isToday && !isCompact && (
                        <span
                          style={{
                            fontSize: '0.55rem',
                            color: '#38bdf8',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'rgba(6, 182, 212, 0.2)',
                            padding: '1px 3px',
                            borderRadius: '3px'
                          }}
                        >
                          Auj.
                        </span>
                      )}
                    </div>

                    {/* Événements jalons */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isCompact ? '2px' : '3px',
                        marginTop: '2px',
                        overflowY: isCompact ? 'hidden' : 'auto',
                        maxHeight: isCompact ? '32px' : '62px'
                      }}
                    >
                      {dayMilestones.map((ms, idx) => {
                        const eventTitle = `${ms.version.versionName} • ${ms.label} (${ms.dateStr})`;
                        return (
                          <div
                            key={`ev-${ms.version._id}-${ms.milestoneType}-${idx}`}
                            onClick={() => {
                              if (onConfigureMilestones) {
                                onConfigureMilestones(ms.version);
                              } else if (onViewTickets) {
                                onViewTickets(ms.version);
                              }
                            }}
                            title={eventTitle}
                            style={{
                              padding: isCompact ? '1px 3px' : '2px 5px',
                              borderRadius: '3px',
                              backgroundColor: `${ms.color}25`,
                              border: `1px solid ${ms.color}77`,
                              color: ms.color,
                              fontSize: isCompact ? '0.6rem' : '0.68rem',
                              fontWeight: 600,
                              cursor: onConfigureMilestones || onViewTickets ? 'pointer' : 'default',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <span
                              style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                backgroundColor: ms.color,
                                flexShrink: 0
                              }}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isCompact ? ms.label.replace('Fin ', '') : `${ms.version.versionName} : ${ms.label}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ margin: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barre de Titre et Contrôles du Calendrier */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)'
            }}
          >
            <CalendarIcon size={20} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                Calendrier des Jalons Opérationnels des Versions
              </h3>
              <span className="badge badge-primary" style={{ fontSize: '0.74rem' }}>
                {mois !== undefined ? `${MONTH_NAMES[mois - 1]} ${annee}` : `Année ${annee} (12 Mois)`}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Suivi synchronisé des 6 jalons clés (Fin À faire, Fin En cours, Fin MR, Fin Recette, MEPP, MEP) avec numéros de semaine ISO.
            </p>
          </div>
        </div>

        {/* Filtres contextuels : Type de jalon & Version */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Compteur jalons trouvés */}
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              color: '#38bdf8'
            }}
          >
            {currentPeriodEvents.length} jalon{currentPeriodEvents.length > 1 ? 's' : ''} affiché{currentPeriodEvents.length > 1 ? 's' : ''}
          </span>

          {/* Filtrer par Version */}
          <select
            className="form-select"
            style={{ width: '150px', padding: '5px 10px', fontSize: '0.82rem' }}
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
          >
            <option value="all">Toutes versions</option>
            {versions.map((v) => (
              <option key={v._id} value={v._id}>
                {v.versionName}
              </option>
            ))}
          </select>

          {/* Filtrer par Type de Jalon */}
          <select
            className="form-select"
            style={{ width: '145px', padding: '5px 10px', fontSize: '0.82rem' }}
            value={selectedMilestoneType}
            onChange={(e) => setSelectedMilestoneType(e.target.value)}
          >
            <option value="all">Tous jalons</option>
            {MILESTONE_DEFS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Légende interactive des 6 jalons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '8px 14px',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '0.76rem'
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Légende :
        </span>
        {MILESTONE_DEFS.map((m) => {
          const isSelected = selectedMilestoneType === 'all' || selectedMilestoneType === m.key;
          return (
            <div
              key={m.key}
              onClick={() => setSelectedMilestoneType(selectedMilestoneType === m.key ? 'all' : m.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                opacity: isSelected ? 1 : 0.4,
                padding: '2px 6px',
                borderRadius: '4px',
                background: selectedMilestoneType === m.key ? `${m.color}22` : 'transparent',
                border: selectedMilestoneType === m.key ? `1px solid ${m.color}55` : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
              title={`Cliquer pour filtrer uniquement sur : ${m.label}`}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: m.color,
                  boxShadow: `0 0 6px ${m.color}`
                }}
              />
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{m.label}</span>
            </div>
          );
        })}
      </div>

      {/* Contenu Calendrier selon la sélection utilisateur (Mois unique vs Année entière) */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Chargement des jalons de versions...
        </div>
      ) : mois !== undefined ? (
        // VUE MOIS SÉLECTIONNÉ
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {renderMonthGrid(mois - 1, false)}
        </div>
      ) : (
        // VUE ANNÉE ENTIÈRE : Grille responsive 12 mois
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}
        >
          {Array.from({ length: 12 }, (_, idx) => renderMonthGrid(idx, true))}
        </div>
      )}
    </div>
  );
};
