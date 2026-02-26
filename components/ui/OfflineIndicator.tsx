import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  showWhenOnline?: boolean;
  position?: 'top' | 'bottom';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  showWhenOnline = false,
  position = 'bottom',
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineNotice, setShowOnlineNotice] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineNotice(true);
      setTimeout(() => setShowOnlineNotice(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if online and not showing online notice
  if (isOnline && !showOnlineNotice && !showWhenOnline) return null;

  const positionClasses = position === 'top'
    ? 'top-0 left-0 right-0'
    : 'bottom-0 left-0 right-0';

  return (
    <div className={`fixed ${positionClasses} z-50`}>
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <WifiOff size={16} />
          <span>You're offline. Some features may be limited.</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 p-1 hover:bg-amber-600 rounded transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {isOnline && showOnlineNotice && (
        <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-bottom duration-300">
          <Wifi size={16} />
          <span>Back online!</span>
        </div>
      )}

      {isOnline && showWhenOnline && !showOnlineNotice && (
        <div className="bg-green-100 text-green-800 px-4 py-1 flex items-center justify-center gap-2 text-xs font-medium">
          <Wifi size={12} />
          <span>Connected</span>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
