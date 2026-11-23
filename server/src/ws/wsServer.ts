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

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();

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
        const parsed = JSON.parse(data.toString()) as WebSocketMessage;

        if (parsed.type === 'PING') {
          const pongMessage: WebSocketMessage = {
            type: 'PONG',
            timestamp: new Date().toISOString()
          };
          ws.send(JSON.stringify(pongMessage));
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      // Clean connection close
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error on client ${clientId}:`, error);
    });
  });

  return wss;
}
