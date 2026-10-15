import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { IMoisCalendaireDTO, IConfigurationTolerances } from '../types';
import { Save, ShieldAlert, Check } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { role } = useAuth();

  if (role !== 'Admin') {
    return (
      <div className="restricted-notice card">
        <ShieldAlert size={48} style={{ color: 'var(--warning)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Accès restreint
        </h2>
        <p style={{ marginTop: '8px' }}>
          La section Administration est réservée au rôle <strong>Administrateur / Manager</strong>.
        </p>
      </div>
    );
  }

  const [selectedAnnee, setSelectedAnnee] = useState<number>(new Date().getFullYear());
  const [moisCalendaires, setMoisCalendaires] = useState<IMoisCalendaireDTO[]>([]);
  const [loadingCalendrier, setLoadingCalendrier] = useState<boolean>(true);

  // Configuration Tolerances
  const [config, setConfig] = useState<IConfigurationTolerances>({
    toleranceB0Pct: 100,
    toleranceB1Pct: 20,
    seuilSousChargeJours: 10
  });
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configSavedSuccess, setConfigSavedSuccess] = useState<boolean>(false);

  // Charger la configuration
  useEffect(() => {
    fetch('/api/configuration')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Erreur config:', err));
  }, []);

  // Charger les jours ouvrés du calendrier
  const fetchCalendrier = (annee: number) => {
    setLoadingCalendrier(true);
    fetch(`/api/calendrier/annee/${annee}`)
      .then((res) => res.json())
      .then((data) => {
        setMoisCalendaires(data);
        setLoadingCalendrier(false);
      })
      .catch((err) => {
        console.error('Erreur calendrier:', err);
        setLoadingCalendrier(false);
      });
  };

  useEffect(() => {
    fetchCalendrier(selectedAnnee);
  }, [selectedAnnee]);

  const handleUpdateJoursForces = async (mois: number, valStr: string) => {
    const joursOuvresForces = valStr === '' ? null : Number(valStr);

    try {
      await fetch('/api/calendrier/forcer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annee: selectedAnnee,
          mois,
          joursOuvresForces
        })
      });
      fetchCalendrier(selectedAnnee);
    } catch (err) {
      console.error('Erreur forçage jours:', err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSavedSuccess(false);

    try {
      const res = await fetch('/api/configuration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const updated = await res.json();
      setConfig(updated);
      setConfigSavedSuccess(true);
      setTimeout(() => setConfigSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Erreur enregistrement config:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const nomsMois = [
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration & Configuration</h1>
          <p className="page-subtitle">
            Paramétrez le calendrier des jours ouvrés et les règles de tolérance d'estimation B0/B1.
          </p>
        </div>
      </div>

      {/* Section 1 : Configuration des Tolérances */}
      <div className="card">
        <div className="card-title">Moteur d'estimation & Seuils d'alerte</div>
        <form onSubmit={handleSaveConfig}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px'
            }}
          >
            <div className="form-group">
              <label className="form-label">Tolérance B0 (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={config.toleranceB0Pct}
                  onChange={(e) =>
                    setConfig({ ...config, toleranceB0Pct: Number(e.target.value) })
                  }
                />
                <span style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Dépassement toléré sur macro-chiffrage (défaut : 100%).
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Tolérance B1 (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={config.toleranceB1Pct}
                  onChange={(e) =>
                    setConfig({ ...config, toleranceB1Pct: Number(e.target.value) })
                  }
                />
                <span style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Dépassement toléré sur chiffrage fin (défaut : 20%).
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Seuil de sous-charge (jours)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={config.seuilSousChargeJours}
                  onChange={(e) =>
                    setConfig({ ...config, seuilSousChargeJours: Number(e.target.value) })
                  }
                />
                <span style={{ color: 'var(--text-muted)' }}>j</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Seuil d'alerte pour identifier une équipe en sous-charge.
              </span>
            </div>
          </div>

          {/* Sous-section : Catégories Tempo RUN */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Catégories Tempo identifiées comme "RUN / MCO"
            </label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Les worklogs Tempo dont le champ <em>category</em> correspond à l'une de ces valeurs seront comptabilisés en RUN (ex: MCO, Evol Technique). Tout le reste sera considéré comme du BUILD.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              {(config.categoriesRun || ['MCO', 'Evol Technique']).map((cat, idx) => (
                <span
                  key={idx}
                  className="badge badge-purple"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {cat}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}
                    onClick={() => {
                      const updated = (config.categoriesRun || ['MCO', 'Evol Technique']).filter((_, i) => i !== idx);
                      setConfig({ ...config, categoriesRun: updated });
                    }}
                    title="Supprimer cette catégorie"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
              <input
                type="text"
                id="newCategoryRunInput"
                className="form-input"
                placeholder="Ex: Maintenance, Anomaly..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = (e.currentTarget.value || '').trim();
                    if (val) {
                      const current = config.categoriesRun || ['MCO', 'Evol Technique'];
                      if (!current.includes(val)) {
                        setConfig({ ...config, categoriesRun: [...current, val] });
                      }
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const input = document.getElementById('newCategoryRunInput') as HTMLInputElement;
                  const val = input?.value.trim();
                  if (val) {
                    const current = config.categoriesRun || ['MCO', 'Evol Technique'];
                    if (!current.includes(val)) {
                      setConfig({ ...config, categoriesRun: [...current, val] });
                    }
                    input.value = '';
                  }
                }}
              >
                + Ajouter
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" disabled={savingConfig}>
              <Save size={16} /> {savingConfig ? 'Enregistrement...' : 'Enregistrer la configuration'}
            </button>
            {configSavedSuccess && (
              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={16} /> Configuration sauvegardée avec succès !
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Section 2 : Référentiel Calendrier */}
      <div className="card">
        <div className="card-title">
          <span>Référentiel Calendrier — Jours Ouvrés</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Année :
            </label>
            <select
              className="form-select"
              value={selectedAnnee}
              onChange={(e) => setSelectedAnnee(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingCalendrier ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Calcul du calendrier...
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mois</th>
                  <th>Jours ouvrés automatiques</th>
                  <th>Jours ouvrés forcés (ponts / fériés)</th>
                  <th>Jours ouvrés effectifs retenus</th>
                </tr>
              </thead>
              <tbody>
                {moisCalendaires.map((m) => {
                  const estForcé = m.joursOuvresForces !== undefined && m.joursOuvresForces !== null;
                  return (
                    <tr key={m.mois}>
                      <td style={{ fontWeight: 600 }}>{nomsMois[m.mois - 1]}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{m.joursOuvresAuto} jours</td>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          style={{ width: '120px' }}
                          placeholder={`Auto (${m.joursOuvresAuto})`}
                          value={estForcé ? m.joursOuvresForces : ''}
                          onChange={(e) => handleUpdateJoursForces(m.mois, e.target.value)}
                        />
                      </td>
                      <td>
                        <span
                          className={`badge ${estForcé ? 'badge-warning' : 'badge-secondary'}`}
                          style={{
                            fontWeight: 600,
                            backgroundColor: estForcé ? 'rgba(245, 158, 11, 0.15)' : undefined,
                            color: estForcé ? '#fbbf24' : undefined,
                            borderColor: estForcé ? 'rgba(245, 158, 11, 0.3)' : undefined
                          }}
                        >
                          {m.joursOuvresEffectifs} jours {estForcé ? '(Manuel)' : '(Auto)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
