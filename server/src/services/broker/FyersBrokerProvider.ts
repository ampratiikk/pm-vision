import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { IBrokerProvider, BrokerCredentials, TickCallback } from './IBrokerProvider.js';
import { MarketTick, OptionRow, ExpiryOption, ChartCandleTick, isIndianMarketOpen } from '@pm-vision/shared';
import { symbolMaster } from './SymbolMasterService.js';

const require = createRequire(import.meta.url);

export { isIndianMarketOpen };

export interface FyersOptionChainResult {
  spotPrice: number;
  futPrice: number;
  expiries: ExpiryOption[];
  selectedExpiry: string;
  rows: OptionRow[];
}

export class FyersBrokerProvider implements IBrokerProvider {
  public readonly name = 'Primary Market Feed API v3';
  private connected: boolean = false;
  private tickCallback: TickCallback | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private appId: string = '';
  private accessToken: string = '';

  // Real-time streaming socket (zero REST quota consumption per tick)
  private dataSocket: any = null;
  private socketConnected: boolean = false;
  private lastSocketTickAt: number = 0;
  private socketReconnectTimer: NodeJS.Timeout | null = null;

  // Rate-limit tracking & exponential backoff (HTTP 429 / code -360 protection)
  private rateLimitedUntil: number = 0;
  private rateLimitStrikes: number = 0;

  // Short-lived history cache + in-flight dedup to conserve Data API daily quota
  private historyCache: Map<string, { ts: number; data: ChartCandleTick[] }> = new Map();
  private historyInFlight: Map<string, Promise<ChartCandleTick[]>> = new Map();

  public isConnected(): boolean {
    return this.connected;
  }

  public isSocketConnected(): boolean {
    return this.socketConnected;
  }

  public getLastSocketTickAt(): number {
    return this.lastSocketTickAt;
  }

  public isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  public getRateLimitedUntil(): number {
    return this.rateLimitedUntil;
  }

  public getAccessToken(): string {
    return this.accessToken;
  }

  private checkAuthError(status: number, json: any): boolean {
    if (
      status === 401 ||
      status === 403 ||
      json?.code === -16 ||
      json?.code === -17 ||
      json?.code === -15 ||
      json?.code === -8 ||
      (typeof json?.message === 'string' && /token.*expir|invalid.*token|unauthorized/i.test(json.message))
    ) {
      if (this.connected) {
        console.warn('[Feed Provider] Session/Token expired or unauthorized:', json?.message || status);
      }
      this.connected = false;
      this.stopDataSocket();
      return true;
    }
    return false;
  }

  private checkRateLimit(status: number, json: any): boolean {
    if (
      status === 429 ||
      json?.code === -360 ||
      json?.code === 429 ||
      (typeof json?.message === 'string' && /rate.?limit|too many request|limit exceed|daily.*limit/i.test(json.message))
    ) {
      this.rateLimitStrikes = Math.min(this.rateLimitStrikes + 1, 6);
      const backoffMs = Math.min(5 * 60_000, 30_000 * Math.pow(2, this.rateLimitStrikes - 1));
      this.rateLimitedUntil = Date.now() + backoffMs;
      console.warn(`[Feed Provider] REST API rate-limited (status=${status}, code=${json?.code}). Backing off for ${Math.round(backoffMs / 1000)}s.`);
      return true;
    }
    return false;
  }

  private normalizeSocketTick(raw: any): MarketTick | null {
    if (!raw || typeof raw !== 'object') return null;
    const sym = typeof raw.symbol === 'string' ? raw.symbol : '';
    const ltp = typeof raw.ltp === 'number' ? raw.ltp : (typeof raw.lp === 'number' ? raw.lp : 0);
    if (!sym || ltp <= 0) return null;

    const prevClose = typeof raw.prev_close_price === 'number' && raw.prev_close_price > 0 ? raw.prev_close_price : ltp;
    const ch = typeof raw.ch === 'number' ? raw.ch : parseFloat((ltp - prevClose).toFixed(2));
    const chp = typeof raw.chp === 'number'
      ? raw.chp
      : (prevClose > 0 ? parseFloat(((ch / prevClose) * 100).toFixed(2)) : 0);
    const vol = typeof raw.vol_traded_today === 'number' ? raw.vol_traded_today : 0;

    return {
      id: sym.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'live-tick',
      name: sym,
      symbol: sym,
      ltp: parseFloat(ltp.toFixed(2)),
      change: parseFloat(ch.toFixed(2)),
      changePct: parseFloat(chp.toFixed(2)),
      high: typeof raw.high_price === 'number' && raw.high_price > 0 ? parseFloat(raw.high_price.toFixed(2)) : ltp,
      low: typeof raw.low_price === 'number' && raw.low_price > 0 ? parseFloat(raw.low_price.toFixed(2)) : ltp,
      open: typeof raw.open_price === 'number' && raw.open_price > 0 ? parseFloat(raw.open_price.toFixed(2)) : ltp,
      vwap: typeof raw.avg_trade_price === 'number' && raw.avg_trade_price > 0 ? parseFloat(raw.avg_trade_price.toFixed(2)) : ltp,
      volume: vol >= 1_000_000 ? `${(vol / 1_000_000).toFixed(1)}M` : vol >= 1000 ? `${(vol / 1000).toFixed(0)}K` : '0M'
    };
  }

  public startDataSocket(symbols?: string[]): void {
    if (!this.appId || !this.accessToken) return;
    if (symbols) {
      symbols.forEach((s) => {
        if (s && s.includes(':')) this.subscribedSymbols.add(s);
      });
    }

    this.stopDataSocket();

    try {
      const { fyersDataSocket } = require('fyers-api-v3');
      if (!fyersDataSocket || typeof fyersDataSocket.getInstance !== 'function') return;

      const skt = fyersDataSocket.getInstance(`${this.appId}:${this.accessToken}`, '', false);
      this.dataSocket = skt;

      skt.on('connect', () => {
        this.socketConnected = true;
        this.lastSocketTickAt = Date.now();
        console.log('[Feed Provider] Real-time WebSocket stream connected.');
        try {
          if (typeof skt.mode === 'function' && skt.FullMode !== undefined) {
            skt.mode(skt.FullMode);
          }
        } catch {}
        try {
          if (typeof skt.autoreconnect === 'function') {
            skt.autoreconnect();
          } else if (typeof skt.autoReconnect === 'function') {
            skt.autoReconnect(25);
          }
        } catch {}

        const list = Array.from(this.subscribedSymbols).filter((s) => s.includes(':'));
        if (list.length > 0 && typeof skt.subscribe === 'function') {
          for (let i = 0; i < list.length; i += 50) {
            try {
              skt.subscribe(list.slice(i, i + 50));
            } catch {}
          }
        }
      });

      skt.on('message', (msg: any) => {
        const items = Array.isArray(msg) ? msg : [msg];
        for (const item of items) {
          const tick = this.normalizeSocketTick(item);
          if (tick) {
            this.lastSocketTickAt = Date.now();
            this.rateLimitStrikes = 0;
            this.rateLimitedUntil = 0;
            this.tickCallback?.(tick);
          }
        }
      });

      skt.on('error', (err: any) => {
        const errText = typeof err === 'string' ? err : err?.message || JSON.stringify(err || {});
        console.warn('[Feed Provider] Data WebSocket error:', errText);
        if (/expir|unauth|invalid token/i.test(errText)) {
          this.connected = false;
          this.socketConnected = false;
        }
      });

      skt.on('close', () => {
        this.socketConnected = false;
        if (this.connected && !this.socketReconnectTimer) {
          this.socketReconnectTimer = setTimeout(() => {
            this.socketReconnectTimer = null;
            if (this.connected && !this.socketConnected) {
              this.startDataSocket();
            }
          }, 8000);
        }
      });

      if (typeof skt.connect === 'function') {
        skt.connect();
      }
    } catch (err: any) {
      this.socketConnected = false;
      console.warn('[Feed Provider] Data WebSocket unavailable, falling back to quota-safe polling:', err?.message || err);
    }
  }

  public stopDataSocket(): void {
    if (this.socketReconnectTimer) {
      clearTimeout(this.socketReconnectTimer);
      this.socketReconnectTimer = null;
    }
    this.socketConnected = false;
    if (this.dataSocket) {
      try {
        if (typeof this.dataSocket.close === 'function') {
          this.dataSocket.close();
        }
      } catch {}
      this.dataSocket = null;
    }
  }

  private extractCodeOrToken(input: string): string {
    let clean = input.trim();
    if (clean.includes('auth_code=') || clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const parsed = new URL(clean);
        const authCode = parsed.searchParams.get('auth_code');
        if (authCode) return authCode.trim();
        const code = parsed.searchParams.get('code');
        if (code && code !== '200') return code.trim();
      } catch {
        const match = clean.match(/auth_code=([^&\s]+)/);
        if (match?.[1]) return decodeURIComponent(match[1]).trim();
      }
    }
    return clean;
  }

  private isFyersAccessTokenJwt(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      return payload?.sub === 'access_token';
    } catch {
      return false;
    }
  }

  public async updateToken(tokenOrAuthCode: string): Promise<{ success: boolean; message: string; spotPrice?: number }> {
    const raw = this.extractCodeOrToken(tokenOrAuthCode);
    if (!raw) {
      return { success: false, message: 'Token or auth code cannot be empty.' };
    }

    const appId = this.appId || process.env.FYERS_APP_ID || 'R3ZD795FUR-100';
    const secretKey = process.env.FYERS_SECRET_KEY || 'MMOAAII27N';
    let candidateToken = raw;

    // Exchange OAuth authorization_code unless input is already an access_token JWT
    if (raw.length > 30 && !this.isFyersAccessTokenJwt(raw)) {
      try {
        const appIdHash = crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');
        const authRes = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            appIdHash,
            code: raw
          })
        });
        const authJson: any = await authRes.json();
        if (authJson.s === 'ok' && authJson.access_token) {
          candidateToken = authJson.access_token;
          console.log('[Feed Provider] Exchanged Auth Code for Access Token successfully!');
        } else if (authJson.message) {
          return { success: false, message: `Auth code rejected: ${authJson.message}` };
        }
      } catch (err) {
        console.warn('[Feed Provider] Auth code exchange check error:', err);
      }
    }

    // Test candidateToken against quotes API
    try {
      const url = `https://api-t1.fyers.in/data/quotes?symbols=NSE:NIFTY50-INDEX`;
      const res = await fetch(url, {
        headers: {
          Authorization: `${appId}:${candidateToken}`
        }
      });
      const json: any = await res.json();
      if (json.s === 'ok' && json.d && json.d.length > 0) {
        this.appId = appId;
        this.accessToken = candidateToken;
        this.connected = true;
        this.rateLimitStrikes = 0;
        this.rateLimitedUntil = 0;
        process.env.FYERS_ACCESS_TOKEN = candidateToken;

        // Persist token to local .env if present
        try {
          const candidatePaths = [
            path.resolve(process.cwd(), 'server/.env'),
            path.resolve(process.cwd(), '.env')
          ];
          for (const envPath of candidatePaths) {
            if (fs.existsSync(envPath)) {
              let content = fs.readFileSync(envPath, 'utf8');
              if (content.includes('FYERS_ACCESS_TOKEN=')) {
                content = content.replace(/FYERS_ACCESS_TOKEN=.*/, `FYERS_ACCESS_TOKEN=${candidateToken}`);
              } else {
                content += `\nFYERS_ACCESS_TOKEN=${candidateToken}\n`;
              }
              fs.writeFileSync(envPath, content, 'utf8');
              break;
            }
          }
        } catch (e) {
          console.warn('[Feed Provider] Could not persist to .env:', e);
        }

        const ltp = json.d[0].v?.lp || 25819.25;
        console.log(`[Feed Provider] Connected! Live NIFTY Spot: ${ltp}`);
        this.startDataSocket();
        return { success: true, message: 'Successfully connected!', spotPrice: ltp };
      } else {
        this.connected = false;
        this.stopDataSocket();
        return { success: false, message: json.message || 'Data feed rejected the token/code.' };
      }
    } catch (err: any) {
      this.connected = false;
      this.stopDataSocket();
      return { success: false, message: err?.message || 'Network error connecting to data feed.' };
    }
  }

  public async connect(credentials: BrokerCredentials): Promise<boolean> {
    this.appId = credentials.appId || process.env.FYERS_APP_ID || '';
    this.accessToken = credentials.accessToken || process.env.FYERS_ACCESS_TOKEN || '';

    if (!this.appId || !this.accessToken) {
      this.connected = false;
      return false;
    }

    try {
      const testQuote = await this.fetchQuotes(['NSE:NIFTY50-INDEX']);
      if (testQuote && testQuote.length > 0) {
        this.connected = true;
        this.rateLimitStrikes = 0;
        this.rateLimitedUntil = 0;
        console.log(`[Feed Provider] Connected! Real Nifty Spot: ${testQuote[0].ltp}`);
        this.startDataSocket();
        return true;
      }
      this.connected = false;
      return false;
    } catch (err) {
      console.error('[Feed Provider] Authentication error:', err);
      this.connected = false;
      return false;
    }
  }

  public disconnect(): void {
    this.connected = false;
    this.stopDataSocket();
  }

  public subscribe(symbols: string[]): void {
    const newlyAdded: string[] = [];
    symbols.forEach((s) => {
      if (s && s.includes(':') && !this.subscribedSymbols.has(s)) {
        this.subscribedSymbols.add(s);
        newlyAdded.push(s);
      }
    });
    if (newlyAdded.length > 0 && this.dataSocket && this.socketConnected && typeof this.dataSocket.subscribe === 'function') {
      for (let i = 0; i < newlyAdded.length; i += 50) {
        try {
          this.dataSocket.subscribe(newlyAdded.slice(i, i + 50));
        } catch {}
      }
    }
  }

  public onTick(callback: TickCallback): void {
    this.tickCallback = callback;
  }

  /**
   * Fetch live quotes for symbols from REST API (rate-limit guarded fallback)
   */
  public async fetchQuotes(symbols: string[]): Promise<MarketTick[]> {
    if (!this.appId || !this.accessToken || symbols.length === 0) return [];
    if (this.isRateLimited()) return [];

    const results: MarketTick[] = [];
    const unique = Array.from(new Set(symbols));
    const batchSize = 45;

    try {
      for (let i = 0; i < unique.length; i += batchSize) {
        if (this.isRateLimited()) break;
        const batch = unique.slice(i, i + batchSize);
        const url = `https://api-t1.fyers.in/data/quotes?symbols=${encodeURIComponent(batch.join(','))}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `${this.appId}:${this.accessToken}`
          },
          signal: AbortSignal.timeout(6000)
        });

        const json: any = await res.json();
        if (json.s !== 'ok' || !json.d) {
          this.checkAuthError(res.status, json);
          if (this.checkRateLimit(res.status, json)) {
            break;
          }
          continue;
        }

        this.rateLimitStrikes = 0;
        this.rateLimitedUntil = 0;

        for (const item of json.d) {
          if (item && item.v && typeof item.v.lp === 'number' && item.v.lp > 0) {
            const v = item.v || {};
            results.push({
              id: item.n?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'feed-tick',
              name: v.short_name || item.n || 'NIFTY',
              symbol: item.n || 'NIFTY',
              ltp: v.lp || 0,
              change: v.ch || 0,
              changePct: v.chp || 0,
              high: v.high_price || v.lp || 0,
              low: v.low_price || v.lp || 0,
              open: v.open_price || v.lp || 0,
              vwap: v.atp || v.lp || 0,
              volume: v.volume ? `${(v.volume / 1000000).toFixed(1)}M` : '0M'
            });
          }
        }
      }
      return results;
    } catch (err) {
      console.error('[Feed Provider] Error fetching quotes:', err);
      return results;
    }
  }

  /**
   * Helper to map any common symbol, index, equity, or futures contract to a valid FYERS symbol
   */
  public toFyersSymbol(symbol: string): string {
    return symbolMaster.resolveInstrument(symbol).fyersSymbol;
  }

  /**
   * Fetch historical candles for any requested symbol based on requested timeframe resolution
   * Supports: 1m, 2m, 3m, 5m, 10m, 15m, 30m, 1H, 2H, 4H, 1D, 1W, 1M
   */
  public async fetchHistory(resolution: string = 'D', symbol: string = 'NIFTY 50'): Promise<ChartCandleTick[]> {
    if (!this.appId || !this.accessToken) return [];
    if (this.isRateLimited()) return [];
    await symbolMaster.ensureLoaded();

    const resTrimmed = resolution.trim();
    const resClean = resTrimmed.toLowerCase();
    const cacheKey = `${symbol.trim().toUpperCase()}::${resTrimmed === '1M' || resTrimmed === 'M' ? '1M' : resClean}`;
    const ttlMs =
      resTrimmed === '1M' || resTrimmed === 'M' || resClean === '1w' || resClean === '1d' || resClean === 'd'
        ? 180_000
        : resClean === '1h' || resClean === '2h' || resClean === '4h' || resClean === '60' || resClean === '120' || resClean === '240'
        ? 45_000
        : 15_000;

    const cached = this.historyCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < ttlMs) {
      return cached.data;
    }

    const existingPromise = this.historyInFlight.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const fetchTask = (async (): Promise<ChartCandleTick[]> => {
      let fyersRes = 'D';
      let lookbackDays = 365; // 1 full year for daily

      if (resTrimmed === '1M' || resTrimmed === 'M' || resClean === '1mo') {
      fyersRes = '1M';
      lookbackDays = 366;
    } else if (resClean === '1w' || resClean === 'w' || resClean === '1wk') {
      fyersRes = '1W';
      lookbackDays = 366;
    } else if (resClean === '1m' || resClean === '1') {
      fyersRes = '1';
      lookbackDays = 3;
    } else if (resClean === '2m' || resClean === '2') {
      fyersRes = '2';
      lookbackDays = 5;
    } else if (resClean === '3m' || resClean === '3') {
      fyersRes = '3';
      lookbackDays = 7;
    } else if (resClean === '5m' || resClean === '5') {
      fyersRes = '5';
      lookbackDays = 10;
    } else if (resClean === '10m' || resClean === '10') {
      fyersRes = '10';
      lookbackDays = 15;
    } else if (resClean === '15m' || resClean === '15') {
      fyersRes = '15';
      lookbackDays = 25;
    } else if (resClean === '30m' || resClean === '30') {
      fyersRes = '30';
      lookbackDays = 45;
    } else if (resClean === '1h' || resClean === '60') {
      fyersRes = '60';
      lookbackDays = 90;
    } else if (resClean === '2h' || resClean === '120') {
      fyersRes = '120';
      lookbackDays = 100;
    } else if (resClean === '4h' || resClean === '240') {
      fyersRes = '240';
      lookbackDays = 100;
    } else {
      fyersRes = 'D';
      lookbackDays = 365;
    }

    try {
      const istNow = new Date(Date.now() + 19800000);
      const istFrom = new Date(istNow.getTime() - lookbackDays * 86400000);

      const toStr = istNow.toISOString().slice(0, 10);
      const fromStr = istFrom.toISOString().slice(0, 10);
      const resolved = symbolMaster.resolveInstrument(symbol);
      const mappedSymbol = resolved.fyersSymbol;
      const isContractFuture =
        (resolved.instrument?.category === 'INDEX_FUTURES' || resolved.instrument?.category === 'STOCK_FUTURES') &&
        !resolved.contFlag;

      const callHistory = async (contFlagVal: '0' | '1') => {
        const url = `https://api-t1.fyers.in/data/history?symbol=${encodeURIComponent(mappedSymbol)}&resolution=${fyersRes}&date_format=1&range_from=${fromStr}&range_to=${toStr}&cont_flag=${contFlagVal}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `${this.appId}:${this.accessToken}`
          },
          signal: AbortSignal.timeout(8000)
        });
        const json: any = await res.json();
        return { res, json };
      };

      const initialContFlag: '0' | '1' = isContractFuture ? '0' : '1';
      let { res, json } = await callHistory(initialContFlag);

      // If continuous flag fails for a futures contract, retry cleanly with contract-specific flag
      if ((json.s !== 'ok' || !Array.isArray(json.candles) || json.candles.length === 0) && initialContFlag === '1' && !this.checkAuthError(res.status, json) && !this.checkRateLimit(res.status, json)) {
        const retry = await callHistory('0');
        res = retry.res;
        json = retry.json;
      }

      if (json.s !== 'ok' || !json.candles || !Array.isArray(json.candles)) {
        this.checkAuthError(res.status, json);
        this.checkRateLimit(res.status, json);
        return [];
      }

      // Deduplicate by timestamp and strictly sort ascending
      const candleMap = new Map<number, any[]>();
      for (const c of json.candles) {
        if (Array.isArray(c) && c.length >= 5 && typeof c[0] === 'number') {
          candleMap.set(c[0], c);
        }
      }

      const sorted = Array.from(candleMap.values()).sort((a, b) => a[0] - b[0]);

      const mapped: ChartCandleTick[] = sorted.map((c: any[]) => {
        const epoch = c[0];
        // Normalize all resolutions (daily & intraday) to UNIX timestamp in seconds (IST shifted)
        // This ensures 100% type consistency across all chart resolutions in Lightweight Charts.
        const timeVal = epoch + 19800;

        return {
          time: timeVal,
          open: parseFloat(Number(c[1]).toFixed(2)),
          high: parseFloat(Number(c[2]).toFixed(2)),
          low: parseFloat(Number(c[3]).toFixed(2)),
          close: parseFloat(Number(c[4]).toFixed(2)),
          volume: Number(c[5]) || 0
        };
      });

      if (mapped.length > 0) {
        if (this.historyCache.size > 100) {
          const oldestKey = this.historyCache.keys().next().value;
          if (oldestKey) this.historyCache.delete(oldestKey);
        }
        this.historyCache.set(cacheKey, { ts: Date.now(), data: mapped });
      }
      return mapped;
    } catch (err) {
      console.error('[Feed Provider] Error fetching history:', err);
      return [];
    }
    })();

    this.historyInFlight.set(cacheKey, fetchTask);
    try {
      return await fetchTask;
    } finally {
      this.historyInFlight.delete(cacheKey);
    }
  }

  /**
   * Fetch live option chain and underlying data from REST API
   */
  public async fetchOptionChain(expiryTimestamp?: string): Promise<FyersOptionChainResult | null> {
    if (!this.appId || !this.accessToken) return null;
    if (this.isRateLimited()) return null;

    try {
      let url = `https://api-t1.fyers.in/data/options-chain-v3?symbol=NSE:NIFTY50-INDEX&strikecount=50`;
      if (expiryTimestamp) {
        url += `&timestamp=${expiryTimestamp}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `${this.appId}:${this.accessToken}`
        },
        signal: AbortSignal.timeout(8000)
      });

      const json: any = await res.json();
      if (json.s !== 'ok' || !json.data || !json.data.optionsChain) {
        this.checkAuthError(res.status, json);
        this.checkRateLimit(res.status, json);
        return null;
      }

      const chain = json.data.optionsChain;
      const indexRow = chain[0] || {};
      const spotPrice = indexRow.ltp || 25349.65;
      const futPrice = indexRow.fp || spotPrice + 180;
      const expiries: ExpiryOption[] = json.data.expiryData || [];
      const selectedExpiry = expiryTimestamp || (expiries[0]?.expiry || '');

      // Group CE and PE by strike_price
      const strikeMap = new Map<number, { ce?: any; pe?: any }>();

      for (let i = 1; i < chain.length; i++) {
        const item = chain[i];
        const strike = item.strike_price;
        if (!strike || strike <= 0) continue;

        if (!strikeMap.has(strike)) {
          strikeMap.set(strike, {});
        }
        const entry = strikeMap.get(strike)!;
        if (item.option_type === 'CE') entry.ce = item;
        if (item.option_type === 'PE') entry.pe = item;
      }

      const rows: OptionRow[] = [];
      const sortedStrikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);

      for (const strike of sortedStrikes) {
        const { ce, pe } = strikeMap.get(strike)!;
        const d = strike - spotPrice;
        const absD = Math.abs(d);

        // Greeks calculation
        const gamma = parseFloat(Math.max(0.0001, 0.0013 * Math.exp(-(absD * absD) / (2 * 180 * 180))).toFixed(4));
        const thetaBase = -15.8 * Math.exp(-(absD * absD) / (2 * 280 * 280));
        const callTheta = parseFloat((thetaBase * (1 + 0.04 * (d / 100))).toFixed(1));
        const putTheta = parseFloat((thetaBase * (1 - 0.04 * (d / 100))).toFixed(1));
        const normD = -d / 280;
        const callDelta = parseFloat(Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-normD)))).toFixed(2));
        const putDelta = parseFloat((callDelta - 1).toFixed(2));

        rows.push({
          strike,
          call: {
            theta: callTheta,
            gamma,
            delta: callDelta,
            oi: ce?.oi || 0,
            ltp: ce?.ltp || 0
          },
          put: {
            ltp: pe?.ltp || 0,
            oi: pe?.oi || 0,
            delta: putDelta,
            gamma,
            theta: putTheta
          }
        });
      }

      return {
        spotPrice,
        futPrice,
        expiries,
        selectedExpiry,
        rows
      };
    } catch (err) {
      console.error('[FYERS Provider] Error fetching option chain:', err);
      return null;
    }
  }
}
