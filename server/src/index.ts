import './config/index.js';
import http from 'http';
import { createApp } from './app.js';
import { setupWebSocketServer } from './ws/wsServer.js';
import { config } from './config/index.js';
import { FyersAutoLoginService } from './services/broker/FyersAutoLoginService.js';
import { marketEngine } from './services/marketEngine.js';
import { isIndianMarketOpen } from '@pm-vision/shared';

const app = createApp();
const server = http.createServer(app);

// Attach WebSocket server on the same HTTP port under path /ws
setupWebSocketServer(server);

// Background check: Automated Morning Headless Login (Method 2)
async function checkAndRunAutoLogin() {
  const pin = process.env.FYERS_PIN;
  const totpKey = process.env.FYERS_TOTP_KEY;
  if (!pin || !totpKey) return;

  // Check if broker is currently disconnected or token expired
  if (!marketEngine.isBrokerConnected()) {
    console.log('[AutoLogin] Broker disconnected. Attempting automated headless TOTP login...');
    try {
      const result = await FyersAutoLoginService.executeAutoLogin();
      if (result.success && result.accessToken) {
        await marketEngine.updateBrokerToken(result.accessToken);
        console.log('[AutoLogin] Headless login succeeded and broker reconnected!');
      } else {
        console.warn('[AutoLogin] Headless login failed:', result.message);
      }
    } catch (e) {
      console.error('[AutoLogin] Headless login exception:', e);
    }
  }
}

// Run 5 seconds after boot, then check every 15 minutes
setTimeout(checkAndRunAutoLogin, 5000);
setInterval(checkAndRunAutoLogin, 15 * 60 * 1000);

server.listen(config.port, () => {
  console.log(`[PM Vision Server] Running on http://${config.host}:${config.port}`);
  console.log(`[PM Vision Server] WebSocket available at ws://${config.host}:${config.port}/ws`);
  console.log(`[PM Vision Server] Health check: http://${config.host}:${config.port}/api/health`);
});
