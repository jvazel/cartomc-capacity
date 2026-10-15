import React from 'react';
import { useToast, ToastItem } from '../context/ToastContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />;
      case 'danger':
        return <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />;
      case 'info':
      default:
        return <Info size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.4)';
      case 'danger':
        return 'rgba(239, 68, 68, 0.4)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.4)';
      case 'info':
      default:
        return 'rgba(59, 130, 246, 0.4)';
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast: ToastItem) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type}`}
          style={{ borderColor: getBorderColor(toast.type) }}
        >
          {getIcon(toast.type)}
          <div className="toast-message">{toast.message}</div>
          <button
            className="toast-close-btn"
            onClick={() => removeToast(toast.id)}
            title="Fermer la notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
