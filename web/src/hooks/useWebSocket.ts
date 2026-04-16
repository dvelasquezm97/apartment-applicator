import { useState, useEffect, useRef, useCallback } from 'react';

// Mirror the backend DashboardUpdate types
export interface ProgressUpdate {
  type: 'progress';
  status: 'idle' | 'scraping' | 'applying' | 'paused' | 'done';
  applied: number;
  failed: number;
  skipped: number;
  total: number;
  currentListing: string | null;
}

export interface ListingResultUpdate {
  type: 'listing-result';
  listingId: string;
  title: string;
  status: 'success' | 'failed' | 'skipped' | 'already-applied';
  reason?: string;
}

type DashboardMessage = ProgressUpdate | ListingResultUpdate;

interface UseWebSocketReturn {
  progress: ProgressUpdate;
  listingResults: ListingResultUpdate[];
  connected: boolean;
  clearResults: () => void;
}

const DEFAULT_PROGRESS: ProgressUpdate = {
  type: 'progress',
  status: 'idle',
  applied: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  currentListing: null,
};

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_HOST = import.meta.env.DEV ? `${window.location.hostname}:3000` : window.location.host;
const WS_URL = `${WS_PROTOCOL}//${WS_HOST}/ws?role=dashboard&token=dev-token&userId=00000000-0000-0000-0000-000000000001`;

const RECONNECT_DELAY_MS = 3000;

export function useWebSocket(): UseWebSocketReturn {
  const [progress, setProgress] = useState<ProgressUpdate>(DEFAULT_PROGRESS);
  const [listingResults, setListingResults] = useState<ListingResultUpdate[]>([]);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearResults = useCallback(() => {
    setListingResults([]);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg: DashboardMessage = JSON.parse(event.data);
          if (msg.type === 'progress') {
            setProgress(msg);
          } else if (msg.type === 'listing-result') {
            setListingResults((prev) => [...prev, msg]);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        // onclose will fire after onerror — reconnect is handled there
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { progress, listingResults, connected, clearResults };
}
