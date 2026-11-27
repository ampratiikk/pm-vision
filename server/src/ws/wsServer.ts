import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketMessage, MarketSnapshotPayload } from '@pm-vision/shared';
import crypto from 'crypto';
import { marketEngine } from '../services/marketEngine.js';

export function setupWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Start the market simulation/feed engine
  marketEngine.start();

  // Broadcast market ticks to all connected clients
  marketEngine.subscribe((payload: MarketSnapshotPayload) => {
    const tickMessage: WebSocketMessage = {
      type: 'MARKET_TICK',
      timestamp: new Date().toISOString(),
      data: payload
    };
    const serialized = JSON.stringify(tickMessage);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  });

  const syncClientCount = () => {
    let openCount = 0;
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) openCount++;
    });
    marketEngine.setActiveClientCount(openCount);
  };

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();
    (ws as any).isAlive = true;
    syncClientCount();

    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    // 1. Connection acknowledgement
    const ackMessage: WebSocketMessage = {
      type: 'CONNECT_ACK',
      clientId,
      message: 'Connected to PM Vision Real-Time Market Feed',
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(ackMessage));

    // 2. Immediately send full current market snapshot
    const snapshotMessage: WebSocketMessage = {
      type: 'MARKET_SNAPSHOT',
      timestamp: new Date().toISOString(),
      data: marketEngine.getSnapshot()
    };
    ws.send(JSON.stringify(snapshotMessage));

    ws.on('message', (data: Buffer | string) => {
      try {
        (ws as any).isAlive = true;
        const parsed = JSON.parse(data.toString()) as WebSocketMessage;

        if (parsed.type === 'PING') {
          const pongMessage: WebSocketMessage = {
            type: 'PONG',
            timestamp: new Date().toISOString()
          };
          ws.send(JSON.stringify(pongMessage));
        } else if (parsed.type === 'SUBSCRIBE' && Array.isArray((parsed as any).symbols)) {
          for (const sym of (parsed as any).symbols) {
            if (typeof sym === 'string' && sym.trim()) {
              marketEngine.addMonitoredSymbol(sym.trim());
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      syncClientCount();
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error on client ${clientId}:`, error);
    });
  });

  // Server-side keepalive ping every 25s (prevents Render.com idle connection terminations)
  const pingInterval = setInterval(() => {
    let terminated = false;
    wss.clients.forEach((client) => {
      const c = client as any;
      if (c.isAlive === false) {
        terminated = true;
        return client.terminate();
      }
      c.isAlive = false;
      try {
        client.ping();
      } catch {}
    });
    if (terminated) syncClientCount();
  }, 25000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  return wss;
}
