import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WebSocketMessage,
  SecurityQuote,
  BasisSpreadPair,
  OptionRow,
  ExpiryOption,
  MarketStatus
} from '@pm-vision/shared';
import { fetchHealth, fetchMarketHistory, fetchOptionChainByExpiry } from './services/api';
import { createWebSocketConnection } from './services/websocket';
import {
  CandlestickChart,
  SAMPLE_CANDLESTICK_DATA,
  ChartImperativeHandle,
  CandlestickData,
  Time
} from './components/chart';
import {
  HighlightWindow,
  BasisSpreadWidget,
  OptionChainWidget,
  NiftyHeatmap
} from './components/dashboard';
import logoImg from './assets/logo.png';

type TimeFilter = '15m' | '30m' | '1H' | '1D';
type AppPage = 'dashboard' | 'heatmap';

export function App() {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [wsStatus, setWsStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('15m');

  // Real-Time Streaming State
  const [securities, setSecurities] = useState<SecurityQuote[]>([]);
  const [basisSpreads, setBasisSpreads] = useState<BasisSpreadPair[]>([]);
  const [optionChain, setOptionChain] = useState<OptionRow[]>([]);
  const [expiries, setExpiries] = useState<ExpiryOption[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [spotPrice, setSpotPrice] = useState<number>(25349.65);
  const [tickCount, setTickCount] = useState<number>(0);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>('CLOSED');

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

  const loadHistory = useCallback(async (resolution: TimeFilter) => {
    try {
      const candles = await fetchMarketHistory(resolution);
      if (candles && candles.length > 0) {
        setChartCandles(candles as any);
        chartRef.current?.setData(candles as any);
      }
    } catch (err) {
      console.error('Failed to load market history:', err);
    }
  }, []);

  const handleTimeframeChange = (tf: TimeFilter) => {
    setActiveTimeFilter(tf);
    loadHistory(tf);
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
            setTickCount((prev) => prev + 1);

            if (data.marketStatus) setMarketStatus(data.marketStatus);
            if (data.expiries && data.expiries.length > 0) setExpiries(data.expiries);
            if (data.selectedExpiry) setSelectedExpiry(data.selectedExpiry);

            // Only update live tick on chart if market is genuinely open
            if (data.marketStatus === 'OPEN' && data.latestCandle && chartRef.current) {
              chartRef.current.updateCandle(data.latestCandle as any);
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
        const newWidth = totalW - e.clientX - 42;
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
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src={logoImg}
            alt="PM Vision Logo"
            style={{
              height: '34px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Market Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: marketStatus === 'OPEN' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(95, 122, 154, 0.12)',
            border: marketStatus === 'OPEN' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(95, 122, 154, 0.35)',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '0.68rem',
            color: marketStatus === 'OPEN' ? '#10b981' : '#CCCCCC',
            fontWeight: 600
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: marketStatus === 'OPEN' ? '#10b981' : '#f59e0b',
              boxShadow: marketStatus === 'OPEN' ? '0 0 6px #10b981' : 'none'
            }} />
            <span>
              {marketStatus === 'OPEN' ? `NSE LIVE (${tickCount})` : 'NSE MARKET CLOSED (OFFICIAL CLOSING DATA)'}
            </span>
          </div>

          {/* Live System Health Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem', color: '#737373' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: healthStatus === 'online' ? '#10b981' : '#ef4444'
              }} />
              <span>API {healthStatus}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: wsStatus === 'online' ? '#10b981' : '#ef4444'
              }} />
              <span>WS {wsStatus}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {activePage === 'dashboard' ? (
          <>
            {/* Left Area: Candlestick Chart */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#000000',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Chart Top Sub-Bar: Timeframe Switcher & Reset */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.05em' }}>
                    TIMEFRAME
                  </span>
                  <div style={{ display: 'flex', gap: '2px', backgroundColor: '#0a0a0a', padding: '2px', borderRadius: '3px', border: '1px solid #1f1f1f' }}>
                    {(['15m', '30m', '1H', '1D'] as TimeFilter[]).map((tf) => (
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
                  </div>
                </div>

                <button
                  onClick={() => chartRef.current?.fitContent()}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.70rem',
                    backgroundColor: '#121212',
                    border: '1px solid #262626',
                    color: '#e5e7eb',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Reset View
                </button>
              </div>

              {/* Main Visual Display: Candlestick Chart */}
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <CandlestickChart
                  ref={chartRef}
                  data={chartCandles}
                  height="100%"
                  style={{ height: '100%' }}
                />
              </div>
            </div>

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

            {/* Right Area: Stacked Sidebar */}
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
                  <HighlightWindow securities={securities} style={{ height: '100%' }} />
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
            </div>
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

        {/* Minimalist Right Sidebar Navigation Rail */}
        <aside style={{
          width: '42px',
          borderLeft: '1px solid #1a1a1a',
          backgroundColor: '#050505',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0',
          flexShrink: 0,
          zIndex: 30
        }}>
          {/* Top Rail Tools */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            {/* Dashboard Icon */}
            <button
              onClick={() => setActivePage('dashboard')}
              title="Trading & Analysis Dashboard"
              style={{
                width: '30px',
                height: '30px',
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
          </div>

          {/* Bottom Rail Action: Dedicated NIFTY 50 Heatmap Switcher */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setActivePage(activePage === 'heatmap' ? 'dashboard' : 'heatmap')}
              title="Full-Page NIFTY 50 Market Heatmap"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                backgroundColor: activePage === 'heatmap' ? '#5F7A9A' : 'rgba(255, 255, 255, 0.04)',
                border: activePage === 'heatmap' ? '1px solid #ffffff' : '1px solid #262626',
                color: activePage === 'heatmap' ? '#000000' : '#CCCCCC',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.2s ease',
                boxShadow: activePage === 'heatmap' ? '0 0 10px rgba(95, 122, 154, 0.5)' : 'none'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="9" height="11" rx="1"></rect>
                <rect x="13" y="2" width="9" height="6" rx="1"></rect>
                <rect x="13" y="10" width="9" height="12" rx="1"></rect>
                <rect x="2" y="15" width="9" height="7" rx="1"></rect>
              </svg>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
