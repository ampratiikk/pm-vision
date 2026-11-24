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
    durationMinutes?: number; // OR opening duration (e.g. 60 for 1H)
    highColor?: string;
    lowColor?: string;
    showMid?: boolean;
    midColor?: string;
    period?: number; // For EMA / SMA
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
    color: '#38bdf8',
    lineWidth: 1,
    options: {
      durationMinutes: 60,
      highColor: '#38bdf8',
      lowColor: '#f87171',
      showMid: true,
      midColor: '#94a3b8'
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
    options: {}
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
    color: '#5F7A9A',
    options: {
      colorUp: 'rgba(95, 122, 154, 0.4)',
      colorDown: 'rgba(239, 68, 68, 0.4)'
    }
  }
];
