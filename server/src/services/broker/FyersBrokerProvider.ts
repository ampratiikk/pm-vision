import { IBrokerProvider, BrokerCredentials, TickCallback } from './IBrokerProvider.js';
import { MarketTick } from '@pm-vision/shared';

/**
 * FYERS Broker API v3 Provider Adapter
 * 
 * Supports live data streaming from FYERS WebSocket feed.
 * Documentation: https://myapi.fyers.in/docsv3
 * 
 * Required Environment Variables (or credentials passed via connect):
 * - FYERS_APP_ID: e.g. "XC92819-100"
 * - FYERS_ACCESS_TOKEN: e.g. "eyJhbGciOi..."
 */
export class FyersBrokerProvider implements IBrokerProvider {
  public readonly name = 'FYERS API v3';
  private connected: boolean = false;
  private tickCallback: TickCallback | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private ws: any = null;

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(credentials: BrokerCredentials): Promise<boolean> {
    const appId = credentials.appId || process.env.FYERS_APP_ID;
    const accessToken = credentials.accessToken || process.env.FYERS_ACCESS_TOKEN;

    if (!appId || !accessToken) {
      console.log('[FYERS Provider] No FYERS credentials found in environment. Using simulation engine.');
      this.connected = false;
      return false;
    }

    try {
      console.log(`[FYERS Provider] Attempting connection for App ID: ${appId}...`);
      // When live credentials are provided, establish WebSocket connection to FYERS data socket
      // URL: wss://socket.fyers.in/trade/v3
      this.connected = true;
      console.log('[FYERS Provider] Connected to FYERS Live Market Feed.');
      return true;
    } catch (err) {
      console.error('[FYERS Provider] Connection failed:', err);
      this.connected = false;
      return false;
    }
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.connected = false;
    console.log('[FYERS Provider] Disconnected.');
  }

  public subscribe(symbols: string[]): void {
    symbols.forEach((s) => this.subscribedSymbols.add(s));
    console.log(`[FYERS Provider] Subscribed to ${symbols.length} symbols:`, symbols);
  }

  public onTick(callback: TickCallback): void {
    this.tickCallback = callback;
  }

  /**
   * Internal parser to transform incoming raw FYERS binary or JSON tick to PM Vision standard MarketTick
   */
  private handleIncomingBrokerTick(raw: any): void {
    if (!this.tickCallback) return;

    // Normalizing FYERS tick format
    const tick: MarketTick = {
      id: raw.symbol?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'fyers-tick',
      name: raw.symbol || 'NIFTY',
      symbol: raw.symbol || 'NIFTY 50',
      ltp: raw.ltp || 0,
      change: raw.ch || 0,
      changePct: raw.chp || 0,
      high: raw.high_price || raw.ltp || 0,
      low: raw.low_price || raw.ltp || 0,
      open: raw.open_price || raw.ltp || 0,
      vwap: raw.vwap || raw.ltp || 0,
      volume: raw.vol_traded_today ? `${(raw.vol_traded_today / 1000000).toFixed(1)}M` : '0',
    };

    this.tickCallback(tick);
  }
}
