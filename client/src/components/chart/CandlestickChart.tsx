import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef
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
import { CandlestickChartProps, ChartImperativeHandle, IndicatorConfig } from './types';
import {
  computeOpeningRangeBreakout,
  computeVWAP,
  computeEMA,
  computeSMA,
  computeVolumeSeries
} from './indicators';

/**
 * Format numerical prices with comma separation (Indian format)
 */
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
  changeVal: number; // compared to previous candle close
  changePct: number; // compared to previous candle close
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

/**
 * Utility to draw a crisp rounded rectangle on Canvas 2D
 */
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
 * Custom series primitive to render the price box on the price axis with:
 * - Razor-sharp, unblurred primary color border (#5F7A9A) via device bitmap pixel alignment
 * - White inside background if price is positive (close >= open)
 * - Black inside background if price is negative (close < open)
 * - Contrasting text color (black on white, white on black)
 * - Strict Quicksand typography
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

        // Draw in 1:1 hardware device bitmap coordinates to completely avoid subpixel blurriness
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

          // 1. Draw outer rounded rect with primary accent color (#5F7A9A)
          drawRoundedRect(ctx, x, top, boxWidth, boxHeight, radius);
          ctx.fillStyle = '#5F7A9A';
          ctx.fill();

          // 2. Draw inner rounded rect with inside color inset by exact borderWidth (100% crisp, zero blur)
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

          // 3. Draw text in crisp bitmap font pixels
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

  updateAllViews() {
    // Redraw triggered by Lightweight Charts on scroll/zoom/viewport change
  }

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
 * Reset chart view: fit all data to screen with right-side breathing room and auto price scale.
 * Uses fitContent() (the correct Lightweight Charts API) then applies rightOffset spacing.
 */
function resetChartView(chartApi: IChartApi | null) {
  if (!chartApi) return;
  try {
    chartApi.timeScale().fitContent();
    chartApi.timeScale().applyOptions({ rightOffset: 15 });
    chartApi.priceScale('right').applyOptions({ autoScale: true });
    chartApi.priceScale('right').setAutoScale(true);
  } catch (e) {
    console.warn('[CandlestickChart] Error resetting chart view:', e);
  }
}

/**
 * Helper to get interval length in seconds for standard chart timeframes
 */
function getTimeframeSeconds(tf: string): number {
  const clean = (tf || '15m').toLowerCase().trim();
  if (clean === '1m' || clean === '1') return 60;
  if (clean === '2m' || clean === '2') return 120;
  if (clean === '3m' || clean === '3') return 180;
  if (clean === '5m' || clean === '5') return 300;
  if (clean === '10m' || clean === '10') return 600;
  if (clean === '15m' || clean === '15') return 900;
  if (clean === '30m' || clean === '30') return 1800;
  if (clean === '1h' || clean === '60') return 3600;
  if (clean === '2h' || clean === '120') return 7200;
  if (clean === '4h' || clean === '240') return 14400;
  if (clean === '1d' || clean === 'd') return 86400;
  return 900;
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
      casPrice,
      timeframe = '15m'
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const priceBoxRef = useRef<PriceBoxPrimitive | null>(null);
    const indicatorSeriesMapRef = useRef<Map<string, ISeriesApi<any>[]>>(new Map());
    const casPriceLineRef = useRef<IPriceLine | null>(null);
    const casPriceRef = useRef<number | undefined>(casPrice);
    casPriceRef.current = casPrice;
    const timeframeRef = useRef<string>(timeframe);
    timeframeRef.current = timeframe;

    // Keep data array in ref for fast lookup during crosshair moves
    const currentDataRef = useRef<CandlestickData<Time>[]>(data || []);

    // OHLC & change compared to previous candle
    const [ohlcInfo, setOhlcInfo] = useState<OHLCInfo | null>(() => {
      const list = data || [];
      return computeOHLCInfo(list, list.length - 1);
    });

    const syncCasPriceLine = (price?: number, tf?: string) => {
      const series = seriesRef.current;
      if (!series) return;

      if (casPriceLineRef.current) {
        try {
          series.removePriceLine(casPriceLineRef.current);
        } catch {}
        casPriceLineRef.current = null;
      }

      if (price && price > 0 && tf !== '1D') {
        try {
          const line = series.createPriceLine({
            price,
            color: '#5F7A9A',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: '' // Removed "CAS" label name; displays only the price value on the Y axis
          });
          casPriceLineRef.current = line;
        } catch (e) {
          console.warn('[CandlestickChart] Error creating CAS price line:', e);
        }
      }
    };

    const syncIndicators = (candles: CandlestickData<Time>[], activeList: IndicatorConfig[]) => {
      const chart = chartRef.current;
      if (!chart || !candles || candles.length === 0) return;

      const seriesMap = indicatorSeriesMapRef.current;
      const activeIds = new Set(activeList.filter((ind) => ind.enabled && ind.visible).map((ind) => ind.id));

      // Remove inactive or disabled series
      for (const [id, sList] of Array.from(seriesMap.entries())) {
        if (!activeIds.has(id)) {
          sList.forEach((s) => {
            try {
              chart.removeSeries(s);
            } catch {}
          });
          seriesMap.delete(id);
        }
      }

      // Add or update active series
      for (const ind of activeList) {
        if (!ind.enabled || !ind.visible) continue;

        const existing = seriesMap.get(ind.id);
        if (existing) {
          existing.forEach((s) => {
            try {
              chart.removeSeries(s);
            } catch {}
          });
          seriesMap.delete(ind.id);
        }

        const createdList: ISeriesApi<any>[] = [];

        try {
          if (ind.type === 'OR') {
            const dur = ind.options.durationMinutes || 60;
            const showMid = ind.options.showMid === true;
            const orData = computeOpeningRangeBreakout(candles, dur, showMid);

            if (orData.highPoints.length > 0) {
              const highSeries = chart.addSeries(LineSeries, {
                color: ind.options.highColor || ind.color || '#38bdf8',
                lineWidth: (ind.lineWidth || 2) as 1 | 2 | 3 | 4,
                lineStyle: LineStyle.Solid,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                title: ''
              });
              highSeries.setData(orData.highPoints);
              createdList.push(highSeries);

              const lowSeries = chart.addSeries(LineSeries, {
                color: ind.options.lowColor || ind.color || '#38bdf8',
                lineWidth: (ind.lineWidth || 2) as 1 | 2 | 3 | 4,
                lineStyle: LineStyle.Solid,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                title: ''
              });
              lowSeries.setData(orData.lowPoints);
              createdList.push(lowSeries);

              if (showMid && orData.midPoints.length > 0) {
                const midSeries = chart.addSeries(LineSeries, {
                  color: ind.options.midColor || 'rgba(56, 189, 248, 0.45)',
                  lineWidth: 1,
                  lineStyle: LineStyle.Dotted,
                  priceLineVisible: false,
                  lastValueVisible: false,
                  crosshairMarkerVisible: false,
                  title: ''
                });
                midSeries.setData(orData.midPoints);
                createdList.push(midSeries);
              }
            }
          } else if (ind.type === 'VWAP') {
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
                color: ind.color || '#a855f7',
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
                color: ind.color || '#10b981',
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
              // Area Chart volume overlay with grey / customizable gradient
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
              // Bar Chart (Histogram) volume overlay
              const volData = computeVolumeSeries(candles, ind.options.colorUp || volColor, ind.options.colorDown || '#555555', ind.options.volumeColor);
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
          }
        } catch (e) {
          console.warn(`[CandlestickChart] Error creating series for ${ind.id}:`, e);
        }

        if (createdList.length > 0) {
          seriesMap.set(ind.id, createdList);
        }
      }
    };

    /**
     * Efficiently update active indicator lines using setData on existing series without rebuilding Canvas context
     */
    const updateIndicatorData = (candles: CandlestickData<Time>[], activeList: IndicatorConfig[]) => {
      const chart = chartRef.current;
      if (!chart || !candles || candles.length === 0) return;

      const seriesMap = indicatorSeriesMapRef.current;

      for (const ind of activeList) {
        if (!ind.enabled || !ind.visible) continue;
        const existing = seriesMap.get(ind.id);
        if (!existing || existing.length === 0) continue;

        try {
          if (ind.type === 'OR') {
            const dur = ind.options.durationMinutes || 60;
            const showMid = ind.options.showMid === true;
            const orData = computeOpeningRangeBreakout(candles, dur, showMid);
            if (existing[0] && orData.highPoints.length > 0) existing[0].setData(orData.highPoints);
            if (existing[1] && orData.lowPoints.length > 0) existing[1].setData(orData.lowPoints);
            if (existing[2] && orData.midPoints.length > 0) existing[2].setData(orData.midPoints);
          } else if (ind.type === 'VWAP') {
            const sessionSpecific = ind.options.sessionSpecific !== false;
            const vwapData = computeVWAP(candles, sessionSpecific);
            if (existing[0] && vwapData.length > 0) existing[0].setData(vwapData);
          } else if (ind.type === 'EMA') {
            const period = ind.options.period || 20;
            const emaData = computeEMA(candles, period);
            if (existing[0] && emaData.length > 0) existing[0].setData(emaData);
          } else if (ind.type === 'SMA') {
            const period = ind.options.period || 50;
            const smaData = computeSMA(candles, period);
            if (existing[0] && smaData.length > 0) existing[0].setData(smaData);
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
              const volData = computeVolumeSeries(candles, ind.options.colorUp || volColor, ind.options.colorDown || '#555555', ind.options.volumeColor);
              if (existing[0] && volData.length > 0) existing[0].setData(volData);
            }
          }
        } catch (e) {
          console.warn(`[CandlestickChart] Error updating indicator data for ${ind.id}:`, e);
        }
      }
    };

    /**
     * TradingView-standard Real-Time Candle Formation:
     * - Truncates incoming tick timestamp to the timeframe's interval bucket (shifted by +19800 IST)
     * - If the interval has advanced: opens and appends a brand-new candle to the series
     * - If within the active interval: updates high, low, close in-place
     */
    const updateLiveTickPrice = (price: number) => {
      try {
        if (typeof price !== 'number' || isNaN(price) || price <= 0) return;
        const list = currentDataRef.current;
        if (!list || list.length === 0) return;

        const currentTf = timeframeRef.current || '15m';
        const lastBar = list[list.length - 1];
        const lastBarTime = Number(lastBar.time);

        // Unified IST offset (+19800s) matching FYERS historical candles
        const IST_OFFSET_SECONDS = 19800;
        const nowIstSeconds = Math.floor(Date.now() / 1000) + IST_OFFSET_SECONDS;

        let activeBar: CandlestickData<Time>;

        if (currentTf === '1D') {
          const dayBucket = Math.floor(nowIstSeconds / 86400) * 86400;
          if (dayBucket > lastBarTime) {
            activeBar = {
              time: dayBucket as Time,
              open: price,
              high: price,
              low: price,
              close: price
            };
            list.push(activeBar);
          } else {
            activeBar = {
              ...lastBar,
              close: price,
              high: Math.max(lastBar.high, price),
              low: Math.min(lastBar.low, price)
            };
            list[list.length - 1] = activeBar;
          }
        } else {
          const intervalSec = getTimeframeSeconds(currentTf);
          const bucketTime = Math.floor(nowIstSeconds / intervalSec) * intervalSec;

          if (bucketTime > lastBarTime) {
            // Interval boundary crossed: advance and open a brand-new candle!
            activeBar = {
              time: bucketTime as Time,
              open: price,
              high: price,
              low: price,
              close: price
            };
            list.push(activeBar);
          } else {
            // Within current candle interval: update high, low, close
            activeBar = {
              ...lastBar,
              close: price,
              high: Math.max(lastBar.high, price),
              low: Math.min(lastBar.low, price)
            };
            list[list.length - 1] = activeBar;
          }
        }

        seriesRef.current?.update(activeBar);
        priceBoxRef.current?.update(price, activeBar.close >= activeBar.open);
        setOhlcInfo(computeOHLCInfo(list, list.length - 1));
        updateIndicatorData(list, indicators);
      } catch (err) {
        console.warn('[CandlestickChart] Error updating live price tick:', err);
      }
    };

    // Expose imperative API for streaming real-time updates (FYERS WebSocket readiness)
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
            updateIndicatorData(list, indicators);
          } catch (err) {
            console.warn('[CandlestickChart] Error updating candle:', err);
          }
        },
        updateLastBarPrice: updateLiveTickPrice,
        setData: (newData) => {
          try {
            const clean = sanitizeCandles(newData);
            if (clean.length === 0) return;
            const currentCas = casPriceRef.current;
            const currentTf = timeframeRef.current;
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
            syncIndicators(clean, indicators);
            syncCasPriceLine(currentCas, currentTf);
            resetChartView(chartRef.current);
          } catch (err) {
            console.error('Error applying chart data:', err);
          }
        },
        fitContent: () => {
          resetChartView(chartRef.current);
        },
        applySeriesOptions: (opts) => {
          seriesRef.current?.applyOptions(opts);
        },
        getChart: () => chartRef.current,
        getSeries: () => seriesRef.current
      }),
      [indicators]
    );

    // Sync indicators whenever indicators prop changes
    useEffect(() => {
      syncIndicators(currentDataRef.current, indicators);
    }, [indicators]);

    // Sync CAS Price Line whenever casPrice or timeframe changes (reference line only)
    useEffect(() => {
      syncCasPriceLine(casPrice, timeframe);
    }, [casPrice, timeframe]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Initialize Lightweight Chart with spec defaults:
      // - Primary color (#5F7A9A) for Y-axis and X-axis borders & text
      // - Pure pitch black (#000000) background
      // - Clean Quicksand font
      const chart = createChart(container, {
        width: container.clientWidth || 600,
        height: typeof height === 'number' ? height : container.clientHeight || 420,
        layout: {
          background: { type: ColorType.Solid, color: '#000000' },
          textColor: '#5F7A9A',
          fontSize: 12,
          fontFamily: 'Quicksand, sans-serif'
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
            top: 0.12,
            bottom: 0.15
          }
        },
        timeScale: {
          borderColor: '#5F7A9A',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 15,
          barSpacing: 6,
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
            time: true,
            price: true
          }
        },
        localization: {
          dateFormat: 'dd MMM yyyy'
        },
        ...chartOptions
      });

      // Positive candles: Light grey-white body & wick (#e5e7eb)
      // Negative candles: Same colour border & wick as positive candles, black body (#000000)
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
        // Price line in primary steel blue color (#5F7A9A)
        priceLineVisible: true,
        priceLineColor: '#5F7A9A',
        priceLineWidth: 1,
        priceLineStyle: LineStyle.Dashed,
        lastValueVisible: false, // Custom PriceBoxPrimitive renders the bordered price box
        ...seriesOptions
      });

      // Set initial data safely with unified numeric epoch timestamps
      const cleanInitial = sanitizeCandles(data);
      if (cleanInitial.length > 0) {
        series.setData(cleanInitial);
        currentDataRef.current = cleanInitial;
        syncIndicators(cleanInitial, indicators);
      }
      resetChartView(chart);

      // Attach custom price box primitive for dynamic positive/negative price box with #5F7A9A border
      const lastBar = cleanInitial.length > 0 ? cleanInitial[cleanInitial.length - 1] : null;
      const initialPrice = lastBar ? lastBar.close : (casPrice || 0);
      const initialIsPositive = lastBar ? lastBar.close >= lastBar.open : true;
      const priceBoxPrimitive = new PriceBoxPrimitive(initialPrice, initialIsPositive);
      series.attachPrimitive(priceBoxPrimitive);
      priceBoxRef.current = priceBoxPrimitive;

      chartRef.current = chart;
      seriesRef.current = series;

      // Sync official CAS price line on small timeframe charts
      syncCasPriceLine(casPrice, timeframe);

      // Track crosshair move for dynamic OHLC display on whatever candle cursor is on
      const handleCrosshairMove = (param: MouseEventParams<Time>) => {
        const list = currentDataRef.current;
        if (list.length === 0) return;

        // If mouse has left the chart pane
        if (!param.point) {
          setOhlcInfo(computeOHLCInfo(list, list.length - 1));
          return;
        }

        let targetIdx = -1;

        // 1. Direct coordinate to logical conversion from cursor X (most continuous & responsive)
        if (chartRef.current && param.point) {
          const logical = chartRef.current.timeScale().coordinateToLogical(param.point.x);
          if (logical !== null) {
            const idx = Math.round(logical);
            if (idx >= 0 && idx < list.length) {
              targetIdx = idx;
            }
          }
        }

        // 2. Exact time match
        if (targetIdx === -1 && param.time !== undefined) {
          const tStr = String(param.time);
          targetIdx = list.findIndex((d) => String(d.time) === tStr);
        }

        // 3. Logical index directly from param
        if (targetIdx === -1 && typeof param.logical === 'number') {
          const idx = Math.round(param.logical);
          if (idx >= 0 && idx < list.length) {
            targetIdx = idx;
          }
        }

        // 4. Series data fallback
        if (targetIdx === -1 && param.seriesData) {
          for (const val of param.seriesData.values()) {
            if (val && typeof val === 'object' && 'time' in val) {
              const tStr = String((val as CandlestickData<Time>).time);
              targetIdx = list.findIndex((d) => String(d.time) === tStr);
              if (targetIdx !== -1) break;
            }
          }
        }

        if (targetIdx !== -1) {
          const info = computeOHLCInfo(list, targetIdx);
          if (info) {
            setOhlcInfo(info);
          }
        }
      };

      chart.subscribeCrosshairMove(handleCrosshairMove);

      const handleMouseLeave = () => {
        const list = currentDataRef.current;
        setOhlcInfo(computeOHLCInfo(list, list.length - 1));
      };
      container.addEventListener('mouseleave', handleMouseLeave);

      // Handle responsiveness via ResizeObserver
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
        }
      });

      resizeObserver.observe(container);

      // Notify consumer that chart is ready
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
          fitContent: () => {
            resetChartView(chart);
          },
          applySeriesOptions: (opts) => series.applyOptions(opts),
          getChart: () => chart,
          getSeries: () => series
        });
      }

      // Y-axis Price Scale mouse wheel zooming (TradingView-style vertical scaling)
      const handleWheel = (e: WheelEvent) => {
        if (!chartRef.current) return;
        const rect = container.getBoundingClientRect();
        // The price scale (Y-axis) is aligned to the right edge of container
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

          // Scroll up (negative delta) zooms in (compresses span, candles taller)
          // Scroll down (positive delta) zooms out (expands span, candles shorter)
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
          rightScale.applyOptions({ autoScale: true });
          rightScale.setAutoScale(true);
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('dblclick', handleDblClick);

      // Cleanup on unmount
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
      };
    }, []); // Run on mount

    // Update dataset when data prop changes
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
            syncIndicators(clean, indicators);
            syncCasPriceLine(currentCas, currentTf);
            resetChartView(chartRef.current);
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
          ...style
        }}
      >
        {/* Chart Canvas */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Top-Left OHLC & Day Change Overlay (Below NIFTY 50 INDEX) */}
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
            {/* O */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>O</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.open)}</span>
            </div>

            {/* H */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>H</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.high)}</span>
            </div>

            {/* L */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>L</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.low)}</span>
            </div>

            {/* C */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#5F7A9A', fontWeight: 700 }}>C</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{formatPrice(ohlcInfo.close)}</span>
            </div>

            {/* Day Change: % in blue (#5F7A9A), then absolute day change in grey-white (#e5e7eb) */}
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

        {/* Active Indicators Overlay Badges (Double-Click on badge to open respective settings) */}
        {indicators && indicators.some((ind) => ind.enabled && ind.visible) && (
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
            {indicators
              .filter((ind) => ind.enabled && ind.visible)
              .map((ind) => (
                <div
                  key={ind.id}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenIndicatorSettings?.(ind.id);
                  }}
                  title={`Double click to open ${ind.shortName} settings`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: 'rgba(5, 5, 5, 0.88)',
                    border: `1px solid ${ind.color || '#5F7A9A'}`,
                    borderRadius: '3px',
                    padding: '2px 7px',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(5, 5, 5, 0.88)';
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: ind.color || '#5F7A9A',
                      boxShadow: `0 0 5px ${ind.color || '#5F7A9A'}`
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{ind.shortName}</span>
                  {ind.type === 'OR' && (
                    <span style={{ color: '#9ca3af', fontSize: '0.60rem' }}>
                      ({ind.options.durationMinutes || 60}m)
                    </span>
                  )}
                  {ind.type === 'VWAP' && (
                    <span style={{ color: '#9ca3af', fontSize: '0.60rem' }}>
                      ({ind.options.sessionSpecific !== false ? 'Session' : 'Cont'})
                    </span>
                  )}
                  {ind.type === 'VOLUME' && (
                    <span style={{ color: '#9ca3af', fontSize: '0.60rem', textTransform: 'capitalize' }}>
                      ({ind.options.volumeStyle || 'area'})
                    </span>
                  )}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: '2px' }}
                  >
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }
);

CandlestickChart.displayName = 'CandlestickChart';
