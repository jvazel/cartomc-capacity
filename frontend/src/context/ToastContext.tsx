import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  showSuccess: (message: string) => void;
  showDanger: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const showDanger = useCallback((message: string) => showToast(message, 'danger'), [showToast]);
  const showWarning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);
  const showInfo = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        showSuccess,
        showDanger,
        showWarning,
        showInfo
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit être utilisé à l'intérieur d'un ToastProvider");
  }
  return context;
};
