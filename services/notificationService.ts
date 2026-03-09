import { store } from './store';
import { InAppNotification } from '../types';

class NotificationService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private onNotificationCallback: ((n: InAppNotification) => void) | null = null;

  connect(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = import.meta.env.VITE_API_URL || 'localhost:8000';
    host = host.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${host}/api/ws/${userId}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[NotificationService] Connected to WebSocket');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            const notification = store.addNotification(data.payload);
            if (this.onNotificationCallback) {
              this.onNotificationCallback(notification);
            }
          }
        } catch (err) {
          console.error('[NotificationService] Error parsing WS message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[NotificationService] WebSocket closed');
        this.attemptReconnect(userId);
      };

      this.ws.onerror = (error) => {
        console.error('[NotificationService] WebSocket error:', error);
      };
    } catch (err) {
      console.error('[NotificationService] Connection failed:', err);
      this.attemptReconnect(userId);
    }
  }

  private attemptReconnect(userId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[NotificationService] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      setTimeout(() => this.connect(userId), this.reconnectInterval);
    }
  }

  onNotification(callback: (n: InAppNotification) => void) {
    this.onNotificationCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const notificationService = new NotificationService();
