import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, onClose, duration]);

  const variants = {
    success: {
      icon: <CheckCircle className="text-emerald-500" size={20} />,
      bg: 'bg-white/90 border-emerald-500/30 shadow-emerald-500/10',
      accent: 'bg-emerald-500'
    },
    warning: {
      icon: <AlertTriangle className="text-amber-500" size={20} />,
      bg: 'bg-white/90 border-amber-500/30 shadow-amber-500/10',
      accent: 'bg-amber-500'
    },
    error: {
      icon: <AlertCircle className="text-rose-500" size={20} />,
      bg: 'bg-white/90 border-rose-500/30 shadow-rose-500/10',
      accent: 'bg-rose-500'
    },
    info: {
      icon: <Info className="text-indigo-500" size={20} />,
      bg: 'bg-white/90 border-indigo-500/30 shadow-indigo-500/10',
      accent: 'bg-indigo-500'
    }
  };

  const { icon, bg, accent } = variants[type];

  return (
    <div className={`relative flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-right-full duration-500 mb-3 overflow-hidden ${bg}`}>
      {/* Accent Bar */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${accent}`} />
      
      <div className="flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 text-sm font-semibold text-gray-800">
        {message}
      </div>
      <button 
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-full transition-all"
      >
        <X size={16} />
      </button>

      {/* Auto-dismiss progress bar */}
      <div 
        className={`absolute bottom-0 left-0 h-0.5 opacity-30 ${accent} transition-all duration-linear`}
        style={{ 
          width: '100%', 
          animation: `toast-progress ${duration}ms linear forwards` 
        }}
      />
    </div>
  );
};
