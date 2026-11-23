import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketMessage } from '@pm-vision/shared';
import crypto from 'crypto';

export function setupWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = crypto.randomUUID();

    const ackMessage: WebSocketMessage = {
      type: 'CONNECT_ACK',
      clientId,
      message: 'Connected to PM Vision WebSocket Server',
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(ackMessage));

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
