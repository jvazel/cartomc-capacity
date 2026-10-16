import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { IMoisCalendaireDTO, IConfigurationTolerances } from '../types';
import {
  Save,
  ShieldAlert,
  Check,
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  FileJson,
  Sliders,
  Calendar,
  Trash2,
  GitMerge
} from 'lucide-react';

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

  // Onglet actif : 'tolerances' | 'calendrier' | 'database'
  const [activeTab, setActiveTab] = useState<'tolerances' | 'calendrier' | 'database'>('database');

  // Configuration Tolerances
  const [config, setConfig] = useState<IConfigurationTolerances>({
    toleranceB0Pct: 100,
    toleranceB1Pct: 20,
    seuilSousChargeJours: 10
  });
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configSavedSuccess, setConfigSavedSuccess] = useState<boolean>(false);

  // États Sauvegarde / Restauration BDD
  const [dbStats, setDbStats] = useState<{ databaseName: string; totalDocuments: number; collections: Record<string, number> } | null>(null);
  const [loadingDbStats, setLoadingDbStats] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFilePayload, setParsedFilePayload] = useState<any>(null);
  const [importStatusMessage, setImportStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les stats de la BDD
  const fetchDbStats = () => {
    setLoadingDbStats(true);
    fetch('/api/database/stats')
      .then((res) => res.json())
      .then((data) => {
        setDbStats(data);
        setLoadingDbStats(false);
      })
      .catch((err) => {
        console.error('Erreur chargement stats BDD:', err);
        setLoadingDbStats(false);
      });
  };

  // Charger la configuration et stats BDD
  useEffect(() => {
    fetch('/api/configuration')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Erreur config:', err));

    fetchDbStats();
  }, []);

  // Déclencher le téléchargement du backup complet
  const handleExportDatabase = async () => {
    try {
      setIsExporting(true);
      const res = await fetch('/api/database/export');
      if (!res.ok) {
        throw new Error('Erreur lors de la génération du fichier d\'export');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `cartomc_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Échec de l'exportation : ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Gestion de la sélection du fichier JSON pour l'import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setParsedFilePayload(null);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('Le fichier sélectionné ne contient pas la structure de sauvegarde CartOMC attendue (clé "data" manquante).');
        }
        setParsedFilePayload(parsed);
      } catch (err: any) {
        setImportStatusMessage({
          type: 'error',
          text: `Fichier JSON invalide : ${err.message}`
        });
        setParsedFilePayload(null);
      }
    };
    reader.readAsText(file);
  };

  // Lancement de la restauration
  const handleImportDatabase = async () => {
    if (!parsedFilePayload?.data) {
      alert('Veuillez sélectionner un fichier de sauvegarde valide.');
      return;
    }

    const confirmText = importMode === 'replace'
      ? '⚠️ ATTENTION : Vous avez choisi le mode "Écraser et remplacer".\n\nToutes les collections locales existantes vont être vidées et remplacées par le contenu du fichier.\n\nVoulez-vous vraiment continuer ?'
      : 'Confirmez-vous l\'injection des données du fichier en mode fusion (mise à jour sans vider) ?';

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      setIsImporting(true);
      setImportStatusMessage(null);

      const res = await fetch('/api/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: parsedFilePayload.data,
          mode: importMode
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Erreur lors de la restauration');
      }

      setImportStatusMessage({
        type: 'success',
        text: `Succès : ${result.totalInserted} document(s) importé(s) dans ${Object.keys(result.details || {}).length} collection(s) !`
      });

      // Réinitialiser la sélection
      setSelectedFile(null);
      setParsedFilePayload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Recharger les stats BDD et calendriers
      fetchDbStats();
      fetchCalendrier(selectedAnnee);
    } catch (err: any) {
      setImportStatusMessage({
        type: 'error',
        text: `Échec de l'import : ${err.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

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
            Gérez les paramètres d'estimation, le calendrier des jours ouvrés et la sauvegarde / restauration de la base MongoDB.
          </p>
        </div>
      </div>

      {/* Navigation par Onglets */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('database')}
          className={`btn ${activeTab === 'database' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600 }}
        >
          <Database size={16} />
          Sauvegarde & Restauration BDD
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendrier')}
          className={`btn ${activeTab === 'calendrier' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600 }}
        >
          <Calendar size={16} />
          Calendrier des Jours Ouvrés
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tolerances')}
          className={`btn ${activeTab === 'tolerances' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600 }}
        >
          <Sliders size={16} />
          Tolérances & Moteur d'estimation
        </button>
      </div>

      {/* Section 1 : Configuration des Tolérances */}
      {activeTab === 'tolerances' && (
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
      )}

      {/* Section 2 : Référentiel Calendrier */}
      {activeTab === 'calendrier' && (
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
      )}

      {/* Section 3 : Sauvegarde & Restauration de la Base de Données MongoDB */}
      {activeTab === 'database' && (
      <div className="card card-neon-orange" style={{ border: '1px solid rgba(249, 115, 22, 0.35)' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={20} color="var(--primary)" />
            <span>Sauvegarde & Restauration de la Base de Données</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchDbStats}
            disabled={loadingDbStats}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Rafraîchir les statistiques de la base locale"
          >
            <RefreshCw size={13} className={loadingDbStats ? 'spin' : ''} />
            Actualiser stats
          </button>
        </div>

        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.5 }}>
          Exportez l'intégralité des données présentes dans toutes les collections MongoDB (ressources, projets, absences, ventilations, versions, jalons, snapshots, logs...) dans un fichier JSON portable pour le partager et l'importer sur une autre machine de test.
        </p>

        {/* Résumé de la base actuelle */}
        {dbStats && (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '22px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Base active : <code style={{ color: 'var(--primary)', backgroundColor: 'rgba(249, 115, 22, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>{dbStats.databaseName}</code>
              </span>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Total : <strong style={{ color: 'var(--text-main)' }}>{dbStats.totalDocuments}</strong> documents dans <strong style={{ color: 'var(--text-main)' }}>{Object.keys(dbStats.collections).length}</strong> collections
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(dbStats.collections).map(([colName, count]) => (
                <span
                  key={colName}
                  className="badge badge-secondary"
                  style={{ fontSize: '0.75rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{colName} :</span>
                  <strong style={{ color: count > 0 ? 'var(--primary)' : 'var(--text-dim)' }}>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}
        >
          {/* Bloc 1 : Exporter */}
          <div
            style={{
              padding: '18px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Download size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  1. Exporter les données
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '14px' }}>
                Générez un snapshot complet de toutes les collections dans un fichier <code>.json</code> unique. Téléchargement immédiat sans interruption de service.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportDatabase}
              disabled={isExporting}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px 16px',
                fontSize: '0.88rem',
                fontWeight: 600
              }}
            >
              <Download size={16} className={isExporting ? 'spin' : ''} />
              {isExporting ? 'Génération de l\'export...' : 'Télécharger la sauvegarde complète (.json)'}
            </button>
          </div>

          {/* Bloc 2 : Importer / Restaurer */}
          <div
            style={{
              padding: '18px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Upload size={18} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  2. Restaurer une sauvegarde
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '14px' }}>
                Importez un fichier de sauvegarde <code>.json</code> généré par CartOMC pour alimenter votre instance MongoDB locale.
              </p>

              {/* Sélection du fichier */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="db-backup-upload-input"
                />
                <label
                  htmlFor="db-backup-upload-input"
                  className="btn btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: '0.84rem'
                  }}
                >
                  <FileJson size={16} />
                  {selectedFile ? selectedFile.name : 'Choisir un fichier de backup (.json)'}
                </label>
              </div>

              {/* Aperçu du contenu du fichier sélectionné */}
              {parsedFilePayload && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'rgba(251, 191, 36, 0.08)',
                    borderRadius: '6px',
                    border: '1px solid rgba(251, 191, 36, 0.25)',
                    marginBottom: '14px',
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '4px' }}>
                    Contenu prêt à importer :
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Exporté le : <strong>{parsedFilePayload._meta?.exportedAt ? new Date(parsedFilePayload._meta.exportedAt).toLocaleString('fr-FR') : 'Inconnue'}</strong>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    Total : <strong>{parsedFilePayload._meta?.totalDocuments || Object.values(parsedFilePayload.data || {}).reduce((s: any, arr: any) => s + (Array.isArray(arr) ? arr.length : 0), 0)}</strong> documents dans <strong>{Object.keys(parsedFilePayload.data || {}).length}</strong> collections
                  </div>
                </div>
              )}

              {/* Choix du mode d'import interactif & moderne */}
              {selectedFile && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Mode d'injection des données :
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    {/* Option 1 : Écraser et remplacer */}
                    <div
                      onClick={() => setImportMode('replace')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: importMode === 'replace'
                          ? '1px solid #f97316'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        background: importMode === 'replace'
                          ? 'rgba(249, 115, 22, 0.12)'
                          : 'rgba(0, 0, 0, 0.25)',
                        boxShadow: importMode === 'replace'
                          ? '0 0 12px rgba(249, 115, 22, 0.2)'
                          : 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${importMode === 'replace' ? '#f97316' : 'rgba(255, 255, 255, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '2px',
                          flexShrink: 0
                        }}
                      >
                        {importMode === 'replace' && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: importMode === 'replace' ? '#ffffff' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trash2 size={13} style={{ color: '#f87171' }} />
                            Écraser et remplacer
                          </span>
                          <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '1px 6px', backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.35)' }}>
                            Recommandé pour testeurs
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          Vide la base locale et restaure exactement l'état du fichier pour un clone 100% fidèle.
                        </p>
                      </div>
                    </div>

                    {/* Option 2 : Fusionner */}
                    <div
                      onClick={() => setImportMode('merge')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: importMode === 'merge'
                          ? '1px solid #06b6d4'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        background: importMode === 'merge'
                          ? 'rgba(6, 182, 212, 0.12)'
                          : 'rgba(0, 0, 0, 0.25)',
                        boxShadow: importMode === 'merge'
                          ? '0 0 12px rgba(6, 182, 212, 0.2)'
                          : 'none',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${importMode === 'merge' ? '#06b6d4' : 'rgba(255, 255, 255, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '2px',
                          flexShrink: 0
                        }}
                      >
                        {importMode === 'merge' && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4' }} />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: importMode === 'merge' ? '#ffffff' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <GitMerge size={13} style={{ color: '#06b6d4' }} />
                            Fusionner / Compléter
                          </span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            Conserve l'existant
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          Met à jour les documents correspondants sans supprimer les données déjà présentes sur cette machine.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton d'action d'import */}
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleImportDatabase}
              disabled={isImporting || !parsedFilePayload}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px 16px',
                fontSize: '0.88rem',
                fontWeight: 600,
                opacity: !parsedFilePayload ? 0.5 : 1
              }}
            >
              <Upload size={16} className={isImporting ? 'spin' : ''} />
              {isImporting ? 'Restauration en cours...' : 'Lancer l\'importation'}
            </button>
          </div>
        </div>

        {/* Message de statut d'importation */}
        {importStatusMessage && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.86rem',
              backgroundColor: importStatusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${importStatusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: importStatusMessage.type === 'success' ? '#34d399' : '#f87171'
            }}
          >
            {importStatusMessage.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            <span>{importStatusMessage.text}</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
