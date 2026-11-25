import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { IBrokerProvider, BrokerCredentials, TickCallback } from './IBrokerProvider.js';
import { MarketTick, OptionRow, ExpiryOption, ChartCandleTick, isIndianMarketOpen } from '@pm-vision/shared';
import { symbolMaster } from './SymbolMasterService.js';

export { isIndianMarketOpen };

export interface FyersOptionChainResult {
  spotPrice: number;
  futPrice: number;
  expiries: ExpiryOption[];
  selectedExpiry: string;
  rows: OptionRow[];
}

export class FyersBrokerProvider implements IBrokerProvider {
  public readonly name = 'FYERS API v3';
  private connected: boolean = false;
  private tickCallback: TickCallback | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private appId: string = '';
  private accessToken: string = '';

  public isConnected(): boolean {
    return this.connected;
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
        console.warn('[FYERS Provider] Session/Token expired or unauthorized:', json?.message || status);
      }
      this.connected = false;
      return true;
    }
    return false;
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
          console.log('[FYERS Provider] Exchanged Auth Code for Access Token successfully!');
        } else if (authJson.message) {
          return { success: false, message: `FYERS auth code rejected: ${authJson.message}` };
        }
      } catch (err) {
        console.warn('[FYERS Provider] Auth code exchange check error:', err);
      }
    }

    // Test candidateToken against FYERS quotes API
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
          console.warn('[FYERS Provider] Could not persist to .env:', e);
        }

        const ltp = json.d[0].v?.lp || 25819.25;
        console.log(`[FYERS Provider] Authenticated! Live NIFTY Spot: ${ltp}`);
        return { success: true, message: 'Successfully authenticated with FYERS!', spotPrice: ltp };
      } else {
        this.connected = false;
        return { success: false, message: json.message || 'FYERS rejected the token/code.' };
      }
    } catch (err: any) {
      this.connected = false;
      return { success: false, message: err?.message || 'Network error connecting to FYERS.' };
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
        console.log(`[FYERS Provider] Authenticated! Real Nifty Spot: ${testQuote[0].ltp}`);
        return true;
      }
      this.connected = false;
      return false;
    } catch (err) {
      console.error('[FYERS Provider] Authentication error:', err);
      this.connected = false;
      return false;
    }
  }

  public disconnect(): void {
    this.connected = false;
  }

  public subscribe(symbols: string[]): void {
    symbols.forEach((s) => this.subscribedSymbols.add(s));
  }

  public onTick(callback: TickCallback): void {
    this.tickCallback = callback;
  }

  /**
   * Fetch live quotes for symbols from FYERS REST API
   */
  public async fetchQuotes(symbols: string[]): Promise<MarketTick[]> {
    if (!this.appId || !this.accessToken || symbols.length === 0) return [];

    const results: MarketTick[] = [];
    const unique = Array.from(new Set(symbols));
    const batchSize = 45;

    try {
      for (let i = 0; i < unique.length; i += batchSize) {
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
          continue;
        }

        for (const item of json.d) {
          if (item && item.v && typeof item.v.lp === 'number' && item.v.lp > 0) {
            const v = item.v || {};
            results.push({
              id: item.n?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'fyers-tick',
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
      console.error('[FYERS Provider] Error fetching quotes:', err);
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
   * Supports: 1m, 2m, 3m, 5m, 10m, 15m, 30m, 1H, 2H, 4H, 1D
   */
  public async fetchHistory(resolution: string = 'D', symbol: string = 'NIFTY 50'): Promise<ChartCandleTick[]> {
    if (!this.appId || !this.accessToken) return [];
    await symbolMaster.ensureLoaded();

    let fyersRes = 'D';
    let lookbackDays = 365; // 1 full year for daily

    const resClean = resolution.toLowerCase().trim();

    if (resClean === '1m' || resClean === '1') {
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
      if ((json.s !== 'ok' || !Array.isArray(json.candles) || json.candles.length === 0) && initialContFlag === '1' && !this.checkAuthError(res.status, json)) {
        const retry = await callHistory('0');
        res = retry.res;
        json = retry.json;
      }

      if (json.s !== 'ok' || !json.candles || !Array.isArray(json.candles)) {
        this.checkAuthError(res.status, json);
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

      return sorted.map((c: any[]) => {
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
    } catch (err) {
      console.error('[FYERS Provider] Error fetching history:', err);
      return [];
    }
  }

  /**
   * Fetch live option chain and underlying data from FYERS REST API
   */
  public async fetchOptionChain(expiryTimestamp?: string): Promise<FyersOptionChainResult | null> {
    if (!this.appId || !this.accessToken) return null;

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
