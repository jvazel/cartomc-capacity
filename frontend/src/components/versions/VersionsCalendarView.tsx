import React, { useState } from 'react';
import { VersionItem } from './types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface VersionsCalendarViewProps {
  versions: VersionItem[];
  onConfigureMilestones: (version: VersionItem) => void;
  onViewTickets: (version: VersionItem) => void;
}

// Calcul du numéro de semaine selon la norme ISO-8601
function getISOWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export const VersionsCalendarView: React.FC<VersionsCalendarViewProps> = ({
  versions,
  onConfigureMilestones,
  onViewTickets
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Nombre de jours dans le mois
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Premier jour du mois (0 = Dimanche, 1 = Lundi, ...)
  let firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  // Adapter pour commencer le Lundi (Lundi = 0, ..., Dimanche = 6)
  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Rassembler tous les jalons qui tombent ce mois-ci
  const milestonesInMonth: Array<{
    dateStr: string;
    day: number;
    version: VersionItem;
    milestoneType: string;
    label: string;
    color: string;
  }> = [];

  const milestoneDefs = [
    { key: 'dateFinAFaire', label: 'Fin À faire', color: '#38bdf8' },
    { key: 'dateFinEnCours', label: 'Fin En cours', color: '#fbbf24' },
    { key: 'dateFinMR', label: 'Fin MR', color: '#c084fc' },
    { key: 'dateFinRecette', label: 'Fin Recette', color: '#fb923c' },
    { key: 'dateMEPP', label: 'MEPP', color: '#34d399' },
    { key: 'dateMEP', label: 'MEP', color: '#f472b6' }
  ];

  versions.forEach((v) => {
    milestoneDefs.forEach((mDef) => {
      const rawDate = (v as any)[mDef.key] || (mDef.key === 'dateMEP' ? v.jiraReleaseDate : null);
      if (rawDate) {
        const d = new Date(rawDate);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          milestonesInMonth.push({
            dateStr: d.toISOString().split('T')[0],
            day: d.getDate(),
            version: v,
            milestoneType: mDef.key,
            label: mDef.label,
            color: mDef.color
          });
        }
      }
    });
  });

  const today = new Date();
  const isCurrentMonthToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const todayDay = isCurrentMonthToday ? today.getDate() : -1;

  // Construction des semaines (lignes du calendrier)
  // Chaque cellule contient soit null (hors mois), soit le numéro du jour (1..daysInMonth)
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
          representativeDate = new Date(currentYear, currentMonth, day);
        }
      } else {
        rowDays.push(null);
      }
    }

    // Calcul du numéro de semaine pour cette ligne
    if (!representativeDate) {
      representativeDate = new Date(currentYear, currentMonth, 1);
    }
    const weekNumber = getISOWeekNumber(representativeDate);

    weeks.push({
      weekNumber,
      days: rowDays
    });
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Navigation calendrier */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CalendarIcon size={22} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {monthNames[currentMonth]} {currentYear}
          </h3>
          <span className="badge badge-secondary">
            {milestonesInMonth.length} jalon(s) ce mois-ci
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleToday}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            Aujourd'hui
          </button>
          <button
            onClick={handlePrevMonth}
            className="btn btn-secondary"
            style={{ padding: '6px 10px' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="btn btn-secondary"
            style={{ padding: '6px 10px' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Légende */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '20px',
          padding: '10px 14px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          fontSize: '0.78rem'
        }}
      >
        {milestoneDefs.map((m) => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: m.color,
                boxShadow: `0 0 6px ${m.color}`
              }}
            />
            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Grille du calendrier avec colonne des Semaines */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '56px repeat(7, 1fr)',
          gap: '8px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px'
        }}
      >
        {/* Noms des colonnes */}
        <div
          style={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: 'var(--primary)',
            paddingBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
          title="Numéro de la semaine (ISO-8601)"
        >
          Sem.
        </div>
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: 'var(--text-dim)',
              paddingBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {d}
          </div>
        ))}

        {/* Lignes de semaines */}
        {weeks.map((week) => (
          <React.Fragment key={`week-${week.weekNumber}`}>
            {/* Colonne Numéro de Semaine */}
            <div
              style={{
                minHeight: '90px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(6, 182, 212, 0.05)',
                border: '1px solid rgba(6, 182, 212, 0.15)',
                borderRadius: 'var(--radius)',
                padding: '4px'
              }}
              title={`Semaine ${week.weekNumber}`}
            >
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  letterSpacing: '0.03em'
                }}
              >
                S{week.weekNumber}
              </span>
            </div>

            {/* 7 Jours de la semaine */}
            {week.days.map((day, dayColIdx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${week.weekNumber}-${dayColIdx}`}
                    style={{
                      minHeight: '90px',
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(255, 255, 255, 0.02)',
                      opacity: 0.3
                    }}
                  />
                );
              }

              const isToday = day === todayDay;
              const dayMilestones = milestonesInMonth.filter((m) => m.day === day);

              return (
                <div
                  key={`day-${day}`}
                  style={{
                    minHeight: '90px',
                    padding: '8px',
                    borderRadius: 'var(--radius)',
                    border: isToday
                      ? '2px solid var(--primary)'
                      : '1px solid var(--border-color)',
                    backgroundColor: isToday
                      ? 'rgba(6, 182, 212, 0.08)'
                      : 'rgba(0, 0, 0, 0.25)',
                    boxShadow: isToday ? '0 0 15px rgba(6, 182, 212, 0.2)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div
                    style={{
                      fontWeight: isToday ? 800 : 600,
                      fontSize: '0.82rem',
                      color: isToday ? 'var(--primary)' : 'var(--text-main)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{day}</span>
                    {isToday && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          backgroundColor: 'rgba(6, 182, 212, 0.15)',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}
                      >
                        Aujourd'hui
                      </span>
                    )}
                  </div>

                  {/* Événements jalons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                    {dayMilestones.map((ms, idx) => (
                      <div
                        key={`${ms.version._id}-${ms.milestoneType}-${idx}`}
                        onClick={() => onConfigureMilestones(ms.version)}
                        title={`${ms.version.versionName} : ${ms.label}`}
                        style={{
                          padding: '3px 6px',
                          borderRadius: '4px',
                          backgroundColor: `${ms.color}22`,
                          border: `1px solid ${ms.color}66`,
                          color: ms.color,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {ms.version.versionName} • {ms.label}
                      </div>
                    ))}
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
