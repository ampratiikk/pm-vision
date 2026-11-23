import { IBrokerProvider, BrokerCredentials, TickCallback } from './IBrokerProvider.js';
import { MarketTick, OptionRow, ExpiryOption, ChartCandleTick } from '@pm-vision/shared';

export interface FyersOptionChainResult {
  spotPrice: number;
  futPrice: number;
  expiries: ExpiryOption[];
  selectedExpiry: string;
  rows: OptionRow[];
}

export function isIndianMarketOpen(): boolean {
  // Convert current time to IST (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 3600000 * 5.5);

  const day = istDate.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) {
    return false;
  }

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const currentMinute = hours * 60 + minutes;

  const marketOpenMinute = 9 * 60 + 15; // 09:15 AM IST
  const marketCloseMinute = 15 * 60 + 30; // 03:30 PM IST

  return currentMinute >= marketOpenMinute && currentMinute <= marketCloseMinute;
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
    if (!this.appId || !this.accessToken) return [];

    try {
      const url = `https://api-t1.fyers.in/data/quotes?symbols=${encodeURIComponent(symbols.join(','))}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `${this.appId}:${this.accessToken}`
        }
      });

      const json = await res.json();
      if (json.s !== 'ok' || !json.d) {
        return [];
      }

      return json.d.map((item: any) => {
        const v = item.v || {};
        return {
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
        };
      });
    } catch (err) {
      console.error('[FYERS Provider] Error fetching quotes:', err);
      return [];
    }
  }

  /**
   * Fetch historical candles for NIFTY 50 based on requested timeframe resolution
   */
  public async fetchHistory(resolution: string = 'D'): Promise<ChartCandleTick[]> {
    if (!this.appId || !this.accessToken) return [];

    // Map timeframes
    let fyersRes = 'D';
    let lookbackDays = 180;

    if (resolution === '15m' || resolution === '15') {
      fyersRes = '15';
      lookbackDays = 7;
    } else if (resolution === '30m' || resolution === '30') {
      fyersRes = '30';
      lookbackDays = 14;
    } else if (resolution === '1H' || resolution === '60') {
      fyersRes = '60';
      lookbackDays = 30;
    } else {
      fyersRes = 'D';
      lookbackDays = 180;
    }

    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - lookbackDays);

      const toStr = toDate.toISOString().slice(0, 10);
      const fromStr = fromDate.toISOString().slice(0, 10);

      const url = `https://api-t1.fyers.in/data/history?symbol=NSE:NIFTY50-INDEX&resolution=${fyersRes}&date_format=1&range_from=${fromStr}&range_to=${toStr}&cont_flag=1`;
      const res = await fetch(url, {
        headers: {
          Authorization: `${this.appId}:${this.accessToken}`
        }
      });

      const json = await res.json();
      if (json.s !== 'ok' || !json.candles || !Array.isArray(json.candles)) {
        return [];
      }

      return json.candles.map((c: any[]) => {
        const epoch = c[0];
        // For lightweight-charts:
        // Use unix timestamp in seconds for intraday, or YYYY-MM-DD for Daily
        let timeVal: string | number = epoch;
        if (fyersRes === 'D') {
          const d = new Date(epoch * 1000);
          timeVal = d.toISOString().slice(0, 10);
        }

        return {
          time: timeVal,
          open: parseFloat(Number(c[1]).toFixed(2)),
          high: parseFloat(Number(c[2]).toFixed(2)),
          low: parseFloat(Number(c[3]).toFixed(2)),
          close: parseFloat(Number(c[4]).toFixed(2)),
          volume: Number(c[5])
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
      let url = `https://api-t1.fyers.in/data/options-chain-v3?symbol=NSE:NIFTY50-INDEX&strikecount=15`;
      if (expiryTimestamp) {
        url += `&timestamp=${expiryTimestamp}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `${this.appId}:${this.accessToken}`
        }
      });

      const json = await res.json();
      if (json.s !== 'ok' || !json.data || !json.data.optionsChain) {
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
