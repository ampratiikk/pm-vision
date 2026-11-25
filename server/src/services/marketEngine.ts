import {
  MarketSnapshotPayload,
  SecurityQuote,
  BasisSpreadPair,
  OptionRow,
  ChartCandleTick,
  ExpiryOption,
  MarketStatus
} from '@pm-vision/shared';
import { FyersBrokerProvider, isIndianMarketOpen } from './broker/FyersBrokerProvider.js';
import { PublicMarketDataProvider } from './broker/PublicMarketDataProvider.js';

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
  private lastPublicPoll: number = 0;
  private lastPublicRefreshOffHours: number = Date.now();
  private publicSyncInFlight: boolean = false;

  // Active symbols monitored for live streaming
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

    this.brokerProvider.connect({}).then(async (connected: boolean) => {
      if (connected) {
        console.log('[MarketEngine] FYERS authenticated. Syncing real exchange data...');
        await this.syncWithBroker();
        setInterval(() => {
          if (this.brokerProvider.isConnected()) {
            this.syncWithBroker();
          }
        }, 60000);
      } else {
        console.log('[MarketEngine] FYERS token absent/expired. Hydrating real market snapshot via public NSE/Yahoo feed...');
        await this.syncPublicQuotes(true);
      }
    });
  }

  public getBrokerProvider(): FyersBrokerProvider {
    return this.brokerProvider;
  }

  public getPublicProvider(): PublicMarketDataProvider {
    return this.publicProvider;
  }

  /**
   * Unified history retrieval: tries FYERS first if connected, otherwise transparently
   * falls back to real public NSE/Yahoo historical data so charts always display accurate candles.
   */
  public async fetchHistory(
    resolution: string = '15m',
    symbol: string = 'NIFTY 50'
  ): Promise<{ candles: ChartCandleTick[]; casPrice?: number; source: 'FYERS' | 'PUBLIC' }> {
    const cleanSym = symbol.trim();
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

    if (candles.length === 0) {
      const pubRes = await this.publicProvider.fetchHistoryWithMeta(resolution, cleanSym);
      candles = pubRes.candles;
      metaPrice = pubRes.regularMarketPrice;
      source = 'PUBLIC';

      // Adjust spot candles cleanly if a synthetic NIFTY Futures contract was requested offline
      const upper = cleanSym.toUpperCase();
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
    const upper = cleanSym.toUpperCase();
    if (upper === 'NIFTY 50') {
      if (metaPrice && metaPrice > 0 && !this.brokerProvider.isConnected()) {
        this.spotPrice = metaPrice;
      }
      casPrice = this.spotPrice;
    } else {
      const sec = this.customQuotes.get(upper) || this.buildPayload().securities.find((s) => s.symbol.toUpperCase() === upper);
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
    this.rawMonitoredSymbols.add(upper);

    if (upper !== 'NIFTY FUT-I' && upper !== 'NIFTY FUT-II' && upper !== 'NIFTY FUT-III') {
      const fyersSym = this.brokerProvider.toFyersSymbol(upper);
      if (!this.monitoredSymbols.has(fyersSym)) {
        this.monitoredSymbols.add(fyersSym);
        console.log(`[MarketEngine] Subscribed to live quotes for: ${symbol} (${fyersSym})`);
      }
    }

    if (this.brokerProvider.isConnected()) {
      this.syncQuotes().catch(() => {});
    } else {
      this.publicProvider.fetchSingleQuote(upper).then((q) => {
        if (q) {
          this.storePublicQuote(upper, q);
          this.notifyListeners(this.buildPayload());
        }
      }).catch(() => {});
    }
  }

  private storePublicQuote(rawSym: string, q: SecurityQuote): void {
    const upper = rawSym.trim().toUpperCase();
    if (upper === 'NIFTY 50' || upper === 'NIFTY' || upper === 'NIFTY50') {
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

  /**
   * Fast quote synchronization (runs every 1.5s during market hours)
   */
  public async syncQuotes(): Promise<void> {
    if (!this.brokerProvider.isConnected()) return;
    try {
      const symbols = Array.from(this.monitoredSymbols);
      const quotes = await this.brokerProvider.fetchQuotes(symbols);
      const nifty = quotes.find((q) => q.symbol === 'NSE:NIFTY50-INDEX');
      if (nifty && nifty.ltp > 0) {
        this.spotPrice = nifty.ltp;
        this.spotOpen = nifty.open || nifty.ltp;
        this.spotHigh = nifty.high || nifty.ltp;
        this.spotLow = nifty.low || nifty.ltp;
        this.spotPrevClose = parseFloat((nifty.ltp - nifty.change).toFixed(2));
        this.spotVwap = nifty.vwap || this.spotVwap;
        this.activeCandle = {
          time: Math.floor(Date.now() / 1000),
          open: this.spotOpen,
          high: this.spotHigh,
          low: this.spotLow,
          close: this.spotPrice
        };
      }

      for (const q of quotes) {
        if (q.symbol !== 'NSE:NIFTY50-INDEX') {
          this.customQuotes.set(q.symbol, q);
          // Also set bare symbol name (e.g. RELIANCE, TCS)
          const bare = q.symbol.replace(/^NSE:/, '').replace(/-EQ$/, '').replace(/-INDEX$/, '');
          this.customQuotes.set(bare, { ...q, symbol: bare });
          if (bare === 'NIFTYBANK' || bare === 'NIFTY BANK') {
            this.customQuotes.set('NIFTY BANK', { ...q, symbol: 'NIFTY BANK' });
            this.customQuotes.set('BANK NIFTY', { ...q, symbol: 'BANK NIFTY' });
          }
          if (bare === 'INDIAVIX' || bare === 'INDIA VIX') {
            this.indiaVix = q.ltp;
          }
        }
      }

      const payload = this.buildPayload();
      this.notifyListeners(payload);
    } catch (err) {
      console.error('[MarketEngine] Quote sync error:', err);
    }
  }

  /**
   * Option chain synchronization (runs every 30s during market hours)
   */
  public async syncOptionChain(expiryTimestamp?: string): Promise<void> {
    if (!this.brokerProvider.isConnected()) return;
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
      }
    } catch (err) {
      console.error('[MarketEngine] Option chain sync error:', err);
    }
  }

  public async syncWithBroker(expiryTimestamp?: string): Promise<void> {
    try {
      await this.syncQuotes();
      await this.syncOptionChain(expiryTimestamp);
      console.log(`[MarketEngine] Synced FYERS: Spot=${this.spotPrice}, Spread=+${this.fut1Spread} pts, Expiries=${this.expiries.length}, Strikes=${this.cachedOptionChain?.length || 0}`);
      const payload = this.buildPayload();
      this.notifyListeners(payload);
    } catch (err) {
      console.error('[MarketEngine] Broker sync error:', err);
    }
  }

  public async changeOptionExpiry(expiryTimestamp: string): Promise<MarketSnapshotPayload> {
    this.selectedExpiry = expiryTimestamp;
    await this.syncOptionChain(expiryTimestamp);
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

  public async updateBrokerToken(tokenOrAuthCode: string) {
    const res = await this.brokerProvider.updateToken(tokenOrAuthCode);
    if (res.success) {
      await this.syncWithBroker();
    }
    return res;
  }

  public start(): void {
    if (this.timer) return;

    // 1. Fast quote polling loop (every 1.5s FYERS / every 4s Public fallback during market hours)
    this.timer = setInterval(async () => {
      const now = Date.now();
      if (isIndianMarketOpen()) {
        if (this.brokerProvider.isConnected()) {
          await this.syncQuotes();
        }
        // Fallback live polling if FYERS is disconnected (or became disconnected on 401)
        if (!this.brokerProvider.isConnected() && now - this.lastPublicPoll >= 4000) {
          this.lastPublicPoll = now;
          await this.syncPublicQuotes(false);
        }
      } else {
        // Off-market keepalive: broadcast every 15s and refresh public closing values every 10m if broker disconnected
        if (!this.brokerProvider.isConnected() && now - this.lastPublicRefreshOffHours >= 600000) {
          this.lastPublicRefreshOffHours = now;
          await this.syncPublicQuotes(true);
        }
        if (now - this.lastOffMarketBroadcast >= 15000) {
          this.lastOffMarketBroadcast = now;
          const payload = this.buildPayload();
          this.notifyListeners(payload);
        }
      }
    }, this.intervalMs);

    // 2. Slower option chain sync loop (every 30 seconds during market hours)
    this.optionTimer = setInterval(async () => {
      if (isIndianMarketOpen() && this.brokerProvider.isConnected()) {
        await this.syncOptionChain();
      }
    }, 30000);

    console.log(`[MarketEngine] Market engine active with live & fallback quote streaming.`);
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
      dataSource: this.brokerProvider.isConnected() ? 'FYERS' : 'PUBLIC',
      isBrokerConnected: this.brokerProvider.isConnected()
    };
  }
}

// Global Singleton Engine
export const marketEngine = new MarketEngine();
