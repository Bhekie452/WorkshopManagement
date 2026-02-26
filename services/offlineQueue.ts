export interface PendingAction {
  id?: number;
  type: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  createdAt: number;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
}

const DB_NAME = 'wms-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-actions';
const SYNC_TAG = 'wms-sync';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = operation(store);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const getRetryDelay = (attempts: number): number => {
  const base = 30 * 1000;
  const max = 12 * 60 * 60 * 1000;
  return Math.min(max, base * 2 ** Math.max(0, attempts - 1));
};

export const addPendingAction = async (
  action: Omit<PendingAction, 'id' | 'createdAt' | 'attempts' | 'nextRetryAt'>
): Promise<number> => {
  const record: PendingAction = {
    ...action,
    createdAt: Date.now(),
    attempts: 0,
    nextRetryAt: Date.now(),
  };

  const key = await withStore<IDBValidKey>('readwrite', (store) => store.add(record));
  const id = typeof key === 'number' ? key : Number(key);
  await registerBackgroundSync();
  return id;
};

const getAllPendingActions = async (): Promise<PendingAction[]> => {
  const actions = await withStore<PendingAction[]>('readonly', (store) => store.getAll());
  return actions || [];
};

const removePendingAction = async (id: number): Promise<void> => {
  await withStore('readwrite', (store) => store.delete(id));
};

const updatePendingAction = async (action: PendingAction): Promise<void> => {
  await withStore('readwrite', (store) => store.put(action));
};

export const processPendingActions = async (): Promise<void> => {
  if (!navigator.onLine) return;

  const now = Date.now();
  const actions = await getAllPendingActions();
  const dueActions = actions
    .filter((action) => action.nextRetryAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const action of dueActions) {
    if (!action.id) continue;

    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await removePendingAction(action.id);
    } catch (error: any) {
      const attempts = action.attempts + 1;
      const nextRetryAt = Date.now() + getRetryDelay(attempts);
      await updatePendingAction({
        ...action,
        attempts,
        nextRetryAt,
        lastError: error?.message || 'Request failed',
      });
    }
  }
};

export const registerBackgroundSync = async (): Promise<void> => {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(SYNC_TAG);
    }
  } catch {
    // Ignore unsupported browser or registration issues.
  }
};

export const registerOfflineQueueAutoSync = (): (() => void) => {
  const handleOnline = () => {
    processPendingActions().catch(() => undefined);
  };

  window.addEventListener('online', handleOnline);
  processPendingActions().catch(() => undefined);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
};
