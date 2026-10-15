import React, { useState, useEffect } from 'react';
import { Play, Calendar, FolderGit2, Globe, CheckCircle, AlertTriangle } from 'lucide-react';
import { IExtractionRequest } from '../../types/tempo';

interface TempoFormProps {
  onSubmit: (data: IExtractionRequest) => void;
  isProcessing: boolean;
  envDefaults: {
    baseUrl: string;
    projectKey: string;
    hasTokenInEnv: boolean;
    hasBaseUrlInEnv: boolean;
    hasProjectInEnv: boolean;
  } | null;
}

export const TempoForm: React.FC<TempoFormProps> = ({ onSubmit, isProcessing, envDefaults }) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-01-01`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-12-31`;
  });

  const [projectKey, setProjectKey] = useState<string>('GTEP');
  const [baseUrl, setBaseUrl] = useState<string>('https://collabtools.boulanger.team');

  useEffect(() => {
    if (envDefaults) {
      if (envDefaults.baseUrl) setBaseUrl(envDefaults.baseUrl);
      if (envDefaults.projectKey) setProjectKey(envDefaults.projectKey);
    }
  }, [envDefaults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    onSubmit({
      startDate,
      endDate,
      projectKey: projectKey.trim(),
      baseUrl: baseUrl.trim()
    });
  };

  const hasToken = envDefaults?.hasTokenInEnv ?? true;

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="var(--primary)" />
          <span>Paramètres de la période d'extraction</span>
        </div>
        {hasToken ? (
          <span className="badge badge-success" style={{ gap: '4px' }}>
            <CheckCircle size={12} /> Token Jira configuré (.env)
          </span>
        ) : (
          <span className="badge badge-warning" style={{ gap: '4px' }}>
            <AlertTriangle size={12} /> Token Jira manquant (.env)
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            Date de début (dateFrom)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            Date de fin (dateTo)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="form-input"
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            <FolderGit2 size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Clé de projet Jira
          </label>
          <input
            type="text"
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
            placeholder="ex: GTEP"
            required
            className="form-input"
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">
            <Globe size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            URL Serveur Jira (BaseUrl)
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://collabtools.boulanger.team"
            required
            className="form-input"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
        <button
          type="submit"
          disabled={isProcessing || !hasToken}
          className="btn btn-primary"
        >
          <Play size={16} />
          {isProcessing ? 'Extraction en cours...' : 'Lancer l\'extraction et l\'enrichissement'}
        </button>
      </div>
    </form>
  );
};
