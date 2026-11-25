import { Router, Request, Response } from 'express';
import { marketEngine } from '../services/marketEngine.js';
import { isIndianMarketOpen, getMarketSessionInfo } from '@pm-vision/shared';
import { FyersAutoLoginService } from '../services/broker/FyersAutoLoginService.js';
import { symbolMaster } from '../services/broker/SymbolMasterService.js';

export const marketRouter = Router();

// GET /api/market/instruments (Full NSE Cash Equities, Indices, F&O Stocks, and Futures Contracts)
marketRouter.get('/instruments', async (_req: Request, res: Response) => {
  try {
    await symbolMaster.ensureLoaded();
    const catalog = symbolMaster.getCatalog();
    res.json({
      status: 'ok',
      ...catalog
    });
  } catch (err: any) {
    console.error('Error in /api/market/instruments:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Failed to load instruments' });
  }
});

// GET /api/market/quotes?symbols=RELIANCE,RELIANCE1!,NIFTY26DECFUT
marketRouter.get('/quotes', async (req: Request, res: Response) => {
  const symbolsParam = (req.query.symbols as string) || '';
  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const quotes = await marketEngine.fetchOnDemandQuotes(symbols);
    res.json({
      status: 'ok',
      isBrokerConnected: marketEngine.isBrokerConnected(),
      quotes
    });
  } catch (err: any) {
    console.error('Error in /api/market/quotes:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch quotes' });
  }
});

// GET /api/market/history?resolution=15m|30m|1H|1D&symbol=RELIANCE|NIFTY 50|RELIANCE1!
marketRouter.get('/history', async (req: Request, res: Response) => {
  const resolution = (req.query.resolution as string) || '15m';
  const symbol = (req.query.symbol as string) || 'NIFTY 50';
  try {
    const result = await marketEngine.fetchHistory(resolution, symbol);

    res.json({
      status: 'ok',
      symbol,
      resolution,
      count: result.candles.length,
      source: result.source,
      requiresBroker: Boolean(result.requiresBroker),
      isBrokerConnected: marketEngine.isBrokerConnected(),
      casPrice: result.casPrice && result.casPrice > 0 ? result.casPrice : undefined,
      candles: result.candles
    });
  } catch (err: any) {
    console.error('Error in /api/market/history:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch history' });
  }
});

// GET /api/market/option-chain?expiry=timestamp
marketRouter.get('/option-chain', async (req: Request, res: Response) => {
  const expiry = req.query.expiry as string | undefined;
  try {
    if (expiry) {
      const data = await marketEngine.changeOptionExpiry(expiry);
      res.json({ status: 'ok', data });
    } else {
      const snapshot = marketEngine.getSnapshot();
      res.json({ status: 'ok', data: snapshot });
    }
  } catch (err: any) {
    console.error('Error in /api/market/option-chain:', err);
    res.status(500).json({ status: 'error', message: err?.message || 'Failed to fetch option chain' });
  }
});

// GET /api/market/status
marketRouter.get('/status', (_req: Request, res: Response) => {
  const session = getMarketSessionInfo();
  res.json({
    status: 'ok',
    marketStatus: isIndianMarketOpen() ? 'OPEN' : 'CLOSED',
    session,
    isBrokerConnected: marketEngine.isBrokerConnected(),
    timestamp: new Date().toISOString()
  });
});

// POST /api/market/broker-token (Quick Update & Reconnect)
marketRouter.post('/broker-token', async (req: Request, res: Response) => {
  const { token, authCode } = req.body || {};
  const input = token || authCode;
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Token or auth code is required.' });
  }

  try {
    const result = await marketEngine.updateBrokerToken(input);
    if (result.success) {
      res.json({
        status: 'ok',
        connected: true,
        message: result.message,
        spotPrice: result.spotPrice
      });
    } else {
      res.status(400).json({
        status: 'error',
        connected: false,
        message: result.message
      });
    }
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      connected: false,
      message: err?.message || 'Failed to authenticate token.'
    });
  }
});

// POST /api/market/auto-login (Method 2: Headless TOTP Auto-Login)
marketRouter.post('/auto-login', async (req: Request, res: Response) => {
  const { fyId, pin, totpKey } = req.body || {};

  if (pin) process.env.FYERS_PIN = pin;
  if (totpKey) process.env.FYERS_TOTP_KEY = totpKey;
  if (fyId) process.env.FYERS_USER_ID = fyId;

  try {
    const result = await FyersAutoLoginService.executeAutoLogin({
      fyId,
      pin,
      totpKey
    });

    if (result.success && result.accessToken) {
      const brokerRes = await marketEngine.updateBrokerToken(result.accessToken);
      res.json({
        status: 'ok',
        connected: true,
        message: 'Headless auto-login successful! Connected to FYERS.',
        spotPrice: brokerRes.spotPrice
      });
    } else {
      res.status(400).json({
        status: 'error',
        connected: false,
        message: result.message
      });
    }
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      connected: false,
      message: err?.message || 'Headless login failed'
    });
  }
});

// GET /api/market/fyers-login-url
marketRouter.get('/fyers-login-url', (_req: Request, res: Response) => {
  const appId = process.env.FYERS_APP_ID || 'R3ZD795FUR-100';
  const redirectUri = process.env.FYERS_REDIRECT_URI || 'https://trade.fyers.in/api-login/redirect-uri/index.html';
  const loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=pmvision`;
  res.json({
    status: 'ok',
    loginUrl,
    appId,
    redirectUri
  });
});

// GET /api/market/fyers-callback (Seamless 1-Click OAuth Redirect)
marketRouter.get('/fyers-callback', async (req: Request, res: Response) => {
  const authCode = (req.query.auth_code || req.query.code) as string | undefined;
  if (!authCode) {
    return res.redirect('/?fyers_error=missing_code');
  }

  try {
    const result = await marketEngine.updateBrokerToken(authCode);
    if (result.success) {
      return res.redirect('/?fyers=connected');
    } else {
      return res.redirect(`/?fyers_error=${encodeURIComponent(result.message)}`);
    }
  } catch (err: any) {
    return res.redirect(`/?fyers_error=${encodeURIComponent(err?.message || 'auth_failed')}`);
  }
});
