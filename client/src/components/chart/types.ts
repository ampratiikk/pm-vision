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

export const MAX_MA_COUNT = 8;

export const DEFAULT_PANE_SEPARATOR_COLOR = '#2B2B43';

// Ordered 1st..8th default colors for EMA & SMA (Dark Blue, Orange, Red, Violet, Pink, Yellow, Green, Brown)
export const MA_DEFAULT_COLORS: string[] = [
  '#1d4ed8', // 1st: Dark Blue
  '#f97316', // 2nd: Orange
  '#ef4444', // 3rd: Red
  '#8b5cf6', // 4th: Violet
  '#ec4899', // 5th: Pink
  '#eab308', // 6th: Yellow
  '#22c55e', // 7th: Green
  '#a16207'  // 8th: Brown
];

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

export interface CandlestickThemePreset {
  id: 'void' | 'regular' | 'jewel';
  label: string;
  colors: CandleColorSettings;
}

export const CANDLESTICK_THEMES: CandlestickThemePreset[] = [
  {
    id: 'void',
    label: '(Default) Void',
    colors: DEFAULT_CANDLE_COLORS
  },
  {
    id: 'regular',
    label: 'Regular - Green & Red',
    colors: {
      upBodyColor: '#157347',
      downBodyColor: '#9e1c24',
      upBorderColor: '#198754',
      downBorderColor: '#b92b2b',
      upWickColor: '#198754',
      downWickColor: '#b92b2b'
    }
  },
  {
    id: 'jewel',
    label: 'Jewel - Gold & Silver',
    colors: {
      upBodyColor: '#dfb430',
      downBodyColor: '#a6b0ba',
      upBorderColor: '#fff08a',
      downBorderColor: '#f8fafc',
      upWickColor: '#fff08a',
      downWickColor: '#f8fafc'
    }
  }
];

export interface ChartImperativeHandle {
  updateCandle: (candle: CandlestickData<Time>) => void;
  updateLastBarPrice: (price: number) => void;
  setData: (data: CandlestickData<Time>[], preserveView?: boolean) => void;
  fitContent: () => void;
  panByBars: (bars: number) => void;
  zoomX: (zoomIn: boolean) => void;
  zoomY: (zoomIn: boolean) => void;
  getCandles: () => CandlestickData<Time>[];
  applySeriesOptions: (options: CandlestickSeriesPartialOptions) => void;
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
}

export interface CandlestickChartProps {
  data: CandlestickData<Time>[];
  chartOptions?: DeepPartial<ChartOptions>;
  seriesOptions?: CandlestickSeriesPartialOptions;
  indicators?: IndicatorConfig[];
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  onChartReady?: (handle: ChartImperativeHandle) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onOpenIndicatorSettings?: (indicatorId?: string) => void;
  onToggleIndicatorVisibility?: (indicatorIds: string[]) => void;
  onBarUpdate?: (candles: CandlestickData<Time>[]) => void;
  casPrice?: number;
  timeframe?: string;
  paneSeparatorColor?: string;
}

export type IndicatorType = 'OR' | 'VWAP' | 'EMA' | 'SMA' | 'VOLUME' | 'RSI' | 'ADX';

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
    durationMinutes?: number;
    highColor?: string;
    lowColor?: string;
    showMid?: boolean;
    midColor?: string;
    period?: number;
    sessionSpecific?: boolean;
    volumeStyle?: 'area' | 'bar';
    volumeColor?: string;
    colorUp?: string;
    colorDown?: string;
    rsiOverbought?: number;
    rsiOversold?: number;
    rsiOverboughtColor?: string;
    rsiOversoldColor?: string;
    showDI?: boolean;
    plusDiColor?: string;
    minusDiColor?: string;
  };
}

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  {
    id: 'indicator-or-1h',
    type: 'OR',
    name: 'Opening Range Breakout',
    shortName: 'OR',
    enabled: false,
    visible: true,
    color: '#38bdf8',
    lineWidth: 2,
    options: {
      durationMinutes: 60,
      highColor: '#38bdf8',
      lowColor: '#38bdf8',
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
    id: 'indicator-ema-1',
    type: 'EMA',
    name: 'Exponential Moving Average',
    shortName: 'EMA 10',
    enabled: false,
    visible: true,
    color: MA_DEFAULT_COLORS[0],
    lineWidth: 1,
    options: {
      period: 10
    }
  },
  {
    id: 'indicator-sma-1',
    type: 'SMA',
    name: 'Simple Moving Average',
    shortName: 'SMA 20',
    enabled: false,
    visible: true,
    color: MA_DEFAULT_COLORS[6],
    lineWidth: 1,
    options: {
      period: 20
    }
  },
  {
    id: 'indicator-volume',
    type: 'VOLUME',
    name: 'Volume Overlay',
    shortName: 'VOL',
    enabled: false,
    visible: true,
    color: '#808080',
    options: {
      volumeStyle: 'area',
      volumeColor: '#808080',
      colorUp: '#808080',
      colorDown: '#555555'
    }
  },
  {
    id: 'indicator-rsi',
    type: 'RSI',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    enabled: false,
    visible: true,
    color: '#a855f7',
    lineWidth: 2,
    options: {
      period: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      rsiOverboughtColor: '#c4b5fd',
      rsiOversoldColor: '#c4b5fd'
    }
  },
  {
    id: 'indicator-adx',
    type: 'ADX',
    name: 'Average Directional Index',
    shortName: 'ADX',
    enabled: false,
    visible: true,
    color: '#eab308',
    lineWidth: 2,
    options: {
      period: 14,
      showDI: true,
      plusDiColor: '#22c55e',
      minusDiColor: '#ef4444'
    }
  }
];
