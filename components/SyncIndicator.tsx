import React, { useEffect, useState, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { subscribeSyncState, manualRetry, SyncState, SyncStatus } from '../services/syncService';

/**
 * SyncIndicator
 * Global header widget that shows:
 *  - Online/offline status
 *  - Background sync progress (X of Y)
 *  - Last sync timestamp
 *  - Manual retry button on error
 */
export const SyncIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const unsub = subscribeSyncState(setSyncState);
    return unsub;
  }, []);

  const handleRetry = useCallback(() => {
    manualRetry();
  }, []);

  if (!syncState) return null;

  const { status, pendingCount, lastSyncAt, lastError } = syncState;

  const icon = (() => {
    switch (status as SyncStatus) {
      case 'syncing':   return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case 'error':     return <AlertCircle size={14} className="text-red-500" />;
      case 'offline':   return <CloudOff size={14} className="text-amber-500" />;
      case 'idle':
      default:          return pendingCount > 0
          ? <Cloud size={14} className="text-blue-400" />
          : <CheckCircle2 size={14} className="text-emerald-500" />;
    }
  })();

  const label = (() => {
    switch (status as SyncStatus) {
      case 'syncing':  return 'Syncing…';
      case 'error':    return 'Sync error';
      case 'offline':  return 'Offline';
      case 'idle':
      default: return pendingCount > 0 ? `${pendingCount} pending` : 'Synced';
    }
  })();

  const colorCls = (() => {
    switch (status as SyncStatus) {
      case 'syncing':  return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'error':    return 'border-red-200 bg-red-50 text-red-700';
      case 'offline':  return 'border-amber-200 bg-amber-50 text-amber-700';
      default:         return pendingCount > 0
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
  })();

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetail(!showDetail)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${colorCls}`}
        title="Sync status"
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>

      {showDetail && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Sync Status</h3>
            <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>

          <div className="space-y-2 text-sm">
            <Row label="Status" value={<span className={`font-semibold capitalize ${status === 'error' ? 'text-red-600' : status === 'offline' ? 'text-amber-600' : status === 'syncing' ? 'text-blue-600' : 'text-emerald-600'}`}>{status}</span>} />
            <Row label="Pending actions" value={pendingCount.toString()} />
            <Row label="Last synced" value={lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Never'} />
            {lastError && (
              <div className="mt-2 p-2.5 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700 break-all">
                {lastError}
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRetry}
              disabled={status === 'syncing' || status === 'offline'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={12} className={status === 'syncing' ? 'animate-spin' : ''} />
              Retry Now
            </button>
            {status === 'offline' && (
              <span className="text-xs text-amber-600 self-center">Changes will sync when back online.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-center border-b border-gray-50 pb-1.5 last:border-0">
    <span className="text-gray-500">{label}</span>
    <span className="text-gray-900 font-medium">{value}</span>
  </div>
);
