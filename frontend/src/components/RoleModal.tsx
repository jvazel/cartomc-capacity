import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserRole, IRessource } from '../types';
import { Shield, UserCheck, Eye, ArrowRight, User } from 'lucide-react';

export const RoleModal: React.FC = () => {
  const { setAuth } = useAuth();
  const { showSuccess } = useToast();
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin');
  const [leadBAs, setLeadBAs] = useState<IRessource[]>([]);
  const [selectedBAId, setSelectedBAId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // Charger la liste des ressources pour sélectionner le Lead BA si besoin
    fetch('/api/ressources')
      .then((res) => res.json())
      .then((data: IRessource[]) => {
        const bas = data.filter((r) => r.estLeadBA && r.actif);
        setLeadBAs(bas);
        if (bas.length > 0) {
          setSelectedBAId(bas[0]._id);
        }
      })
      .catch((err) => console.error('Erreur chargement ressources:', err));
  }, []);

  const handleConfirm = () => {
    if (selectedRole === 'LeadBA') {
      const selectedBA = leadBAs.find((b) => b._id === selectedBAId) || null;
      setAuth('LeadBA', selectedBA);
      showSuccess(`Bienvenue ! Rôle activé : Lead BA (${selectedBA?.nom || 'Non assigné'})`);
    } else {
      setAuth(selectedRole);
      showSuccess(`Bienvenue ! Rôle activé : ${selectedRole === 'Admin' ? 'Administrateur' : 'Lecteur'}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
          Bienvenue sur CartOMC
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Veuillez sélectionner votre rôle pour cette session :
        </p>

        <div
          className={`role-option ${selectedRole === 'Admin' ? 'selected' : ''}`}
          onClick={() => setSelectedRole('Admin')}
        >
          <Shield className="role-icon" size={24} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              Administrateur / Manager
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Accès complet (gestion du référentiel, configuration, projets).
            </div>
          </div>
        </div>

        <div
          className={`role-option ${selectedRole === 'LeadBA' ? 'selected' : ''}`}
          onClick={() => setSelectedRole('LeadBA')}
        >
          <UserCheck className="role-icon" size={24} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lead BA</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Saisie des estimations (B0/B1) et gestion de ses projets.
            </div>
          </div>
        </div>

        {selectedRole === 'LeadBA' && (
          <div style={{ marginLeft: '36px', marginBottom: '16px' }}>
            <label className="form-label">Sélectionner votre profil BA :</label>
            {leadBAs.length > 0 ? (
              <select
                className="form-select"
                style={{ width: '100%' }}
                value={selectedBAId}
                onChange={(e) => setSelectedBAId(e.target.value)}
              >
                {leadBAs.map((ba) => (
                  <option key={ba._id} value={ba._id}>
                    {ba.nom} ({ba.matricule})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px' }}>
                Aucune ressource marquée comme Lead BA n'existe actuellement. Vous pourrez naviguer mais non assigné.
              </div>
            )}
          </div>
        )}

        <div
          className={`role-option ${selectedRole === 'Lecteur' ? 'selected' : ''}`}
          onClick={() => setSelectedRole('Lecteur')}
        >
          <Eye className="role-icon" size={24} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lecteur</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Consultation seule de la capacité et du portefeuille.
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '16px', padding: '12px' }}
          onClick={handleConfirm}
        >
          Accéder à l'application <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
