import React, { useState, useEffect } from 'react';
import { VersionItem } from './types';
import { X, Calendar, Sparkles, Trash2, Check, AlertCircle } from 'lucide-react';

interface MilestoneConfigModalProps {
  version: VersionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (versionId: string, data: {
    dateFinAFaire?: string | null;
    dateFinEnCours?: string | null;
    dateFinMR?: string | null;
    dateFinRecette?: string | null;
    dateMEPP?: string | null;
    dateMEP?: string | null;
    description?: string;
  }) => Promise<void>;
  onReset: (versionId: string) => Promise<void>;
}

export const MilestoneConfigModal: React.FC<MilestoneConfigModalProps> = ({
  version,
  isOpen,
  onClose,
  onSave,
  onReset
}) => {
  const [dateFinAFaire, setDateFinAFaire] = useState('');
  const [dateFinEnCours, setDateFinEnCours] = useState('');
  const [dateFinMR, setDateFinMR] = useState('');
  const [dateFinRecette, setDateFinRecette] = useState('');
  const [dateMEPP, setDateMEPP] = useState('');
  const [dateMEP, setDateMEP] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDateForInput = (d?: string | null) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (version) {
      setDateFinAFaire(formatDateForInput(version.dateFinAFaire));
      setDateFinEnCours(formatDateForInput(version.dateFinEnCours));
      setDateFinMR(formatDateForInput(version.dateFinMR));
      setDateFinRecette(formatDateForInput(version.dateFinRecette));
      setDateMEPP(formatDateForInput(version.dateMEPP));
      setDateMEP(formatDateForInput(version.dateMEP || version.jiraReleaseDate));
      setDescription(version.description || '');
      setError(null);
    }
  }, [version, isOpen]);

  if (!isOpen || !version) return null;

  // Assistant de calcul automatique depuis la date de MEP
  const handleAutoCalculateFromMEP = () => {
    if (!dateMEP) {
      setError('Veuillez d\'abord renseigner la Date de MEP (Mise en Prod) pour calculer les jalons précédents.');
      return;
    }
    setError(null);
    const mepDate = new Date(dateMEP);

    const subDays = (d: Date, days: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() - days);
      return copy.toISOString().split('T')[0];
    };

    // MEPP à J-4
    if (!dateMEPP) setDateMEPP(subDays(mepDate, 4));
    // Fin recette à J-7
    if (!dateFinRecette) setDateFinRecette(subDays(mepDate, 7));
    // Fin MR à J-12
    if (!dateFinMR) setDateFinMR(subDays(mepDate, 12));
    // Fin En cours à J-16
    if (!dateFinEnCours) setDateFinEnCours(subDays(mepDate, 16));
    // Fin À faire à J-21
    if (!dateFinAFaire) setDateFinAFaire(subDays(mepDate, 21));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSave(version._id, {
        dateFinAFaire: dateFinAFaire || null,
        dateFinEnCours: dateFinEnCours || null,
        dateFinMR: dateFinMR || null,
        dateFinRecette: dateFinRecette || null,
        dateMEPP: dateMEPP || null,
        dateMEP: dateMEP || null,
        description: description.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer tous les jalons pour la version "${version.versionName}" ?`)) {
      setIsSaving(true);
      try {
        await onReset(version._id);
        setDateFinAFaire('');
        setDateFinEnCours('');
        setDateFinMR('');
        setDateFinRecette('');
        setDateMEPP('');
        setDateMEP('');
        onClose();
      } catch (err: any) {
        setError(err.message || 'Erreur lors de la suppression');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const milestonesList = [
    {
      id: 'dateFinAFaire',
      label: '1. Date fin « À faire »',
      desc: 'Interdiction de démarrer de nouveaux tickets.',
      value: dateFinAFaire,
      setter: setDateFinAFaire,
      color: '#38bdf8'
    },
    {
      id: 'dateFinEnCours',
      label: '2. Date fin « En cours »',
      desc: 'Interdiction de commiter / clôture du dev.',
      value: dateFinEnCours,
      setter: setDateFinEnCours,
      color: '#fbbf24'
    },
    {
      id: 'dateFinMR',
      label: '3. Date fin « MR »',
      desc: 'Freeze de code / toutes les PR doivent être mergées.',
      value: dateFinMR,
      setter: setDateFinMR,
      color: '#c084fc'
    },
    {
      id: 'dateFinRecette',
      label: '4. Date fin « Recette »',
      desc: 'Tests QA et validation métier terminés.',
      value: dateFinRecette,
      setter: setDateFinRecette,
      color: '#fb923c'
    },
    {
      id: 'dateMEPP',
      label: '5. Date de « MEPP »',
      desc: 'Déploiement Préprod & tests de charge / benchs.',
      value: dateMEPP,
      setter: setDateMEPP,
      color: '#34d399'
    },
    {
      id: 'dateMEP',
      label: '6. Date de « MEP »',
      desc: 'Mise en Production finale.',
      value: dateMEP,
      setter: setDateMEP,
      color: '#f472b6'
    }
  ];

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '92vh',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
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
              <Calendar size={22} style={{ color: 'var(--primary)' }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.01em'
                }}
              >
                Jalons de la Version : <span style={{ color: 'var(--primary)' }}>{version.versionName}</span>
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Projet : <strong style={{ color: 'var(--text-main)' }}>{version.projectKey}</strong> • Statut Jira :{' '}
              <span className={`badge ${version.released ? 'badge-success' : 'badge-primary'}`} style={{ marginLeft: '4px' }}>
                {version.released ? 'Publiée' : 'Non publiée (En cours)'}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-change-role"
            style={{ padding: '6px', borderRadius: '8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '22px 24px', flex: 1 }}>
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius)',
                  color: '#f87171',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.88rem'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Assistant calcul automatique */}
            <div
              style={{
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: 'var(--radius)',
                padding: '12px 18px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> Calcul automatique des rétro-plannings
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Préremplit automatiquement Recette, MR, Dév et À faire à partir de la date de MEP.
                </div>
              </div>
              <button
                type="button"
                onClick={handleAutoCalculateFromMEP}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  padding: '6px 12px',
                  color: 'var(--primary)',
                  border: '1px solid var(--border-color-glow)'
                }}
              >
                <Sparkles size={14} /> Calculer les jalons
              </button>
            </div>

            {/* Grille des 6 jalons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {milestonesList.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: m.color,
                          boxShadow: `0 0 8px ${m.color}88`,
                          display: 'inline-block'
                        }}
                      />
                      <label htmlFor={m.id} style={{ fontWeight: 600, fontSize: '0.92rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                        {m.label}
                      </label>
                    </div>
                    <p style={{ margin: '2px 0 0 18px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {m.desc}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id={m.id}
                      type="date"
                      value={m.value}
                      onChange={(e) => m.setter(e.target.value)}
                      className="form-input"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.85rem',
                        width: '150px'
                      }}
                    />
                    {m.value && (
                      <button
                        type="button"
                        onClick={() => m.setter('')}
                        title="Effacer ce jalon"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--danger)',
                          padding: '6px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Note / Description facultative */}
            <div style={{ marginTop: '18px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Commentaire / Remarques sur la version
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Version critique, jalons serrés suite aux recettes partenaires..."
                rows={2}
                className="form-input"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="btn btn-danger"
              style={{
                fontSize: '0.82rem',
                padding: '8px 14px'
              }}
            >
              <Trash2 size={15} /> Vider tous les jalons
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontWeight: 600 }}
              >
                <Check size={16} /> {isSaving ? 'Enregistrement...' : 'Enregistrer les jalons'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
