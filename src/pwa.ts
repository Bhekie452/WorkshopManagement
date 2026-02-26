import { processPendingActions, registerOfflineQueueAutoSync } from '../services/offlineQueue';

export function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    if (!import.meta.env.PROD) {
        // Avoid caching and HMR websocket issues during development.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => registration.unregister());
        });
        return;
    }

    window.addEventListener('load', () => {
        const stopAutoSync = registerOfflineQueueAutoSync();

        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);

                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data?.type === 'PROCESS_OFFLINE_QUEUE') {
                        processPendingActions().catch(() => undefined);
                    }
                });

                processPendingActions().catch(() => undefined);
            }, (err) => {
                console.log('ServiceWorker registration failed: ', err);
            });

        window.addEventListener('beforeunload', () => {
            stopAutoSync();
        }, { once: true });
    });
}
