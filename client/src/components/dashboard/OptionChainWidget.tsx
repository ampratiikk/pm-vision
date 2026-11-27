import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ExpiryOption } from '@pm-vision/shared';

export type ColumnKey = 'theta' | 'gamma' | 'delta' | 'oi' | 'ltp';

export interface ColumnDefinition {
  key: ColumnKey;
  label: string;
  minWidth: number;
}

export const CALL_COLUMNS: ColumnDefinition[] = [
  { key: 'theta', label: 'Theta', minWidth: 80 },
  { key: 'gamma', label: 'Gamma', minWidth: 80 },
  { key: 'delta', label: 'Delta', minWidth: 80 },
  { key: 'oi', label: 'Open Interest', minWidth: 115 },
  { key: 'ltp', label: 'LTP', minWidth: 78 }
];

export const PUT_COLUMNS: ColumnDefinition[] = [
  { key: 'ltp', label: 'LTP', minWidth: 78 },
  { key: 'oi', label: 'Open Interest', minWidth: 115 },
  { key: 'delta', label: 'Delta', minWidth: 80 },
  { key: 'gamma', label: 'Gamma', minWidth: 80 },
  { key: 'theta', label: 'Theta', minWidth: 80 }
];

export interface OptionRow {
  strike: number;
  call: {
    theta: number;
    gamma: number;
    delta: number;
    oi: number;
    ltp: number;
  };
  put: {
    ltp: number;
    oi: number;
    delta: number;
    gamma: number;
    theta: number;
  };
}

export const DEFAULT_SPOT_PRICE = 25819.25;

export interface OptionChainWidgetProps {
  data?: OptionRow[];
  spotPrice?: number;
  expiries?: ExpiryOption[];
  selectedExpiry?: string;
  onSelectExpiry?: (expiryTimestamp: string) => void;
  enabled?: boolean;
  onToggleEnabled?: (nextEnabled: boolean) => void;
  isBrokerConnected?: boolean;
}

export const OptionChainWidget: React.FC<OptionChainWidgetProps> = ({
  data,
  spotPrice,
  expiries,
  selectedExpiry,
  onSelectExpiry,
  enabled = false,
  onToggleEnabled,
  isBrokerConnected = false
}) => {
  const currentSpotPrice = spotPrice && spotPrice > 0 ? spotPrice : DEFAULT_SPOT_PRICE;
  const currentAtmStrike = Math.round(currentSpotPrice / 50) * 50;

  // Visible Strikes option: default 10 (10 above ATM, 10 below ATM, up to 50 max)
  const [strikeCount, setStrikeCount] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem('pm_vision_oc_strikecount') || '', 10);
      return saved >= 5 && saved <= 50 ? saved : 10;
    } catch {
      return 10;
    }
  });

  const updateStrikeCount = (nextVal: number) => {
    const clamped = Math.max(5, Math.min(50, Math.round(nextVal)));
    setStrikeCount(clamped);
    try {
      localStorage.setItem('pm_vision_oc_strikecount', String(clamped));
    } catch {}
  };

  const currentChain = useMemo(() => (data && data.length > 0 ? data : []), [data]);

  const [selectedStrike, setSelectedStrike] = useState<number>(currentAtmStrike);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    theta: true,
    gamma: true,
    delta: true,
    oi: true,
    ltp: true
  });

  // Mirrored horizontal scroll offset in pixels
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const scrollOffsetRef = useRef<number>(0);
  const [maxScroll, setMaxScroll] = useState<number>(180);

  const callContainerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const unifiedScrollerRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef<boolean>(false);

  const activeCallColumns = useMemo(
    () => CALL_COLUMNS.filter((col) => visibleColumns[col.key]),
    [visibleColumns]
  );
  const activePutColumns = useMemo(
    () => PUT_COLUMNS.filter((col) => visibleColumns[col.key]),
    [visibleColumns]
  );

  const totalCallsWidth = useMemo(
    () => activeCallColumns.reduce((sum, col) => sum + col.minWidth, 0),
    [activeCallColumns]
  );
  const totalPutsWidth = useMemo(
    () => activePutColumns.reduce((sum, col) => sum + col.minWidth, 0),
    [activePutColumns]
  );

  // Filter strikes based on strikeCount (count above & count below ATM)
  const visibleRows = useMemo(() => {
    const atmIndex = currentChain.findIndex((row) => row.strike === currentAtmStrike);
    if (atmIndex === -1) return currentChain;
    const startIndex = Math.max(0, atmIndex - strikeCount);
    const endIndex = Math.min(currentChain.length, atmIndex + strikeCount + 1);
    return currentChain.slice(startIndex, endIndex);
  }, [currentChain, currentAtmStrike, strikeCount]);

  // Measure visible call container width to calculate maxScroll
  useEffect(() => {
    const el = callContainerRef.current;
    if (!el) return;

    const measure = () => {
      const visibleW = el.clientWidth;
      const max = Math.max(0, totalCallsWidth - visibleW);
      setMaxScroll(max);
      const clamped = Math.min(scrollOffsetRef.current, max);
      scrollOffsetRef.current = clamped;
      setScrollOffset(clamped);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalCallsWidth]);

  // Sync scrollbar position when scrollOffset changes
  const applyScrollOffset = useCallback((offset: number) => {
    const clamped = Math.max(0, Math.min(maxScroll, offset));
    scrollOffsetRef.current = clamped;
    setScrollOffset(clamped);

    isSyncingScrollRef.current = true;
    if (unifiedScrollerRef.current) {
      unifiedScrollerRef.current.scrollLeft = clamped;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, [maxScroll]);

  const handleUnifiedScroller = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScrollRef.current) return;
    const newOffset = e.currentTarget.scrollLeft;
    applyScrollOffset(newOffset);
  };

  // Shift + Scroll listener (attached non-passive to allow e.preventDefault)
  useEffect(() => {
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;

    const onWheel = (e: WheelEvent) => {
      // If Shift key is pressed or native deltaX (horizontal trackpad scroll)
      if (e.shiftKey || Math.abs(e.deltaX) > 0) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
        applyScrollOffset(scrollOffsetRef.current + delta);
      }
    };

    tableEl.addEventListener('wheel', onWheel, { passive: false });
    return () => tableEl.removeEventListener('wheel', onWheel);
  }, [applyScrollOffset]);

  // Center on ATM strike initially or when strike count / ATM changes
  useEffect(() => {
    setSelectedStrike(currentAtmStrike);
    if (tableContainerRef.current) {
      const atmEl = tableContainerRef.current.querySelector('[data-atm="true"]') as HTMLElement;
      if (atmEl) {
        const targetScrollTop = atmEl.offsetTop - (tableContainerRef.current.clientHeight / 2) + 17;
        tableContainerRef.current.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  }, [strikeCount, currentAtmStrike]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const ROW_HEIGHT = '34px';

  return (
    <div style={{
      backgroundColor: '#000000',
      border: '1px solid #1a1a1a',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'Quicksand, sans-serif'
    }}>
      {/* Top Header & Settings Option */}
      <div style={{
        height: '38px',
        flexShrink: 0,
        padding: '0 0.85rem',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#050505',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.80rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a3a3a3', fontWeight: 700 }}>
            OPTION CHAIN
          </span>
          {!enabled && currentChain.length > 0 && (
            <span style={{
              fontSize: '0.60rem',
              padding: '1px 5px',
              borderRadius: '2px',
              backgroundColor: 'rgba(115, 115, 115, 0.16)',
              border: '1px solid #262626',
              color: '#9ca3af',
              fontWeight: 700
            }}>
              PAUSED
            </span>
          )}
          <span style={{
            fontSize: '0.70rem',
            padding: '1px 6px',
            borderRadius: '2px',
            backgroundColor: '#141414',
            border: '1px solid #262626',
            color: '#e5e7eb'
          }}>
            NIFTY SPOT: {currentSpotPrice.toFixed(2)}
          </span>

          {/* Expiry Selector Dropdown */}
          {expiries && expiries.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.68rem', color: '#737373', fontWeight: 600 }}>EXPIRY:</span>
              <select
                value={selectedExpiry || (expiries[0]?.expiry || '')}
                onChange={(e) => onSelectExpiry?.(e.target.value)}
                disabled={!enabled}
                style={{
                  backgroundColor: '#0a0a0a',
                  color: enabled ? '#e5e7eb' : '#737373',
                  border: '1px solid #262626',
                  borderRadius: '3px',
                  fontSize: '0.70rem',
                  padding: '2px 6px',
                  outline: 'none',
                  cursor: enabled ? 'pointer' : 'not-allowed'
                }}
              >
                {expiries.map((exp) => (
                  <option key={exp.expiry} value={exp.expiry}>
                    {exp.date} {exp.expiry_flag ? `(${exp.expiry_flag})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Enable/Disable Toggle (LHS of Settings) & Settings Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          <button
            type="button"
            onClick={() => onToggleEnabled?.(!enabled)}
            title={
              enabled
                ? 'Option Chain active (updates every 2s). Click to disable and save token quota.'
                : 'Option Chain disabled to save token quota. Click to enable live 2s updates.'
            }
            style={{
              padding: '2px 9px',
              fontSize: '0.70rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: enabled ? 'rgba(16, 185, 129, 0.14)' : '#0a0a0a',
              borderColor: enabled ? 'rgba(16, 185, 129, 0.45)' : '#262626',
              color: enabled ? '#34d399' : '#d4d4d4'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: enabled ? '#10b981' : '#525252',
                boxShadow: enabled ? '0 0 6px #10b981' : 'none'
              }}
            />
            <span>{enabled ? 'Disable' : 'Enable'}</span>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '2px 8px',
              fontSize: '0.72rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: showSettings ? '#5F7A9A' : '#0a0a0a',
              borderColor: showSettings ? '#5F7A9A' : '#262626',
              color: showSettings ? '#ffffff' : '#CCCCCC'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>

          {/* Settings Popover Dropdown */}
          {showSettings && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 4px)',
              backgroundColor: '#0a0a0a',
              border: '1px solid #262626',
              borderRadius: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.9)',
              padding: '0.75rem 0.85rem',
              width: '230px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              {/* Strike Count Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.70rem', color: '#CCCCCC', fontWeight: 700 }}>
                    VISIBLE STRIKES (± ATM)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => updateStrikeCount(strikeCount - 5)}
                      disabled={strikeCount <= 5}
                      title="Decrease strikes"
                      style={{
                        width: '20px',
                        height: '20px',
                        padding: 0,
                        fontSize: '0.76rem',
                        lineHeight: 1,
                        backgroundColor: '#121212',
                        border: '1px solid #262626',
                        color: strikeCount <= 5 ? '#404040' : '#CCCCCC',
                        borderRadius: '2px',
                        cursor: strikeCount <= 5 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffffff', minWidth: '20px', textAlign: 'center' }}>
                      {strikeCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateStrikeCount(strikeCount + 5)}
                      disabled={strikeCount >= 50}
                      title="Increase strikes"
                      style={{
                        width: '20px',
                        height: '20px',
                        padding: 0,
                        fontSize: '0.76rem',
                        lineHeight: 1,
                        backgroundColor: '#121212',
                        border: '1px solid #262626',
                        color: strikeCount >= 50 ? '#404040' : '#CCCCCC',
                        borderRadius: '2px',
                        cursor: strikeCount >= 50 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  {[5, 10, 15, 20, 30, 50].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => updateStrikeCount(count)}
                      style={{
                        padding: '3px 0',
                        fontSize: '0.70rem',
                        fontWeight: strikeCount === count ? 600 : 400,
                        backgroundColor: strikeCount === count ? '#5F7A9A' : '#121212',
                        border: `1px solid ${strikeCount === count ? '#5F7A9A' : '#1f1f1f'}`,
                        color: strikeCount === count ? '#ffffff' : '#CCCCCC',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.64rem', color: '#9ca3af', textAlign: 'center' }}>
                  {strikeCount} above & {strikeCount} below ({visibleRows.length} rows shown)
                </div>
              </div>

              {/* Visible Columns Checkboxes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ fontSize: '0.70rem', color: '#CCCCCC', fontWeight: 700 }}>
                  VISIBLE COLUMNS
                </div>
                {(['ltp', 'oi', 'delta', 'gamma', 'theta'] as ColumnKey[]).map((key) => {
                  const labelMap: Record<ColumnKey, string> = {
                    ltp: 'LTP',
                    oi: 'Open Interest',
                    delta: 'Delta',
                    gamma: 'Gamma',
                    theta: 'Theta'
                  };
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        fontSize: '0.76rem',
                        color: visibleColumns[key] ? '#ffffff' : '#CCCCCC',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[key]}
                        onChange={() => toggleColumn(key)}
                        style={{ cursor: 'pointer', accentColor: '#5F7A9A' }}
                      />
                      <span>{labelMap[key]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Empty/Disabled Banner OR Option Chain Table */}
      {currentChain.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: '#000000',
            textAlign: 'center',
            gap: '0.65rem'
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: enabled ? '#e5e7eb' : '#9ca3af' }}>
            {enabled
              ? isBrokerConnected
                ? 'Fetching live Option Chain (updates every 2s)...'
                : 'Connect Data Feed in Settings (Alt+S) to fetch live Option Chain'
              : 'Option Chain Fetching Disabled'}
          </div>
          <div style={{ fontSize: '0.70rem', color: '#737373', maxWidth: '300px', lineHeight: 1.45 }}>
            {enabled
              ? 'Live strike chain and open interest will populate here once received.'
              : 'Kept disabled by default to conserve API quota. Enable to fetch live updates every 2 seconds.'}
          </div>
          {!enabled && onToggleEnabled && (
            <button
              type="button"
              onClick={() => onToggleEnabled(true)}
              style={{
                marginTop: '4px',
                padding: '5px 14px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: '#5F7A9A',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Enable Option Chain
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Main Table: Single Vertical Scroll Container for ALL Rows */}
          <div
            ref={tableContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#000000',
              minHeight: 0
            }}
          >
        {/* ===================== UNIFIED STICKY HEADER (ZERO GAP) ===================== */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          backgroundColor: '#0a0a0a'
        }}>
          {/* Row 1: "CALL" | "—" | "PUT" in main accent Steel Blue (#5F7A9A) */}
          <div style={{
            display: 'flex',
            height: '24px',
            backgroundColor: '#080808',
            borderBottom: '1px solid #1f1f1f',
            width: '100%',
            fontSize: '0.74rem',
            fontWeight: 800,
            letterSpacing: '0.08em'
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5F7A9A',
              borderRight: '1px solid #262626'
            }}>
              CALL
            </div>
            <div style={{
              width: '95px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#CCCCCC',
              borderRight: '1px solid #262626'
            }}>
              —
            </div>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5F7A9A'
            }}>
              PUT
            </div>
          </div>

          {/* Row 2: COLUMN NAMES (CENTER-ALIGNED) */}
          <div style={{
            display: 'flex',
            height: '32px',
            backgroundColor: '#0a0a0a',
            borderBottom: '1px solid #262626',
            width: '100%'
          }}>
            {/* Call Header */}
            <div
              ref={callContainerRef}
              style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'flex-end',
                borderRight: '1px solid #262626'
              }}
            >
              <div style={{
                display: 'flex',
                width: `${totalCallsWidth}px`,
                flexShrink: 0,
                transform: `translateX(${scrollOffset}px)`,
                willChange: 'transform'
              }}>
                {activeCallColumns.map((col) => (
                  <div
                    key={col.key}
                    style={{
                      width: `${col.minWidth}px`,
                      flexShrink: 0,
                      padding: '4px 6px',
                      textAlign: 'center',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: '#d4d4d4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Center Strike Header */}
            <div style={{
              width: '95px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.80rem',
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: '#121212',
              borderRight: '1px solid #262626',
              letterSpacing: '0.04em',
              textAlign: 'center'
            }}>
              STRIKE
            </div>

            {/* Put Header */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              justifyContent: 'flex-start'
            }}>
              <div style={{
                display: 'flex',
                width: `${totalPutsWidth}px`,
                flexShrink: 0,
                transform: `translateX(-${scrollOffset}px)`,
                willChange: 'transform'
              }}>
                {activePutColumns.map((col) => (
                  <div
                    key={col.key}
                    style={{
                      width: `${col.minWidth}px`,
                      flexShrink: 0,
                      padding: '4px 6px',
                      textAlign: 'center',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: '#d4d4d4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===================== DATA ROWS (CENTER-ALIGNED) ===================== */}
        {visibleRows.map((row) => {
          const isAtm = row.strike === currentAtmStrike;
          const isSelected = row.strike === selectedStrike;
          const isCallItm = row.strike < currentAtmStrike; // In-The-Money: Strike < Spot
          const isPutItm = row.strike > currentAtmStrike;   // In-The-Money: Strike > Spot

          const callBg = isSelected ? 'rgba(95, 122, 154, 0.20)' : isCallItm ? '#181818' : '#000000';
          const putBg = isSelected ? 'rgba(95, 122, 154, 0.20)' : isPutItm ? '#181818' : '#000000';
          const strikeBg = isAtm ? '#1f2937' : isSelected ? 'rgba(95, 122, 154, 0.30)' : '#0d0d0d';

          // Dark white border for ATM row
          const atmBorder = isAtm ? '2px solid #e5e7eb' : '1px solid #141414';

          return (
            <div
              key={row.strike}
              data-atm={isAtm ? 'true' : undefined}
              onClick={() => setSelectedStrike(row.strike)}
              style={{
                display: 'flex',
                height: ROW_HEIGHT,
                width: '100%',
                borderTop: isAtm ? atmBorder : undefined,
                borderBottom: atmBorder,
                cursor: 'pointer'
              }}
            >
              {/* Call Cells */}
              <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: callBg,
                borderRight: '1px solid #262626'
              }}>
                <div style={{
                  display: 'flex',
                  width: `${totalCallsWidth}px`,
                  flexShrink: 0,
                  transform: `translateX(${scrollOffset}px)`,
                  willChange: 'transform'
                }}>
                  {activeCallColumns.map((col) => {
                    let val: string | number = '';
                    let isBold = false;
                    if (col.key === 'ltp') {
                      val = (row.call?.ltp ?? 0).toFixed(2);
                      isBold = true;
                    } else if (col.key === 'oi') {
                      val = `${((row.call?.oi ?? 0) / 1000).toFixed(0)}k`;
                    } else if (col.key === 'delta') {
                      val = (row.call?.delta ?? 0).toFixed(2);
                    } else if (col.key === 'gamma') {
                      val = (row.call?.gamma ?? 0).toFixed(4);
                    } else if (col.key === 'theta') {
                      val = (row.call?.theta ?? 0).toFixed(1);
                    }

                    return (
                      <div
                        key={col.key}
                        style={{
                          width: `${col.minWidth}px`,
                          flexShrink: 0,
                          padding: '6px 6px',
                          textAlign: 'center',
                          fontSize: isBold ? '0.90rem' : '0.84rem',
                          fontWeight: isBold ? 700 : 400,
                          color: isBold ? '#ffffff' : isCallItm ? '#f3f4f6' : '#9ca3af',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Center Strike Cell */}
              <div style={{
                width: '95px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.92rem',
                fontWeight: isAtm ? 800 : 700,
                color: isAtm ? '#ffffff' : '#e5e7eb',
                backgroundColor: strikeBg,
                borderRight: '1px solid #262626',
                textAlign: 'center'
              }}>
                <span>{row.strike}</span>
              </div>

              {/* Put Cells */}
              <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'flex-start',
                backgroundColor: putBg
              }}>
                <div style={{
                  display: 'flex',
                  width: `${totalPutsWidth}px`,
                  flexShrink: 0,
                  transform: `translateX(-${scrollOffset}px)`,
                  willChange: 'transform'
                }}>
                  {activePutColumns.map((col) => {
                    let val: string | number = '';
                    let isBold = false;
                    if (col.key === 'ltp') {
                      val = (row.put?.ltp ?? 0).toFixed(2);
                      isBold = true;
                    } else if (col.key === 'oi') {
                      val = `${((row.put?.oi ?? 0) / 1000).toFixed(0)}k`;
                    } else if (col.key === 'delta') {
                      val = (row.put?.delta ?? 0).toFixed(2);
                    } else if (col.key === 'gamma') {
                      val = (row.put?.gamma ?? 0).toFixed(4);
                    } else if (col.key === 'theta') {
                      val = (row.put?.theta ?? 0).toFixed(1);
                    }

                    return (
                      <div
                        key={col.key}
                        style={{
                          width: `${col.minWidth}px`,
                          flexShrink: 0,
                          padding: '6px 6px',
                          textAlign: 'center',
                          fontSize: isBold ? '0.90rem' : '0.84rem',
                          fontWeight: isBold ? 700 : 400,
                          color: isBold ? '#ffffff' : isPutItm ? '#f3f4f6' : '#9ca3af',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {val}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================== ONE SINGLE COMBINED SIDE SCROLLER ===================== */}
      <div style={{
        height: '14px',
        backgroundColor: '#050505',
        borderTop: '1px solid #1a1a1a',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 2px'
      }}>
        <div
          ref={unifiedScrollerRef}
          onScroll={handleUnifiedScroller}
          className="option-chain-scroller"
          style={{
            width: '100%',
            overflowX: 'auto',
            overflowY: 'hidden'
          }}
        >
          {/* Inner dummy bar sized to provide exact scroll range */}
          <div style={{ width: `calc(100% + ${maxScroll}px)`, height: '1px' }} />
        </div>
      </div>
        </>
      )}
    </div>
  );
};
