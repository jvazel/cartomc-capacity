import React, { useState } from 'react';
import { MessageSquare, X, Check, Trash2, Calendar, FileText } from 'lucide-react';

interface NoteArbitrageModalProps {
  isOpen: boolean;
  onClose: () => void;
  projet: {
    _id: string;
    nom: string;
    codeProjet?: string;
  };
  mois: number;
  annee: number;
  existingNote?: string;
  onSave: (note: string) => void;
  canEdit: boolean;
}

const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const NoteArbitrageModal: React.FC<NoteArbitrageModalProps> = ({
  isOpen,
  onClose,
  projet,
  mois,
  annee,
  existingNote = '',
  onSave,
  canEdit
}) => {
  const [note, setNote] = useState<string>(existingNote);

  React.useEffect(() => {
    setNote(existingNote || '');
  }, [existingNote, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    onSave(note.trim());
  };

  const handleClear = () => {
    if (!canEdit) return;
    onSave('');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1250 }}>
      <div className="modal-card" style={{ maxWidth: '480px', width: '92%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b'
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-heading)'
                }}
              >
                Note d'Arbitrage & Contexte
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {projet.codeProjet && (
                  <span className="badge badge-secondary" style={{ marginRight: '6px' }}>
                    {projet.codeProjet}
                  </span>
                )}
                {projet.nom}
              </div>
            </div>
          </div>
          <button className="toast-close-btn" onClick={onClose} style={{ fontSize: '1.2rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--primary)'
              }}
            >
              <Calendar size={15} />
              <span>
                Période ciblée : <strong>{NOMS_MOIS[mois - 1]} {annee}</strong>
              </span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Commentaire d'arbitrage / Décision d'équipe :
              </label>
              <textarea
                rows={4}
                autoFocus
                disabled={!canEdit}
                placeholder="Ex : Décalé à septembre en attente arbitrage métier COPROJ du 15/03..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="form-input"
                style={{
                  resize: 'vertical',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  fontFamily: 'var(--font-family)',
                  borderColor: note.trim() ? 'rgba(245, 158, 11, 0.5)' : undefined
                }}
              />
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              💡 Cette note apparaîtra sous forme de marqueur ambre au coin de la cellule et sera immédiatement consultable au survol.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px'
            }}
          >
            {existingNote && canEdit ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', padding: '6px 10px', fontSize: '0.8rem' }}
                onClick={handleClear}
                title="Supprimer la note d'arbitrage"
              >
                <Trash2 size={14} style={{ marginRight: '4px' }} /> Supprimer
              </button>
            ) : (
              <span />
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {canEdit ? 'Annuler' : 'Fermer'}
              </button>
              {canEdit && (
                <button type="submit" className="btn btn-primary" style={{ minWidth: '100px' }}>
                  <Check size={14} style={{ marginRight: '4px' }} /> Enregistrer
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
