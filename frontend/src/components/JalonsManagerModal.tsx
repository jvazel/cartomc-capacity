import React, { useState } from 'react';
import { IJalon } from '../types';
import {
  Flag,
  Plus,
  Trash2,
  X,
  Check,
  Calendar,
  Sparkles,
  Rocket,
  TestTube2,
  Compass,
  Scale,
  Bookmark
} from 'lucide-react';

interface JalonsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projet: {
    _id: string;
    nom: string;
    codeProjet?: string;
    jalons?: IJalon[];
  };
  annee: number;
  onSaveJalons: (jalons: IJalon[]) => Promise<void>;
}

const NOMS_MOIS_COURTS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

const NOMS_MOIS_LONGS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

interface TypeJalonConfig {
  type: 'MEP' | 'UAT' | 'CADRAGE' | 'GONO' | 'AUTRE';
  label: string;
  tag: string;
  couleur: string;
  glow: string;
  icon: React.ReactNode;
  placeholder: string;
}

const TYPES_JALONS: TypeJalonConfig[] = [
  {
    type: 'MEP',
    label: 'Mise en Production',
    tag: 'MEP',
    couleur: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    icon: <Rocket size={15} />,
    placeholder: 'ex: MEP V1.0, Bascule Prod...'
  },
  {
    type: 'UAT',
    label: 'Recette & Validation',
    tag: 'UAT',
    couleur: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
    icon: <TestTube2 size={15} />,
    placeholder: 'ex: Fin Recette Métier, UAT Client...'
  },
  {
    type: 'CADRAGE',
    label: 'Cadrage & Spécifications',
    tag: 'Cadrage',
    couleur: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.4)',
    icon: <Compass size={15} />,
    placeholder: 'ex: Cadrage validé, Architecture figée...'
  },
  {
    type: 'GONO',
    label: 'Go / No-Go',
    tag: 'Go/No-Go',
    couleur: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.4)',
    icon: <Scale size={15} />,
    placeholder: 'ex: Comité Go / No-Go CODIR...'
  },
  {
    type: 'AUTRE',
    label: 'Autre Jalon Clé',
    tag: 'Jalon',
    couleur: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
    icon: <Bookmark size={15} />,
    placeholder: 'ex: Fin dev sprint 4, Formation users...'
  }
];

// Helper standard ISO 8601 pour calculer le numéro de semaine annuel
const getISOWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Lundi = 0, Dimanche = 6
  target.setDate(target.getDate() - dayNr + 3); // Jeudi de la semaine
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
};

// Helper pour lister les semaines ISO appartenant à un mois donné
export interface IWeekOption {
  semaine: number;
  label: string;
  startDay: number;
  endDay: number;
}

export const getWeeksForMonth = (annee: number, mois: number): IWeekOption[] => {
  const daysInMonth = new Date(annee, mois, 0).getDate();
  const nomMoisCourt = NOMS_MOIS_COURTS[mois - 1];

  const weekGroups: { [weekNum: number]: { weekNum: number; days: number[] } } = {};
  const orderedWeekNums: number[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = new Date(annee, mois - 1, day);
    const wNum = getISOWeekNumber(curDate);
    if (!weekGroups[wNum]) {
      weekGroups[wNum] = { weekNum: wNum, days: [] };
      orderedWeekNums.push(wNum);
    }
    weekGroups[wNum].days.push(day);
  }

  return orderedWeekNums.map((wNum) => {
    const group = weekGroups[wNum];
    const startDay = group.days[0];
    const endDay = group.days[group.days.length - 1];
    return {
      semaine: wNum,
      label: `S${wNum} (${startDay}-${endDay} ${nomMoisCourt})`,
      startDay,
      endDay
    };
  });
};

export const JalonsManagerModal: React.FC<JalonsManagerModalProps> = ({
  isOpen,
  onClose,
  projet,
  annee,
  onSaveJalons
}) => {
  const [jalons, setJalons] = useState<IJalon[]>(projet.jalons || []);
  const [saving, setSaving] = useState<boolean>(false);

  // Formulaire d'ajout
  const [nouveauNom, setNouveauNom] = useState<string>('');
  const [nouveauMois, setNouveauMois] = useState<number>(new Date().getMonth() + 1);
  const [nouvelleSemaine, setNouvelleSemaine] = useState<number | undefined>(undefined);
  const [modePrecision, setModePrecision] = useState<'mois' | 'semaine'>('semaine');
  const [nouveauType, setNouveauType] = useState<'MEP' | 'UAT' | 'CADRAGE' | 'GONO' | 'AUTRE'>('MEP');

  if (!isOpen) return null;

  const currentTypeConfig = TYPES_JALONS.find((t) => t.type === nouveauType) || TYPES_JALONS[0];
  const weeksAvailable = getWeeksForMonth(annee, nouveauMois);

  const handleAjouterJalon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauNom.trim()) return;

    const nouveauJalon: IJalon = {
      nom: nouveauNom.trim(),
      mois: nouveauMois,
      semaine: modePrecision === 'semaine' ? (nouvelleSemaine || weeksAvailable[0]?.semaine) : undefined,
      annee,
      type: nouveauType,
      couleur: currentTypeConfig.couleur
    };

    setJalons([...jalons, nouveauJalon]);
    setNouveauNom('');
  };

  const handleSupprimerJalon = (index: number) => {
    setJalons(jalons.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveJalons(jalons);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Regroupement chronologique des jalons
  const jalonsTries = [...jalons].sort((a, b) => (a.mois || 0) - (b.mois || 0));

  return (
    <div className="modal-overlay" style={{ zIndex: 1200, backdropFilter: 'blur(10px)' }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '720px',
          width: '95%',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(239, 68, 68, 0.15)',
          borderRadius: '16px',
          padding: '24px'
        }}
      >
        {/* HEADER MODERNE */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <Flag size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  Jalons & Milestones
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  {annee}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Projet cible :</span>
                {projet.codeProjet && (
                  <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                    {projet.codeProjet}
                  </span>
                )}
                <strong style={{ color: 'var(--text-main)' }}>{projet.nom}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="toast-close-btn"
            style={{
              padding: '6px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* SECTION 1 : MINI TIMELINE CHRONOLOGIQUE VISUELLE */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> Trajectoire des jalons sur l'année ({jalons.length})
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Repères positionnés sur le Gantt
            </span>
          </div>

          {/* Grille des 12 mois avec positionnement des jalons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            {Array.from({ length: 12 }, (_, i) => {
              const mNum = i + 1;
              const jalonsDuMois = jalons.filter((j) => j.mois === mNum);
              const isSelected = nouveauMois === mNum;

              return (
                <div
                  key={mNum}
                  onClick={() => setNouveauMois(mNum)}
                  style={{
                    textAlign: 'center',
                    padding: '8px 2px',
                    borderRadius: '6px',
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.18)'
                      : jalonsDuMois.length > 0
                      ? 'rgba(30, 41, 59, 0.8)'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid #06b6d4'
                      : jalonsDuMois.length > 0
                      ? '1px solid rgba(255, 255, 255, 0.12)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  title={`Mois de ${NOMS_MOIS_LONGS[i]} : ${jalonsDuMois.length} jalon(s)`}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isSelected ? '#38bdf8' : 'var(--text-muted)' }}>
                    {NOMS_MOIS_COURTS[i]}
                  </div>

                  {/* Indicateurs losanges */}
                  <div style={{ minHeight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '4px' }}>
                    {jalonsDuMois.length === 0 ? (
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    ) : (
                      jalonsDuMois.slice(0, 2).map((j, jIdx) => (
                        <span
                          key={jIdx}
                          style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: j.couleur || '#ef4444',
                            transform: 'rotate(45deg)',
                            display: 'inline-block',
                            boxShadow: `0 0 6px ${j.couleur || '#ef4444'}`,
                            border: '1px solid #ffffff'
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2 : FORMULAIRE D'AJOUT RAPIDE AVEC SÉLECTEUR DE TYPE EN CARTOUCHES */}
        <form
          onSubmit={handleAjouterJalon}
          style={{
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
            <span>Nouveau Jalon Clé</span>
          </div>

          {/* Cartouches de choix de typologie */}
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              1. Sélectionnez la typologie du jalon :
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
              {TYPES_JALONS.map((t) => {
                const isSelected = nouveauType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setNouveauType(t.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? `1.5px solid ${t.couleur}` : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected ? `rgba(${t.couleur === '#ef4444' ? '239, 68, 68' : t.couleur === '#f59e0b' ? '245, 158, 11' : t.couleur === '#06b6d4' ? '6, 182, 212' : t.couleur === '#a855f7' ? '168, 85, 247' : '16, 185, 129'}, 0.15)` : 'rgba(30, 41, 59, 0.4)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      boxShadow: isSelected ? `0 0 12px ${t.glow}` : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ color: t.couleur }}>{t.icon}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500, whiteSpace: 'nowrap' }}>
                      {t.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saisie du nom, mois cible et granularité semaine */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 170px auto', gap: '10px', alignItems: 'flex-end' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                2. Intitulé du jalon *
              </label>
              <input
                type="text"
                required
                placeholder={currentTypeConfig.placeholder}
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                className="form-input"
                style={{
                  height: '38px',
                  fontSize: '0.88rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderColor: 'rgba(255, 255, 255, 0.12)'
                }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                3. Mois cible ({annee})
              </label>
              <select
                value={nouveauMois}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setNouveauMois(m);
                  const w = getWeeksForMonth(annee, m);
                  setNouvelleSemaine(w[0]?.semaine);
                }}
                className="form-select"
                style={{
                  height: '38px',
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)'
                }}
              >
                {NOMS_MOIS_LONGS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {idx + 1}. {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-muted)' }}>
                  4. Granularité
                </label>
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '1px', borderRadius: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setModePrecision('mois')}
                    style={{
                      padding: '1px 5px',
                      fontSize: '0.68rem',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      background: modePrecision === 'mois' ? 'var(--primary)' : 'transparent',
                      color: modePrecision === 'mois' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    Mois
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModePrecision('semaine');
                      if (!nouvelleSemaine) setNouvelleSemaine(weeksAvailable[0]?.semaine);
                    }}
                    style={{
                      padding: '1px 5px',
                      fontSize: '0.68rem',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      background: modePrecision === 'semaine' ? 'var(--primary)' : 'transparent',
                      color: modePrecision === 'semaine' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    Semaine
                  </button>
                </div>
              </div>

              {modePrecision === 'semaine' ? (
                <select
                  value={nouvelleSemaine || weeksAvailable[0]?.semaine}
                  onChange={(e) => setNouvelleSemaine(Number(e.target.value))}
                  className="form-select"
                  style={{
                    height: '38px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    borderColor: 'rgba(6, 182, 212, 0.4)',
                    color: '#38bdf8',
                    fontWeight: 600
                  }}
                >
                  {weeksAvailable.map((w) => (
                    <option key={w.semaine} value={w.semaine}>
                      {w.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  style={{
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px'
                  }}
                >
                  Tout le mois
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                height: '38px',
                padding: '0 16px',
                fontSize: '0.85rem',
                gap: '6px',
                borderRadius: '8px',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)'
              }}
            >
              <Plus size={16} /> Ajouter
            </button>
          </div>
        </form>

        {/* SECTION 3 : LISTE DES JALONS EXISTANTS AVEC DESIGN CARTE ÉLÉGANT */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
              Jalons enregistrés sur ce projet
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {jalons.length} jalon{jalons.length > 1 ? 's' : ''} au total
            </span>
          </div>

          {jalonsTries.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 16px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontStyle: 'italic',
                background: 'rgba(30, 41, 59, 0.3)',
                borderRadius: '10px',
                border: '1px dashed rgba(255, 255, 255, 0.1)'
              }}
            >
              Aucun jalon n'est encore positionné. Ajoutez votre premier jalon pour l'afficher sur le Gantt.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '190px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}
            >
              {jalonsTries.map((j, idx) => {
                const typeCfg = TYPES_JALONS.find((t) => t.type === j.type) || TYPES_JALONS[0];
                const color = j.couleur || typeCfg.couleur;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(30, 41, 59, 0.65)',
                      backdropFilter: 'blur(8px)',
                      border: `1px solid ${color}35`,
                      borderLeft: `4px solid ${color}`,
                      borderRadius: '8px',
                      padding: '10px 14px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {/* Losange lumineux */}
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: color,
                          transform: 'rotate(45deg)',
                          display: 'inline-block',
                          boxShadow: `0 0 10px ${color}`,
                          border: '1.5px solid #ffffff',
                          flexShrink: 0
                        }}
                      />

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {j.nom}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color,
                              background: `${color}18`,
                              border: `1px solid ${color}40`
                            }}
                          >
                            {j.type || 'MEP'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#38bdf8',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>📅 {NOMS_MOIS_LONGS[(j.mois || 1) - 1]} {j.annee || annee}</span>
                        {j.semaine && (
                          <span
                            style={{
                              backgroundColor: 'rgba(6, 182, 212, 0.25)',
                              color: '#67e8f9',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.74rem'
                            }}
                          >
                            Semaine S{j.semaine}
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSupprimerJalon(idx)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '5px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        title="Supprimer ce jalon"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '16px'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Les jalons sont visibles en losanges néon au sommet des cellules du Gantt.
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                minWidth: '130px',
                boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)'
              }}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
