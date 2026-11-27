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

export interface ORSessionSegment {
  sessionDate: string;
  startTime: Time;
  endTime: Time;
  high: number;
  low: number;
  mid: number;
  isComplete: boolean;
}

export interface ORBreakoutResult {
  highPoints: IndicatorPoint[];
  lowPoints: IndicatorPoint[];
  midPoints: IndicatorPoint[];
  sessions: ORSessionSegment[];
  stats: {
    orHigh: number;
    orLow: number;
    orMid: number;
    sessionDate: string;
    isComplete: boolean;
  } | null;
}

export interface ADXResult {
  adx: IndicatorPoint[];
  plusDI: IndicatorPoint[];
  minusDI: IndicatorPoint[];
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
    return new Date(Date.UTC(time.year, time.month - 1, time.day));
  }
  return new Date(sec * 1000);
}

/**
 * Formats an already IST-shifted Date object to YYYY-MM-DD in IST
 */
function getISTDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Computes Opening Range Breakout (OR) levels per session independently.
 * Returns disconnected per-session horizontal segments so lines never connect across days.
 */
export function computeOpeningRangeBreakout(
  candles: CandlestickData<Time>[],
  durationMinutes: number = 60,
  includeMidpoint: boolean = false
): ORBreakoutResult {
  if (!candles || candles.length === 0) {
    return { highPoints: [], lowPoints: [], midPoints: [], sessions: [], stats: null };
  }

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
  const sessions: ORSessionSegment[] = [];
  let latestStats: ORBreakoutResult['stats'] = null;

  for (const [dayKey, dayCandles] of dayGroups.entries()) {
    if (dayCandles.length === 0) continue;

    dayCandles.sort((a, b) => Number(a.time) - Number(b.time));

    const sessionStartSec = Number(dayCandles[0].time);
    const openingWindowEndSec = sessionStartSec + durationMinutes * 60;

    let orHigh = -Infinity;
    let orLow = Infinity;
    let isComplete = false;

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

    sessions.push({
      sessionDate: dayKey,
      startTime: dayCandles[0].time,
      endTime: dayCandles[dayCandles.length - 1].time,
      high: orHigh,
      low: orLow,
      mid: orMid,
      isComplete
    });

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
    sessions,
    stats: latestStats
  };
}

/**
 * Computes Volume Weighted Average Price (VWAP).
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
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        cumVolume = 0;
        cumTypicalVol = 0;
      }
    }

    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume && c.volume > 0 ? c.volume : 1000;

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
 */
export function computeEMA(candles: CandlestickData<Time>[], period: number = 20): IndicatorPoint[] {
  const safePeriod = Math.max(2, Math.round(period));
  if (!candles || candles.length < safePeriod) return [];

  const points: IndicatorPoint[] = [];
  const k = 2 / (safePeriod + 1);

  let sum = 0;
  for (let i = 0; i < safePeriod; i++) {
    sum += candles[i].close;
  }
  let prevEMA = sum / safePeriod;
  points.push({ time: candles[safePeriod - 1].time, value: parseFloat(prevEMA.toFixed(2)) });

  for (let i = safePeriod; i < candles.length; i++) {
    const ema = candles[i].close * k + prevEMA * (1 - k);
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
  const safePeriod = Math.max(2, Math.round(period));
  if (!candles || candles.length < safePeriod) return [];

  const points: IndicatorPoint[] = [];
  let sum = 0;

  for (let i = 0; i < safePeriod; i++) {
    sum += candles[i].close;
  }
  points.push({ time: candles[safePeriod - 1].time, value: parseFloat((sum / safePeriod).toFixed(2)) });

  for (let i = safePeriod; i < candles.length; i++) {
    sum += candles[i].close - candles[i - safePeriod].close;
    points.push({
      time: candles[i].time,
      value: parseFloat((sum / safePeriod).toFixed(2))
    });
  }

  return points;
}

/**
 * Computes Wilder's Relative Strength Index (RSI)
 */
export function computeRSI(candles: CandlestickData<Time>[], period: number = 14): IndicatorPoint[] {
  const p = Math.max(2, Math.round(period));
  if (!candles || candles.length <= p) return [];

  const points: IndicatorPoint[] = [];
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= p; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / p;
  let avgLoss = lossSum / p;
  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  points.push({ time: candles[p].time, value: parseFloat(firstRsi.toFixed(2)) });

  for (let i = p + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (p - 1) + gain) / p;
    avgLoss = (avgLoss * (p - 1) + loss) / p;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    points.push({
      time: candles[i].time,
      value: parseFloat(rsi.toFixed(2))
    });
  }

  return points;
}

/**
 * Computes Wilder's Average Directional Index (ADX), +DI, and -DI
 */
export function computeADX(candles: CandlestickData<Time>[], period: number = 14): ADXResult {
  const p = Math.max(2, Math.round(period));
  if (!candles || candles.length < p * 2 + 1) {
    return { adx: [], plusDI: [], minusDI: [] };
  }

  const trArr: number[] = [];
  const plusDmArr: number[] = [];
  const minusDmArr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;
    trArr.push(tr);
    plusDmArr.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDmArr.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;
  for (let i = 0; i < p; i++) {
    smoothTR += trArr[i];
    smoothPlusDM += plusDmArr[i];
    smoothMinusDM += minusDmArr[i];
  }

  const plusDI: IndicatorPoint[] = [];
  const minusDI: IndicatorPoint[] = [];
  const dxList: { time: Time; value: number }[] = [];

  const pushDI = (barIndex: number, trVal: number, pDm: number, mDm: number) => {
    const pdi = trVal > 0 ? (100 * pDm) / trVal : 0;
    const mdi = trVal > 0 ? (100 * mDm) / trVal : 0;
    const diSum = pdi + mdi;
    const dx = diSum > 0 ? (100 * Math.abs(pdi - mdi)) / diSum : 0;
    const t = candles[barIndex].time;
    plusDI.push({ time: t, value: parseFloat(pdi.toFixed(2)) });
    minusDI.push({ time: t, value: parseFloat(mdi.toFixed(2)) });
    dxList.push({ time: t, value: dx });
  };

  // First DI point corresponds to candles[p] (index p - 1 in trArr)
  pushDI(p, smoothTR, smoothPlusDM, smoothMinusDM);

  for (let i = p; i < trArr.length; i++) {
    smoothTR = smoothTR - smoothTR / p + trArr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / p + plusDmArr[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / p + minusDmArr[i];
    pushDI(i + 1, smoothTR, smoothPlusDM, smoothMinusDM);
  }

  const adx: IndicatorPoint[] = [];
  if (dxList.length >= p) {
    let dxSum = 0;
    for (let i = 0; i < p; i++) dxSum += dxList[i].value;
    let prevAdx = dxSum / p;
    adx.push({ time: dxList[p - 1].time, value: parseFloat(prevAdx.toFixed(2)) });

    for (let i = p; i < dxList.length; i++) {
      prevAdx = (prevAdx * (p - 1) + dxList[i].value) / p;
      adx.push({ time: dxList[i].time, value: parseFloat(prevAdx.toFixed(2)) });
    }
  }

  return { adx, plusDI, minusDI };
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
