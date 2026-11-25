import { CandlestickData, Time } from 'lightweight-charts';

export interface IndicatorPoint {
  time: Time;
  value: number;
}

export interface VolumePoint {
  time: Time;
  value: number;
  color: string;
}

export interface ORBreakoutResult {
  highPoints: IndicatorPoint[];
  lowPoints: IndicatorPoint[];
  midPoints: IndicatorPoint[];
  stats: {
    orHigh: number;
    orLow: number;
    orMid: number;
    sessionDate: string;
    isComplete: boolean;
  } | null;
}

/**
 * Helper to convert lightweight-charts time to Date in Indian Standard Time (UTC + 5:30)
 */
function toISTDate(time: Time): Date {
  let sec = 0;
  if (typeof time === 'number') {
    sec = time;
  } else if (typeof time === 'string') {
    sec = Math.floor(Date.parse(time) / 1000);
  } else if (typeof time === 'object' && 'year' in time) {
    const d = new Date(Date.UTC(time.year, time.month - 1, time.day));
    return d;
  }
  return new Date(sec * 1000);
}

/**
 * Formats an already IST-shifted Date object (or string/BusinessDay) to YYYY-MM-DD in IST
 */
function getISTDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Computes Opening Range Breakout (OR) levels for intraday candles.
 * Starting session window: 09:15 AM IST.
 * Duration: customizable in minutes (default 60 for OR 1H).
 * Tracks the High and Low established in that opening duration,
 * then projects those levels horizontally across the rest of the day.
 */
export function computeOpeningRangeBreakout(
  candles: CandlestickData<Time>[],
  durationMinutes: number = 60,
  includeMidpoint: boolean = true
): ORBreakoutResult {
  if (!candles || candles.length === 0) {
    return { highPoints: [], lowPoints: [], midPoints: [], stats: null };
  }

  // Group candles by IST day
  const dayGroups = new Map<string, CandlestickData<Time>[]>();
  for (const c of candles) {
    const d = toISTDate(c.time);
    const dayKey = getISTDateString(d);
    const list = dayGroups.get(dayKey) || [];
    list.push(c);
    dayGroups.set(dayKey, list);
  }

  const highPoints: IndicatorPoint[] = [];
  const lowPoints: IndicatorPoint[] = [];
  const midPoints: IndicatorPoint[] = [];
  let latestStats: ORBreakoutResult['stats'] = null;

  for (const [dayKey, dayCandles] of dayGroups.entries()) {
    if (dayCandles.length === 0) continue;

    // Sort chronologically
    dayCandles.sort((a, b) => Number(a.time) - Number(b.time));

    // First candle of the day defines session start time
    const sessionStartSec = Number(dayCandles[0].time);
    const openingWindowEndSec = sessionStartSec + durationMinutes * 60;

    let orHigh = -Infinity;
    let orLow = Infinity;
    let isComplete = false;

    // 1. Calculate high and low during the opening window
    for (const c of dayCandles) {
      const t = Number(c.time);
      if (t <= openingWindowEndSec) {
        if (c.high > orHigh) orHigh = c.high;
        if (c.low < orLow) orLow = c.low;
      } else {
        isComplete = true;
      }
    }

    if (orHigh === -Infinity || orLow === Infinity) continue;
    const orMid = parseFloat(((orHigh + orLow) / 2).toFixed(2));

    // 2. Project levels across all candles in this day
    for (const c of dayCandles) {
      highPoints.push({ time: c.time, value: orHigh });
      lowPoints.push({ time: c.time, value: orLow });
      if (includeMidpoint) {
        midPoints.push({ time: c.time, value: orMid });
      }
    }

    latestStats = {
      orHigh,
      orLow,
      orMid,
      sessionDate: dayKey,
      isComplete
    };
  }

  return {
    highPoints,
    lowPoints,
    midPoints,
    stats: latestStats
  };
}

/**
 * Computes Volume Weighted Average Price (VWAP).
 * - When sessionSpecific is true (default): resets accumulation at the start of each IST day (09:15 AM).
 * - When sessionSpecific is false: computes rolling continuous VWAP across all candles.
 * Typical Price = (High + Low + Close) / 3
 * VWAP = CumSum(TypicalPrice * Volume) / CumSum(Volume)
 */
export function computeVWAP(
  candles: (CandlestickData<Time> & { volume?: number })[],
  sessionSpecific: boolean = true
): IndicatorPoint[] {
  if (!candles || candles.length === 0) return [];

  const points: IndicatorPoint[] = [];
  let currentDay = '';
  let cumVolume = 0;
  let cumTypicalVol = 0;

  for (const c of candles) {
    if (sessionSpecific) {
      const d = toISTDate(c.time);
      const dayKey = getISTDateString(d);

      // Reset accumulator on new trading day
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        cumVolume = 0;
        cumTypicalVol = 0;
      }
    }

    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume && c.volume > 0 ? c.volume : 1000; // fallback volume weight

    cumTypicalVol += typicalPrice * vol;
    cumVolume += vol;

    const vwap = cumVolume > 0 ? cumTypicalVol / cumVolume : typicalPrice;
    points.push({
      time: c.time,
      value: parseFloat(vwap.toFixed(2))
    });
  }

  return points;
}

/**
 * Computes Exponential Moving Average (EMA)
 * Multiplier = 2 / (period + 1)
 */
export function computeEMA(candles: CandlestickData<Time>[], period: number = 20): IndicatorPoint[] {
  if (!candles || candles.length < period) return [];

  const points: IndicatorPoint[] = [];
  const k = 2 / (period + 1);

  // Compute initial SMA as seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEMA = sum / period;
  points.push({ time: candles[period - 1].time, value: parseFloat(prevEMA.toFixed(2)) });

  // Compute EMA iteratively
  for (let i = period; i < candles.length; i++) {
    const currentPrice = candles[i].close;
    const ema = currentPrice * k + prevEMA * (1 - k);
    prevEMA = ema;
    points.push({
      time: candles[i].time,
      value: parseFloat(ema.toFixed(2))
    });
  }

  return points;
}

/**
 * Computes Simple Moving Average (SMA)
 */
export function computeSMA(candles: CandlestickData<Time>[], period: number = 50): IndicatorPoint[] {
  if (!candles || candles.length < period) return [];

  const points: IndicatorPoint[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  points.push({ time: candles[period - 1].time, value: parseFloat((sum / period).toFixed(2)) });

  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close;
    points.push({
      time: candles[i].time,
      value: parseFloat((sum / period).toFixed(2))
    });
  }

  return points;
}

/**
 * Computes Volume Histogram / Area Series
 */
export function computeVolumeSeries(
  candles: (CandlestickData<Time> & { volume?: number })[],
  colorUp: string = 'rgba(128, 128, 128, 0.45)',
  colorDown: string = 'rgba(128, 128, 128, 0.35)',
  singleColor?: string
): VolumePoint[] {
  if (!candles) return [];
  return candles.map((c, i) => {
    const prev = i > 0 ? candles[i - 1] : null;
    const isUp = prev ? c.close >= prev.close : c.close >= c.open;
    const vol = c.volume !== undefined ? c.volume : Math.abs(c.close - c.open) * 125000 + 45000;
    const itemColor = singleColor ? singleColor : (isUp ? colorUp : colorDown);
    return {
      time: c.time,
      value: Math.round(vol),
      color: itemColor
    };
  });
}
