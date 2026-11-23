import { WebSocketMessage } from '@pm-vision/shared';

export interface WebSocketCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

export function createWebSocketConnection(callbacks: WebSocketCallbacks): {
  sendPing: () => void;
  close: () => void;
} {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  const socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    callbacks.onOpen?.();
  });

  socket.addEventListener('close', () => {
    callbacks.onClose?.();
  });

  socket.addEventListener('error', (event) => {
    callbacks.onError?.(event);
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data) as WebSocketMessage;
      callbacks.onMessage?.(data);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  });

  return {
    sendPing: () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
      }
    },
    close: () => {
      socket.close();
    }
  };
}
