/**
 * useRealtimeSync
 * ---------------
 * React hook that connects to the backend WebSocket for real-time push updates.
 * The backend broadcasts events like:
 *   { event: 'job_updated',     data: { job } }
 *   { event: 'invoice_updated', data: { invoice } }
 *   { event: 'part_updated',    data: { part } }
 *
 * The hook:
 *  - Auto-connects on mount
 *  - Exponential back-off reconnect on disconnect (max 30s)
 *  - Calls a user-provided onMessage handler
 *  - Exposes connection state: 'connecting' | 'connected' | 'disconnected'
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type WsConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  event: string;
  data: any;
}

interface UseRealtimeSyncOptions {
  /** Called whenever a message arrives from the server. */
  onMessage?: (msg: WsMessage) => void;
  /** Disable connection entirely (e.g., user not logged in). */
  disabled?: boolean;
}

const MAX_BACKOFF_MS = 30_000;

export function useRealtimeSync({ onMessage, disabled = false }: UseRealtimeSyncOptions = {}) {
  const [connectionState, setConnectionState] = useState<WsConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (disabled) return;

    let token = localStorage.getItem('auth_token');
    if (!token) {
      const session = localStorage.getItem('customAuthSession');
      if (session) {
        try {
          token = JSON.parse(session).accessToken;
        } catch (e) {}
      }
    }
    if (!token) return;

    // Construct WS URL from the current API origin
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const url = `${proto}://${host}/api/ws?token=${encodeURIComponent(token)}`;

    setConnectionState('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('connected');
      attemptsRef.current = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WsMessage = JSON.parse(ev.data);
        onMessageRef.current?.(msg);
      } catch {
        // malformed message — ignore
      }
    };

    ws.onerror = () => {
      // onclose always fires after onerror
    };

    ws.onclose = () => {
      wsRef.current = null;
      setConnectionState('disconnected');

      if (!disabled) {
        // Exponential back-off: 1s, 2s, 4s, 8s, 16s, 30s cap
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, attemptsRef.current));
        attemptsRef.current += 1;
        retryRef.current = setTimeout(connect, delay);
      }
    };
  }, [disabled]);

  useEffect(() => {
    if (disabled) {
      wsRef.current?.close();
      return;
    }
    connect();
    return () => {
      disabled || wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect, disabled]);

  /** Send a message to the server (fire-and-forget). */
  const sendMessage = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connectionState, sendMessage };
}
