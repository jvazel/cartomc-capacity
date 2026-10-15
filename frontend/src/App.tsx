import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { RoleModal } from './components/RoleModal';
import { DashboardPage } from './pages/DashboardPage';
import { TimelinePage } from './pages/TimelinePage';
import { RevuePortefeuillePage } from './pages/RevuePortefeuillePage';
import { RessourcesPage } from './pages/RessourcesPage';
import { AdminPage } from './pages/AdminPage';
import { AbsencesPage } from './pages/AbsencesPage';
import { ProjetsPage } from './pages/ProjetsPage';
import { TempoPage } from './pages/TempoPage';
import { AuditSnapshotPage } from './pages/AuditSnapshotPage';
import { VersionsPage } from './pages/VersionsPage';

export const AppContent: React.FC = () => {
  const { role } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [navParams, setNavParams] = useState<{ priorite?: string; b0b1?: string }>({});

  const handleNavigateWithFilter = (targetTab: string, params: { priorite?: string; b0b1?: string }) => {
    setNavParams(params);
    setCurrentTab(targetTab);
  };

  if (!role) {
    return <RoleModal />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigateWithFilter={handleNavigateWithFilter} />;
      case 'projets':
        return (
          <ProjetsPage
            initialFilterPriorite={navParams.priorite || 'Tous'}
            initialFilterStatutEst={navParams.b0b1 || 'Tous'}
          />
        );
      case 'timeline':
        return <TimelinePage />;
      case 'revue':
        return (
          <ProjetsPage
            initialFilterPriorite={navParams.priorite || 'Tous'}
            initialFilterStatutEst={navParams.b0b1 || 'Tous'}
          />
        );
      case 'audit':
        return <AuditSnapshotPage />;
      case 'tempo':
        return <TempoPage />;
      case 'versions':
        return <VersionsPage />;
      case 'ressources':
        return <RessourcesPage />;
      case 'absences':
        return <AbsencesPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-main)' }}>
              Section non encore disponible
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Cette section sera développée dans les prochaines étapes de l'application CartOMC.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
      <main className="main-content">{renderContent()}</main>
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};
