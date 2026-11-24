import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  WebSocketMessage,
  SecurityQuote,
  BasisSpreadPair,
  OptionRow,
  ExpiryOption,
  getMarketSessionInfo,
  MarketSessionInfo
} from '@pm-vision/shared';
import { fetchHealth, fetchMarketHistory, fetchOptionChainByExpiry, fetchMarketStatus } from './services/api';
import { createWebSocketConnection } from './services/websocket';
import {
  CandlestickChart,
  SAMPLE_CANDLESTICK_DATA,
  ChartImperativeHandle,
  CandlestickData,
  Time,
  CandleColorSettings,
  DEFAULT_CANDLE_COLORS,
  IndicatorConfig,
  DEFAULT_INDICATORS
} from './components/chart';
import { IndicatorsModal } from './components/chart/IndicatorsModal';
import {
  HighlightWindow,
  BasisSpreadWidget,
  OptionChainWidget,
  NiftyHeatmap,
  WatchlistDrawer,
  WatchlistMode,
  SymbolSearchModal,
  NIFTY_50_CONSTITUENTS,
  NIFTY_INDICES
} from './components/dashboard';
import { SettingsModal } from './components/dashboard/SettingsModal';
import logoImg from './assets/logo.png';

type AppPage = 'dashboard' | 'chart' | 'heatmap';

const ALL_TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '2m', value: '2m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1H', value: '1H' },
  { label: '2H', value: '2H' },
  { label: '4H', value: '4H' },
  { label: '1D', value: '1D' }
];

const DEFAULT_PINNED = ['1m', '5m', '15m', '1H', '1D'];

export function App() {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [wsStatus, setWsStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [isBrokerConnected, setIsBrokerConnected] = useState<boolean>(true);
  const [activeTimeFilter, setActiveTimeFilter] = useState<string>('15m');
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Market session status (Markets Live / Markets Closed / Holiday / Pre / Post)
  const [sessionInfo, setSessionInfo] = useState<MarketSessionInfo>(getMarketSessionInfo);

  // Highlight Window Custom Symbols (persisted across sessions)
  const [highlightSymbols, setHighlightSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pm_vision_highlight_symbols');
      return saved ? JSON.parse(saved) : ['NIFTY 50', 'NIFTY FUT-I', 'BANK NIFTY', 'RELIANCE', 'HDFCBANK'];
    } catch {
      return ['NIFTY 50', 'NIFTY FUT-I', 'BANK NIFTY', 'RELIANCE', 'HDFCBANK'];
    }
  });

  const handleAddHighlightSymbol = (symbol: string) => {
    setHighlightSymbols((prev) => {
      if (prev.some((s) => s.toUpperCase() === symbol.toUpperCase())) return prev;
      const updated = [...prev, symbol];
      try {
        localStorage.setItem('pm_vision_highlight_symbols', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleRemoveHighlightSymbol = (symbol: string) => {
    setHighlightSymbols((prev) => {
      const updated = prev.filter((s) => s.toUpperCase() !== symbol.toUpperCase());
      try {
        localStorage.setItem('pm_vision_highlight_symbols', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleToggleHighlightSymbol = (symbol: string) => {
    setHighlightSymbols((prev) => {
      const exists = prev.some((s) => s.toUpperCase() === symbol.toUpperCase());
      const updated = exists
        ? prev.filter((s) => s.toUpperCase() !== symbol.toUpperCase())
        : [...prev, symbol];
      try {
        localStorage.setItem('pm_vision_highlight_symbols', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Technical Indicators State
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pm_vision_indicators_v2');
      return saved ? JSON.parse(saved) : DEFAULT_INDICATORS;
    } catch {
      return DEFAULT_INDICATORS;
    }
  });
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState<boolean>(false);
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null);

  const handleUpdateIndicators = (newIndicators: IndicatorConfig[]) => {
    setIndicators(newIndicators);
    try {
      localStorage.setItem('pm_vision_indicators_v2', JSON.stringify(newIndicators));
    } catch {}
  };

  const handleResetIndicators = () => {
    setIndicators(DEFAULT_INDICATORS);
    try {
      localStorage.removeItem('pm_vision_indicators_v2');
    } catch {}
  };

  // Watchlist State (Overlay Slider, Docked, or Fullscreen)
  const [isWatchlistOpen, setIsWatchlistOpen] = useState<boolean>(false);
  const [watchlistMode, setWatchlistMode] = useState<WatchlistMode>('overlay');

  // Symbol Search State
  const [isSymbolSearchOpen, setIsSymbolSearchOpen] = useState<boolean>(false);
  const [activeChartSymbol, setActiveChartSymbol] = useState<string>('NIFTY 50');
  const [activeChartSymbolName, setActiveChartSymbolName] = useState<string>('Nifty 50 Index');
  const [activeChartSymbolSector, setActiveChartSymbolSector] = useState<string>('INDEX');
  const activeChartSymbolRef = useRef(activeChartSymbol);
  activeChartSymbolRef.current = activeChartSymbol;
  const baseHistoryRef = useRef<CandlestickData<Time>[]>(SAMPLE_CANDLESTICK_DATA);

  const handleSelectSymbol = (symbol: string, name: string, sector: string, _basePrice: number) => {
    setActiveChartSymbol(symbol);
    setActiveChartSymbolName(name);
    setActiveChartSymbolSector(sector);
    activeChartSymbolRef.current = symbol;
    loadHistory(activeTimeFilter, symbol);
  };

  // Candlestick Appearance Customization
  const [candleColors, setCandleColors] = useState<CandleColorSettings>(() => {
    try {
      const saved = localStorage.getItem('pm_vision_candle_colors');
      return saved ? JSON.parse(saved) : DEFAULT_CANDLE_COLORS;
    } catch {
      return DEFAULT_CANDLE_COLORS;
    }
  });

  // Chart Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0
  });

  // TradingView-style direct keyboard interval jump
  const [keyIntervalBuffer, setKeyIntervalBuffer] = useState<string>('');
  const [keyIntervalVisible, setKeyIntervalVisible] = useState<boolean>(false);

  // Pinned Timeframes state (persisted to localStorage)
  const [pinnedTimeframes, setPinnedTimeframes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pm_vision_pinned_tf');
      return saved ? JSON.parse(saved) : DEFAULT_PINNED;
    } catch {
      return DEFAULT_PINNED;
    }
  });
  const [showTfDropdown, setShowTfDropdown] = useState<boolean>(false);
  const [customValue, setCustomValue] = useState<string>('3');
  const [customUnit, setCustomUnit] = useState<'m' | 'H' | 'D'>('m');

  // Real-Time Streaming State
  const [securities, setSecurities] = useState<SecurityQuote[]>([]);
  const [basisSpreads, setBasisSpreads] = useState<BasisSpreadPair[]>([]);
  const [optionChain, setOptionChain] = useState<OptionRow[]>([]);
  const [expiries, setExpiries] = useState<ExpiryOption[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [spotPrice, setSpotPrice] = useState<number>(25349.65);

  // Chart Historical Data State
  const [chartCandles, setChartCandles] = useState<CandlestickData<Time>[]>(SAMPLE_CANDLESTICK_DATA);
  const chartRef = useRef<ChartImperativeHandle | null>(null);

  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState<number>(500);
  const [isDraggingH, setIsDraggingH] = useState<boolean>(false);
  const [optionChainRatio, setOptionChainRatio] = useState<number>(0.50);
  const [isDraggingV, setIsDraggingV] = useState<boolean>(false);
  const [highlightRatio, setHighlightRatio] = useState<number>(0.42);
  const [isDraggingSubV, setIsDraggingSubV] = useState<boolean>(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);

  // Active symbol's official CAS / Closing price
  const currentCasPrice = useMemo(() => {
    if (activeChartSymbol === 'NIFTY 50') return spotPrice;
    const sec = securities.find((s) => s.symbol.toUpperCase() === activeChartSymbol.toUpperCase());
    if (sec && sec.ltp > 0) return sec.ltp;
    const found = [...NIFTY_50_CONSTITUENTS, ...NIFTY_INDICES].find(
      (i) => i.symbol.toUpperCase() === activeChartSymbol.toUpperCase()
    );
    return found?.basePrice || (activeChartSymbol === 'NIFTY 50' ? spotPrice : 0);
  }, [activeChartSymbol, spotPrice, securities]);

  const loadHistory = useCallback(async (resolution: string, symbol: string = activeChartSymbol) => {
    setIsChartLoading(true);
    try {
      const candles = await fetchMarketHistory(resolution, symbol);
      const sec = securities.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
      const casPrice = (sec && sec.ltp > 0)
        ? sec.ltp
        : (symbol === 'NIFTY 50' ? spotPrice : 0);

      if (candles && candles.length > 0) {
        if (resolution !== '1D' && casPrice > 0) {
          const last = candles[candles.length - 1];
          last.close = casPrice;
          last.high = Math.max(last.high, casPrice);
          last.low = Math.min(last.low, casPrice);
        }
        if (symbol === 'NIFTY 50') {
          baseHistoryRef.current = candles as any;
        }
        setChartCandles(candles as any);
        chartRef.current?.setData(candles as any);
      } else {
        // Fallback: accurately scale based on the stock's actual base price
        const found = [...NIFTY_50_CONSTITUENTS, ...NIFTY_INDICES].find((i) => i.symbol === symbol);
        const targetPrice = found?.basePrice || (symbol === 'NIFTY 50' ? 25349.65 : 1000);
        const ratio = targetPrice / 25349.65;
        const base = (baseHistoryRef.current && baseHistoryRef.current.length > 0)
          ? baseHistoryRef.current
          : SAMPLE_CANDLESTICK_DATA;
        const scaled = base.map((c) => ({
          time: c.time,
          open: parseFloat((c.open * ratio).toFixed(2)),
          high: parseFloat((c.high * ratio).toFixed(2)),
          low: parseFloat((c.low * ratio).toFixed(2)),
          close: parseFloat((c.close * ratio).toFixed(2)),
          volume: (c as any).volume
        }));
        if (resolution !== '1D' && casPrice > 0 && scaled.length > 0) {
          const last = scaled[scaled.length - 1];
          last.close = casPrice;
          last.high = Math.max(last.high, casPrice);
          last.low = Math.min(last.low, casPrice);
        }
        setChartCandles(scaled as any);
        chartRef.current?.setData(scaled as any);
      }
    } catch (err) {
      console.error('Failed to load market history:', err);
    } finally {
      setIsChartLoading(false);
    }
  }, [activeChartSymbol, spotPrice, securities]);

  const handleTimeframeChange = (tf: string) => {
    setActiveTimeFilter(tf);
    loadHistory(tf, activeChartSymbol);
  };

  const togglePin = (tf: string) => {
    const updated = pinnedTimeframes.includes(tf)
      ? pinnedTimeframes.filter((t) => t !== tf)
      : [...pinnedTimeframes, tf];
    setPinnedTimeframes(updated);
    try {
      localStorage.setItem('pm_vision_pinned_tf', JSON.stringify(updated));
    } catch {}
  };

  const handleAddCustom = () => {
    const val = parseInt(customValue, 10);
    if (!val || val <= 0) return;
    const tfStr = `${val}${customUnit}`;
    if (!pinnedTimeframes.includes(tfStr)) {
      const updated = [...pinnedTimeframes, tfStr];
      setPinnedTimeframes(updated);
      try {
        localStorage.setItem('pm_vision_pinned_tf', JSON.stringify(updated));
      } catch {}
    }
    handleTimeframeChange(tfStr);
    setShowTfDropdown(false);
  };

  const handleSelectExpiry = async (expiry: string) => {
    try {
      setSelectedExpiry(expiry);
      const updated = await fetchOptionChainByExpiry(expiry);
      if (updated && updated.optionChain) {
        setOptionChain(updated.optionChain);
      }
    } catch (e) {
      console.error('Failed to change option expiry:', e);
    }
  };

  const handleUpdateCandleColors = (newColors: CandleColorSettings) => {
    setCandleColors(newColors);
    try {
      localStorage.setItem('pm_vision_candle_colors', JSON.stringify(newColors));
    } catch {}
    chartRef.current?.applySeriesOptions({
      upColor: newColors.upBodyColor,
      downColor: newColors.downBodyColor,
      borderUpColor: newColors.upBorderColor,
      borderDownColor: newColors.downBorderColor,
      wickUpColor: newColors.upWickColor,
      wickDownColor: newColors.downWickColor
    });
  };

  const handleResetCandleColors = () => {
    handleUpdateCandleColors(DEFAULT_CANDLE_COLORS);
  };

  const handleChartContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // TradingView-style direct keyboard interval jump
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (isSettingsOpen || isIndicatorsOpen || isSymbolSearchOpen) return;

      // Ctrl+K or / to open Symbol Search (TradingView standard)
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || e.key === '/') {
        e.preventDefault();
        setIsSymbolSearchOpen(true);
        return;
      }

      if (!keyIntervalVisible) {
        if (e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          setKeyIntervalBuffer(e.key);
          setKeyIntervalVisible(true);
        }
        return;
      }

      // Interval buffer is active
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setKeyIntervalBuffer((prev) => (prev.length < 4 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setKeyIntervalBuffer((prev) => {
          const next = prev.slice(0, -1);
          if (next.length === 0) {
            setKeyIntervalVisible(false);
          }
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (keyIntervalBuffer) {
          const num = parseInt(keyIntervalBuffer, 10);
          if (num > 0) {
            let targetTf = `${num}m`;
            if (num === 60) targetTf = '1H';
            else if (num === 120) targetTf = '2H';
            else if (num === 240) targetTf = '4H';

            handleTimeframeChange(targetTf);
          }
        }
        setKeyIntervalVisible(false);
        setKeyIntervalBuffer('');
      } else {
        // Any other key or Escape cancels immediately and vanishes
        setKeyIntervalVisible(false);
        setKeyIntervalBuffer('');
      }
    };

    const handleWindowMouseDown = () => {
      // Clicking anywhere on the screen cancels immediately
      if (keyIntervalVisible) {
        setKeyIntervalVisible(false);
        setKeyIntervalBuffer('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleWindowMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleWindowMouseDown);
    };
  }, [keyIntervalVisible, keyIntervalBuffer, isSettingsOpen, isIndicatorsOpen, isSymbolSearchOpen, handleTimeframeChange]);

  // Check market session & broker status every 15 seconds
  useEffect(() => {
    const checkStatus = () => {
      setSessionInfo(getMarketSessionInfo());
      fetchMarketStatus()
        .then((res: any) => {
          setIsBrokerConnected(res.isBrokerConnected);
          if (res.session) {
            setSessionInfo(res.session);
          }
        })
        .catch(() => {});
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHealth()
      .then(() => setHealthStatus('online'))
      .catch(() => setHealthStatus('offline'));

    // Load initial real 15m historical candles from FYERS
    loadHistory('15m');

    const client = createWebSocketConnection({
      onOpen: () => setWsStatus('online'),
      onClose: () => setWsStatus('offline'),
      onError: () => setWsStatus('offline'),
      onMessage: (msg: WebSocketMessage) => {
        if (msg.type === 'MARKET_SNAPSHOT' || msg.type === 'MARKET_TICK') {
          const data = msg.data;
          if (data) {
            setSecurities(data.securities);
            setBasisSpreads(data.basisSpreads);
            setOptionChain(data.optionChain);
            setSpotPrice(data.spotPrice);

            if (data.expiries && data.expiries.length > 0) setExpiries(data.expiries);
            if (data.selectedExpiry) setSelectedExpiry(data.selectedExpiry);

            // Real-time chart candle updates:
            // 1. When Indian markets are closed, domestic symbols (NIFTY 50, stocks) MUST remain clean & static!
            // 2. Only during genuine open market hours: update the current active candle in-place without creating extra bars!
            if (data.marketStatus === 'OPEN' && chartRef.current) {
              const sec = data.securities?.find(
                (s) => s.symbol.toUpperCase() === activeChartSymbolRef.current.toUpperCase()
              );
              if (sec && sec.ltp > 0) {
                chartRef.current.updateLastBarPrice(sec.ltp);
              } else if (activeChartSymbolRef.current === 'NIFTY 50' && data.spotPrice > 0) {
                chartRef.current.updateLastBarPrice(data.spotPrice);
              }
            }
          }
        }
      }
    });

    return () => {
      client.close();
    };
  }, [loadHistory]);

  // Global mouse move & up handlers for border dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingH) {
        const totalW = window.innerWidth;
        const newWidth = totalW - e.clientX;
        const clampedWidth = Math.max(340, Math.min(newWidth, totalW - 450));
        setSidebarWidth(clampedWidth);
      }

      if (isDraggingV && sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const totalHeight = rect.height;
        const topRatio = Math.max(0.18, Math.min(offsetY / totalHeight, 0.82));
        setOptionChainRatio(1 - topRatio);
      }

      if (isDraggingSubV && topSectionRef.current) {
        const rect = topSectionRef.current.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const totalHeight = rect.height;
        const ratio = Math.max(0.2, Math.min(offsetY / totalHeight, 0.8));
        setHighlightRatio(ratio);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingH(false);
      setIsDraggingV(false);
      setIsDraggingSubV(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDraggingH || isDraggingV || isDraggingSubV) {
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingH, isDraggingV, isDraggingSubV]);

  const startDraggingH = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingH(true);
    document.body.style.cursor = 'col-resize';
  }, []);

  const startDraggingV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingV(true);
    document.body.style.cursor = 'row-resize';
  }, []);

  const startDraggingSubV = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSubV(true);
    document.body.style.cursor = 'row-resize';
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: '#000000',
      color: '#e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        height: '48px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        backgroundColor: '#000000',
        flexShrink: 0
      }}>
        {/* Brand Logo (Transparent background, clean & crisp on pitch black) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={logoImg}
            alt="PM Vision Logo"
            style={{
              height: '32px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>

        {/* Header Right: Market Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Domestic Market Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            color: sessionInfo.status === 'LIVE' ? '#e5e7eb' : '#9ca3af',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid #1f1f1f'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: sessionInfo.dotColor,
              boxShadow: sessionInfo.status === 'LIVE' ? `0 0 6px ${sessionInfo.dotColor}` : 'none'
            }} />
            <span>NSE: {sessionInfo.label}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace with Navigation Rail shifted to Right */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Content Area */}
        {activePage !== 'heatmap' ? (
          <>
            {/* Left Area (or Full Workspace in 'chart' view): Candlestick Chart */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#000000',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Chart Top Sub-Bar: Search on LHS + Symbol + Timeframes + Indicators */}
              <div style={{
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 0.85rem',
                borderBottom: '1px solid #1a1a1a',
                backgroundColor: '#050505',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', position: 'relative' }}>
                  {/* Search Option on LHS of Symbol Name */}
                  <button
                    onClick={() => setIsSymbolSearchOpen(true)}
                    title="Search Stock or Index (Click or Ctrl+K / /)"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#111111',
                      border: '1px solid #262626',
                      borderRadius: '3px',
                      padding: '3px 8px',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#5F7A9A';
                      e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#262626';
                      e.currentTarget.style.backgroundColor = '#111111';
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5F7A9A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#CCCCCC' }}>Search</span>
                  </button>

                  {/* Active Symbol Display (Clickable to open search) */}
                  <div
                    onClick={() => setIsSymbolSearchOpen(true)}
                    title={`${activeChartSymbolName} - Click to switch symbol`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.03em' }}>
                      {activeChartSymbol}
                    </span>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      color: '#5F7A9A',
                      backgroundColor: 'rgba(95, 122, 154, 0.15)',
                      padding: '1px 5px',
                      borderRadius: '2px',
                      border: '1px solid rgba(95, 122, 154, 0.3)',
                      textTransform: 'uppercase'
                    }}>
                      {activeChartSymbolSector}
                    </span>
                    {activeTimeFilter !== '1D' && currentCasPrice > 0 && (
                      <div
                        title="Official Closing Auction Session (CAS) Price"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.62rem',
                          color: '#5F7A9A',
                          backgroundColor: 'rgba(95, 122, 154, 0.12)',
                          padding: '1px 6px',
                          borderRadius: '2px',
                          border: '1px solid rgba(95, 122, 154, 0.3)',
                          fontWeight: 600
                        }}
                      >
                        <span style={{ fontSize: '0.56rem', color: '#9ca3af' }}>CAS</span>
                        <span style={{ color: '#ffffff' }}>
                          {currentCasPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pinned Timeframe Buttons */}
                  <div style={{ display: 'flex', gap: '2px', backgroundColor: '#0a0a0a', padding: '2px', borderRadius: '3px', border: '1px solid #1f1f1f', alignItems: 'center' }}>
                    {pinnedTimeframes.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => handleTimeframeChange(tf)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.70rem',
                          fontWeight: activeTimeFilter === tf ? 600 : 400,
                          borderRadius: '2px',
                          backgroundColor: activeTimeFilter === tf ? '#5F7A9A' : 'transparent',
                          color: activeTimeFilter === tf ? '#ffffff' : '#CCCCCC',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {tf}
                      </button>
                    ))}

                    {/* Timeframe Dropdown Toggle */}
                    <button
                      onClick={() => setShowTfDropdown(!showTfDropdown)}
                      title="Custom interval & pin timeframes"
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.70rem',
                        backgroundColor: showTfDropdown ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                        color: showTfDropdown ? '#5F7A9A' : '#737373',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                  </div>

                  {/* Loading indicator */}
                  {isChartLoading && (
                    <span style={{ fontSize: '0.68rem', color: '#5F7A9A', fontStyle: 'italic' }}>
                      Loading candles...
                    </span>
                  )}

                  {/* Dropdown Menu for Custom Interval & Pinning */}
                  {showTfDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: '80px',
                      width: '240px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #262626',
                      borderRadius: '4px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.95)',
                      padding: '0.75rem',
                      zIndex: 60,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}>
                      <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#CCCCCC', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px' }}>
                        PRESET INTERVALS
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                        {ALL_TIMEFRAMES.map((item) => {
                          const isPinned = pinnedTimeframes.includes(item.value);
                          const isActive = activeTimeFilter === item.value;
                          return (
                            <div
                              key={item.value}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '3px 6px',
                                borderRadius: '2px',
                                backgroundColor: isActive ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                                border: isActive ? '1px solid rgba(95, 122, 154, 0.4)' : '1px solid transparent'
                              }}
                            >
                              <span
                                onClick={() => {
                                  handleTimeframeChange(item.value);
                                  setShowTfDropdown(false);
                                }}
                                style={{
                                  fontSize: '0.72rem',
                                  color: isActive ? '#ffffff' : '#CCCCCC',
                                  cursor: 'pointer',
                                  flex: 1
                                }}
                              >
                                {item.label}
                              </span>
                              <button
                                onClick={() => togglePin(item.value)}
                                title={isPinned ? 'Unpin from top bar' : 'Pin to top bar'}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  color: isPinned ? '#5F7A9A' : '#404040'
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Custom Input */}
                      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '0.68rem', color: '#a3a3a3', fontWeight: 600 }}>CUSTOM INTERVAL</div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            style={{
                              width: '45px',
                              backgroundColor: '#121212',
                              border: '1px solid #262626',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              padding: '2px 4px',
                              borderRadius: '2px',
                              outline: 'none'
                            }}
                          />
                          <select
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value as any)}
                            style={{
                              backgroundColor: '#121212',
                              border: '1px solid #262626',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              padding: '2px 4px',
                              borderRadius: '2px',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="m">Minute(s)</option>
                            <option value="H">Hour(s)</option>
                            <option value="D">Day(s)</option>
                          </select>
                          <button
                            onClick={handleAddCustom}
                            style={{
                              fontSize: '0.70rem',
                              padding: '2px 8px',
                              backgroundColor: '#5F7A9A',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Pin
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Indicators Button */}
                  <button
                    onClick={() => setIsIndicatorsOpen(true)}
                    title="Add or manage technical indicators (OR 1H, VWAP, EMA, SMA, Volume)"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.70rem',
                      backgroundColor: indicators.some((ind) => ind.enabled) ? 'rgba(95, 122, 154, 0.2)' : '#121212',
                      border: `1px solid ${indicators.some((ind) => ind.enabled) ? '#5F7A9A' : '#262626'}`,
                      color: indicators.some((ind) => ind.enabled) ? '#5F7A9A' : '#e5e7eb',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}
                  >
                    <span style={{ fontStyle: 'italic', fontFamily: 'serif', color: '#5F7A9A' }}>fx</span>
                    <span>Indicators</span>
                    {indicators.filter((ind) => ind.enabled).length > 0 && (
                      <span
                        style={{
                          fontSize: '0.58rem',
                          backgroundColor: '#5F7A9A',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '13px',
                          height: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {indicators.filter((ind) => ind.enabled).length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Visual Display: Candlestick Chart */}
              <div
                onContextMenu={handleChartContextMenu}
                style={{ flex: 1, position: 'relative', minHeight: 0 }}
              >
                <CandlestickChart
                  ref={chartRef}
                  data={chartCandles}
                  casPrice={currentCasPrice}
                  timeframe={activeTimeFilter}
                  indicators={indicators}
                  height="100%"
                  style={{ height: '100%' }}
                  onOpenIndicatorSettings={(id) => {
                    setSelectedIndicatorId(id || null);
                    setIsIndicatorsOpen(true);
                  }}
                  seriesOptions={{
                    upColor: candleColors.upBodyColor,
                    downColor: candleColors.downBodyColor,
                    borderUpColor: candleColors.upBorderColor,
                    borderDownColor: candleColors.downBorderColor,
                    wickUpColor: candleColors.upWickColor,
                    wickDownColor: candleColors.downWickColor
                  }}
                />

                {/* Direct Keyboard Interval Jump Overlay (TradingView style) */}
                {keyIntervalVisible && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'rgba(8, 8, 8, 0.92)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid #5F7A9A',
                      borderRadius: '8px',
                      padding: '1.2rem 2.4rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 16px 36px rgba(0, 0, 0, 0.9), 0 0 20px rgba(95, 122, 154, 0.3)',
                      zIndex: 80,
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{
                      fontSize: '48px',
                      fontWeight: 700,
                      color: '#5F7A9A',
                      fontFamily: 'Quicksand, sans-serif',
                      lineHeight: 1,
                      letterSpacing: '0.02em'
                    }}>
                      {keyIntervalBuffer}m
                    </div>
                    <div style={{
                      fontSize: '0.72rem',
                      color: '#9CA3AF',
                      marginTop: '8px',
                      letterSpacing: '0.04em',
                      fontWeight: 500
                    }}>
                      Press Enter to apply · Esc to cancel
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* IN DASHBOARD MODE: Horizontal Resizer + Stacked Right Sidebar */}
            {activePage === 'dashboard' && (
              <>
                {/* ↔ HORIZONTAL RESIZER BORDER (Drag to resize Left Chart vs Right Sidebar) */}
                <div
                  onMouseDown={startDraggingH}
                  title="Drag left/right to resize sidebar width"
                  style={{
                    width: '8px',
                    flexShrink: 0,
                    cursor: 'col-resize',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDraggingH ? '#171717' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{
                    width: '2px',
                    height: '42px',
                    borderRadius: '1px',
                    backgroundColor: isDraggingH ? '#5F7A9A' : '#262626',
                    transition: 'background-color 0.15s ease'
                  }} />
                </div>

                {/* Right Area: Stacked Sidebar or Docked Watchlist */}
                <div
                  ref={sidebarRef}
                  style={{
                    width: `${sidebarWidth}px`,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#050505',
                    overflow: 'hidden'
                  }}
                >
                  {isWatchlistOpen && watchlistMode === 'docked' ? (
                    <WatchlistDrawer
                      isOpen={true}
                      mode="docked"
                      onChangeMode={(m) => setWatchlistMode(m)}
                      onClose={() => setIsWatchlistOpen(false)}
                      securities={securities}
                      activeSymbol={activeChartSymbol}
                      highlightSymbols={highlightSymbols}
                      onToggleHighlightSymbol={handleToggleHighlightSymbol}
                      onSelectSymbol={(sym) => {
                        const found = [...NIFTY_50_CONSTITUENTS, ...NIFTY_INDICES].find((i) => i.symbol === sym);
                        if (found) {
                          handleSelectSymbol(found.symbol, found.name, found.sector || (found.isIndex ? 'INDEX' : 'Stock'), found.basePrice);
                        } else {
                          setActiveChartSymbol(sym);
                        }
                      }}
                    />
                  ) : (
                    <>
                      {/* TOP SECTION: Highlight Window & Basis Spread */}
                      <div
                        ref={topSectionRef}
                        style={{
                          height: `calc(${(1 - optionChainRatio) * 100}% - 4px)`,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          minHeight: '140px'
                        }}
                      >
                        {/* 1. Highlight Window */}
                        <div style={{
                          height: `calc(${highlightRatio * 100}% - 3px)`,
                          minHeight: '80px',
                          overflow: 'hidden'
                        }}>
                          <HighlightWindow
                            securities={securities}
                            customSymbols={highlightSymbols}
                            onAddSymbol={handleAddHighlightSymbol}
                            onRemoveSymbol={handleRemoveHighlightSymbol}
                            onSelectSymbol={(sym) => {
                              const found = [...NIFTY_50_CONSTITUENTS, ...NIFTY_INDICES].find(
                                (i) => i.symbol.toUpperCase() === sym.toUpperCase()
                              );
                              if (found) {
                                handleSelectSymbol(found.symbol, found.name, found.sector || (found.isIndex ? 'INDEX' : 'Stock'), found.basePrice);
                              } else {
                                handleSelectSymbol(sym, sym, 'FUTURES', spotPrice);
                              }
                            }}
                            activeChartSymbol={activeChartSymbol}
                            style={{ height: '100%' }}
                          />
                        </div>

                        {/* ↕ SUB-VERTICAL RESIZER */}
                        <div
                          onMouseDown={startDraggingSubV}
                          title="Drag up/down to resize Highlight Window & Basis Spread"
                          style={{
                            height: '6px',
                            flexShrink: 0,
                            cursor: 'row-resize',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDraggingSubV ? '#171717' : 'transparent'
                          }}
                        >
                          <div style={{
                            height: '1px',
                            width: '32px',
                            backgroundColor: isDraggingSubV ? '#5F7A9A' : '#262626',
                            transition: 'background-color 0.15s ease'
                          }} />
                        </div>

                        {/* 2. Basis Spread */}
                        <div style={{
                          flex: 1,
                          minHeight: '80px',
                          overflow: 'hidden'
                        }}>
                          <BasisSpreadWidget pairs={basisSpreads} style={{ height: '100%' }} />
                        </div>
                      </div>

                      {/* ↕ MAIN VERTICAL RESIZER */}
                      <div
                        onMouseDown={startDraggingV}
                        title="Drag up/down to adjust Option Chain height"
                        style={{
                          height: '8px',
                          flexShrink: 0,
                          cursor: 'row-resize',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isDraggingV ? '#171717' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{
                          height: '2px',
                          width: '42px',
                          borderRadius: '1px',
                          backgroundColor: isDraggingV ? '#5F7A9A' : '#262626',
                          transition: 'background-color 0.15s ease'
                        }} />
                      </div>

                      {/* BOTTOM SECTION: Option Chain */}
                      <div style={{
                        height: `calc(${optionChainRatio * 100}% - 4px)`,
                        minHeight: '160px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <OptionChainWidget
                          data={optionChain}
                          spotPrice={spotPrice}
                          expiries={expiries}
                          selectedExpiry={selectedExpiry}
                          onSelectExpiry={handleSelectExpiry}
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          /* DEDICATED FULL-PAGE VIEW: Nifty 50 Treemap Heatmap */
          <div style={{
            flex: 1,
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <NiftyHeatmap />
          </div>
        )}

        {/* Watchlist: Overlay Slider or Fullscreen Mode */}
        {isWatchlistOpen && watchlistMode !== 'docked' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: '44px',
              left: watchlistMode === 'fullscreen' ? 0 : 'auto',
              width: watchlistMode === 'fullscreen' ? 'auto' : '380px',
              maxWidth: 'calc(100% - 44px)',
              zIndex: 70
            }}
          >
            <WatchlistDrawer
              isOpen={true}
              mode={watchlistMode}
              onChangeMode={(m) => setWatchlistMode(m)}
              onClose={() => setIsWatchlistOpen(false)}
              securities={securities}
              activeSymbol={activeChartSymbol}
              highlightSymbols={highlightSymbols}
              onToggleHighlightSymbol={handleToggleHighlightSymbol}
              onSelectSymbol={(sym) => {
                const found = [...NIFTY_50_CONSTITUENTS, ...NIFTY_INDICES].find((i) => i.symbol === sym);
                if (found) {
                  handleSelectSymbol(found.symbol, found.name, found.sector || (found.isIndex ? 'INDEX' : 'Stock'), found.basePrice);
                } else {
                  setActiveChartSymbol(sym);
                }
              }}
            />
          </div>
        )}

        {/* ===================== RIGHT NAVIGATION PANEL ===================== */}
        <aside style={{
          width: '44px',
          borderLeft: '1px solid #1a1a1a',
          backgroundColor: '#050505',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0',
          flexShrink: 0,
          zIndex: 30
        }}>
          {/* Top Navigation Views */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            {/* 1. Main Dashboard Icon */}
            <button
              onClick={() => setActivePage('dashboard')}
              title="Main Dashboard (Chart + Analytics Sidebar)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: activePage === 'dashboard' ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                border: activePage === 'dashboard' ? '1px solid #5F7A9A' : '1px solid transparent',
                color: activePage === 'dashboard' ? '#5F7A9A' : '#737373',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>

            {/* 2. Dedicated Full Chart Section (Only Charts) */}
            <button
              onClick={() => setActivePage('chart')}
              title="Charts (Full Technical Chart View)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: activePage === 'chart' ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                border: activePage === 'chart' ? '1px solid #5F7A9A' : '1px solid transparent',
                color: activePage === 'chart' ? '#5F7A9A' : '#737373',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="21"></line>
                <rect x="4" y="7" width="4" height="9" fill="currentColor"></rect>
                <line x1="12" y1="2" x2="12" y2="22"></line>
                <rect x="10" y="5" width="4" height="12" fill="currentColor"></rect>
                <line x1="18" y1="4" x2="18" y2="20"></line>
                <rect x="16" y="8" width="4" height="7" fill="currentColor"></rect>
              </svg>
            </button>

            {/* 3. Heatmap Icon */}
            <button
              onClick={() => setActivePage('heatmap')}
              title="NIFTY 50 Heatmap"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: activePage === 'heatmap' ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                border: activePage === 'heatmap' ? '1px solid #5F7A9A' : '1px solid transparent',
                color: activePage === 'heatmap' ? '#5F7A9A' : '#737373',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="9" height="11" rx="1"></rect>
                <rect x="13" y="2" width="9" height="6" rx="1"></rect>
                <rect x="13" y="10" width="9" height="12" rx="1"></rect>
                <rect x="2" y="15" width="9" height="7" rx="1"></rect>
              </svg>
            </button>

            {/* 3. Watchlist Icon (Below Heatmap) */}
            <button
              onClick={() => {
                if (isWatchlistOpen) {
                  setIsWatchlistOpen(false);
                } else {
                  setIsWatchlistOpen(true);
                  if (watchlistMode !== 'docked' && watchlistMode !== 'fullscreen') {
                    setWatchlistMode('overlay');
                  }
                }
              }}
              title="Watchlist (NIFTY 50 & Indices)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: isWatchlistOpen ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                border: isWatchlistOpen ? '1px solid #5F7A9A' : '1px solid transparent',
                color: isWatchlistOpen ? '#5F7A9A' : '#737373',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Bottom of Right Panel: Settings Icon */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Platform & Chart Settings (Candle Colors, System Status)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: isSettingsOpen ? 'rgba(95, 122, 154, 0.2)' : 'transparent',
                border: isSettingsOpen ? '1px solid #5F7A9A' : '1px solid transparent',
                color: isSettingsOpen ? '#5F7A9A' : '#737373',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        </aside>
      </div>

      {/* ===================== RIGHT-CLICK CONTEXT MENU ON CHART ===================== */}
      {contextMenu.visible && (
        <div style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          backgroundColor: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: '4px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.95)',
          padding: '4px 0',
          zIndex: 90,
          minWidth: '150px'
        }}>
          <div
            onClick={() => {
              chartRef.current?.fitContent();
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              color: '#e5e7eb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            <span>Reset Chart</span>
          </div>
          <div style={{ height: '1px', backgroundColor: '#1a1a1a', margin: '4px 0' }} />
          <div
            onClick={() => {
              setIsSettingsOpen(true);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              color: '#e5e7eb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Settings...</span>
          </div>
        </div>
      )}

      {/* ===================== SYMBOL SEARCH MODAL ===================== */}
      <SymbolSearchModal
        isOpen={isSymbolSearchOpen}
        onClose={() => setIsSymbolSearchOpen(false)}
        onSelectSymbol={handleSelectSymbol}
        activeSymbol={activeChartSymbol}
      />

      {/* ===================== INDICATORS MODAL ===================== */}
      <IndicatorsModal
        isOpen={isIndicatorsOpen}
        onClose={() => {
          setIsIndicatorsOpen(false);
          setSelectedIndicatorId(null);
        }}
        indicators={indicators}
        onUpdateIndicators={handleUpdateIndicators}
        onResetIndicators={handleResetIndicators}
        initialIndicatorId={selectedIndicatorId}
      />

      {/* ===================== SETTINGS MODAL ===================== */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        candleColors={candleColors}
        onUpdateCandleColors={handleUpdateCandleColors}
        onResetCandleColors={handleResetCandleColors}
        apiStatus={healthStatus}
        wsStatus={wsStatus}
        isBrokerConnected={isBrokerConnected}
        onBrokerConnected={() => {
          setIsBrokerConnected(true);
          loadHistory(activeTimeFilter);
        }}
      />
    </div>
  );
}
