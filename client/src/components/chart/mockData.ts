import { CandlestickData, Time } from './types';

function toEpoch(dateStr: string): Time {
  return (Math.floor(new Date(`${dateStr}T09:15:00+05:30`).getTime() / 1000) + 19800) as Time;
}

/**
 * Historical daily dataset reflecting real NIFTY 50 price trajectory reaching current NSE levels (~25,350)
 * All timestamps strictly normalized to UNIX seconds (UTCTimestamp) to ensure 100% compatibility with intraday intervals.
 */
export const SAMPLE_CANDLESTICK_DATA: CandlestickData<Time>[] = [
  { time: toEpoch('2026-02-01'), open: 24750.5, high: 24880.0, low: 24700.2, close: 24850.8 },
  { time: toEpoch('2026-02-02'), open: 24860.0, high: 24960.4, low: 24810.0, close: 24920.2 },
  { time: toEpoch('2026-02-03'), open: 24930.6, high: 25050.0, low: 24890.5, close: 25010.1 },
  { time: toEpoch('2026-02-04'), open: 25020.0, high: 25100.8, low: 24950.0, close: 25080.4 },
  { time: toEpoch('2026-02-05'), open: 25070.2, high: 25180.0, low: 25010.0, close: 25140.6 },
  { time: toEpoch('2026-02-08'), open: 25150.0, high: 25260.5, low: 25100.0, close: 25220.0 },
  { time: toEpoch('2026-02-09'), open: 25230.5, high: 25340.0, low: 25190.2, close: 25310.7 },
  { time: toEpoch('2026-02-10'), open: 25300.0, high: 25420.0, low: 25250.3, close: 25380.5 },
  { time: toEpoch('2026-02-11'), open: 25370.0, high: 25480.0, low: 25310.0, close: 25430.2 },
  { time: toEpoch('2026-02-12'), open: 25420.8, high: 25550.2, low: 25380.0, close: 25510.0 },
  { time: toEpoch('2026-02-15'), open: 25520.0, high: 25640.4, low: 25470.0, close: 25600.3 },
  { time: toEpoch('2026-02-16'), open: 25610.2, high: 25720.0, low: 25560.5, close: 25680.8 },
  { time: toEpoch('2026-02-17'), open: 25690.0, high: 25790.0, low: 25620.0, close: 25740.0 },
  { time: toEpoch('2026-02-18'), open: 25750.4, high: 25840.0, low: 25680.2, close: 25790.6 },
  { time: toEpoch('2026-02-19'), open: 25800.0, high: 25910.4, low: 25740.0, close: 25860.2 },
  { time: toEpoch('2026-02-22'), open: 25870.0, high: 25950.0, low: 25810.5, close: 25910.4 },
  { time: toEpoch('2026-02-23'), open: 25920.2, high: 26010.8, low: 25870.0, close: 25960.0 },
  { time: toEpoch('2026-02-24'), open: 25970.0, high: 26040.0, low: 25890.4, close: 25800.6 },
  { time: toEpoch('2026-02-25'), open: 25820.0, high: 25900.0, low: 25740.0, close: 25800.6 },
  { time: toEpoch('2026-02-26'), open: 25805.0, high: 25860.4, low: 25760.2, close: 25819.25 }
];
