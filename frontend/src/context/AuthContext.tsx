import React, { createContext, useContext, useState } from 'react';
import { UserRole, IRessource } from '../types';

interface AuthContextType {
  role: UserRole | null;
  leadBARessource: IRessource | null;
  setAuth: (role: UserRole, ressource?: IRessource | null) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [leadBARessource, setLeadBARessource] = useState<IRessource | null>(null);

  const setAuth = (newRole: UserRole, ressource: IRessource | null = null) => {
    setRole(newRole);
    setLeadBARessource(newRole === 'LeadBA' ? ressource : null);
  };

  const clearAuth = () => {
    setRole(null);
    setLeadBARessource(null);
  };

  return (
    <AuthContext.Provider value={{ role, leadBARessource, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
};
