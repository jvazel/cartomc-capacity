import React, { useState, useEffect } from 'react';
import { Clock, Table, BarChart3, Settings, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useExtractionJob } from '../hooks/useExtractionJob';
import { TempoForm } from '../components/tempo/TempoForm';
import { ExtractionProgressPanel } from '../components/tempo/ExtractionProgressPanel';
import { TempoDetailTable } from '../components/tempo/TempoDetailTable';
import { TempoPivotTable } from '../components/tempo/TempoPivotTable';
import { TempoConfigScreen } from '../components/tempo/TempoConfigScreen';

export const TempoPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'detail' | 'pivot' | 'config'>('detail');
  const [envDefaults, setEnvDefaults] = useState<{
    baseUrl: string;
    projectKey: string;
    hasTokenInEnv: boolean;
    hasBaseUrlInEnv: boolean;
    hasProjectInEnv: boolean;
  } | null>(null);

  const [savedEntries, setSavedEntries] = useState<any[] | null>(null);
  const [savedExtractedAt, setSavedExtractedAt] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState<boolean>(true);

  const {
    status,
    progress,
    result,
    anomalies,
    error,
    elapsedSeconds,
    isConnectionLost,
    startJob,
    cancelJob,
    resetJob
  } = useExtractionJob();

  const loadSavedWorklogs = () => {
    setLoadingSaved(true);
    fetch('/api/tempo/extractions/saved')
      .then((res) => res.json())
      .then((data) => {
        if (data.entries && data.entries.length > 0) {
          setSavedEntries(data.entries);
          setSavedExtractedAt(data.extractedAt);
        }
        setLoadingSaved(false);
      })
      .catch((err) => {
        console.error('Erreur chargement données BDD Tempo:', err);
        setLoadingSaved(false);
      });
  };

  useEffect(() => {
    fetch('/api/tempo/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.defaults) {
          setEnvDefaults(data.defaults);
        }
      })
      .catch(() => {});

    loadSavedWorklogs();
  }, []);

  // Effect pour recharger les données de la BDD après un job terminé
  useEffect(() => {
    if (status === 'completed') {
      loadSavedWorklogs();
    }
  }, [status]);

  const displayedEntries = (result && result.length > 0) ? result : (savedEntries || []);
  const isUsingSavedData = !result && savedEntries && savedEntries.length > 0;

  const isProcessing = status === 'running' || status === 'queued';

  // Check missing environment variables
  const missingEnvVars: string[] = [];
  if (envDefaults) {
    if (!envDefaults.hasTokenInEnv) missingEnvVars.push('JIRA_API_TOKEN');
    if (!envDefaults.hasBaseUrlInEnv) missingEnvVars.push('JIRA_BASE_URL');
    if (!envDefaults.hasProjectInEnv) missingEnvVars.push('JIRA_DEFAULT_PROJECT');
  }

  return (
    <div>
      {/* Page Header (Matching App standard style) */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={28} color="var(--primary)" />
            Temps Tempo Jira
          </h1>
          <p className="page-subtitle">
            Extraction asynchrone, enrichissement en 24 colonnes et tableau croisé dynamique de suivi budgétaire.
          </p>
        </div>
      </div>

      {/* Warning banner if environment variables are missing */}
      {missingEnvVars.length > 0 && (
        <div className="card card-neon-amber" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--warning)' }}>
            <ShieldAlert size={24} />
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Configuration `.env` incomplète sur le serveur backend :</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Veuillez renseigner {missingEnvVars.map((v) => `"${v}"`).join(', ')} dans le fichier <code style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>backend/.env</code>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Parameters Form */}
      <TempoForm onSubmit={startJob} isProcessing={isProcessing} envDefaults={envDefaults} />

      {/* Non-blocking Progress Panel */}
      <ExtractionProgressPanel
        status={status}
        progress={progress}
        elapsedSeconds={elapsedSeconds}
        isConnectionLost={isConnectionLost}
        onCancel={cancelJob}
      />

      {/* Error notification banner */}
      {status === 'failed' && error && (
        <div className="card card-neon-red">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)' }}>
              <AlertCircle size={20} />
              <div>
                <strong>Échec de l'extraction :</strong> {error}
              </div>
            </div>
            <button onClick={resetJob} className="btn btn-secondary">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {status === 'completed' && result && (
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'rgba(16, 185, 129, 0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#34d399' }}>
            <CheckCircle2 size={20} />
            <span>
              Extraction terminée avec succès ! <strong>{result.length}</strong> lignes générées et enregistrées en base de données.
            </span>
          </div>
        </div>
      )}

      {/* Banner info si affichage des données BDD enregistrées */}
      {isUsingSavedData && status !== 'completed' && (
        <div className="card" style={{ borderLeft: '4px solid #38bdf8', background: 'rgba(56, 189, 248, 0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#38bdf8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={20} />
              <span>
                Données d'extraction chargées depuis la base de données <strong>({savedEntries.length} lignes)</strong>.
                {savedExtractedAt && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    Dernière extraction : {new Date(savedExtractedAt).toLocaleString('fr-FR')}
                  </span>
                )}
              </span>
            </div>
            <button onClick={loadSavedWorklogs} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Rafraîchir BDD
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('detail')}
          className={`btn ${activeTab === 'detail' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Table size={16} />
          Détail ({displayedEntries.length} lignes)
        </button>

        <button
          onClick={() => setActiveTab('pivot')}
          className={`btn ${activeTab === 'pivot' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <BarChart3 size={16} />
          Synthèse (Tableau croisé)
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Settings size={16} />
          Configuration Customfields & Annuaire
        </button>
      </div>

      {/* Sub-Tab Content */}
      {activeTab === 'detail' && (
        <TempoDetailTable entries={displayedEntries} anomalies={anomalies} />
      )}

      {activeTab === 'pivot' && (
        <TempoPivotTable entries={displayedEntries} />
      )}

      {activeTab === 'config' && (
        <TempoConfigScreen />
      )}
    </div>
  );
};
