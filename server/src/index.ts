import http from 'http';
import { createApp } from './app.js';
import { setupWebSocketServer } from './ws/wsServer.js';
import { config } from './config/index.js';

const app = createApp();
const server = http.createServer(app);

// Attach WebSocket server on the same HTTP port under path /ws
setupWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`[PM Vision Server] Running on http://${config.host}:${config.port}`);
  console.log(`[PM Vision Server] WebSocket available at ws://${config.host}:${config.port}/ws`);
  console.log(`[PM Vision Server] Health check: http://${config.host}:${config.port}/api/health`);
});
