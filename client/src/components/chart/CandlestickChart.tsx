import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo
} from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  ColorType,
  LineStyle,
  CrosshairMode,
  MouseEventParams,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  CandlestickData,
  Time,
  IPriceLine
} from 'lightweight-charts';
import { isIndianMarketOpen } from '@pm-vision/shared';
import { CandlestickChartProps, ChartImperativeHandle, IndicatorConfig } from './types';
import {
  computeOpeningRangeBreakout,
  computeVWAP,
  computeEMA,
  computeSMA,
  computeRSI,
  computeADX,
  computeVolumeSeries,
  ORSessionSegment
} from './indicators';

function formatPrice(val: number): string {
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

interface OHLCInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  changeVal: number;
  changePct: number;
}

function parseToSeconds(val: any): number {
  if (typeof val === 'number') {
    if (val > 1e11) return Math.floor(val / 1000);
    return Math.floor(val);
  }
  if (typeof val === 'string') {
    const cleanStr = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      const parsed = Date.parse(`${cleanStr}T09:15:00+05:30`);
      if (!isNaN(parsed)) return Math.floor(parsed / 1000);
    }
    const parsed = Date.parse(cleanStr);
    if (!isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return 0;
}

function sanitizeCandles(raw: CandlestickData<Time>[]): CandlestickData<Time>[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  const map = new Map<number, CandlestickData<Time>>();
  for (const c of raw) {
    if (
      c &&
      c.time !== undefined &&
      c.time !== null &&
      !isNaN(Number(c.open)) &&
      !isNaN(Number(c.high)) &&
      !isNaN(Number(c.low)) &&
      !isNaN(Number(c.close))
    ) {
      const sec = parseToSeconds(c.time);
      if (sec > 0) {
        map.set(sec, {
          ...c,
          time: sec as Time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close)
        });
      }
    }
  }

  const list = Array.from(map.values());
  list.sort((a, b) => Number(a.time) - Number(b.time));
  return list;
}

function computeOHLCInfo(list: CandlestickData<Time>[], targetIdx: number): OHLCInfo | null {
  if (targetIdx < 0 || targetIdx >= list.length) return null;
  const bar = list[targetIdx];
  const prevBar = targetIdx > 0 ? list[targetIdx - 1] : null;
  const prevClose = prevBar ? prevBar.close : bar.open;
  const changeVal = bar.close - prevClose;
  const changePct = prevClose !== 0 ? (changeVal / prevClose) * 100 : 0;
  return {
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    changeVal,
    changePct
  };
}

type CanvasTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];
type BitmapCoordinateScope = Parameters<Parameters<CanvasTarget['useBitmapCoordinateSpace']>[0]>[0];

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, Math.floor(width / 2), Math.floor(height / 2)));
  ctx.beginPath();
  if (r === 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Custom price box primitive on right Y-axis in Quicksand font
 */
class PriceBoxPrimitive implements ISeriesPrimitive<Time> {
  private _attachedParams: SeriesAttachedParameter<Time> | null = null;
  private _price: number;
  private _isPositive: boolean;
  private _paneViews: readonly IPrimitivePaneView[];

  constructor(initialPrice: number, initialIsPositive: boolean) {
    this._price = initialPrice;
    this._isPositive = initialIsPositive;

    const renderer: IPrimitivePaneRenderer = {
      draw: (target: CanvasTarget) => {
        if (!this._attachedParams) return;
        const y = this._attachedParams.series.priceToCoordinate(this._price);
        if (y === null) return;

        target.useBitmapCoordinateSpace((scope: BitmapCoordinateScope) => {
          const { context: ctx, horizontalPixelRatio: hRatio, verticalPixelRatio: vRatio, bitmapSize } = scope;

          const yCenter = Math.round(y * vRatio);
          const boxHeight = Math.round(20 * vRatio);
          const top = Math.round(yCenter - boxHeight / 2);
          const borderWidth = Math.max(1, Math.round(1.5 * vRatio));
          const x = Math.round(2 * hRatio);
          const boxWidth = Math.min(
            bitmapSize.width - x - Math.round(2 * hRatio),
            Math.max(Math.round(58 * hRatio), bitmapSize.width - x - 2)
          );
          const radius = Math.round(3 * hRatio);

          ctx.save();
          drawRoundedRect(ctx, x, top, boxWidth, boxHeight, radius);
          ctx.fillStyle = '#5F7A9A';
          ctx.fill();

          const innerRadius = Math.max(0, radius - borderWidth);
          drawRoundedRect(
            ctx,
            x + borderWidth,
            top + borderWidth,
            boxWidth - 2 * borderWidth,
            boxHeight - 2 * borderWidth,
            innerRadius
          );
          ctx.fillStyle = this._isPositive ? '#FFFFFF' : '#000000';
          ctx.fill();

          const text = this._price.toFixed(2);
          const fontSize = Math.round(11 * vRatio);
          ctx.font = `600 ${fontSize}px Quicksand, sans-serif`;
          ctx.fillStyle = this._isPositive ? '#000000' : '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, x + boxWidth / 2, yCenter);
          ctx.restore();
        });
      }
    };

    this._paneViews = [
      {
        zOrder: () => 'top',
        renderer: () => renderer
      }
    ];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this._attachedParams = param;
  }

  detached() {
    this._attachedParams = null;
  }

  updateAllViews() {}

  priceAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  update(price: number, isPositive: boolean) {
    this._price = price;
    this._isPositive = isPositive;
    this._attachedParams?.requestUpdate();
  }
}

/**
 * Custom Canvas primitive drawing completely independent, unconnected per-session OR High/Low/Mid segments.
 * Ensures previous trading days' lines never staircase/connect into subsequent days.
 */
class OpeningRangePrimitive implements ISeriesPrimitive<Time> {
  private _attachedParams: SeriesAttachedParameter<Time> | null = null;
  private _sessions: ORSessionSegment[] = [];
  private _highColor = '#38bdf8';
  private _lowColor = '#38bdf8';
  private _midColor = 'rgba(56, 189, 248, 0.45)';
  private _showMid = false;
  private _lineWidth = 2;
  private _paneViews: readonly IPrimitivePaneView[];

  constructor() {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target: CanvasTarget) => {
        if (!this._attachedParams || this._sessions.length === 0) return;
        const { chart, series } = this._attachedParams;
        const timeScale = chart.timeScale();

        target.useBitmapCoordinateSpace((scope: BitmapCoordinateScope) => {
          const { context: ctx, horizontalPixelRatio: hRatio, verticalPixelRatio: vRatio } = scope;
          ctx.save();

          for (const seg of this._sessions) {
            const x1 = timeScale.timeToCoordinate(seg.startTime);
            const x2 = timeScale.timeToCoordinate(seg.endTime);
            const yHigh = series.priceToCoordinate(seg.high);
            const yLow = series.priceToCoordinate(seg.low);
            if (x1 === null || x2 === null || yHigh === null || yLow === null) continue;

            const px1 = Math.round(x1 * hRatio);
            const px2 = Math.max(px1 + Math.round(4 * hRatio), Math.round(x2 * hRatio));
            const lw = Math.max(1, Math.round(this._lineWidth * vRatio));

            // OR High horizontal segment
            ctx.beginPath();
            ctx.strokeStyle = this._highColor;
            ctx.lineWidth = lw;
            ctx.setLineDash([]);
            const pyHigh = Math.round(yHigh * vRatio) + (lw % 2 === 1 ? 0.5 : 0);
            ctx.moveTo(px1, pyHigh);
            ctx.lineTo(px2, pyHigh);
            ctx.stroke();

            // OR Low horizontal segment
            ctx.beginPath();
            ctx.strokeStyle = this._lowColor;
            ctx.lineWidth = lw;
            const pyLow = Math.round(yLow * vRatio) + (lw % 2 === 1 ? 0.5 : 0);
            ctx.moveTo(px1, pyLow);
            ctx.lineTo(px2, pyLow);
            ctx.stroke();

            // Optional OR Midpoint dotted segment
            if (this._showMid) {
              const yMid = series.priceToCoordinate(seg.mid);
              if (yMid !== null) {
                ctx.beginPath();
                ctx.strokeStyle = this._midColor;
                ctx.lineWidth = Math.max(1, Math.round(1 * vRatio));
                ctx.setLineDash([Math.round(4 * hRatio), Math.round(4 * hRatio)]);
                const pyMid = Math.round(yMid * vRatio);
                ctx.moveTo(px1, pyMid);
                ctx.lineTo(px2, pyMid);
                ctx.stroke();
              }
            }
          }

          ctx.restore();
        });
      }
    };

    this._paneViews = [
      {
        zOrder: () => 'normal',
        renderer: () => renderer
      }
    ];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this._attachedParams = param;
  }

  detached() {
    this._attachedParams = null;
  }

  updateAllViews() {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  update(
    sessions: ORSessionSegment[],
    highColor: string,
    lowColor: string,
    midColor: string,
    showMid: boolean,
    lineWidth: number
  ) {
    this._sessions = sessions;
    this._highColor = highColor;
    this._lowColor = lowColor;
    this._midColor = midColor;
    this._showMid = showMid;
    this._lineWidth = lineWidth;
    this._attachedParams?.requestUpdate();
  }
}

function resetChartView(chartApi: IChartApi | null) {
  if (!chartApi) return;
  try {
    chartApi.timeScale().applyOptions({
      rightOffset: 15,
      barSpacing: 12
    });
    chartApi.timeScale().resetTimeScale();
    chartApi.priceScale('right').applyOptions({
      autoScale: true,
      scaleMargins: {
        top: 0.16,
        bottom: 0.14
      }
    });
    chartApi.priceScale('right').setAutoScale(true);
  } catch (e) {
    console.warn('[CandlestickChart] Error resetting chart view:', e);
  }
}

function getTimeframeSeconds(tf: string): number {
  const trimmed = (tf || '5m').trim();
  if (trimmed === '1M' || trimmed === 'M') return 30 * 86400;
  const clean = trimmed.toLowerCase();
  if (clean === '1w' || clean === 'w') return 7 * 86400;
  if (clean === '1d' || clean === 'd') return 86400;
  if (clean === '4h' || clean === '240') return 14400;
  if (clean === '2h' || clean === '120') return 7200;
  if (clean === '1h' || clean === '60') return 3600;
  if (clean === '30m' || clean === '30') return 1800;
  if (clean === '15m' || clean === '15') return 900;
  if (clean === '10m' || clean === '10') return 600;
  if (clean === '5m' || clean === '5') return 300;
  if (clean === '3m' || clean === '3') return 180;
  if (clean === '2m' || clean === '2') return 120;
  if (clean === '1m' || clean === '1') return 60;
  const parsedMin = parseInt(clean.replace(/m$/, ''), 10);
  if (parsedMin > 0) return parsedMin * 60;
  return 300;
}

function formatDurationLabel(mins: number): string {
  if (mins >= 60 && mins % 60 === 0) return `${mins / 60}H`;
  return `${mins}m`;
}

function formatCountdown(timeframe: string, lastCandleTimeSec?: number): string {
  const now = new Date();
  if (!isIndianMarketOpen(now)) {
    return '00:00';
  }
  const trimmed = (timeframe || '5m').trim();
  const istNowSec = Math.floor(now.getTime() / 1000) + 19800;

  if (trimmed === '1M' || trimmed === 'M') {
    const dIst = new Date(istNowSec * 1000);
    const nextMonth = Date.UTC(dIst.getUTCFullYear(), dIst.getUTCMonth() + 1, 1, 9, 15, 0) / 1000;
    const rem = Math.max(0, nextMonth - istNowSec);
    const days = Math.floor(rem / 86400);
    const hrs = Math.floor((rem % 86400) / 3600);
    return `${days}d ${String(hrs).padStart(2, '0')}h`;
  }

  if (trimmed.toLowerCase() === '1w') {
    const dIst = new Date(istNowSec * 1000);
    const day = dIst.getUTCDay(); // 0=Sun..5=Fri
    const daysUntilFri = (5 - day + 7) % 7;
    const dayStart = Math.floor(istNowSec / 86400) * 86400;
    const friClose = dayStart + daysUntilFri * 86400 + 15 * 3600 + 30 * 60;
    const rem = Math.max(0, friClose - istNowSec);
    const d = Math.floor(rem / 86400);
    const h = Math.floor((rem % 86400) / 3600);
    const m = Math.floor((rem % 3600) / 60);
    return d > 0 ? `${d}d ${String(h).padStart(2, '0')}h` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  if (trimmed.toLowerCase() === '1d') {
    const dayStart = Math.floor(istNowSec / 86400) * 86400;
    const closeSec = dayStart + 15 * 3600 + 30 * 60;
    const rem = Math.max(0, closeSec - istNowSec);
    const h = Math.floor(rem / 3600);
    const m = Math.floor((rem % 3600) / 60);
    const s = rem % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const intervalSec = getTimeframeSeconds(trimmed);
  let remainingSec = 0;

  if (
    lastCandleTimeSec &&
    lastCandleTimeSec > 0 &&
    istNowSec >= lastCandleTimeSec &&
    istNowSec - lastCandleTimeSec < intervalSec
  ) {
    remainingSec = lastCandleTimeSec + intervalSec - istNowSec;
  } else {
    // Anchor to NSE 09:15 IST session start (33300s from midnight)
    const dayStart = Math.floor(istNowSec / 86400) * 86400;
    const anchor = dayStart + 9 * 3600 + 15 * 60;
    const elapsed = Math.max(0, istNowSec - anchor);
    remainingSec = intervalSec - (elapsed % intervalSec);
    if (remainingSec === intervalSec) remainingSec = 0;
  }

  const hrs = Math.floor(remainingSec / 3600);
  const mins = Math.floor((remainingSec % 3600) / 60);
  const secs = remainingSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CandlestickChart = forwardRef<ChartImperativeHandle, CandlestickChartProps>(
  (
    {
      data,
      chartOptions,
      seriesOptions,
      indicators = [],
      height = 420,
      style,
      className,
      onChartReady,
      onContextMenu,
      onOpenIndicatorSettings,
      onToggleIndicatorVisibility,
      onBarUpdate,
      casPrice,
      timeframe = '5m',
      paneSeparatorColor = '#2B2B43'
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const priceBoxRef = useRef<PriceBoxPrimitive | null>(null);
    const orPrimitiveRef = useRef<OpeningRangePrimitive | null>(null);
    const indicatorSeriesMapRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
    const casPriceLineRef = useRef<IPriceLine | null>(null);

    const casPriceRef = useRef<number | undefined>(casPrice);
    casPriceRef.current = casPrice;
    const timeframeRef = useRef<string>(timeframe);
    timeframeRef.current = timeframe;
    const indicatorsRef = useRef<IndicatorConfig[]>(indicators);
    indicatorsRef.current = indicators;
    const onBarUpdateRef = useRef(onBarUpdate);
    onBarUpdateRef.current = onBarUpdate;

    const currentDataRef = useRef<CandlestickData<Time>[]>(data || []);

    const [ohlcInfo, setOhlcInfo] = useState<OHLCInfo | null>(() => {
      const list = data || [];
      return computeOHLCInfo(list, list.length - 1);
    });

    const [countdownText, setCountdownText] = useState<string>(() =>
      formatCountdown(timeframe, data && data.length > 0 ? Number(data[data.length - 1].time) : undefined)
    );
    const [cornerDims, setCornerDims] = useState<{ rightW: number; bottomH: number }>({ rightW: 62, bottomH: 26 });

    useEffect(() => {
      const updateTimer = () => {
        const list = currentDataRef.current;
        const lastSec = list && list.length > 0 ? Number(list[list.length - 1].time) : undefined;
        setCountdownText(formatCountdown(timeframeRef.current, lastSec));
      };
      updateTimer();
      const iv = setInterval(updateTimer, 1000);
      return () => clearInterval(iv);
    }, [timeframe]);

    const syncCasPriceLine = (price?: number, tf?: string) => {
      const series = seriesRef.current;
      if (!series) return;

      if (casPriceLineRef.current) {
        try {
          series.removePriceLine(casPriceLineRef.current);
        } catch {}
        casPriceLineRef.current = null;
      }

      if (price && price > 0 && tf !== '1D' && tf !== '1W' && tf !== '1M') {
        try {
          const line = series.createPriceLine({
            price,
            color: '#5F7A9A',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: ''
          });
          casPriceLineRef.current = line;
        } catch (e) {
          console.warn('[CandlestickChart] Error creating CAS price line:', e);
        }
      }
    };

    const syncIndicators = (candles: CandlestickData<Time>[], activeList: IndicatorConfig[]) => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series) return;

      const seriesMap = indicatorSeriesMapRef.current;

      // Clear previous overlay/sub-pane series
      for (const [, sList] of Array.from(seriesMap.entries())) {
        sList.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch {}
        });
      }
      seriesMap.clear();

      // Remove any secondary panes cleanly before re-creating sub-panes
      try {
        while (chart.panes().length > 1) {
          chart.removePane(chart.panes().length - 1);
        }
      } catch {}

      // Manage OpeningRangePrimitive cleanly
      const activeOR = activeList.find((ind) => ind.type === 'OR' && ind.enabled && ind.visible);
      if (activeOR && candles.length > 0) {
        if (!orPrimitiveRef.current) {
          const prim = new OpeningRangePrimitive();
          series.attachPrimitive(prim);
          orPrimitiveRef.current = prim;
        }
        const dur = activeOR.options.durationMinutes || 60;
        const showMid = activeOR.options.showMid === true;
        const orData = computeOpeningRangeBreakout(candles, dur, showMid);
        orPrimitiveRef.current.update(
          orData.sessions,
          activeOR.options.highColor || activeOR.color || '#38bdf8',
          activeOR.options.lowColor || activeOR.color || '#38bdf8',
          activeOR.options.midColor || 'rgba(56, 189, 248, 0.45)',
          showMid,
          activeOR.lineWidth || 2
        );
      } else if (orPrimitiveRef.current) {
        orPrimitiveRef.current.update([], '#38bdf8', '#38bdf8', 'rgba(56, 189, 248, 0.45)', false, 2);
      }

      if (!candles || candles.length === 0) return;

      // Track sub-panes dynamically so RSI and ADX each occupy their own clean lower pane
      const visibleOscillators = activeList.filter(
        (ind) => (ind.type === 'RSI' || ind.type === 'ADX') && ind.enabled && ind.visible
      );
      if (visibleOscillators.length > 0) {
        try {
          const mainPane = chart.panes()[0];
          if (mainPane) {
            mainPane.setStretchFactor(visibleOscillators.length >= 2 ? 0.60 : 0.76);
          }
        } catch {}
      } else {
        try {
          const mainPane = chart.panes()[0];
          if (mainPane) mainPane.setStretchFactor(1.0);
        } catch {}
      }

      for (const ind of activeList) {
        if (!ind.enabled || !ind.visible || ind.type === 'OR') continue;

        const createdList: ISeriesApi<any>[] = [];

        try {
          if (ind.type === 'VWAP') {
            const sessionSpecific = ind.options.sessionSpecific !== false;
            const vwapData = computeVWAP(candles, sessionSpecific);
            if (vwapData.length > 0) {
              const vSeries = chart.addSeries(LineSeries, {
                color: ind.color || '#f59e0b',
                lineWidth: (ind.lineWidth || 1) as 1 | 2 | 3 | 4,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                title: ''
              });
              vSeries.setData(vwapData);
              createdList.push(vSeries);
            }
          } else if (ind.type === 'EMA') {
            const period = ind.options.period || 20;
            const emaData = computeEMA(candles, period);
            if (emaData.length > 0) {
              const eSeries = chart.addSeries(LineSeries, {
                color: ind.color || '#1d4ed8',
                lineWidth: (ind.lineWidth || 1) as 1 | 2 | 3 | 4,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                title: ''
              });
              eSeries.setData(emaData);
              createdList.push(eSeries);
            }
          } else if (ind.type === 'SMA') {
            const period = ind.options.period || 50;
            const smaData = computeSMA(candles, period);
            if (smaData.length > 0) {
              const sSeries = chart.addSeries(LineSeries, {
                color: ind.color || '#22c55e',
                lineWidth: (ind.lineWidth || 1) as 1 | 2 | 3 | 4,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                title: ''
              });
              sSeries.setData(smaData);
              createdList.push(sSeries);
            }
          } else if (ind.type === 'VOLUME') {
            const volStyle = ind.options.volumeStyle || 'area';
            const volColor = ind.options.volumeColor || ind.color || '#808080';

            if (volStyle === 'area') {
              const areaData = candles.map((c) => ({
                time: c.time,
                value: (c as any).volume !== undefined ? (c as any).volume : Math.abs(c.close - c.open) * 125000 + 45000
              }));
              const areaSeries = chart.addSeries(AreaSeries, {
                topColor: volColor.startsWith('#') ? `${volColor}55` : 'rgba(128, 128, 128, 0.35)',
                bottomColor: volColor.startsWith('#') ? `${volColor}08` : 'rgba(128, 128, 128, 0.02)',
                lineColor: volColor,
                lineWidth: 1,
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
              });
              chart.priceScale('volume').applyOptions({
                scaleMargins: {
                  top: 0.80,
                  bottom: 0
                }
              });
              areaSeries.setData(areaData);
              createdList.push(areaSeries);
            } else {
              const volData = computeVolumeSeries(
                candles,
                ind.options.colorUp || volColor,
                ind.options.colorDown || '#555555',
                ind.options.volumeColor
              );
              if (volData.length > 0) {
                const volSeries = chart.addSeries(HistogramSeries, {
                  priceFormat: { type: 'volume' },
                  priceScaleId: 'volume',
                  priceLineVisible: false,
                  lastValueVisible: false
                });
                chart.priceScale('volume').applyOptions({
                  scaleMargins: {
                    top: 0.80,
                    bottom: 0
                  }
                });
                volSeries.setData(volData);
                createdList.push(volSeries);
              }
            }
          } else if (ind.type === 'RSI') {
            const period = ind.options.period || 14;
            const rsiData = computeRSI(candles, period);
            const pane = chart.addPane();
            pane.setStretchFactor(0.22);
            const rsiSeries = pane.addSeries(LineSeries, {
              color: ind.color || '#a855f7',
              lineWidth: (ind.lineWidth || 2) as 1 | 2 | 3 | 4,
              priceLineVisible: false,
              lastValueVisible: true,
              crosshairMarkerVisible: true,
              autoscaleInfoProvider: () => ({
                priceRange: { minValue: 0, maxValue: 100 }
              })
            });
            const ob = ind.options.rsiOverbought ?? 70;
            const os = ind.options.rsiOversold ?? 30;
            rsiSeries.createPriceLine({
              price: ob,
              color: ind.options.rsiOverboughtColor || '#c4b5fd',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
              title: ''
            });
            rsiSeries.createPriceLine({
              price: 50,
              color: 'rgba(95, 122, 154, 0.25)',
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: false,
              title: ''
            });
            rsiSeries.createPriceLine({
              price: os,
              color: ind.options.rsiOversoldColor || '#c4b5fd',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
              title: ''
            });
            if (rsiData.length > 0) rsiSeries.setData(rsiData);
            createdList.push(rsiSeries);
          } else if (ind.type === 'ADX') {
            const period = ind.options.period || 14;
            const adxRes = computeADX(candles, period);
            const pane = chart.addPane();
            pane.setStretchFactor(0.22);
            const adxSeries = pane.addSeries(LineSeries, {
              color: ind.color || '#eab308',
              lineWidth: (ind.lineWidth || 2) as 1 | 2 | 3 | 4,
              priceLineVisible: false,
              lastValueVisible: true,
              crosshairMarkerVisible: true
            });
            adxSeries.createPriceLine({
              price: 25,
              color: 'rgba(95, 122, 154, 0.35)',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
              title: ''
            });
            if (adxRes.adx.length > 0) adxSeries.setData(adxRes.adx);
            createdList.push(adxSeries);

            if (ind.options.showDI !== false) {
              const plusSeries = pane.addSeries(LineSeries, {
                color: ind.options.plusDiColor || '#22c55e',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
              });
              if (adxRes.plusDI.length > 0) plusSeries.setData(adxRes.plusDI);
              createdList.push(plusSeries);

              const minusSeries = pane.addSeries(LineSeries, {
                color: ind.options.minusDiColor || '#ef4444',
                lineWidth: 1,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
              });
              if (adxRes.minusDI.length > 0) minusSeries.setData(adxRes.minusDI);
              createdList.push(minusSeries);
            }
          }
        } catch (e) {
          console.warn(`[CandlestickChart] Error creating series for ${ind.id}:`, e);
        }

        if (createdList.length > 0) {
          seriesMap.set(ind.id, createdList);
        }
      }
    };

    const updateIndicatorData = (candles: CandlestickData<Time>[], activeList: IndicatorConfig[]) => {
      const chart = chartRef.current;
      if (!chart || !candles || candles.length === 0) return;

      const activeOR = activeList.find((ind) => ind.type === 'OR' && ind.enabled && ind.visible);
      if (activeOR && orPrimitiveRef.current) {
        const dur = activeOR.options.durationMinutes || 60;
        const showMid = activeOR.options.showMid === true;
        const orData = computeOpeningRangeBreakout(candles, dur, showMid);
        orPrimitiveRef.current.update(
          orData.sessions,
          activeOR.options.highColor || activeOR.color || '#38bdf8',
          activeOR.options.lowColor || activeOR.color || '#38bdf8',
          activeOR.options.midColor || 'rgba(56, 189, 248, 0.45)',
          showMid,
          activeOR.lineWidth || 2
        );
      }

      const seriesMap = indicatorSeriesMapRef.current;
      for (const ind of activeList) {
        if (!ind.enabled || !ind.visible || ind.type === 'OR') continue;
        const existing = seriesMap.get(ind.id);
        if (!existing || existing.length === 0) continue;

        try {
          if (ind.type === 'VWAP') {
            const vwapData = computeVWAP(candles, ind.options.sessionSpecific !== false);
            if (existing[0] && vwapData.length > 0) existing[0].setData(vwapData);
          } else if (ind.type === 'EMA') {
            const emaData = computeEMA(candles, ind.options.period || 20);
            if (existing[0] && emaData.length > 0) existing[0].setData(emaData);
          } else if (ind.type === 'SMA') {
            const smaData = computeSMA(candles, ind.options.period || 50);
            if (existing[0] && smaData.length > 0) existing[0].setData(smaData);
          } else if (ind.type === 'RSI') {
            const rsiData = computeRSI(candles, ind.options.period || 14);
            if (existing[0] && rsiData.length > 0) existing[0].setData(rsiData);
          } else if (ind.type === 'ADX') {
            const adxRes = computeADX(candles, ind.options.period || 14);
            if (existing[0] && adxRes.adx.length > 0) existing[0].setData(adxRes.adx);
            if (existing[1] && adxRes.plusDI.length > 0) existing[1].setData(adxRes.plusDI);
            if (existing[2] && adxRes.minusDI.length > 0) existing[2].setData(adxRes.minusDI);
          } else if (ind.type === 'VOLUME') {
            const volStyle = ind.options.volumeStyle || 'area';
            const volColor = ind.options.volumeColor || ind.color || '#808080';
            if (volStyle === 'area') {
              const areaData = candles.map((c) => ({
                time: c.time,
                value: (c as any).volume !== undefined ? (c as any).volume : Math.abs(c.close - c.open) * 125000 + 45000
              }));
              if (existing[0]) existing[0].setData(areaData);
            } else {
              const volData = computeVolumeSeries(
                candles,
                ind.options.colorUp || volColor,
                ind.options.colorDown || '#555555',
                ind.options.volumeColor
              );
              if (existing[0] && volData.length > 0) existing[0].setData(volData);
            }
          }
        } catch (e) {
          console.warn(`[CandlestickChart] Error updating indicator data for ${ind.id}:`, e);
        }
      }
    };

    const updateLiveTickPrice = (price: number) => {
      try {
        if (typeof price !== 'number' || isNaN(price) || price <= 0) return;
        const list = currentDataRef.current;
        if (!list || list.length === 0) return;

        const currentTf = (timeframeRef.current || '5m').trim();
        const lastBar = list[list.length - 1];
        const lastBarTime = Number(lastBar.time);

        const IST_OFFSET_SECONDS = 19800;
        const nowIstSeconds = Math.floor(Date.now() / 1000) + IST_OFFSET_SECONDS;

        let bucketTime: number;
        if (currentTf === '1M' || currentTf === 'M') {
          const d = new Date(nowIstSeconds * 1000);
          bucketTime = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 9, 15, 0) / 1000);
        } else if (currentTf.toLowerCase() === '1w') {
          const d = new Date(nowIstSeconds * 1000);
          const day = d.getUTCDay();
          const daysSinceMon = (day + 6) % 7;
          const mondayStart = Math.floor(nowIstSeconds / 86400) * 86400 - daysSinceMon * 86400;
          bucketTime = mondayStart + 9 * 3600 + 15 * 60;
        } else if (currentTf.toLowerCase() === '1d') {
          bucketTime = Math.floor(nowIstSeconds / 86400) * 86400;
        } else {
          const intervalSec = getTimeframeSeconds(currentTf);
          const dayStart = Math.floor(nowIstSeconds / 86400) * 86400;
          const anchor = dayStart + 9 * 3600 + 15 * 60;
          if (nowIstSeconds >= anchor) {
            const elapsed = nowIstSeconds - anchor;
            bucketTime = anchor + Math.floor(elapsed / intervalSec) * intervalSec;
          } else {
            bucketTime = Math.floor(nowIstSeconds / intervalSec) * intervalSec;
          }
        }

        let activeBar: CandlestickData<Time>;
        let addedNewBar = false;

        if (bucketTime > lastBarTime) {
          activeBar = {
            time: bucketTime as Time,
            open: price,
            high: price,
            low: price,
            close: price
          };
          list.push(activeBar);
          addedNewBar = true;
        } else {
          activeBar = {
            ...lastBar,
            close: price,
            high: Math.max(lastBar.high, price),
            low: Math.min(lastBar.low, price)
          };
          list[list.length - 1] = activeBar;
        }

        seriesRef.current?.update(activeBar);
        priceBoxRef.current?.update(price, activeBar.close >= activeBar.open);
        setOhlcInfo(computeOHLCInfo(list, list.length - 1));
        updateIndicatorData(list, indicatorsRef.current);
        if (addedNewBar) {
          onBarUpdateRef.current?.([...list]);
        }
      } catch (err) {
        console.warn('[CandlestickChart] Error updating live price tick:', err);
      }
    };

    useImperativeHandle(
      ref,
      (): ChartImperativeHandle => ({
        updateCandle: (candle) => {
          try {
            const sec = parseToSeconds(candle.time);
            const cleanCandle = {
              ...candle,
              time: (sec > 0 ? sec : candle.time) as Time,
              open: Number(candle.open),
              high: Number(candle.high),
              low: Number(candle.low),
              close: Number(candle.close)
            };
            seriesRef.current?.update(cleanCandle);
            priceBoxRef.current?.update(cleanCandle.close, cleanCandle.close >= cleanCandle.open);

            const list = currentDataRef.current;
            const last = list.length > 0 ? list[list.length - 1] : null;
            if (last && String(last.time) === String(cleanCandle.time)) {
              list[list.length - 1] = cleanCandle;
            } else {
              list.push(cleanCandle);
            }
            setOhlcInfo(computeOHLCInfo(list, list.length - 1));
            updateIndicatorData(list, indicatorsRef.current);
          } catch (err) {
            console.warn('[CandlestickChart] Error updating candle:', err);
          }
        },
        updateLastBarPrice: updateLiveTickPrice,
        setData: (newData, preserveView = false) => {
          try {
            const clean = sanitizeCandles(newData);
            if (clean.length === 0) {
              seriesRef.current?.setData([]);
              currentDataRef.current = [];
              setOhlcInfo(null);
              syncIndicators([], indicatorsRef.current);
              return;
            }
            const currentCas = casPriceRef.current;
            const currentTf = timeframeRef.current;
            const savedLogical = preserveView ? chartRef.current?.timeScale().getVisibleLogicalRange() : null;

            try {
              seriesRef.current?.setData(clean);
            } catch (err) {
              console.warn('[CandlestickChart] Error calling series.setData:', err);
            }
            currentDataRef.current = clean;
            const latest = clean[clean.length - 1];
            if (latest) {
              priceBoxRef.current?.update(latest.close, latest.close >= latest.open);
            }
            setOhlcInfo(computeOHLCInfo(clean, clean.length - 1));
            syncIndicators(clean, indicatorsRef.current);
            syncCasPriceLine(currentCas, currentTf);

            if (preserveView && savedLogical && chartRef.current) {
              chartRef.current.timeScale().setVisibleLogicalRange(savedLogical);
            } else {
              resetChartView(chartRef.current);
            }
          } catch (err) {
            console.error('Error applying chart data:', err);
          }
        },
        fitContent: () => {
          resetChartView(chartRef.current);
        },
        panByBars: (bars: number) => {
          const ts = chartRef.current?.timeScale();
          if (!ts) return;
          const range = ts.getVisibleLogicalRange();
          if (!range) return;
          ts.setVisibleLogicalRange({
            from: range.from + bars,
            to: range.to + bars
          });
        },
        zoomX: (zoomIn: boolean) => {
          const ts = chartRef.current?.timeScale();
          if (!ts) return;
          const currentSpacing = ts.options().barSpacing || 12;
          const nextSpacing = zoomIn
            ? Math.min(80, currentSpacing * 1.18)
            : Math.max(1.5, currentSpacing * 0.84);
          ts.applyOptions({ barSpacing: nextSpacing });
        },
        zoomY: (zoomIn: boolean) => {
          const ps = chartRef.current?.priceScale('right');
          if (!ps) return;
          const range = ps.getVisibleRange();
          if (!range) return;
          const span = range.to - range.from;
          if (span <= 0) return;
          const mid = (range.from + range.to) / 2;
          const factor = zoomIn ? 0.85 : 1.18;
          const half = (span * factor) / 2;
          ps.setAutoScale(false);
          ps.setVisibleRange({ from: mid - half, to: mid + half });
        },
        getCandles: () => [...currentDataRef.current],
        applySeriesOptions: (opts) => {
          seriesRef.current?.applyOptions(opts);
        },
        getChart: () => chartRef.current,
        getSeries: () => seriesRef.current
      }),
      []
    );

    // Sync indicators whenever indicators prop changes
    useEffect(() => {
      syncIndicators(currentDataRef.current, indicators);
    }, [indicators]);

    // Sync CAS Price Line whenever casPrice or timeframe changes
    useEffect(() => {
      syncCasPriceLine(casPrice, timeframe);
    }, [casPrice, timeframe]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const chart = createChart(container, {
        width: container.clientWidth || 600,
        height: typeof height === 'number' ? height : container.clientHeight || 420,
        layout: {
          background: { type: ColorType.Solid, color: '#000000' },
          textColor: '#5F7A9A',
          fontSize: 12,
          fontFamily: 'Quicksand, sans-serif',
          panes: {
            enableResize: true,
            separatorColor: paneSeparatorColor || '#2B2B43',
            separatorHoverColor: 'rgba(95, 122, 154, 0.35)'
          }
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false }
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#334155',
            width: 1,
            style: LineStyle.Dotted,
            labelBackgroundColor: '#171717'
          },
          horzLine: {
            color: '#334155',
            width: 1,
            style: LineStyle.Dotted,
            labelBackgroundColor: '#171717'
          }
        },
        rightPriceScale: {
          borderColor: '#5F7A9A',
          textColor: '#5F7A9A',
          autoScale: true,
          scaleMargins: {
            top: 0.16,
            bottom: 0.14
          }
        },
        timeScale: {
          borderColor: '#5F7A9A',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 15,
          barSpacing: 12,
          minBarSpacing: 1,
          fixLeftEdge: false,
          fixRightEdge: false
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: {
            time: true,
            price: true
          },
          axisDoubleClickReset: {
            time: false,
            price: true
          }
        },
        localization: {
          dateFormat: 'dd MMM yyyy'
        },
        ...chartOptions
      });

      const POSITIVE_COLOR = '#e5e7eb';
      const NEGATIVE_BODY_COLOR = '#000000';

      const series = chart.addSeries(CandlestickSeries, {
        upColor: POSITIVE_COLOR,
        downColor: NEGATIVE_BODY_COLOR,
        borderVisible: true,
        borderColor: POSITIVE_COLOR,
        borderUpColor: POSITIVE_COLOR,
        borderDownColor: POSITIVE_COLOR,
        wickVisible: true,
        wickUpColor: POSITIVE_COLOR,
        wickDownColor: POSITIVE_COLOR,
        priceLineVisible: true,
        priceLineColor: '#5F7A9A',
        priceLineWidth: 1,
        priceLineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        ...seriesOptions
      });

      const cleanInitial = sanitizeCandles(data);
      if (cleanInitial.length > 0) {
        series.setData(cleanInitial);
        currentDataRef.current = cleanInitial;
      }

      const lastBar = cleanInitial.length > 0 ? cleanInitial[cleanInitial.length - 1] : null;
      const initialPrice = lastBar ? lastBar.close : (casPrice || 0);
      const initialIsPositive = lastBar ? lastBar.close >= lastBar.open : true;
      const priceBoxPrimitive = new PriceBoxPrimitive(initialPrice, initialIsPositive);
      series.attachPrimitive(priceBoxPrimitive);
      priceBoxRef.current = priceBoxPrimitive;

      chartRef.current = chart;
      seriesRef.current = series;

      if (cleanInitial.length > 0) {
        syncIndicators(cleanInitial, indicatorsRef.current);
      }
      resetChartView(chart);
      syncCasPriceLine(casPrice, timeframe);

      const measureCorner = () => {
        try {
          const rw = Math.max(54, Math.round(chart.priceScale('right').width() || 62));
          const bh = Math.max(24, Math.round(chart.timeScale().height() || 26));
          setCornerDims((prev) => (prev.rightW === rw && prev.bottomH === bh ? prev : { rightW: rw, bottomH: bh }));
        } catch {}
      };
      setTimeout(measureCorner, 80);

      const handleCrosshairMove = (param: MouseEventParams<Time>) => {
        const list = currentDataRef.current;
        if (list.length === 0) return;

        if (!param.point) {
          setOhlcInfo(computeOHLCInfo(list, list.length - 1));
          return;
        }

        let targetIdx = -1;
        if (chartRef.current && param.point) {
          const logical = chartRef.current.timeScale().coordinateToLogical(param.point.x);
          if (logical !== null) {
            const idx = Math.round(logical);
            if (idx >= 0 && idx < list.length) {
              targetIdx = idx;
            }
          }
        }
        if (targetIdx === -1 && param.time !== undefined) {
          const tStr = String(param.time);
          targetIdx = list.findIndex((d) => String(d.time) === tStr);
        }
        if (targetIdx === -1 && typeof param.logical === 'number') {
          const idx = Math.round(param.logical);
          if (idx >= 0 && idx < list.length) {
            targetIdx = idx;
          }
        }

        if (targetIdx !== -1) {
          const info = computeOHLCInfo(list, targetIdx);
          if (info) setOhlcInfo(info);
        }
      };

      chart.subscribeCrosshairMove(handleCrosshairMove);

      const handleMouseLeave = () => {
        const list = currentDataRef.current;
        setOhlcInfo(computeOHLCInfo(list, list.length - 1));
      };
      container.addEventListener('mouseleave', handleMouseLeave);

      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const entry = entries[0];
        const newWidth = entry.contentRect.width;
        const newHeight = typeof height === 'number' ? height : entry.contentRect.height;

        if (newWidth > 0 && chartRef.current) {
          chartRef.current.applyOptions({
            width: newWidth,
            ...(newHeight > 0 ? { height: newHeight } : {})
          });
          measureCorner();
        }
      });

      resizeObserver.observe(container);

      if (onChartReady) {
        onChartReady({
          updateCandle: (candle) => {
            series.update(candle);
            priceBoxPrimitive.update(candle.close, candle.close >= candle.open);
            const list = currentDataRef.current;
            const last = list.length > 0 ? list[list.length - 1] : null;
            if (last && String(last.time) === String(candle.time)) {
              list[list.length - 1] = candle;
            } else {
              list.push(candle);
            }
            setOhlcInfo(computeOHLCInfo(list, list.length - 1));
          },
          updateLastBarPrice: updateLiveTickPrice,
          setData: (newData) => {
            series.setData(newData);
            currentDataRef.current = [...newData];
            const latest = newData && newData.length > 0 ? newData[newData.length - 1] : null;
            if (latest) {
              priceBoxPrimitive.update(latest.close, latest.close >= latest.open);
            }
            setOhlcInfo(computeOHLCInfo(newData, newData.length - 1));
          },
          fitContent: () => resetChartView(chart),
          panByBars: (bars) => {
            const r = chart.timeScale().getVisibleLogicalRange();
            if (r) chart.timeScale().setVisibleLogicalRange({ from: r.from + bars, to: r.to + bars });
          },
          zoomX: (zoomIn) => {
            const sp = chart.timeScale().options().barSpacing || 12;
            chart.timeScale().applyOptions({ barSpacing: zoomIn ? Math.min(80, sp * 1.18) : Math.max(1.5, sp * 0.84) });
          },
          zoomY: (zoomIn) => {
            const ps = chart.priceScale('right');
            const r = ps.getVisibleRange();
            if (!r) return;
            const span = r.to - r.from;
            if (span <= 0) return;
            const mid = (r.from + r.to) / 2;
            const half = (span * (zoomIn ? 0.85 : 1.18)) / 2;
            ps.setAutoScale(false);
            ps.setVisibleRange({ from: mid - half, to: mid + half });
          },
          getCandles: () => [...currentDataRef.current],
          applySeriesOptions: (opts) => series.applyOptions(opts),
          getChart: () => chart,
          getSeries: () => series
        });
      }

      const handleWheel = (e: WheelEvent) => {
        if (!chartRef.current) return;
        const rect = container.getBoundingClientRect();
        const rightScale = chartRef.current.priceScale('right');
        const scaleWidth = rightScale.width() || 65;
        const isOverYAxis = e.clientX >= rect.right - scaleWidth - 5;

        if (isOverYAxis) {
          e.preventDefault();
          e.stopPropagation();

          const range = rightScale.getVisibleRange();
          if (!range) return;

          const span = range.to - range.from;
          if (span <= 0) return;

          const mouseY = e.clientY - rect.top;
          const ratio = Math.max(0.05, Math.min(0.95, mouseY / rect.height));
          const focalPrice = range.to - ratio * span;

          const zoomFactor = e.deltaY < 0 ? 0.88 : 1.14;
          const newTo = focalPrice + (range.to - focalPrice) * zoomFactor;
          const newFrom = focalPrice - (focalPrice - range.from) * zoomFactor;

          if (newTo > newFrom) {
            rightScale.setAutoScale(false);
            rightScale.setVisibleRange({ from: newFrom, to: newTo });
          }
        }
      };

      const handleDblClick = (e: MouseEvent) => {
        if (!chartRef.current) return;
        const rect = container.getBoundingClientRect();
        const rightScale = chartRef.current.priceScale('right');
        const scaleWidth = rightScale.width() || 65;
        if (e.clientX >= rect.right - scaleWidth - 5) {
          rightScale.applyOptions({
            autoScale: true,
            scaleMargins: { top: 0.16, bottom: 0.14 }
          });
          rightScale.setAutoScale(true);
        } else if (e.clientY >= rect.bottom - 28) {
          resetChartView(chartRef.current);
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('dblclick', handleDblClick);

      return () => {
        resizeObserver.disconnect();
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('dblclick', handleDblClick);
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
        indicatorSeriesMapRef.current.clear();
        if (casPriceLineRef.current && seriesRef.current) {
          try {
            seriesRef.current.removePriceLine(casPriceLineRef.current);
          } catch {}
          casPriceLineRef.current = null;
        }
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
        priceBoxRef.current = null;
        orPrimitiveRef.current = null;
      };
    }, []);

    useEffect(() => {
      try {
        if (seriesRef.current && data) {
          const clean = sanitizeCandles(data);
          if (clean.length > 0) {
            const currentCas = casPriceRef.current;
            const currentTf = timeframeRef.current;
            try {
              seriesRef.current.setData(clean);
            } catch (err) {
              console.warn('[CandlestickChart] Error updating series data in effect:', err);
            }
            currentDataRef.current = clean;
            const latest = clean[clean.length - 1];
            if (latest) {
              priceBoxRef.current?.update(latest.close, latest.close >= latest.open);
            }
            setOhlcInfo(computeOHLCInfo(clean, clean.length - 1));
            syncIndicators(clean, indicatorsRef.current);
            syncCasPriceLine(currentCas, currentTf);
          }
        }
      } catch (err) {
        console.error('Error updating chart series data:', err);
      }
    }, [data]);

    useEffect(() => {
      if (seriesRef.current && seriesOptions) {
        seriesRef.current.applyOptions(seriesOptions);
      }
    }, [seriesOptions]);

    useEffect(() => {
      if (chartRef.current) {
        chartRef.current.applyOptions({
          layout: {
            panes: {
              enableResize: true,
              separatorColor: paneSeparatorColor || '#2B2B43',
              separatorHoverColor: 'rgba(95, 122, 154, 0.35)'
            }
          }
        });
      }
    }, [paneSeparatorColor]);

    // Group active indicators for clean OHLC indicator strip (EMA stacked, SMA stacked, no dots, no gear)
    const groupedIndicatorBadges = useMemo(() => {
      const enabled = (indicators || []).filter((ind) => ind.enabled);
      const emas = enabled.filter((ind) => ind.type === 'EMA');
      const smas = enabled.filter((ind) => ind.type === 'SMA');
      const others = enabled.filter((ind) => ind.type !== 'EMA' && ind.type !== 'SMA');

      return { emas, smas, others };
    }, [indicators]);

    const changePctSign = ohlcInfo && ohlcInfo.changePct > 0 ? '+' : '';
    const changeValSign = ohlcInfo && ohlcInfo.changeVal > 0 ? '+' : '';

    return (
      <div
        className={className}
        onContextMenu={onContextMenu}
        style={{
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '4px',
          fontFamily: 'Quicksand, sans-serif',
          ...style
        }}
      >
        {/* Chart Canvas */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Top-Left OHLC & Change Overlay */}
        {ohlcInfo && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '12px',
              zIndex: 10,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'Quicksand, sans-serif',
              fontSize: '0.74rem',
              backgroundColor: 'rgba(0, 0, 0, 0.70)',
              padding: '2px 8px',
              borderRadius: '3px',
              border: '1px solid #1a1a1a',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>O</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.open)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>H</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.high)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>L</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.low)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>C</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.close)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>
                {changePctSign}{ohlcInfo.changePct.toFixed(2)}%
              </span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>
                ({changeValSign}{ohlcInfo.changeVal.toFixed(2)})
              </span>
            </div>
          </div>
        )}

        {/* Active Indicators Bar Under OHLC (Single-click to Hide/Show, Stacked EMA/SMA, No dots/gear) */}
        {(groupedIndicatorBadges.others.length > 0 ||
          groupedIndicatorBadges.emas.length > 0 ||
          groupedIndicatorBadges.smas.length > 0) && (
          <div
            style={{
              position: 'absolute',
              top: '36px',
              left: '12px',
              zIndex: 10,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              fontFamily: 'Quicksand, sans-serif',
              fontSize: '0.66rem',
              userSelect: 'none'
            }}
          >
            {/* Non-MA Indicators: OR (<tf>), VWAP (Session), VOL (...), RSI (...), ADX (...) */}
            {groupedIndicatorBadges.others.map((ind) => {
              const isHidden = !ind.visible;
              let displayText = ind.shortName;
              if (ind.type === 'OR') {
                displayText = `OR (${formatDurationLabel(ind.options.durationMinutes || 60)})`;
              } else if (ind.type === 'VWAP') {
                displayText = `VWAP (${ind.options.sessionSpecific !== false ? 'Session' : 'Cont'})`;
              } else if (ind.type === 'VOLUME') {
                displayText = `VOL (${ind.options.volumeStyle === 'bar' ? 'Bar' : 'Area'})`;
              } else if (ind.type === 'RSI') {
                displayText = `RSI (${ind.options.period || 14})`;
              } else if (ind.type === 'ADX') {
                displayText = `ADX (${ind.options.period || 14})`;
              }

              return (
                <div
                  key={ind.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleIndicatorVisibility?.([ind.id]);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenIndicatorSettings?.(ind.id);
                  }}
                  title={isHidden ? 'Click to show · Double-click for settings' : 'Click to hide · Double-click for settings'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isHidden ? 'rgba(20, 20, 20, 0.72)' : 'rgba(5, 5, 5, 0.88)',
                    border: `1px solid ${isHidden ? '#525252' : ind.color || '#5F7A9A'}`,
                    borderRadius: '3px',
                    padding: '2px 8px',
                    color: isHidden ? '#9ca3af' : '#e5e7eb',
                    textDecoration: isHidden ? 'line-through' : 'none',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.12s ease',
                    fontWeight: 600
                  }}
                >
                  <span>{displayText}</span>
                </div>
              );
            })}

            {/* Stacked EMA Pill: EMA (10,20,50) with each period individually colored */}
            {groupedIndicatorBadges.emas.length > 0 && (() => {
              const allHidden = groupedIndicatorBadges.emas.every((e) => !e.visible);
              const ids = groupedIndicatorBadges.emas.map((e) => e.id);
              return (
                <div
                  key="group-ema"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleIndicatorVisibility?.(ids);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenIndicatorSettings?.(ids[0]);
                  }}
                  title={allHidden ? 'Click to show EMAs · Double-click for settings' : 'Click to hide EMAs · Double-click for settings'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    backgroundColor: allHidden ? 'rgba(20, 20, 20, 0.72)' : 'rgba(5, 5, 5, 0.88)',
                    border: `1px solid ${allHidden ? '#525252' : '#5F7A9A'}`,
                    borderRadius: '3px',
                    padding: '2px 8px',
                    color: allHidden ? '#9ca3af' : '#e5e7eb',
                    textDecoration: allHidden ? 'line-through' : 'none',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.12s ease',
                    fontWeight: 600
                  }}
                >
                  <span>EMA (</span>
                  {groupedIndicatorBadges.emas.map((ema, idx) => (
                    <span key={ema.id}>
                      <span
                        style={{
                          color: allHidden || !ema.visible ? '#9ca3af' : ema.color,
                          textDecoration: allHidden || !ema.visible ? 'line-through' : 'none',
                          fontWeight: 700
                        }}
                      >
                        {ema.options.period || 20}
                      </span>
                      {idx < groupedIndicatorBadges.emas.length - 1 && (
                        <span style={{ color: allHidden ? '#9ca3af' : '#737373' }}>,</span>
                      )}
                    </span>
                  ))}
                  <span>)</span>
                </div>
              );
            })()}

            {/* Stacked SMA Pill: SMA (20,50,200) with each period individually colored */}
            {groupedIndicatorBadges.smas.length > 0 && (() => {
              const allHidden = groupedIndicatorBadges.smas.every((s) => !s.visible);
              const ids = groupedIndicatorBadges.smas.map((s) => s.id);
              return (
                <div
                  key="group-sma"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleIndicatorVisibility?.(ids);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenIndicatorSettings?.(ids[0]);
                  }}
                  title={allHidden ? 'Click to show SMAs · Double-click for settings' : 'Click to hide SMAs · Double-click for settings'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    backgroundColor: allHidden ? 'rgba(20, 20, 20, 0.72)' : 'rgba(5, 5, 5, 0.88)',
                    border: `1px solid ${allHidden ? '#525252' : '#5F7A9A'}`,
                    borderRadius: '3px',
                    padding: '2px 8px',
                    color: allHidden ? '#9ca3af' : '#e5e7eb',
                    textDecoration: allHidden ? 'line-through' : 'none',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.12s ease',
                    fontWeight: 600
                  }}
                >
                  <span>SMA (</span>
                  {groupedIndicatorBadges.smas.map((sma, idx) => (
                    <span key={sma.id}>
                      <span
                        style={{
                          color: allHidden || !sma.visible ? '#9ca3af' : sma.color,
                          textDecoration: allHidden || !sma.visible ? 'line-through' : 'none',
                          fontWeight: 700
                        }}
                      >
                        {sma.options.period || 50}
                      </span>
                      {idx < groupedIndicatorBadges.smas.length - 1 && (
                        <span style={{ color: allHidden ? '#9ca3af' : '#737373' }}>,</span>
                      )}
                    </span>
                  ))}
                  <span>)</span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Candle Countdown Timer Anchored at Corner Where X-Axis and Y-Axis Meet */}
        <div
          title={`Time remaining until current ${timeframe} candle closes`}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: `${cornerDims.rightW}px`,
            height: `${cornerDims.bottomH}px`,
            backgroundColor: '#050505',
            borderTop: '1px solid #5F7A9A',
            borderLeft: '1px solid #5F7A9A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.66rem',
            fontWeight: 700,
            color: '#e5e7eb',
            fontFamily: 'Quicksand, sans-serif',
            letterSpacing: '0.02em',
            zIndex: 12,
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          {countdownText}
        </div>
      </div>
    );
  }
);

CandlestickChart.displayName = 'CandlestickChart';
