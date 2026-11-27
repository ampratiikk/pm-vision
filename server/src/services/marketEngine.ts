import {
  MarketSnapshotPayload,
  SecurityQuote,
  BasisSpreadPair,
  OptionRow,
  ChartCandleTick,
  ExpiryOption,
  MarketStatus,
  FeedHealthStatus
} from '@pm-vision/shared';
import { FyersBrokerProvider, isIndianMarketOpen } from './broker/FyersBrokerProvider.js';
import { PublicMarketDataProvider } from './broker/PublicMarketDataProvider.js';
import { symbolMaster } from './broker/SymbolMasterService.js';

const CORE_PUBLIC_SYMBOLS = [
  'NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'NIFTY NEXT 50', 'NIFTY MIDCAP 50',
  'NIFTY IT', 'NIFTY AUTO', 'NIFTY FMCG', 'NIFTY METAL', 'NIFTY PHARMA',
  'NIFTY REALTY', 'NIFTY ENERGY', 'NIFTY INFRA', 'INDIA VIX',
  'HDFCBANK', 'ICICIBANK', 'RELIANCE', 'BHARTIARTL', 'LT',
  'SBIN', 'INFY', 'AXISBANK', 'KOTAKBANK', 'BAJFINANCE',
  'M&M', 'ITC', 'ETERNAL', 'TCS', 'SUNPHARMA',
  'TITAN', 'HINDUNILVR', 'TATASTEEL', 'MARUTI', 'NTPC',
  'ADANIPORTS', 'BEL', 'HINDALCO', 'SHRIRAMFIN', 'BSE',
  'HCLTECH', 'ULTRACEMCO', 'JSWSTEEL', 'POWERGRID', 'BAJAJ-AUTO',
  'GRASIM', 'INDIGO', 'ASIANPAINT', 'COALINDIA', 'BAJAJFINSV',
  'ADANIENT', 'EICHERMOT', 'NESTLEIND', 'TECHM', 'ONGC',
  'APOLLOHOSP', 'TRENT', 'SBILIFE', 'CIPLA', 'DRREDDY',
  'MAXHEALTH', 'JIOFIN', 'TATACONSUM', 'TMPV', 'HDFCLIFE'
];

export class MarketEngine {
  private timer: NodeJS.Timeout | null = null;
  private optionTimer: NodeJS.Timeout | null = null;
  private intervalMs: number = 1500;
  private listeners: Array<(payload: MarketSnapshotPayload) => void> = [];
  private lastOffMarketBroadcast: number = 0;
  private lastRestPoll: number = 0;
  private lastPublicPoll: number = 0;
  private lastPublicCorePoll: number = 0;
  private lastPublicRefreshOffHours: number = Date.now();
  private quoteSyncInFlight: boolean = false;
  private optionSyncInFlight: boolean = false;
  private publicSyncInFlight: boolean = false;
  private lastDataUpdateAt: number = 0;
  private consecutiveRestFailures: number = 0;
  private socketBroadcastTimer: NodeJS.Timeout | null = null;
  private optionChainEnabled: boolean = false;
  private activeClientCount: number = 0;
  private quoteUpdatedAt: Map<string, number> = new Map();

  // Active symbols monitored for live streaming (capped for REST quota; WS subscribes core + 50 stocks)
  private monitoredSymbols: Set<string> = new Set(['NSE:NIFTY50-INDEX']);
  private rawMonitoredSymbols: Set<string> = new Set(['NIFTY 50', 'BANK NIFTY', 'RELIANCE', 'HDFCBANK']);
  private customQuotes: Map<string, SecurityQuote> = new Map();

  // Underlying Market State
  private spotPrice: number = 25819.25;
  private spotOpen: number = 25349.65;
  private spotPrevClose: number = 25349.65;
  private spotHigh: number = 25819.25;
  private spotLow: number = 25349.65;
  private spotVwap: number = 25650.00;
  private spotVolumeM: number = 18.4;
  private indiaVix: number = 17.70;

  // Futures Spreads from Spot
  private fut1Spread: number = 180.35;
  private fut2Spread: number = 275.40;
  private fut3Spread: number = 380.20;

  // Real option chain cache
  private cachedOptionChain: OptionRow[] | null = null;
  private expiries: ExpiryOption[] = [];
  private selectedExpiry: string = '';

  // Active Candle
  private activeCandle: ChartCandleTick = {
    time: Math.floor(Date.now() / 1000) + 19800,
    open: 25349.65,
    high: 25819.25,
    low: 25349.65,
    close: 25819.25
  };

  // Providers
  private brokerProvider: FyersBrokerProvider;
  private publicProvider: PublicMarketDataProvider;

  constructor() {
    this.brokerProvider = new FyersBrokerProvider();
    this.publicProvider = new PublicMarketDataProvider();

    this.brokerProvider.onTick((tick) => {
      this.handleRealtimeSocketTick(tick);
    });

    Promise.all([
      symbolMaster.ensureLoaded(),
      this.brokerProvider.connect({})
    ]).then(async ([, connected]) => {
      // Ensure NIFTY Current/Next/Far futures + Major Indices + all 50 NIFTY stocks are subscribed on WebSocket
      const socketSubList: string[] = [];
      const niftyContracts = symbolMaster.getNiftyMonthlyContracts();
      if (niftyContracts.current) {
        this.monitoredSymbols.add(niftyContracts.current.fyersSymbol);
        socketSubList.push(niftyContracts.current.fyersSymbol);
      }
      if (niftyContracts.next) {
        this.monitoredSymbols.add(niftyContracts.next.fyersSymbol);
        socketSubList.push(niftyContracts.next.fyersSymbol);
      }
      if (niftyContracts.far) {
        this.monitoredSymbols.add(niftyContracts.far.fyersSymbol);
        socketSubList.push(niftyContracts.far.fyersSymbol);
      }

      for (const sym of CORE_PUBLIC_SYMBOLS) {
        const fs = symbolMaster.resolveInstrument(sym).fyersSymbol;
        if (fs && fs.includes(':')) {
          socketSubList.push(fs);
        }
      }
      this.brokerProvider.subscribe(socketSubList);

      if (connected) {
        console.log('[MarketEngine] Primary feed authenticated. Real-time streaming active...');
        await this.syncWithBroker();
      } else {
        console.log('[MarketEngine] Primary feed inactive. Hydrating real market snapshot via public NSE feed...');
        await this.syncPublicQuotes(true);
      }
    });
  }

  public setActiveClientCount(count: number): void {
    this.activeClientCount = Math.max(0, count);
  }

  public isOptionChainEnabled(): boolean {
    return this.optionChainEnabled;
  }

  public async setOptionChainEnabled(enabled: boolean, expiryTimestamp?: string): Promise<MarketSnapshotPayload> {
    this.optionChainEnabled = enabled;
    if (expiryTimestamp !== undefined) {
      this.selectedExpiry = expiryTimestamp;
    }
    if (enabled && this.brokerProvider.isConnected() && !this.brokerProvider.isRateLimited()) {
      const updated = await this.syncOptionChain(this.selectedExpiry, true);
      if (updated) {
        this.lastDataUpdateAt = Date.now();
      }
    }
    const payload = this.buildPayload();
    this.notifyListeners(payload);
    return payload;
  }

  private handleRealtimeSocketTick(tick: SecurityQuote): void {
    const fUpper = tick.symbol.toUpperCase();
    const now = Date.now();
    this.lastDataUpdateAt = now;
    this.consecutiveRestFailures = 0;

    if (fUpper === 'NSE:NIFTY50-INDEX') {
      this.quoteUpdatedAt.set('NIFTY 50', now);
      this.quoteUpdatedAt.set(fUpper, now);
      this.spotPrice = tick.ltp;
      this.spotOpen = tick.open || tick.ltp;
      this.spotHigh = tick.high || tick.ltp;
      this.spotLow = tick.low || tick.ltp;
      this.spotPrevClose = parseFloat((tick.ltp - tick.change).toFixed(2));
      this.spotVwap = tick.vwap || this.spotVwap;
      this.activeCandle = {
        time: Math.floor(Date.now() / 1000) + 19800,
        open: this.spotOpen,
        high: this.spotHigh,
        low: this.spotLow,
        close: this.spotPrice
      };
    } else {
      this.storeFyersQuote(tick);
    }

    // Throttled broadcast (at most once per 400ms) to keep UI responsive without JSON spam
    if (!this.socketBroadcastTimer) {
      this.socketBroadcastTimer = setTimeout(() => {
        this.socketBroadcastTimer = null;
        this.notifyListeners(this.buildPayload());
      }, 400);
    }
  }

  public getBrokerProvider(): FyersBrokerProvider {
    return this.brokerProvider;
  }

  public getPublicProvider(): PublicMarketDataProvider {
    return this.publicProvider;
  }

  /**
   * Unified history retrieval: tries FYERS first if connected, otherwise transparently
   * falls back to real public NSE/Yahoo historical data for cash stocks & indices.
   * Futures contracts (Index/Stock) require live FYERS broker connection.
   */
  public async fetchHistory(
    resolution: string = '15m',
    symbol: string = 'NIFTY 50'
  ): Promise<{ candles: ChartCandleTick[]; casPrice?: number; source: 'FYERS' | 'PUBLIC'; requiresBroker?: boolean }> {
    await symbolMaster.ensureLoaded();
    const cleanSym = symbol.trim();
    const upper = cleanSym.toUpperCase();
    const resolved = symbolMaster.resolveInstrument(cleanSym);

    let candles: ChartCandleTick[] = [];
    let source: 'FYERS' | 'PUBLIC' = 'PUBLIC';
    let metaPrice: number | undefined;

    if (this.brokerProvider.isConnected()) {
      const fyersCandles = await this.brokerProvider.fetchHistory(resolution, cleanSym);
      if (fyersCandles && fyersCandles.length > 0) {
        candles = fyersCandles;
        source = 'FYERS';
      }
    }

    const isGenuineFutureContract =
      resolved.instrument &&
      (resolved.instrument.category === 'INDEX_FUTURES' || resolved.instrument.category === 'STOCK_FUTURES') &&
      upper !== 'NIFTY FUT-I' &&
      upper !== 'NIFTY FUT-II' &&
      upper !== 'NIFTY FUT-III';

    if (candles.length === 0 && !this.brokerProvider.isConnected() && isGenuineFutureContract) {
      return { candles: [], source: 'PUBLIC', requiresBroker: true };
    }

    if (candles.length === 0) {
      const pubRes = await this.publicProvider.fetchHistoryWithMeta(resolution, cleanSym);
      candles = pubRes.candles;
      metaPrice = pubRes.regularMarketPrice;
      source = 'PUBLIC';

      // Adjust spot candles cleanly if legacy NIFTY FUT-I/II/III alias was requested offline
      if (candles.length > 0 && (upper === 'NIFTY FUT-I' || upper === 'NIFTY FUT-II' || upper === 'NIFTY FUT-III')) {
        const spread = upper === 'NIFTY FUT-I' ? this.fut1Spread : upper === 'NIFTY FUT-II' ? this.fut2Spread : this.fut3Spread;
        candles = candles.map((c) => ({
          ...c,
          open: parseFloat((c.open + spread).toFixed(2)),
          high: parseFloat((c.high + spread).toFixed(2)),
          low: parseFloat((c.low + spread).toFixed(2)),
          close: parseFloat((c.close + spread).toFixed(2))
        }));
        if (metaPrice) metaPrice = parseFloat((metaPrice + spread).toFixed(2));
      }
    }

    // Determine accurate CAS / Reference Price
    let casPrice: number | undefined;
    if (upper === 'NIFTY 50') {
      if (metaPrice && metaPrice > 0 && !this.brokerProvider.isConnected()) {
        this.spotPrice = metaPrice;
      }
      casPrice = this.spotPrice;
    } else {
      const sec =
        this.customQuotes.get(upper) ||
        this.customQuotes.get(resolved.fyersSymbol.toUpperCase()) ||
        this.buildPayload().securities.find((s) => s.symbol.toUpperCase() === upper);
      if (sec && sec.ltp > 0) {
        casPrice = sec.ltp;
      } else if (metaPrice && metaPrice > 0) {
        casPrice = metaPrice;
      } else if (candles.length > 0) {
        casPrice = candles[candles.length - 1].close;
      }
    }

    return { candles, casPrice, source };
  }

  /**
   * Register a symbol for real-time live streaming quotes
   */
  public addMonitoredSymbol(symbol: string): void {
    if (!symbol) return;
    const upper = symbol.trim().toUpperCase();
    const resolved = symbolMaster.resolveInstrument(upper);
    const isFuture =
      resolved.instrument?.category === 'INDEX_FUTURES' ||
      resolved.instrument?.category === 'STOCK_FUTURES';

    if (!isFuture) {
      this.rawMonitoredSymbols.add(upper);
      if (this.rawMonitoredSymbols.size > 30) {
        const first = this.rawMonitoredSymbols.values().next().value;
        if (first && first !== 'NIFTY 50' && first !== 'BANK NIFTY') {
          this.rawMonitoredSymbols.delete(first);
        }
      }
    }

    if (upper !== 'NIFTY FUT-I' && upper !== 'NIFTY FUT-II' && upper !== 'NIFTY FUT-III') {
      const fyersSym = resolved.fyersSymbol;
      if (fyersSym && fyersSym.includes(':')) {
        this.brokerProvider.subscribe([fyersSym]);
        if (!this.monitoredSymbols.has(fyersSym)) {
          this.monitoredSymbols.add(fyersSym);
          // Cap REST fallback set to 40 symbols so a single REST call covers them safely
          if (this.monitoredSymbols.size > 40) {
            for (const existing of this.monitoredSymbols) {
              if (existing !== 'NSE:NIFTY50-INDEX' && !existing.includes('FUT')) {
                this.monitoredSymbols.delete(existing);
                break;
              }
            }
          }
          console.log(`[MarketEngine] Subscribed to live stream for: ${symbol} (${fyersSym})`);
        }
      }
    }

    if (this.brokerProvider.isConnected() && !this.brokerProvider.isRateLimited()) {
      const wsSilent = Date.now() - this.brokerProvider.getLastSocketTickAt() > 6000;
      if (wsSilent) {
        this.syncQuotes().catch(() => {});
      }
    } else if (!isFuture) {
      this.publicProvider.fetchSingleQuote(upper).then((q) => {
        if (q) {
          this.storePublicQuote(upper, q);
          this.notifyListeners(this.buildPayload());
        }
      }).catch(() => {});
    }
  }

  /**
   * On-demand quote hydration for Watchlist segments (cache & WebSocket first to save API quota)
   */
  public async fetchOnDemandQuotes(symbols: string[]): Promise<SecurityQuote[]> {
    if (!symbols || symbols.length === 0) return [];
    await symbolMaster.ensureLoaded();

    const limited = symbols.slice(0, 60);
    const now = Date.now();
    const freshnessMs = 6000;

    if (this.brokerProvider.isConnected()) {
      const reqToFyers = new Map<string, string>();
      const staleFyers: string[] = [];
      const allFyers: string[] = [];

      for (const s of limited) {
        const key = s.toUpperCase();
        const fs = symbolMaster.resolveInstrument(s).fyersSymbol;
        reqToFyers.set(key, fs);
        if (fs && fs.includes(':')) {
          allFyers.push(fs);
          const lastAt = Math.max(
            this.quoteUpdatedAt.get(key) || 0,
            this.quoteUpdatedAt.get(fs.toUpperCase()) || 0
          );
          if (now - lastAt > freshnessMs) {
            staleFyers.push(fs);
          }
        }
      }

      // Subscribe requested symbols on WebSocket so subsequent ticks stream without REST polling
      if (allFyers.length > 0) {
        this.brokerProvider.subscribe(allFyers);
      }

      const byFyers = new Map<string, SecurityQuote>();
      const uniqueStale = Array.from(new Set(staleFyers));
      if (uniqueStale.length > 0 && !this.brokerProvider.isRateLimited()) {
        const quotes = await this.brokerProvider.fetchQuotes(uniqueStale);
        for (const q of quotes) {
          this.storeFyersQuote(q);
          byFyers.set(q.symbol.toUpperCase(), q);
        }
      }

      const out: SecurityQuote[] = [];
      for (const s of limited) {
        const upper = s.toUpperCase();
        const fs = reqToFyers.get(upper)?.toUpperCase();
        const q =
          (fs && byFyers.get(fs)) ||
          this.customQuotes.get(upper) ||
          (fs ? this.customQuotes.get(fs) : undefined);
        if (q) out.push({ ...q, symbol: s });
      }
      return out;
    }

    // Public fallback (Equities & Indices only)
    const cashSymbols = limited.filter((s) => {
      const r = symbolMaster.resolveInstrument(s).instrument;
      return !r || (r.category !== 'INDEX_FUTURES' && r.category !== 'STOCK_FUTURES');
    });
    const staleCash = cashSymbols.filter((s) => now - (this.quoteUpdatedAt.get(s.toUpperCase()) || 0) > freshnessMs);
    if (staleCash.length > 0) {
      const pubQuotes = await this.publicProvider.fetchQuotes(staleCash);
      for (const q of pubQuotes) {
        this.storePublicQuote(q.symbol, q);
      }
    }
    const pubOut: SecurityQuote[] = [];
    for (const s of cashSymbols) {
      const q = this.customQuotes.get(s.toUpperCase());
      if (q) pubOut.push(q);
    }
    return pubOut;
  }

  private storePublicQuote(rawSym: string, q: SecurityQuote): void {
    const upper = rawSym.trim().toUpperCase();
    const now = Date.now();
    this.quoteUpdatedAt.set(upper, now);
    if (upper === 'NIFTY 50' || upper === 'NIFTY' || upper === 'NIFTY50') {
      this.quoteUpdatedAt.set('NIFTY 50', now);
      this.spotPrice = q.ltp;
      this.spotOpen = q.open || q.ltp;
      this.spotHigh = q.high || q.ltp;
      this.spotLow = q.low || q.ltp;
      this.spotPrevClose = parseFloat((q.ltp - q.change).toFixed(2));
      this.spotVwap = q.vwap || this.spotVwap;
      this.activeCandle = {
        time: Math.floor(Date.now() / 1000) + 19800,
        open: this.spotOpen,
        high: this.spotHigh,
        low: this.spotLow,
        close: this.spotPrice
      };
      return;
    }

    if (upper === 'INDIA VIX') {
      this.indiaVix = q.ltp;
    }

    this.customQuotes.set(upper, { ...q, symbol: upper });
    if (upper === 'NIFTY BANK' || upper === 'BANK NIFTY') {
      this.quoteUpdatedAt.set('NIFTY BANK', now);
      this.quoteUpdatedAt.set('BANK NIFTY', now);
      this.customQuotes.set('NIFTY BANK', { ...q, symbol: 'NIFTY BANK' });
      this.customQuotes.set('BANK NIFTY', { ...q, symbol: 'BANK NIFTY' });
    }
  }

  /**
   * Public NSE/Yahoo real-data fallback synchronization (used when FYERS token isn't active)
   */
  public async syncPublicQuotes(includeCoreSymbols: boolean = false): Promise<void> {
    if (this.publicSyncInFlight) return;
    this.publicSyncInFlight = true;
    try {
      const targetSet = new Set<string>(this.rawMonitoredSymbols);
      if (includeCoreSymbols) {
        CORE_PUBLIC_SYMBOLS.forEach((s) => targetSet.add(s));
      }
      // Exclude synthetic future aliases from Yahoo batch
      targetSet.delete('NIFTY FUT-I');
      targetSet.delete('NIFTY FUT-II');
      targetSet.delete('NIFTY FUT-III');

      const symbols = Array.from(targetSet);
      const batchSize = 10;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const quotes = await this.publicProvider.fetchQuotes(batch);
        for (const q of quotes) {
          this.storePublicQuote(q.symbol, q);
          this.lastDataUpdateAt = Date.now();
        }
        // Emit immediately after the priority first batch (NIFTY 50 + Highlight defaults) and on completion
        if (i === 0 || i + batchSize >= symbols.length) {
          this.notifyListeners(this.buildPayload());
        }
      }
    } catch (err) {
      console.error('[MarketEngine] Public fallback quote sync error:', err);
    } finally {
      this.publicSyncInFlight = false;
    }
  }

  private storeFyersQuote(q: SecurityQuote): void {
    const fUpper = q.symbol.toUpperCase();
    const now = Date.now();
    this.customQuotes.set(fUpper, q);
    this.quoteUpdatedAt.set(fUpper, now);

    const bare = fUpper.replace(/^NSE:/, '').replace(/-EQ$/, '').replace(/-INDEX$/, '');
    this.customQuotes.set(bare, { ...q, symbol: bare });
    this.quoteUpdatedAt.set(bare, now);

    if (bare === 'NIFTYBANK' || bare === 'NIFTY BANK') {
      this.quoteUpdatedAt.set('NIFTY BANK', now);
      this.quoteUpdatedAt.set('BANK NIFTY', now);
      this.customQuotes.set('NIFTY BANK', { ...q, symbol: 'NIFTY BANK' });
      this.customQuotes.set('BANK NIFTY', { ...q, symbol: 'BANK NIFTY' });
    }
    if (bare === 'INDIAVIX' || bare === 'INDIA VIX') {
      this.indiaVix = q.ltp;
    }

    // Mirror Current-month Futures quote onto TradingView continuous alias (e.g. RELIANCE1!, NIFTY1!)
    const resolved = symbolMaster.resolveInstrument(fUpper).instrument;
    if (resolved && resolved.futuresRole === 'CURRENT') {
      this.quoteUpdatedAt.set(`${resolved.underlying}1!`, now);
      this.customQuotes.set(`${resolved.underlying}1!`, { ...q, symbol: `${resolved.underlying}1!` });
    }

    // Update live NIFTY Futures basis spreads when real NIFTY Future quotes arrive
    const niftyContracts = symbolMaster.getNiftyMonthlyContracts();
    if (niftyContracts.current && fUpper === niftyContracts.current.fyersSymbol.toUpperCase() && this.spotPrice > 0) {
      this.fut1Spread = parseFloat((q.ltp - this.spotPrice).toFixed(2));
    } else if (niftyContracts.next && fUpper === niftyContracts.next.fyersSymbol.toUpperCase() && this.spotPrice > 0) {
      this.fut2Spread = parseFloat((q.ltp - this.spotPrice).toFixed(2));
    } else if (niftyContracts.far && fUpper === niftyContracts.far.fyersSymbol.toUpperCase() && this.spotPrice > 0) {
      this.fut3Spread = parseFloat((q.ltp - this.spotPrice).toFixed(2));
    }
  }

  /**
   * Quota-safe backup quote synchronization (runs when streaming socket isn't delivering ticks)
   */
  public async syncQuotes(): Promise<void> {
    if (!this.brokerProvider.isConnected() || this.brokerProvider.isRateLimited()) return;
    if (this.quoteSyncInFlight) return;
    this.quoteSyncInFlight = true;
    try {
      const symbols = Array.from(this.monitoredSymbols).slice(0, 45);
      const quotes = await this.brokerProvider.fetchQuotes(symbols);
      if (quotes.length > 0) {
        this.lastDataUpdateAt = Date.now();
        this.consecutiveRestFailures = 0;
      } else {
        this.consecutiveRestFailures++;
      }

      const nifty = quotes.find((q) => q.symbol === 'NSE:NIFTY50-INDEX');
      if (nifty && nifty.ltp > 0) {
        this.spotPrice = nifty.ltp;
        this.spotOpen = nifty.open || nifty.ltp;
        this.spotHigh = nifty.high || nifty.ltp;
        this.spotLow = nifty.low || nifty.ltp;
        this.spotPrevClose = parseFloat((nifty.ltp - nifty.change).toFixed(2));
        this.spotVwap = nifty.vwap || this.spotVwap;
        this.activeCandle = {
          time: Math.floor(Date.now() / 1000) + 19800,
          open: this.spotOpen,
          high: this.spotHigh,
          low: this.spotLow,
          close: this.spotPrice
        };
      }

      for (const q of quotes) {
        if (q.symbol !== 'NSE:NIFTY50-INDEX') {
          this.storeFyersQuote(q);
        }
      }

      const payload = this.buildPayload();
      this.notifyListeners(payload);
    } catch (err) {
      this.consecutiveRestFailures++;
      console.error('[MarketEngine] Quote sync error:', err);
    } finally {
      this.quoteSyncInFlight = false;
    }
  }

  /**
   * Option chain synchronization (ONLY fetches when explicitly enabled by user; 2s interval)
   */
  public async syncOptionChain(expiryTimestamp?: string, force: boolean = false): Promise<boolean> {
    if (!this.optionChainEnabled && !force) return false;
    if (!this.brokerProvider.isConnected() || this.brokerProvider.isRateLimited()) return false;
    if (this.optionSyncInFlight) return false;
    this.optionSyncInFlight = true;
    try {
      const chainData = await this.brokerProvider.fetchOptionChain(expiryTimestamp || this.selectedExpiry);
      if (chainData) {
        if (chainData.rows.length > 0) {
          this.cachedOptionChain = chainData.rows;
        }
        if (chainData.expiries && chainData.expiries.length > 0) {
          this.expiries = chainData.expiries;
        }
        if (chainData.selectedExpiry) {
          this.selectedExpiry = chainData.selectedExpiry;
        }
        if (chainData.futPrice > chainData.spotPrice) {
          this.fut1Spread = parseFloat((chainData.futPrice - chainData.spotPrice).toFixed(2));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[MarketEngine] Option chain sync error:', err);
      return false;
    } finally {
      this.optionSyncInFlight = false;
    }
  }

  public async syncWithBroker(expiryTimestamp?: string): Promise<void> {
    try {
      await this.syncQuotes();
      if (this.optionChainEnabled) {
        await this.syncOptionChain(expiryTimestamp);
      }
      console.log(`[MarketEngine] Synced Feed: Spot=${this.spotPrice}, Spread=+${this.fut1Spread} pts, Expiries=${this.expiries.length}, Strikes=${this.cachedOptionChain?.length || 0}`);
      const payload = this.buildPayload();
      this.notifyListeners(payload);
    } catch (err) {
      console.error('[MarketEngine] Feed sync error:', err);
    }
  }

  public async changeOptionExpiry(expiryTimestamp: string): Promise<MarketSnapshotPayload> {
    this.selectedExpiry = expiryTimestamp;
    if (this.optionChainEnabled) {
      await this.syncOptionChain(expiryTimestamp);
    }
    const payload = this.buildPayload();
    this.notifyListeners(payload);
    return payload;
  }

  public subscribe(listener: (payload: MarketSnapshotPayload) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public isBrokerConnected(): boolean {
    return this.brokerProvider.isConnected();
  }

  public getFeedHealth(): { feedStatus: FeedHealthStatus; lastDataUpdateAt: string } {
    const isConnected = this.brokerProvider.isConnected();
    const marketOpen = isIndianMarketOpen();
    const now = Date.now();
    let feedStatus: FeedHealthStatus = 'PUBLIC';

    if (!isConnected) {
      feedStatus = this.lastDataUpdateAt > 0 ? 'PUBLIC' : 'OFFLINE';
    } else if (this.brokerProvider.isRateLimited()) {
      feedStatus = 'RATE_LIMITED';
    } else if (marketOpen && this.lastDataUpdateAt > 0 && now - this.lastDataUpdateAt > 25000) {
      feedStatus = 'STALE';
    } else {
      feedStatus = 'LIVE';
    }

    return {
      feedStatus,
      lastDataUpdateAt: this.lastDataUpdateAt > 0 ? new Date(this.lastDataUpdateAt).toISOString() : new Date().toISOString()
    };
  }

  public async updateBrokerToken(tokenOrAuthCode: string) {
    const res = await this.brokerProvider.updateToken(tokenOrAuthCode);
    if (res.success) {
      this.consecutiveRestFailures = 0;
      const socketSubList: string[] = [];
      for (const sym of CORE_PUBLIC_SYMBOLS) {
        const fs = symbolMaster.resolveInstrument(sym).fyersSymbol;
        if (fs && fs.includes(':')) socketSubList.push(fs);
      }
      this.brokerProvider.subscribe(socketSubList);
      await this.syncWithBroker();
    }
    return res;
  }

  public start(): void {
    if (this.timer) return;

    // 1. Live streaming watchdog + quota-safe backup REST loop + live Heatmap/Public fallback sync
    this.timer = setInterval(async () => {
      const now = Date.now();
      if (isIndianMarketOpen()) {
        const connected = this.brokerProvider.isConnected();
        const socketHealthy = connected && this.brokerProvider.isSocketConnected() && now - this.brokerProvider.getLastSocketTickAt() <= 20000;
        const rateLimited = connected && this.brokerProvider.isRateLimited();

        if (this.activeClientCount > 0 && connected && !socketHealthy && !rateLimited && now - this.lastRestPoll >= 15000) {
          // Ultra-safe 15s backup polling ONLY when viewers are active and WebSocket stream is silent (~4 req/min max)
          this.lastRestPoll = now;
          await this.syncQuotes();
        }

        // Transparent fallback to public NSE feed whenever disconnected, rate-limited, or REST failing repeatedly
        const needsPublicFallback =
          !connected ||
          rateLimited ||
          (this.consecutiveRestFailures >= 3 && now - this.lastDataUpdateAt > 15000);

        if (needsPublicFallback && this.activeClientCount > 0) {
          if (now - this.lastPublicCorePoll >= 15000) {
            this.lastPublicCorePoll = now;
            await this.syncPublicQuotes(true); // Keeps all 50 NIFTY Heatmap constituents live
          } else if (now - this.lastPublicPoll >= 5000) {
            this.lastPublicPoll = now;
            await this.syncPublicQuotes(false);
          }
        }
      } else {
        // Off-market keepalive: broadcast every 15s and refresh closing values every 10m if disconnected
        if (!this.brokerProvider.isConnected() && now - this.lastPublicRefreshOffHours >= 600000) {
          this.lastPublicRefreshOffHours = now;
          await this.syncPublicQuotes(true);
        }
        if (this.activeClientCount > 0 && now - this.lastOffMarketBroadcast >= 15000) {
          this.lastOffMarketBroadcast = now;
          const payload = this.buildPayload();
          this.notifyListeners(payload);
        }
      }
    }, this.intervalMs);

    // 2. Live 2-second option chain sync loop (runs ONLY when explicitly enabled by user)
    this.optionTimer = setInterval(async () => {
      if (
        this.optionChainEnabled &&
        this.activeClientCount > 0 &&
        isIndianMarketOpen() &&
        this.brokerProvider.isConnected() &&
        !this.brokerProvider.isRateLimited()
      ) {
        const updated = await this.syncOptionChain();
        if (updated) {
          this.lastDataUpdateAt = Date.now();
          this.notifyListeners(this.buildPayload());
        }
      }
    }, 2000);

    console.log(`[MarketEngine] Market engine active with WebSocket stream & quota-safe fallback.`);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.optionTimer) {
      clearInterval(this.optionTimer);
      this.optionTimer = null;
    }
  }

  public getSnapshot(): MarketSnapshotPayload {
    return this.buildPayload();
  }

  private notifyListeners(payload: MarketSnapshotPayload): void {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('[MarketEngine] Listener error:', err);
      }
    });
  }

  private buildPayload(): MarketSnapshotPayload {
    const spot = this.spotPrice;
    const fut1 = parseFloat((spot + this.fut1Spread).toFixed(2));
    const fut2 = parseFloat((spot + this.fut2Spread).toFixed(2));
    const fut3 = parseFloat((spot + this.fut3Spread).toFixed(2));

    const spotChange = parseFloat((spot - this.spotPrevClose).toFixed(2));
    const spotChangePct = parseFloat(((spotChange / this.spotPrevClose) * 100).toFixed(2));

    const fut1Change = parseFloat((fut1 - (this.spotPrevClose + 175)).toFixed(2));
    const fut1ChangePct = parseFloat(((fut1Change / (this.spotPrevClose + 175)) * 100).toFixed(2));

    const fut2Change = parseFloat((fut2 - (this.spotPrevClose + 270)).toFixed(2));
    const fut2ChangePct = parseFloat(((fut2Change / (this.spotPrevClose + 270)) * 100).toFixed(2));

    const fut3Change = parseFloat((fut3 - (this.spotPrevClose + 375)).toFixed(2));
    const fut3ChangePct = parseFloat(((fut3Change / (this.spotPrevClose + 375)) * 100).toFixed(2));

    const securities: SecurityQuote[] = [
      {
        id: 'nifty-spot',
        name: 'Nifty 50 Spot',
        symbol: 'NIFTY 50',
        ltp: spot,
        change: spotChange,
        changePct: spotChangePct,
        high: this.spotHigh,
        low: this.spotLow,
        open: this.spotOpen,
        vwap: this.spotVwap,
        volume: `${this.spotVolumeM.toFixed(1)}M`
      },
      {
        id: 'nifty-fut-1',
        name: 'Nifty Fut #1 (Current)',
        symbol: 'NIFTY FUT-I',
        ltp: fut1,
        change: fut1Change,
        changePct: fut1ChangePct,
        high: parseFloat((fut1 + 25).toFixed(2)),
        low: parseFloat((fut1 - 45).toFixed(2)),
        open: parseFloat((fut1 - 30).toFixed(2)),
        vwap: parseFloat((fut1 - 5).toFixed(2)),
        volume: '9.8M'
      },
      {
        id: 'nifty-fut-2',
        name: 'Nifty Fut #2 (Next)',
        symbol: 'NIFTY FUT-II',
        ltp: fut2,
        change: fut2Change,
        changePct: fut2ChangePct,
        high: parseFloat((fut2 + 25).toFixed(2)),
        low: parseFloat((fut2 - 45).toFixed(2)),
        open: parseFloat((fut2 - 30).toFixed(2)),
        vwap: parseFloat((fut2 - 5).toFixed(2)),
        volume: '1.4M'
      },
      {
        id: 'nifty-fut-3',
        name: 'Nifty Fut #3 (Far)',
        symbol: 'NIFTY FUT-III',
        ltp: fut3,
        change: fut3Change,
        changePct: fut3ChangePct,
        high: parseFloat((fut3 + 25).toFixed(2)),
        low: parseFloat((fut3 - 45).toFixed(2)),
        open: parseFloat((fut3 - 30).toFixed(2)),
        vwap: parseFloat((fut3 - 5).toFixed(2)),
        volume: '240K'
      }
    ];

    const s1Pts = parseFloat((fut1 - spot).toFixed(2));
    const s1Pct = parseFloat(((s1Pts / spot) * 100).toFixed(2));
    const s1Yield = parseFloat(((s1Pct / 17) * 365).toFixed(2));

    const s2Pts = parseFloat((fut2 - fut1).toFixed(2));
    const s2Pct = parseFloat(((s2Pts / fut1) * 100).toFixed(2));
    const s2Yield = parseFloat(((s2Pct / 30) * 365).toFixed(2));

    const s3Pts = parseFloat((fut3 - fut2).toFixed(2));
    const s3Pct = parseFloat(((s3Pts / fut2) * 100).toFixed(2));
    const s3Yield = parseFloat(((s3Pct / 30) * 365).toFixed(2));

    const s4Pts = parseFloat((fut3 - fut1).toFixed(2));
    const s4Pct = parseFloat(((s4Pts / fut1) * 100).toFixed(2));
    const s4Yield = parseFloat(((s4Pct / 60) * 365).toFixed(2));

    const basisSpreads: BasisSpreadPair[] = [
      {
        id: 'nifty-fut1',
        name: 'Nifty ↔ Nifty Fut #1',
        leg1: 'NIFTY SPOT',
        leg2: 'NIFTY FUT-I',
        price1: spot,
        price2: fut1,
        spread: s1Pts,
        spreadPct: s1Pct,
        annualizedYield: s1Yield,
        isDefault: true
      },
      {
        id: 'fut1-fut2',
        name: 'Nifty Fut #1 ↔ Nifty Fut #2',
        leg1: 'NIFTY FUT-I',
        leg2: 'NIFTY FUT-II',
        price1: fut1,
        price2: fut2,
        spread: s2Pts,
        spreadPct: s2Pct,
        annualizedYield: s2Yield
      },
      {
        id: 'fut2-fut3',
        name: 'Nifty Fut #2 ↔ Nifty Fut #3',
        leg1: 'NIFTY FUT-II',
        leg2: 'NIFTY FUT-III',
        price1: fut2,
        price2: fut3,
        spread: s3Pts,
        spreadPct: s3Pct,
        annualizedYield: s3Yield
      },
      {
        id: 'fut1-fut3',
        name: 'Nifty Fut #1 ↔ Nifty Fut #3',
        leg1: 'NIFTY FUT-I',
        leg2: 'NIFTY FUT-III',
        price1: fut1,
        price2: fut3,
        spread: s4Pts,
        spreadPct: s4Pct,
        annualizedYield: s4Yield
      }
    ];

    const optionChain = (this.cachedOptionChain && this.cachedOptionChain.length > 0)
      ? this.cachedOptionChain
      : [];

    const marketStatus: MarketStatus = isIndianMarketOpen() ? 'OPEN' : 'CLOSED';
    const customList = Array.from(this.customQuotes.values());
    const allSecurities = [...securities, ...customList];
    const health = this.getFeedHealth();

    return {
      securities: allSecurities,
      basisSpreads,
      optionChain,
      expiries: this.expiries,
      selectedExpiry: this.selectedExpiry,
      latestCandle: { ...this.activeCandle },
      spotPrice: spot,
      fut1Price: fut1,
      pcr: 1.18,
      maxPain: Math.round(spot / 50) * 50,
      indiaVix: this.indiaVix,
      marketStatus,
      dataSource: this.brokerProvider.isConnected() && health.feedStatus === 'LIVE' ? 'FYERS' : 'PUBLIC',
      isBrokerConnected: this.brokerProvider.isConnected(),
      feedStatus: health.feedStatus,
      lastDataUpdateAt: health.lastDataUpdateAt,
      optionChainEnabled: this.optionChainEnabled
    };
  }
}

// Global Singleton Engine
export const marketEngine = new MarketEngine();
