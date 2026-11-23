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
