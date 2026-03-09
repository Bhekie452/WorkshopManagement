import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Toast, ToastType } from './ui/Toast';
import { InAppNotification } from '../types';


interface ToastContextType {
  showToast: (message: string, type: ToastType, options?: { sound?: boolean; push?: boolean, title?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.3;
      audio.play();
    } catch (err) {
      console.warn('Failed to play sound:', err);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      return Notification.permission === 'granted';
    }
    return false;
  }, []);

  const showToast = useCallback(async (message: string, type: ToastType, options?: { sound?: boolean; push?: boolean, title?: string }) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (options?.sound !== false) {
      playNotificationSound();
    }

    if (options?.push && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(options.title || 'Workshop Management', {
        body: message,
        icon: '/logo192.png'
      });
    }
  }, [playNotificationSound]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleAppNotification = (event: Event) => {
      const customEvent = event as CustomEvent<InAppNotification>;
      const n = customEvent.detail;
      showToast(n.message || n.title, (n.type as ToastType) || 'info', { sound: true, push: true, title: n.title });
    };

    window.addEventListener('app-notification', handleAppNotification);
    return () => window.removeEventListener('app-notification', handleAppNotification);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <button 
        onClick={requestNotificationPermission}
        className="fixed bottom-4 left-4 z-50 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-full text-[10px] text-white/50 hover:text-white transition-all pointer-events-auto"
        title="Enable Browser Notifications"
      >
        Push
      </button>
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end max-w-md w-full pointer-events-none">
        <div className="pointer-events-auto">
          {toasts.map((toast) => (
            <Toast 
              key={toast.id}
              id={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={hideToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
