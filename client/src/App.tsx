import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketMessage } from '@pm-vision/shared';
import { fetchHealth } from './services/api';
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

  const chartRef = useRef<ChartImperativeHandle | null>(null);
  const [simulatedDay, setSimulatedDay] = useState<number>(27);
  const [lastSimulatedPrice, setLastSimulatedPrice] = useState<number>(24700.8);

  // Resize State
  // 1. Horizontal Split: Sidebar width (default 500px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(500);
  const [isDraggingH, setIsDraggingH] = useState<boolean>(false);

  // 2. Vertical Split: Option Chain takes 50% (half) by default
  const [optionChainRatio, setOptionChainRatio] = useState<number>(0.50);
  const [isDraggingV, setIsDraggingV] = useState<boolean>(false);

  // 3. Sub-vertical split: Highlight Window vs Basis Spread
  const [highlightRatio, setHighlightRatio] = useState<number>(0.42);
  const [isDraggingSubV, setIsDraggingSubV] = useState<boolean>(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHealth()
      .then(() => setHealthStatus('online'))
      .catch(() => setHealthStatus('offline'));

    const client = createWebSocketConnection({
      onOpen: () => setWsStatus('online'),
      onClose: () => setWsStatus('offline'),
      onError: () => setWsStatus('offline'),
      onMessage: (_msg: WebSocketMessage) => {}
    });

    return () => {
      client.close();
    };
  }, []);

  // Global mouse move & up handlers for border dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingH) {
        const totalW = window.innerWidth;
        const newWidth = totalW - e.clientX - 42; // offset for 42px right rail
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

  const handleSimulateUpdate = () => {
    if (!chartRef.current) return;

    const dayStr = simulatedDay < 10 ? `0${simulatedDay}` : `${simulatedDay}`;
    const open = lastSimulatedPrice;
    const change = (Math.random() - 0.48) * 80;
    const close = parseFloat((open + change).toFixed(2));
    const high = parseFloat((Math.max(open, close) + Math.random() * 30).toFixed(2));
    const low = parseFloat((Math.min(open, close) - Math.random() * 30).toFixed(2));

    const simulatedCandle: CandlestickData<Time> = {
      time: `2026-02-${dayStr}`,
      open,
      high,
      low,
      close
    };

    chartRef.current.updateCandle(simulatedCandle);
    setLastSimulatedPrice(close);
    if (simulatedDay < 28) {
      setSimulatedDay((prev) => prev + 1);
    }
  };

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
      {/* Platform Header */}
      <header style={{
        height: '46px',
        flexShrink: 0,
        borderBottom: '1px solid #1a1a1a',
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#000000',
        zIndex: 20
      }}>
        {/* Brand Logo - User provided minimalist PM VISION brand image */}
        <div
          onClick={() => setActivePage('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          title="PM VISION - Market Analysis Platform"
        >
          <img
            src={logoImg}
            alt="PM VISION"
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
          {activePage === 'dashboard' && (
            <button
              onClick={handleSimulateUpdate}
              style={{ fontSize: '0.72rem', padding: '3px 8px', borderColor: '#404040', color: '#ffffff' }}
            >
              + Live Candle
            </button>
          )}

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

      {/* Main Workspace Layout */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        padding: '0.5rem',
        gap: '0',
        backgroundColor: '#000000',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* CONDITIONAL PAGE VIEW */}
        {activePage === 'dashboard' ? (
          /* DASHBOARD PAGE: Left Chart + Right Stacked Widgets */
          <>
            {/* LEFT PANE: Candlestick Chart Area */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#000000',
              border: '1px solid #1a1a1a',
              borderRadius: '4px',
              overflow: 'hidden',
              minWidth: '350px',
              height: '100%'
            }}>
              {/* Chart Header Bar */}
              <div style={{
                height: '36px',
                flexShrink: 0,
                padding: '0 0.75rem',
                borderBottom: '1px solid #141414',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                backgroundColor: '#050505'
              }}>
                {/* Left: Symbol & Timeframe options */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                    NIFTY 50 INDEX
                  </span>

                  {/* Timeframe options placed right next to symbol name */}
                  <div style={{
                    display: 'flex',
                    gap: '2px',
                    backgroundColor: '#0a0a0a',
                    padding: '2px',
                    borderRadius: '4px',
                    border: '1px solid #1f1f1f'
                  }}>
                    {(['15m', '30m', '1H', '1D'] as TimeFilter[]).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setActiveTimeFilter(tf)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          fontWeight: activeTimeFilter === tf ? 600 : 400,
                          border: 'none',
                          backgroundColor: activeTimeFilter === tf ? '#5F7A9A' : 'transparent',
                          color: activeTimeFilter === tf ? '#ffffff' : '#CCCCCC',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Corner: Reset Chart button */}
                <button
                  onClick={() => chartRef.current?.fitContent()}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    backgroundColor: '#121212',
                    border: '1px solid #262626',
                    color: '#e5e7eb',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Reset Chart
                </button>
              </div>

              {/* Main Visual Display: Candlestick Chart */}
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <CandlestickChart
                  ref={chartRef}
                  data={SAMPLE_CANDLESTICK_DATA}
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
                height: '36px',
                borderRadius: '1px',
                backgroundColor: isDraggingH ? '#5F7A9A' : '#262626',
                transition: 'background-color 0.15s ease'
              }} />
            </div>

            {/* RIGHT PANE: Stacked Resizable Widgets */}
            <div
              ref={sidebarRef}
              style={{
                width: `${sidebarWidth}px`,
                flexShrink: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0
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
                  <HighlightWindow style={{ height: '100%' }} />
                </div>

                {/* ↕ SUB-VERTICAL RESIZER (Between Highlight Window and Basis Spread) */}
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
                  <BasisSpreadWidget style={{ height: '100%' }} />
                </div>
              </div>

              {/* ↕ MAIN VERTICAL RESIZER (Drag to adjust Option Chain height) */}
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

              {/* BOTTOM SECTION: Option Chain (By default 50% vertical height) */}
              <div style={{
                height: `calc(${optionChainRatio * 100}% - 4px)`,
                minHeight: '160px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <OptionChainWidget />
              </div>
            </div>
          </>
        ) : (
          /* DEDICATED FULL-PAGE VIEW: Nifty 50 Treemap Heatmap */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000000',
            border: '1px solid #1a1a1a',
            borderRadius: '4px',
            overflow: 'hidden',
            height: '100%',
            minWidth: 0
          }}>
            <NiftyHeatmap
              onClose={() => setActivePage('dashboard')}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        )}

        {/* RIGHTMOST EASY-ACCESS VERTICAL RAIL */}
        <div
          style={{
            width: '42px',
            flexShrink: 0,
            height: '100%',
            backgroundColor: '#050505',
            borderLeft: '1px solid #1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0.65rem 0',
            zIndex: 30
          }}
        >
          {/* Top: Minimalist Dashboard / Chart Page Icon */}
          <button
            onClick={() => setActivePage('dashboard')}
            title="Dashboard (Chart & Options Chain)"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              border: activePage === 'dashboard' ? '1px solid #5F7A9A' : '1px solid transparent',
              backgroundColor: activePage === 'dashboard' ? 'rgba(95, 122, 154, 0.22)' : 'transparent',
              color: activePage === 'dashboard' ? '#5F7A9A' : '#737373',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </button>

          {/* Bottom: Minimalist Treemap Heatmap Page Icon (No Emojis!) */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setActivePage('heatmap')}
              title="NIFTY 50 Heatmap Page"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                border: activePage === 'heatmap' ? '1px solid #5F7A9A' : '1px solid #1f1f1f',
                backgroundColor: activePage === 'heatmap' ? 'rgba(95, 122, 154, 0.25)' : '#0d0d0d',
                color: activePage === 'heatmap' ? '#5F7A9A' : '#CCCCCC',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {/* Minimalist SVG Treemap Grid (No Emojis!) */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="10" height="11" rx="1.5" />
                <rect x="15" y="3" width="6" height="6" rx="1.5" />
                <rect x="15" y="11" width="6" height="10" rx="1.5" />
                <rect x="3" y="16" width="10" height="5" rx="1.5" />
              </svg>
              {activePage === 'heatmap' && (
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    right: '3px',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: '#5F7A9A'
                  }}
                />
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;