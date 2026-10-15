import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IImportAbsenceLog, ICSVPreviewData } from '../types';
import { VerifCapaciteTable } from '../components/VerifCapaciteTable';
import { ControleAbsencesJiraTable } from '../components/ControleAbsencesJiraTable';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Calendar,
  ShieldAlert,
  ArrowRight,
  Layers
} from 'lucide-react';

export const AbsencesPage: React.FC = () => {
  const { role } = useAuth();
  const { showSuccess, showDanger } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'controle' | 'import'>('controle');


  // Restriction aux rôles Admin / Manager
  if (role !== 'Admin') {
    return (
      <div className="restricted-notice card">
        <ShieldAlert size={48} style={{ color: 'var(--warning)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Accès restreint
        </h2>
        <p style={{ marginTop: '8px' }}>
          La synchronisation des absences est réservée au rôle <strong>Administrateur / Manager</strong>.
        </p>
      </div>
    );
  }

  // State du dernier import
  const [dernierImport, setDernierImport] = useState<IImportAbsenceLog | null>(null);
  const [loadingLog, setLoadingLog] = useState<boolean>(true);

  // State Fichier & Preview
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<ICSVPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mapping manuellement corrigible
  const [datesRowIndex, setDatesRowIndex] = useState<number>(0);
  const [matriculeColIndex, setMatriculeColIndex] = useState<number>(0);
  const [startDataRowIndex, setStartDataRowIndex] = useState<number>(1);
  const [conventionMode, setConventionMode] = useState<'0_is_absent' | '1_is_absent'>('0_is_absent');

  // State Importation en cours & Rapport final
  const [importing, setImporting] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<{
    dateImport: string;
    nombreLignesTraitees: number;
    nombreMatriculesReconnus: number;
    matriculesNonReconnus: string[];
    cellulesIgnoreesOuInvalides: number;
    nombreAbsencesEnregistrees: number;
  } | null>(null);

  // Charger le dernier import au montage
  const fetchDernierImport = () => {
    setLoadingLog(true);
    fetch('/api/absences/dernier-import')
      .then((res) => res.json())
      .then((data) => {
        setDernierImport(data);
        setLoadingLog(false);
      })
      .catch((err) => {
        console.error('Erreur chargement dernier import:', err);
        setLoadingLog(false);
      });
  };

  useEffect(() => {
    fetchDernierImport();
  }, []);

  // Gestion du fichier sélectionné
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);
    setImportReport(null);
    setLoadingPreview(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      generatePreview(text);
    };
    reader.onerror = () => {
      setErrorMsg('Erreur lors de la lecture du fichier CSV.');
      setLoadingPreview(false);
    };
    reader.readAsText(file);
  };

  // Demander la prévisualisation et la détection automatique au backend
  const generatePreview = async (text: string) => {
    try {
      const res = await fetch('/api/absences/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erreur d\'analyse du fichier CSV.');
      }

      const data: ICSVPreviewData = await res.json();
      setPreviewData(data);
      setDatesRowIndex(data.detectedDatesRow);
      setMatriculeColIndex(data.detectedMatriculeCol);
      setStartDataRowIndex(data.detectedStartDataRow);
      setLoadingPreview(false);
    } catch (err: any) {
      setErrorMsg(err.message);
      setPreviewData(null);
      setLoadingPreview(false);
    }
  };

  // Exécution de l'importation définitive
  const handleConfirmImport = async () => {
    if (!csvContent) return;

    setImporting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/absences/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          datesRowIndex,
          matriculeColIndex,
          startDataRowIndex,
          conventionMode
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erreur lors de l\'importation des absences.');
      }

      const resData = await res.json();
      setImportReport(resData.report);
      setImporting(false);
      setPreviewData(null); // Masquer le panneau de prévisualisation
      fetchDernierImport(); // Mettre à jour la date du dernier import
      showSuccess(`Importation d'absences réussie ! (${resData.report.nbAbsencesImportees} absences enregistrées)`);
    } catch (err: any) {
      setErrorMsg(err.message);
      showDanger(err.message || 'Erreur lors de l\'importation des absences.');
      setImporting(false);
    }
  };

  const formatDateFormatee = (dateIso?: string) => {
    if (!dateIso) return 'Aucun import effectué';
    const d = new Date(dateIso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      {/* En-tête de la page avec badge permanent du dernier import */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Gestion & Contrôle des Absences</h1>
          <p className="page-subtitle">
            Contrôlez la saisie réelle des congés dans Jira vs les intentions CSV et importez les données d'absences.
          </p>
        </div>

        {/* Permanent Last Import Badge */}
        <div
          style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            padding: '10px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <Calendar size={20} style={{ color: 'var(--primary-light)' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Dernier import validé
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {loadingLog ? 'Chargement...' : formatDateFormatee(dernierImport?.dateImport)}
            </div>
          </div>
        </div>
      </div>

      {/* Barre d'onglets principale */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          className={`btn ${activeSubTab === 'controle' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('controle')}
          style={{ padding: '10px 20px', fontSize: '0.95rem' }}
        >
          <Layers size={16} /> Contrôle Saisie Jira (vs CSV)
        </button>
        <button
          className={`btn ${activeSubTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveSubTab('import')}
          style={{ padding: '10px 20px', fontSize: '0.95rem' }}
        >
          <Upload size={16} /> Importer Fichier CSV (Intentions)
        </button>
      </div>

      {activeSubTab === 'controle' ? (
        <ControleAbsencesJiraTable />
      ) : (
        <>
          {/* Section 1 : Zone d'Upload du fichier */}
          <div className="card">
            <div className="card-title">1. Sélectionner le fichier d'absences (CSV)</div>


        <div
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '10px',
            padding: '32px',
            textAlign: 'center',
            background: 'rgba(30, 41, 59, 0.4)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => document.getElementById('csvFileInput')?.click()}
        >
          <FileSpreadsheet size={48} style={{ color: 'var(--primary-light)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
            {fileName ? `Fichier sélectionné : ${fileName}` : 'Cliquez ici pour téléverser votre fichier CSV'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Format attendu : CSV encodé en UTF-8 ou ISO, une ligne par ressource (matricule) et des colonnes par jour calendaire au format JJ/MM/AAAA. (0,5 = demi-journée, 1 = absent, 0 ou vide = présent).
          </p>

          <input
            id="csvFileInput"
            type="file"
            accept=".csv,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('csvFileInput')?.click();
            }}
          >
            <Upload size={16} /> Parcourir les fichiers
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={18} /> {errorMsg}
          </div>
        )}
      </div>

      {/* Section 2 : Prévisualisation & Mapping si fichier chargé */}
      {loadingPreview && (
        <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
          Analyse de la structure du fichier CSV en cours...
        </div>
      )}

      {previewData && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>2. Vérification et confirmation du mapping des colonnes</span>
            <span className="badge badge-secondary">{previewData.totalRows} lignes détectées</span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Le système a automatiquement détecté la structure ci-dessous. Vous pouvez corriger le positionnement avant la validation définitive.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">
                Ligne des dates (contient 01/01/2026, ...)
              </label>
              <select
                className="form-select"
                value={datesRowIndex}
                onChange={(e) => setDatesRowIndex(Number(e.target.value))}
              >
                {previewData.sampleRows.map((row, idx) => (
                  <option key={idx} value={idx}>
                    Ligne {idx + 1} : {row.slice(0, 5).join(' | ')}...
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">
                Colonne des Matricules
              </label>
              <select
                className="form-select"
                value={matriculeColIndex}
                onChange={(e) => setMatriculeColIndex(Number(e.target.value))}
              >
                {previewData.sampleRows[0]?.map((_, colIdx) => (
                  <option key={colIdx} value={colIdx}>
                    Colonne {colIdx + 1} ({previewData.sampleRows.find(r => r[colIdx] && r[colIdx] !== '')?.[colIdx] || `Col ${colIdx + 1}`})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">
                Première ligne de données (Ressources)
              </label>
              <select
                className="form-select"
                value={startDataRowIndex}
                onChange={(e) => setStartDataRowIndex(Number(e.target.value))}
              >
                {previewData.sampleRows.map((row, idx) => (
                  <option key={idx} value={idx}>
                    Ligne {idx + 1} : Matricule = "{row[matriculeColIndex] || ''}" ({row.slice(1, 4).join(', ')})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">
                Convention des valeurs d'absence
              </label>
              <select
                className="form-select"
                value={conventionMode}
                onChange={(e) => setConventionMode(e.target.value as '0_is_absent' | '1_is_absent')}
              >
                <option value="0_is_absent">0 = Absent (Vacances) / 1 = Présent / 0.5 = Demi-journée</option>
                <option value="1_is_absent">1 = Absent / 0 ou Vide = Présent / 0.5 = Demi-journée</option>
              </select>
            </div>
          </div>

          {/* Aperçu du tableau de données */}
          <div style={{ marginBottom: '12px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Aperçu des premières lignes du fichier CSV :
          </div>

          <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Ligne</th>
                  {previewData.sampleRows[0]?.slice(0, 15).map((_, cIdx) => (
                    <th
                      key={cIdx}
                      style={{
                        background: cIdx === matriculeColIndex ? 'rgba(59, 130, 246, 0.2)' : undefined,
                        color: cIdx === matriculeColIndex ? '#60a5fa' : undefined
                      }}
                    >
                      {cIdx === matriculeColIndex ? 'Col Matricule' : `Col ${cIdx + 1}`}
                    </th>
                  ))}
                  {previewData.sampleRows[0] && previewData.sampleRows[0].length > 15 && <th>...</th>}
                </tr>
              </thead>
              <tbody>
                {previewData.sampleRows.slice(0, 10).map((row, rIdx) => {
                  const isDatesRow = rIdx === datesRowIndex;
                  const isDataRow = rIdx >= startDataRowIndex;

                  return (
                    <tr
                      key={rIdx}
                      style={{
                        background: isDatesRow
                          ? 'rgba(245, 158, 11, 0.15)'
                          : isDataRow
                          ? 'rgba(16, 185, 129, 0.05)'
                          : undefined
                      }}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        {rIdx + 1} {isDatesRow && '(Dates)'} {rIdx === startDataRowIndex && '(Début)'}
                      </td>
                      {row.slice(0, 15).map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            fontWeight: cIdx === matriculeColIndex ? 600 : 'normal',
                            color: cIdx === matriculeColIndex ? '#60a5fa' : undefined
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                      {row.length > 15 && <td style={{ color: 'var(--text-muted)' }}>...</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPreviewData(null)}
              disabled={importing}
            >
              Annuler
            </button>

            <button
              className="btn btn-primary"
              onClick={handleConfirmImport}
              disabled={importing}
              style={{ padding: '10px 20px', fontSize: '0.95rem' }}
            >
              <CheckCircle2 size={18} /> {importing ? 'Importation et calculs en cours...' : 'Valider et importer les absences'}
            </button>
          </div>
        </div>
      )}

      {/* Section 3 : Rapport d'importation */}
      {importReport && (
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="card-title" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={20} /> Rapport d'importation validé avec succès
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '16px',
              marginBottom: '20px'
            }}
          >
            <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lignes traitées dans le fichier</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>
                {importReport.nombreLignesTraitees}
              </div>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Matricules reconnus dans l'application</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
                {importReport.nombreMatriculesReconnus}
              </div>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cellules non numériques/vides retenues (0)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>
                {importReport.cellulesIgnoreesOuInvalides}
              </div>
            </div>

            <div style={{ background: 'var(--surface-hover)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jours/absences enregistrés</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-light)', marginTop: '4px' }}>
                {importReport.nombreAbsencesEnregistrees}
              </div>
            </div>
          </div>

          {/* Liste des matricules non reconnus mis en évidence */}
          {importReport.matriculesNonReconnus.length > 0 ? (
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: 600 }}>
                <AlertTriangle size={18} />
                <span>
                  {importReport.matriculesNonReconnus.length} matricule(s) présent(s) dans le fichier CSV mais absent(s) du référentiel Ressources :
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Conformément aux règles métier, les lignes de ces matricules ont été ignorées lors de l'import.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {importReport.matriculesNonReconnus.map((mat) => (
                  <span
                    key={mat}
                    className="badge"
                    style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      borderColor: 'rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    {mat}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 500 }}>
              Tous les matricules du fichier CSV correspondent parfaitement au référentiel Ressources !
            </div>
          )}
        </div>
      )}

      {/* Section 4 : Tableau de Vérification de Capacité */}
      <VerifCapaciteTable />
        </>
      )}
    </div>
  );
};

