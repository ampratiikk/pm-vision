import {
  CandlestickData,
  CandlestickSeriesPartialOptions,
  ChartOptions,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  Time
} from 'lightweight-charts';

export type { CandlestickData, Time };

export interface CandleColorSettings {
  upBodyColor: string;
  downBodyColor: string;
  upBorderColor: string;
  downBorderColor: string;
  upWickColor: string;
  downWickColor: string;
}

export const DEFAULT_CANDLE_COLORS: CandleColorSettings = {
  upBodyColor: '#e5e7eb',
  downBodyColor: '#000000',
  upBorderColor: '#e5e7eb',
  downBorderColor: '#e5e7eb',
  upWickColor: '#e5e7eb',
  downWickColor: '#e5e7eb'
};

export interface ChartImperativeHandle {
  /**
   * Update the latest candle or append a new candle in real-time.
   */
  updateCandle: (candle: CandlestickData<Time>) => void;

  /**
   * Update the latest bar's close price (and adjust high/low if breached) in-place without creating extra bars.
   */
  updateLastBarPrice: (price: number) => void;

  /**
   * Replace the full historical dataset.
   */
  setData: (data: CandlestickData<Time>[]) => void;

  /**
   * Auto-fit content to the visible viewport.
   */
  fitContent: () => void;

  /**
   * Dynamically apply candlestick series visual options (colors, borders, wicks).
   */
  applySeriesOptions: (options: CandlestickSeriesPartialOptions) => void;

  /**
   * Direct access to the Lightweight Charts IChartApi instance.
   */
  getChart: () => IChartApi | null;

  /**
   * Direct access to the candlestick series instance.
   */
  getSeries: () => ISeriesApi<'Candlestick'> | null;
}

export interface CandlestickChartProps {
  /**
   * Historical candlestick data array.
   */
  data: CandlestickData<Time>[];

  /**
   * Optional custom chart options (background, grid, layout, etc.).
   */
  chartOptions?: DeepPartial<ChartOptions>;

  /**
   * Optional custom series options (colors, borders, wicks).
   */
  seriesOptions?: CandlestickSeriesPartialOptions;

  /**
   * Active indicators list to plot on chart
   */
  indicators?: IndicatorConfig[];

  /**
   * Height in pixels or percentage CSS string (e.g. "100%").
   */
  height?: number | string;

  /**
   * Optional CSS class name.
   */
  className?: string;

  /**
   * Optional inline style.
   */
  style?: React.CSSProperties;

  /**
   * Optional callback when chart instance and series are initialized.
   */
  onChartReady?: (handle: ChartImperativeHandle) => void;

  /**
   * Optional callback when user right-clicks on chart canvas.
   */
  onContextMenu?: (e: React.MouseEvent) => void;

  /**
   * Optional callback when user clicks or double-clicks on an indicator to open its settings.
   */
  onOpenIndicatorSettings?: (indicatorId?: string) => void;

  /**
   * Official Closing Auction Session (CAS) price for the active symbol.
   * Rendered as an official reference line on small timeframe charts.
   */
  casPrice?: number;

  /**
   * Current active chart resolution/timeframe (e.g. '15m', '1D').
   */
  timeframe?: string;
}

export type IndicatorType = 'OR' | 'VWAP' | 'EMA' | 'SMA' | 'VOLUME';

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  name: string;
  shortName: string;
  enabled: boolean;
  visible: boolean;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  options: {
    durationMinutes?: number; // OR opening duration in mins (default: 60 for 1H)
    highColor?: string;
    lowColor?: string;
    showMid?: boolean;
    midColor?: string;
    period?: number; // For EMA / SMA
    sessionSpecific?: boolean; // For VWAP (true: resets at session start 09:15 IST, false: continuous)
    volumeStyle?: 'area' | 'bar'; // For Volume Overlay: 'area' (default) or 'bar'
    volumeColor?: string; // Base / single color for volume (default: '#808080' grey)
    colorUp?: string;
    colorDown?: string;
  };
}

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  {
    id: 'indicator-or-1h',
    type: 'OR',
    name: 'Opening Range Breakout',
    shortName: 'OR 1H',
    enabled: false,
    visible: true,
    color: '#38bdf8', // Sky blue default
    lineWidth: 2,
    options: {
      durationMinutes: 60,
      highColor: '#38bdf8', // Sky blue
      lowColor: '#38bdf8',  // Sky blue
      showMid: false,
      midColor: 'rgba(56, 189, 248, 0.45)'
    }
  },
  {
    id: 'indicator-vwap',
    type: 'VWAP',
    name: 'Volume Weighted Average Price',
    shortName: 'VWAP',
    enabled: false,
    visible: true,
    color: '#f59e0b',
    lineWidth: 1,
    options: {
      sessionSpecific: true
    }
  },
  {
    id: 'indicator-ema-20',
    type: 'EMA',
    name: 'Exponential Moving Average',
    shortName: 'EMA 20',
    enabled: false,
    visible: true,
    color: '#a855f7',
    lineWidth: 1,
    options: {
      period: 20
    }
  },
  {
    id: 'indicator-sma-50',
    type: 'SMA',
    name: 'Simple Moving Average',
    shortName: 'SMA 50',
    enabled: false,
    visible: true,
    color: '#10b981',
    lineWidth: 1,
    options: {
      period: 50
    }
  },
  {
    id: 'indicator-volume',
    type: 'VOLUME',
    name: 'Volume Overlay',
    shortName: 'VOL',
    enabled: false,
    visible: true,
    color: '#808080', // Grey default
    options: {
      volumeStyle: 'area', // Area chart default
      volumeColor: '#808080', // Grey default
      colorUp: '#808080',
      colorDown: '#555555'
    }
  }
];
