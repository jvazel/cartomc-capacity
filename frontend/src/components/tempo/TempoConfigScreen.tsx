import React, { useState, useEffect } from 'react';
import { Settings, Users, Save, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { ICustomFieldMapping, ICollaboratorConfig } from '../../types/tempo';

export const TempoConfigScreen: React.FC = () => {
  const [customFields, setCustomFields] = useState<ICustomFieldMapping>({
    budgetLine: 'customfield_10101',
    category: 'customfield_10102',
    lot: 'customfield_10103',
    featureId: 'customfield_10104',
    businessChange: 'customfield_10105'
  });

  const [collaborators, setCollaborators] = useState<ICollaboratorConfig[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ICollaboratorConfig['type']>('INT');
  const [newRole, setNewRole] = useState<ICollaboratorConfig['role']>('DEV Back');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/tempo/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.customFields) setCustomFields(data.customFields);
        if (data.collaborators) setCollaborators(data.collaborators);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Impossible de charger la configuration depuis le serveur.' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('http://localhost:4000/api/tempo/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customFields, collaborators })
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      setMessage({ type: 'success', text: 'Configuration enregistrée avec succès !' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Échec de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCollaborator = () => {
    if (!newName.trim()) return;
    setCollaborators((prev) => [
      ...prev,
      { name: newName.trim(), type: newType, role: newRole }
    ]);
    setNewName('');
  };

  const handleRemoveCollaborator = (index: number) => {
    setCollaborators((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="card" style={{ padding: '32px', textAlign: 'center' }}>Chargement de la configuration...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {message && (
        <div
          className="card"
          style={{
            padding: '12px 16px',
            marginBottom: 0,
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: message.type === 'success' ? '#34d399' : '#f87171',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Customfield Mapping section */}
      <div className="card">
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} color="var(--primary)" />
            <span>Mapping des champs personnalisés Jira (Customfields)</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              budgetLine Field ID
            </label>
            <input
              type="text"
              value={customFields.budgetLine}
              onChange={(e) => setCustomFields({ ...customFields, budgetLine: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              category Field ID
            </label>
            <input
              type="text"
              value={customFields.category}
              onChange={(e) => setCustomFields({ ...customFields, category: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              lot Field ID
            </label>
            <input
              type="text"
              value={customFields.lot}
              onChange={(e) => setCustomFields({ ...customFields, lot: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              featureId Field ID
            </label>
            <input
              type="text"
              value={customFields.featureId}
              onChange={(e) => setCustomFields({ ...customFields, featureId: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              businessChange Field ID
            </label>
            <input
              type="text"
              value={customFields.businessChange}
              onChange={(e) => setCustomFields({ ...customFields, businessChange: e.target.value })}
              className="form-input"
            />
          </div>
        </div>
      </div>

      {/* Collaborators Directory section */}
      <div className="card">
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="var(--primary)" />
            <span>Annuaire des collaborateurs ({collaborators.length})</span>
          </div>
        </div>

        {/* Add new collaborator form */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '180px', margin: 0 }}>
            <label className="form-label">
              Nom du collaborateur Jira
            </label>
            <input
              type="text"
              placeholder="ex: Jean Dupont"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '120px', margin: 0 }}>
            <label className="form-label">
              Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="form-select"
            >
              <option value="INT">INT (Interne)</option>
              <option value="EXT">EXT (Externe)</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '140px', margin: 0 }}>
            <label className="form-label">
              Rôle
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              className="form-select"
            >
              <option value="DEV Back">DEV Back</option>
              <option value="PIL">PIL</option>
              <option value="QA">QA</option>
              <option value="BA">BA</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleAddCollaborator}
            className="btn btn-secondary"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>

        {/* Collaborators list table */}
        <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nom du collaborateur</th>
                <th style={{ width: '150px' }}>Type</th>
                <th style={{ width: '170px' }}>Rôle</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {collaborators.map((collab, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{collab.name}</td>
                  <td>
                    <select
                      value={collab.type}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCollaborators((prev) => prev.map((c, i) => (i === idx ? { ...c, type: val } : c)));
                      }}
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                    >
                      <option value="INT">INT</option>
                      <option value="EXT">EXT</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={collab.role}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCollaborators((prev) => prev.map((c, i) => (i === idx ? { ...c, role: val } : c)));
                      }}
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                    >
                      <option value="DEV Back">DEV Back</option>
                      <option value="PIL">PIL</option>
                      <option value="QA">QA</option>
                      <option value="BA">BA</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleRemoveCollaborator(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {collaborators.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Aucun collaborateur répertorié pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '10px 24px' }}
        >
          <Save size={18} />
          {saving ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </button>
      </div>
    </div>
  );
};
