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

export interface ChartImperativeHandle {
  /**
   * Update the latest candle or append a new candle in real-time.
   * Directly feeds into the underlying series (ideal for FYERS WebSocket stream).
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
   * Optional custom candlestick visual styling (colors, wick visibility, etc.).
   */
  seriesOptions?: CandlestickSeriesPartialOptions;

  /**
   * Container height. Defaults to 400px.
   */
  height?: number | string;

  /**
   * Optional inline styles for the outer container.
   */
  style?: React.CSSProperties;

  /**
   * Optional CSS class name.
   */
  className?: string;

  /**
   * Callback fired once chart and series have mounted.
   */
  onChartReady?: (handle: ChartImperativeHandle) => void;
}
