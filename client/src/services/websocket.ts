import { WebSocketMessage } from '@pm-vision/shared';

export interface WebSocketCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

export interface WebSocketClient {
  sendPing: () => void;
  subscribe: (symbols: string[]) => void;
  close: () => void;
}

export function createWebSocketConnection(callbacks: WebSocketCallbacks): WebSocketClient {
  let socket: WebSocket | null = null;
  let isClosedExplicitly = false;
  let reconnectAttempts = 0;
  let reconnectTimer: any = null;
  let pingTimer: any = null;
  const subscribedSymbols = new Set<string>();

  const getWsUrl = (): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  };

  const send = (msg: object) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(msg));
      } catch (e) {
        console.warn('[WebSocket] Send failed:', e);
      }
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    pingTimer = setInterval(() => {
      send({ type: 'PING', timestamp: new Date().toISOString() });
    }, 20000);
  };

  const stopHeartbeat = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const connect = () => {
    if (isClosedExplicitly) return;

    try {
      const wsUrl = getWsUrl();
      socket = new WebSocket(wsUrl);

      socket.addEventListener('open', () => {
        reconnectAttempts = 0;
        startHeartbeat();
        callbacks.onOpen?.();

        // Resubscribe active symbols on connection / reconnection
        if (subscribedSymbols.size > 0) {
          send({
            type: 'SUBSCRIBE',
            symbols: Array.from(subscribedSymbols),
            timestamp: new Date().toISOString()
          });
        }
      });

      socket.addEventListener('close', () => {
        stopHeartbeat();
        callbacks.onClose?.();
        scheduleReconnect();
      });

      socket.addEventListener('error', (event) => {
        callbacks.onError?.(event);
      });

      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          callbacks.onMessage?.(data);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      });
    } catch (err) {
      console.warn('[WebSocket] Connection creation error:', err);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (isClosedExplicitly) return;
    if (reconnectTimer) return;

    reconnectAttempts++;
    // Exponential backoff: 1.5s, 3s, 4.5s, max 10s
    const delay = Math.min(10000, Math.round(1500 * Math.pow(1.3, reconnectAttempts - 1)));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  connect();

  return {
    sendPing: () => {
      send({ type: 'PING', timestamp: new Date().toISOString() });
    },
    subscribe: (symbols: string[]) => {
      symbols.forEach((s) => subscribedSymbols.add(s));
      send({
        type: 'SUBSCRIBE',
        symbols,
        timestamp: new Date().toISOString()
      });
    },
    close: () => {
      isClosedExplicitly = true;
      stopHeartbeat();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
    }
  };
}
