import {
  MarketSnapshotPayload,
  SecurityQuote,
  BasisSpreadPair,
  OptionRow,
  ChartCandleTick
} from '@pm-vision/shared';
import { FyersBrokerProvider } from './broker/FyersBrokerProvider.js';

export class MarketEngine {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 800; // 800ms ticks for smooth live action
  private listeners: Array<(payload: MarketSnapshotPayload) => void> = [];

  // Underlying Market State
  private spotPrice: number = 24700.80;
  private spotOpen: number = 24650.00;
  private spotPrevClose: number = 24590.20;
  private spotHigh: number = 24740.00;
  private spotLow: number = 24590.20;
  private spotVwap: number = 24682.40;
  private spotVolumeM: number = 14.2;

  // Futures Spreads from Spot
  private fut1Spread: number = 84.60;
  private fut2Spread: number = 159.40;
  private fut3Spread: number = 244.20;
  private giftSpread: number = 109.20;

  // Active Candle
  private activeCandle: ChartCandleTick = {
    time: '2026-02-27',
    open: 24650.00,
    high: 24740.00,
    low: 24590.20,
    close: 24700.80
  };

  // Optional Broker Provider
  private brokerProvider: FyersBrokerProvider;

  constructor() {
    this.brokerProvider = new FyersBrokerProvider();
    // Attempt connecting to broker if credentials exist
    this.brokerProvider.connect({}).then((connected: boolean) => {
      if (connected) {
        console.log('[MarketEngine] Using Live Broker Data Feed.');
        this.brokerProvider.onTick((tick: SecurityQuote) => {
          this.applyExternalTick(tick);
        });
      } else {
        console.log('[MarketEngine] Using Autonomous Real-Time Market Simulation Engine.');
      }
    });
  }

  public subscribe(listener: (payload: MarketSnapshotPayload) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      const payload = this.generateTick();
      this.listeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error('[MarketEngine] Listener error:', err);
        }
      });
    }, this.intervalMs);

    console.log(`[MarketEngine] Started live tick streaming every ${this.intervalMs}ms.`);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getSnapshot(): MarketSnapshotPayload {
    return this.buildPayload();
  }

  private applyExternalTick(tick: SecurityQuote): void {
    if (tick.symbol === 'NIFTY 50' || tick.symbol.includes('NIFTY')) {
      this.spotPrice = tick.ltp;
      if (tick.high) this.spotHigh = Math.max(this.spotHigh, tick.high);
      if (tick.low) this.spotLow = Math.min(this.spotLow, tick.low);
      this.activeCandle.close = this.spotPrice;
      this.activeCandle.high = Math.max(this.activeCandle.high, this.spotPrice);
      this.activeCandle.low = Math.min(this.activeCandle.low, this.spotPrice);
    }
  }

  private generateTick(): MarketSnapshotPayload {
    // Realistic brownian micro-step for Nifty (±0.40 to ±2.80 points)
    // Mean reverting slightly if drifting too far from 24,700
    const drift = (24700 - this.spotPrice) * 0.005;
    const delta = (Math.random() - 0.495) * 2.2 + drift;
    
    this.spotPrice = parseFloat((this.spotPrice + delta).toFixed(2));
    this.spotHigh = Math.max(this.spotHigh, this.spotPrice);
    this.spotLow = Math.min(this.spotLow, this.spotPrice);
    this.spotVolumeM = parseFloat((this.spotVolumeM + Math.random() * 0.005).toFixed(3));
    this.spotVwap = parseFloat(((this.spotVwap * 0.999) + (this.spotPrice * 0.001)).toFixed(2));

    // Dynamic micro-movements in basis spreads (subtle 0.05 to 0.25 pt changes)
    this.fut1Spread = parseFloat((this.fut1Spread + (Math.random() - 0.5) * 0.35).toFixed(2));
    // Keep spread realistic between 70 and 98 pts
    if (this.fut1Spread < 70) this.fut1Spread = 70.5;
    if (this.fut1Spread > 98) this.fut1Spread = 97.5;

    this.fut2Spread = parseFloat((this.fut2Spread + (Math.random() - 0.5) * 0.4).toFixed(2));
    this.fut3Spread = parseFloat((this.fut3Spread + (Math.random() - 0.5) * 0.4).toFixed(2));
    this.giftSpread = parseFloat((this.giftSpread + (Math.random() - 0.5) * 0.5).toFixed(2));

    // Update active chart candle
    this.activeCandle.close = this.spotPrice;
    this.activeCandle.high = Math.max(this.activeCandle.high, this.spotPrice);
    this.activeCandle.low = Math.min(this.activeCandle.low, this.spotPrice);

    return this.buildPayload();
  }

  private buildPayload(): MarketSnapshotPayload {
    const spot = this.spotPrice;
    const fut1 = parseFloat((spot + this.fut1Spread).toFixed(2));
    const fut2 = parseFloat((spot + this.fut2Spread).toFixed(2));
    const fut3 = parseFloat((spot + this.fut3Spread).toFixed(2));
    const gift = parseFloat((spot + this.giftSpread).toFixed(2));

    const spotChange = parseFloat((spot - this.spotPrevClose).toFixed(2));
    const spotChangePct = parseFloat(((spotChange / this.spotPrevClose) * 100).toFixed(2));

    const fut1Change = parseFloat((fut1 - (this.spotPrevClose + 80)).toFixed(2));
    const fut1ChangePct = parseFloat(((fut1Change / (this.spotPrevClose + 80)) * 100).toFixed(2));

    const fut2Change = parseFloat((fut2 - (this.spotPrevClose + 155)).toFixed(2));
    const fut2ChangePct = parseFloat(((fut2Change / (this.spotPrevClose + 155)) * 100).toFixed(2));

    const fut3Change = parseFloat((fut3 - (this.spotPrevClose + 240)).toFixed(2));
    const fut3ChangePct = parseFloat(((fut3Change / (this.spotPrevClose + 240)) * 100).toFixed(2));

    const giftChange = parseFloat((gift - (this.spotPrevClose + 100)).toFixed(2));
    const giftChangePct = parseFloat(((giftChange / (this.spotPrevClose + 100)) * 100).toFixed(2));

    // 1. Securities List (for Highlight Window and Quick Ticker)
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
        volume: '8.5M'
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
        volume: '1.2M'
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
        volume: '225K'
      },
      {
        id: 'gift-nifty-1',
        name: 'Gift Nifty Fut #1',
        symbol: 'GIFT NIFTY',
        ltp: gift,
        change: giftChange,
        changePct: giftChangePct,
        high: parseFloat((gift + 30).toFixed(2)),
        low: parseFloat((gift - 40).toFixed(2)),
        open: parseFloat((gift - 20).toFixed(2)),
        vwap: parseFloat((gift - 2).toFixed(2)),
        volume: '5.2M'
      }
    ];

    // 2. The 5 Basis Spreads as specified in documentation
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

    const s5Pts = parseFloat((gift - spot).toFixed(2));
    const s5Pct = parseFloat(((s5Pts / spot) * 100).toFixed(2));
    const s5Yield = parseFloat(((s5Pct / 17) * 365).toFixed(2));

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
      },
      {
        id: 'nifty-gift',
        name: 'Nifty ↔ Gift Nifty Fut #1',
        leg1: 'NIFTY SPOT',
        leg2: 'GIFT NIFTY #1',
        price1: spot,
        price2: gift,
        spread: s5Pts,
        spreadPct: s5Pct,
        annualizedYield: s5Yield
      }
    ];

    // 3. Option Chain Around Spot
    const optionChain = this.buildDynamicOptionChain(spot);

    return {
      securities,
      basisSpreads,
      optionChain,
      latestCandle: { ...this.activeCandle },
      spotPrice: spot,
      fut1Price: fut1,
      pcr: 1.14,
      maxPain: 24700,
      indiaVix: 13.42
    };
  }

  private buildDynamicOptionChain(spotPrice: number): OptionRow[] {
    const rows: OptionRow[] = [];
    const minStrike = 23700;
    const maxStrike = 25700;
    const step = 50;

    for (let strike = minStrike; strike <= maxStrike; strike += step) {
      const d = strike - spotPrice;
      const absD = Math.abs(d);

      // Realistic Gamma
      const gamma = parseFloat(Math.max(0.0001, 0.0013 * Math.exp(-(absD * absD) / (2 * 180 * 180))).toFixed(4));

      // Realistic Theta
      const thetaBase = -15.8 * Math.exp(-(absD * absD) / (2 * 280 * 280));
      const callTheta = parseFloat((thetaBase * (1 + 0.04 * (d / 100))).toFixed(1));
      const putTheta = parseFloat((thetaBase * (1 - 0.04 * (d / 100))).toFixed(1));

      // Realistic Delta
      const normD = -d / 280;
      const callDelta = parseFloat(Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-normD)))).toFixed(2));
      const putDelta = parseFloat((callDelta - 1).toFixed(2));

      // Realistic LTP
      const timeValue = 170 * Math.exp(-(absD * absD) / (2 * 250 * 250));
      const intrinsicCall = Math.max(0, spotPrice - strike);
      const intrinsicPut = Math.max(0, strike - spotPrice);

      const callLtp = parseFloat(Math.max(1.2, intrinsicCall + timeValue).toFixed(2));
      const putLtp = parseFloat(Math.max(1.2, intrinsicPut + timeValue).toFixed(2));

      // Realistic Open Interest
      const roundWeight = strike % 500 === 0 ? 1.8 : strike % 100 === 0 ? 1.3 : 1.0;
      const baseOi = 65000 * Math.exp(-(absD * absD) / (2 * 450 * 450));
      const callOi = Math.round((baseOi * (0.8 + 0.4 * Math.sin(strike / 100)) * roundWeight) / 100) * 100;
      const putOi = Math.round((baseOi * (0.8 + 0.4 * Math.cos(strike / 100)) * roundWeight) / 100) * 100;

      rows.push({
        strike,
        call: {
          theta: callTheta,
          gamma,
          delta: callDelta,
          oi: callOi,
          ltp: callLtp
        },
        put: {
          ltp: putLtp,
          oi: putOi,
          delta: putDelta,
          gamma,
          theta: putTheta
        }
      });
    }

    return rows;
  }
}

// Global Singleton Engine
export const marketEngine = new MarketEngine();
