import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  KanbanSquare,
  Users,
  Settings,
  RefreshCw,
  UserCheck,
  Clock,
  History,
  Milestone
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { role, leadBARessource, clearAuth } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'projets', label: 'Portefeuille projets', icon: FolderKanban },
    { id: 'timeline', label: 'Timeline', icon: CalendarDays },
    { id: 'audit', label: 'Historique & Baselines', icon: History },
    { id: 'tempo', label: 'Temps Tempo Jira', icon: Clock },
    { id: 'versions', label: 'Suivi des versions', icon: Milestone },
    { id: 'ressources', label: 'Ressources', icon: Users },
    { id: 'absences', label: 'Gestion des absences', icon: UserCheck },
    { id: 'admin', label: 'Administration', icon: Settings }
  ];

  const getRoleLabel = () => {
    switch (role) {
      case 'Admin':
        return 'Administrateur / Manager';
      case 'LeadBA':
        return `Lead BA : ${leadBARessource ? leadBARessource.nom : 'Non sélectionné'}`;
      case 'Lecteur':
        return 'Lecteur (Lecture seule)';
      default:
        return '';
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">CartOMC Capacity</div>
      </div>

      <ul className="nav-list">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectTab(item.id);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <div className="user-badge-bar">
        <div className="user-info">
          <span className="user-role-title">Rôle actuel</span>
          <span className="user-name">{getRoleLabel()}</span>
        </div>
        <button className="btn-change-role" onClick={clearAuth}>
          <RefreshCw size={14} /> Changer de rôle
        </button>
      </div>
    </aside>
  );
};
