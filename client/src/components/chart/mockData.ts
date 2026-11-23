import { CandlestickData, Time } from './types';

/**
 * Small local static dataset for testing candlestick chart rendering.
 * Sample index-like price movement around 24,000 - 24,700 levels.
 */
export const SAMPLE_CANDLESTICK_DATA: CandlestickData<Time>[] = [
  { time: '2026-02-01', open: 24100.5, high: 24220.0, low: 24050.2, close: 24190.8 },
  { time: '2026-02-02', open: 24195.0, high: 24310.4, low: 24150.0, close: 24280.2 },
  { time: '2026-02-03', open: 24275.6, high: 24350.0, low: 24210.5, close: 24230.1 },
  { time: '2026-02-04', open: 24220.0, high: 24260.8, low: 24090.0, close: 24120.4 },
  { time: '2026-02-05', open: 24130.2, high: 24290.0, low: 24110.0, close: 24270.6 },
  { time: '2026-02-08', open: 24300.0, high: 24450.5, low: 24280.0, close: 24410.0 },
  { time: '2026-02-09', open: 24420.5, high: 24520.0, low: 24390.2, close: 24480.7 },
  { time: '2026-02-10', open: 24490.0, high: 24580.0, low: 24410.3, close: 24430.5 },
  { time: '2026-02-11', open: 24415.0, high: 24460.0, low: 24300.0, close: 24340.2 },
  { time: '2026-02-12', open: 24350.8, high: 24490.2, low: 24320.0, close: 24470.0 },
  { time: '2026-02-15', open: 24500.0, high: 24620.4, low: 24460.0, close: 24590.3 },
  { time: '2026-02-16', open: 24600.2, high: 24690.0, low: 24540.5, close: 24640.8 },
  { time: '2026-02-17', open: 24650.0, high: 24720.0, low: 24580.0, close: 24600.0 },
  { time: '2026-02-18', open: 24590.4, high: 24630.0, low: 24450.2, close: 24490.6 },
  { time: '2026-02-19', open: 24500.0, high: 24580.4, low: 24420.0, close: 24550.2 },
  { time: '2026-02-22', open: 24570.0, high: 24680.0, low: 24510.5, close: 24660.4 },
  { time: '2026-02-23', open: 24670.2, high: 24750.8, low: 24620.0, close: 24710.0 },
  { time: '2026-02-24', open: 24720.0, high: 24820.0, low: 24690.4, close: 24790.5 },
  { time: '2026-02-25', open: 24780.0, high: 24800.0, low: 24610.0, close: 24640.2 },
  { time: '2026-02-26', open: 24650.0, high: 24740.0, low: 24590.2, close: 24700.8 }
];
