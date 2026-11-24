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
  Time
} from 'lightweight-charts';
import { CandlestickChartProps, ChartImperativeHandle } from './types';

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

export const CandlestickChart = forwardRef<ChartImperativeHandle, CandlestickChartProps>(
  (
    {
      data,
      chartOptions,
      seriesOptions,
      height = 420,
      style,
      className,
      onChartReady,
      onContextMenu
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const priceBoxRef = useRef<PriceBoxPrimitive | null>(null);

    // Keep data array in ref for fast lookup during crosshair moves
    const currentDataRef = useRef<CandlestickData<Time>[]>(data || []);

    // OHLC & change compared to previous candle
    const [ohlcInfo, setOhlcInfo] = useState<OHLCInfo | null>(() => {
      const list = data || [];
      return computeOHLCInfo(list, list.length - 1);
    });

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
          } catch (err) {
            console.warn('[CandlestickChart] Error updating candle:', err);
          }
        },
        setData: (newData) => {
          try {
            const clean = sanitizeCandles(newData);
            if (clean.length === 0) return;
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
            try {
              chartRef.current?.timeScale().fitContent();
            } catch {}
          } catch (err) {
            console.error('Error applying chart data:', err);
          }
        },
        fitContent: () => {
          chartRef.current?.timeScale().fitContent();
        },
        applySeriesOptions: (opts) => {
          seriesRef.current?.applyOptions(opts);
        },
        getChart: () => chartRef.current,
        getSeries: () => seriesRef.current
      }),
      []
    );

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
          textColor: '#5F7A9A'
        },
        timeScale: {
          borderColor: '#5F7A9A',
          timeVisible: true,
          secondsVisible: false
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
      }
      chart.timeScale().fitContent();

      // Attach custom price box primitive for dynamic positive/negative price box with #5F7A9A border
      const lastBar = cleanInitial.length > 0 ? cleanInitial[cleanInitial.length - 1] : null;
      const initialPrice = lastBar ? lastBar.close : 0;
      const initialIsPositive = lastBar ? lastBar.close >= lastBar.open : true;
      const priceBoxPrimitive = new PriceBoxPrimitive(initialPrice, initialIsPositive);
      series.attachPrimitive(priceBoxPrimitive);
      priceBoxRef.current = priceBoxPrimitive;

      chartRef.current = chart;
      seriesRef.current = series;

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
          setData: (newData) => {
            series.setData(newData);
            currentDataRef.current = [...newData];
            const latest = newData && newData.length > 0 ? newData[newData.length - 1] : null;
            if (latest) {
              priceBoxPrimitive.update(latest.close, latest.close >= latest.open);
            }
            setOhlcInfo(computeOHLCInfo(newData, newData.length - 1));
          },
          fitContent: () => chart.timeScale().fitContent(),
          applySeriesOptions: (opts) => series.applyOptions(opts),
          getChart: () => chart,
          getSeries: () => series
        });
      }

      // Cleanup on unmount
      return () => {
        resizeObserver.disconnect();
        container.removeEventListener('mouseleave', handleMouseLeave);
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
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
            try {
              chartRef.current?.timeScale().fitContent();
            } catch {}
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
      </div>
    );
  }
);

CandlestickChart.displayName = 'CandlestickChart';
