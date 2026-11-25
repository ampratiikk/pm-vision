import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  SecurityQuote,
  InstrumentCatalogResponse,
  FuturesMonthRole,
  InstrumentCategory
} from '@pm-vision/shared';
import {
  WatchlistItem,
  NIFTY_50_CONSTITUENTS,
  NIFTY_INDICES,
  ALL_SECTORS
} from './watchlistData';

export type WatchlistMode = 'docked' | 'fullscreen';

export type WatchlistSegment =
  | 'nifty50'
  | 'fno_stocks'
  | 'all_stocks'
  | 'indices'
  | 'index_futures'
  | 'stock_futures'
  | 'all_futures';

export type WatchlistContractFilter = 'ALL' | FuturesMonthRole;

interface EnrichedWatchlistItem extends WatchlistItem {
  category?: InstrumentCategory;
  futuresRole?: FuturesMonthRole;
  expiryLabel?: string;
  lotSize?: number;
  underlying?: string;
  isFnO?: boolean;
}

const ROLE_LABELS: Record<FuturesMonthRole, { title: string; short: string; color: string; bg: string }> = {
  CONTINUOUS: {
    title: 'Continuous (1!)',
    short: 'CONT 1!',
    color: '#93c5fd',
    bg: 'rgba(95, 122, 154, 0.22)'
  },
  CURRENT: {
    title: 'Current Month',
    short: 'CURR MO',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.14)'
  },
  NEXT: {
    title: 'Next Month',
    short: 'NEXT MO',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.14)'
  },
  FAR: {
    title: 'Far Month',
    short: 'FAR MO',
    color: '#c084fc',
    bg: 'rgba(168, 85, 247, 0.14)'
  }
};

const ROLE_ORDER: FuturesMonthRole[] = ['CONTINUOUS', 'CURRENT', 'NEXT', 'FAR'];

interface WatchlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: WatchlistMode;
  onChangeMode: (mode: WatchlistMode) => void;
  securities?: SecurityQuote[];
  catalog?: InstrumentCatalogResponse | null;
  activeSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  highlightSymbols?: string[];
  onToggleHighlightSymbol?: (symbol: string) => void;
  onRequestQuotes?: (symbols: string[]) => void;
}

export const WatchlistDrawer: React.FC<WatchlistDrawerProps> = ({
  isOpen,
  onClose,
  mode: _mode,
  onChangeMode: _onChangeMode,
  securities = [],
  catalog = null,
  activeSymbol = 'NIFTY 50',
  onSelectSymbol,
  highlightSymbols = [],
  onToggleHighlightSymbol,
  onRequestQuotes
}) => {
  const [segment, setSegment] = useState<WatchlistSegment>('nifty50');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [contractFilter, setContractFilter] = useState<WatchlistContractFilter>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [displayLimit, setDisplayLimit] = useState<number>(150);

  const lastRequestedRef = useRef<Map<string, number>>(new Map());

  // Context menu for right-clicking any watchlist item
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: EnrichedWatchlistItem | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    item: null
  });

  // Close context menu on outside click
  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Reset pagination window when filters change
  useEffect(() => {
    setDisplayLimit(150);
  }, [segment, searchTerm, selectedSector, contractFilter]);

  // Sync quotes with live securities stream from WebSocket + on-demand fetches
  const securityMap = useMemo(() => {
    const map = new Map<string, SecurityQuote>();
    for (const s of securities) {
      map.set(s.symbol.toUpperCase(), s);
    }
    return map;
  }, [securities]);

  const isFuturesSegment =
    segment === 'index_futures' || segment === 'stock_futures' || segment === 'all_futures';

  // Build active list based on selected Watchlist Segment
  const activeCatalogList: EnrichedWatchlistItem[] = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    if (segment === 'nifty50') {
      return NIFTY_50_CONSTITUENTS.filter((item) => {
        const matchesSearch =
          !q ||
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q);
        const matchesSector =
          selectedSector === 'All Sectors' || item.sector === selectedSector;
        return matchesSearch && matchesSector;
      }).map((item) => ({ ...item, category: 'EQUITY' as InstrumentCategory, isFnO: true }));
    }

    if (segment === 'indices') {
      const merged: EnrichedWatchlistItem[] = [];
      const seen = new Set<string>();
      for (const idx of NIFTY_INDICES) {
        seen.add(idx.symbol.toUpperCase());
        merged.push({ ...idx, category: 'INDEX' });
      }
      if (catalog) {
        for (const idx of catalog.indices) {
          const key = idx.symbol.toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push({
            symbol: idx.symbol,
            name: idx.name,
            sector: 'NSE Index',
            basePrice: 0,
            change: 0,
            changePct: 0,
            high: 0,
            low: 0,
            isIndex: true,
            category: 'INDEX'
          });
        }
      }
      return merged.filter(
        (item) =>
          !q ||
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
      );
    }

    if (segment === 'fno_stocks' || segment === 'all_stocks') {
      const n50Map = new Map<string, WatchlistItem>();
      for (const s of NIFTY_50_CONSTITUENTS) n50Map.set(s.symbol.toUpperCase(), s);

      const sourceList = catalog?.equities || [];
      let baseItems: EnrichedWatchlistItem[];
      if (sourceList.length > 0) {
        baseItems = sourceList
          .filter((eq) => (segment === 'fno_stocks' ? Boolean(eq.isFnO) : true))
          .map((eq) => {
            const n50 = n50Map.get(eq.symbol.toUpperCase());
            return {
              symbol: eq.symbol,
              name: n50 ? n50.name : eq.name,
              sector: n50 ? n50.sector : eq.isFnO ? 'NSE F&O' : 'NSE Equity',
              weight: n50?.weight,
              basePrice: n50 ? n50.basePrice : 0,
              change: n50 ? n50.change : 0,
              changePct: n50 ? n50.changePct : 0,
              high: n50 ? n50.high : 0,
              low: n50 ? n50.low : 0,
              category: 'EQUITY',
              isFnO: eq.isFnO
            };
          });
      } else {
        baseItems = NIFTY_50_CONSTITUENTS.map((item) => ({
          ...item,
          category: 'EQUITY' as InstrumentCategory,
          isFnO: true
        }));
      }

      return baseItems
        .filter(
          (item) =>
            !q ||
            item.symbol.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q)
        )
        .sort((a, b) => {
          if (q) {
            const aStarts = a.symbol.toLowerCase().startsWith(q) ? 0 : 1;
            const bStarts = b.symbol.toLowerCase().startsWith(q) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
          }
          return a.symbol.localeCompare(b.symbol);
        });
    }

    // Futures segments ('index_futures' | 'stock_futures' | 'all_futures')
    const futuresList = catalog?.futures || [];
    return futuresList
      .filter((f) => {
        if (segment === 'index_futures' && f.category !== 'INDEX_FUTURES') return false;
        if (segment === 'stock_futures' && f.category !== 'STOCK_FUTURES') return false;
        if (contractFilter !== 'ALL' && f.futuresRole !== contractFilter) return false;
        if (!q) return true;
        return (
          f.symbol.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.underlying.toLowerCase().includes(q) ||
          (f.expiryLabel && f.expiryLabel.toLowerCase().includes(q)) ||
          (f.futuresRole && f.futuresRole.toLowerCase().includes(q))
        );
      })
      .map((f) => ({
        symbol: f.symbol,
        name: f.name,
        sector: f.category === 'INDEX_FUTURES' ? 'Index Futures' : 'Stock Futures',
        basePrice: 0,
        change: 0,
        changePct: 0,
        high: 0,
        low: 0,
        category: f.category,
        futuresRole: f.futuresRole,
        expiryLabel: f.expiryLabel,
        lotSize: f.lotSize,
        underlying: f.underlying,
        isFnO: true
      }))
      .sort((a, b) => {
        if (a.category !== b.category) {
          return a.category === 'INDEX_FUTURES' ? -1 : 1;
        }
        const rA = a.futuresRole ? ROLE_ORDER.indexOf(a.futuresRole) : 9;
        const rB = b.futuresRole ? ROLE_ORDER.indexOf(b.futuresRole) : 9;
        if (rA !== rB) return rA - rB;
        return a.symbol.localeCompare(b.symbol);
      });
  }, [segment, searchTerm, selectedSector, contractFilter, catalog]);

  // Visible slice for smooth rendering of thousands of NSE instruments
  const visibleItems = useMemo(() => {
    return activeCatalogList.slice(0, displayLimit);
  }, [activeCatalogList, displayLimit]);

  // Group by Sector (for NIFTY 50)
  const groupedNifty50 = useMemo(() => {
    if (segment !== 'nifty50') return new Map<string, EnrichedWatchlistItem[]>();
    const map = new Map<string, EnrichedWatchlistItem[]>();
    for (const item of visibleItems) {
      const sec = item.sector || 'Other';
      const list = map.get(sec) || [];
      list.push(item);
      map.set(sec, list);
    }
    return map;
  }, [segment, visibleItems]);

  // Group Futures by Role (Continuous / Current / Next / Far) when viewing All Contracts
  const groupedFuturesByRole = useMemo(() => {
    if (!isFuturesSegment || contractFilter !== 'ALL') {
      return new Map<FuturesMonthRole, EnrichedWatchlistItem[]>();
    }
    const map = new Map<FuturesMonthRole, EnrichedWatchlistItem[]>();
    for (const role of ROLE_ORDER) map.set(role, []);
    for (const item of visibleItems) {
      const role = item.futuresRole || 'CURRENT';
      const list = map.get(role) || [];
      list.push(item);
      map.set(role, list);
    }
    for (const [k, v] of map.entries()) {
      if (v.length === 0) map.delete(k);
    }
    return map;
  }, [isFuturesSegment, contractFilter, visibleItems]);

  // Hydrate live quotes on demand for currently visible instruments (with 15s per-symbol cooldown)
  useEffect(() => {
    if (!isOpen || !onRequestQuotes || visibleItems.length === 0) return;

    const now = Date.now();
    const missing: string[] = [];
    for (const item of visibleItems.slice(0, 45)) {
      const key = item.symbol.toUpperCase();
      const live = securityMap.get(key);
      if (live && live.ltp > 0) continue;
      const last = lastRequestedRef.current.get(key) || 0;
      if (now - last > 15000) {
        missing.push(item.symbol);
      }
    }

    if (missing.length === 0) return;
    const timer = setTimeout(() => {
      const stamp = Date.now();
      for (const s of missing) {
        lastRequestedRef.current.set(s.toUpperCase(), stamp);
      }
      onRequestQuotes(missing);
    }, 220);

    return () => clearTimeout(timer);
  }, [isOpen, visibleItems, securityMap, onRequestQuotes]);

  if (!isOpen) return null;

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getItemLtp = (item: EnrichedWatchlistItem): { ltp: number; change: number; changePct: number } => {
    const live = securityMap.get(item.symbol.toUpperCase());
    if (live && live.ltp > 0) {
      return {
        ltp: live.ltp,
        change: live.change,
        changePct: live.changePct
      };
    }
    return {
      ltp: item.basePrice,
      change: item.change,
      changePct: item.changePct
    };
  };

  const handleItemContextMenu = (e: React.MouseEvent, item: EnrichedWatchlistItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  const renderRow = (item: EnrichedWatchlistItem) => {
    const { ltp, change, changePct } = getItemLtp(item);
    const isPositive = change >= 0;
    const isSelected = activeSymbol.toUpperCase() === item.symbol.toUpperCase();
    const isHighlighted = highlightSymbols.some((s) => s.toUpperCase() === item.symbol.toUpperCase());
    const roleMeta = item.futuresRole ? ROLE_LABELS[item.futuresRole] : null;

    return (
      <div
        key={item.symbol}
        onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
        onContextMenu={(e) => handleItemContextMenu(e, item)}
        title="Click to open chart · Right click for options"
        style={{
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isSelected ? 'rgba(95, 122, 154, 0.12)' : 'transparent',
          borderBottom: '1px solid #121212',
          cursor: 'pointer',
          transition: 'background-color 0.12s ease'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ minWidth: 0, paddingRight: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#ffffff' }}>
              {item.symbol}
            </span>

            {roleMeta && (
              <span
                style={{
                  fontSize: '0.55rem',
                  color: roleMeta.color,
                  backgroundColor: roleMeta.bg,
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontWeight: 700
                }}
              >
                {roleMeta.short}
              </span>
            )}

            {item.expiryLabel && (
              <span style={{ fontSize: '0.56rem', color: '#9ca3af', fontWeight: 600 }}>
                {item.expiryLabel}
              </span>
            )}

            {item.category === 'INDEX' && (
              <span
                style={{
                  fontSize: '0.55rem',
                  color: '#5F7A9A',
                  backgroundColor: 'rgba(95, 122, 154, 0.15)',
                  padding: '1px 4px',
                  borderRadius: '2px'
                }}
              >
                INDEX
              </span>
            )}

            {item.weight && (
              <span style={{ fontSize: '0.58rem', color: '#525252' }}>
                {item.weight.toFixed(1)}%
              </span>
            )}

            {item.category === 'EQUITY' && item.isFnO && segment === 'all_stocks' && (
              <span
                style={{
                  fontSize: '0.54rem',
                  color: '#34d399',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  padding: '1px 3px',
                  borderRadius: '2px',
                  fontWeight: 700
                }}
              >
                F&O
              </span>
            )}

            {isHighlighted && (
              <span
                title="In Highlight Window"
                style={{
                  fontSize: '0.55rem',
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontWeight: 700
                }}
              >
                HL
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: '0.63rem',
              color: '#737373',
              maxWidth: '190px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px'
            }}
          >
            {item.name}
            {item.lotSize && item.lotSize > 1 ? ` · Lot ${item.lotSize}` : ''}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.73rem', fontWeight: 600, color: '#ffffff', fontFamily: 'monospace' }}>
            {ltp > 0 ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </div>
          {ltp > 0 ? (
            <div
              style={{
                fontSize: '0.63rem',
                fontWeight: 600,
                color: isPositive ? '#10b981' : '#ef4444',
                fontFamily: 'monospace'
              }}
            >
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
            </div>
          ) : (
            <div style={{ fontSize: '0.58rem', color: '#525252' }}>
              {isFuturesSegment ? 'FYERS FUT' : 'NSE'}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: '#0a0a0a',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Quicksand, sans-serif',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Drawer Top Navigation Bar */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#050505',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
            WATCHLIST
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              backgroundColor: 'rgba(95, 122, 154, 0.2)',
              color: '#5F7A9A',
              padding: '1px 6px',
              borderRadius: '2px',
              fontWeight: 600
            }}
          >
            {activeCatalogList.length.toLocaleString()}
          </span>
        </div>

        <button
          onClick={onClose}
          title="Close Watchlist"
          style={{
            padding: '3px 7px',
            fontSize: '0.72rem',
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
        >
          ✕
        </button>
      </div>

      {/* Market Segment Selector Dropdown */}
      <div
        style={{
          padding: '7px 12px',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#080808',
          flexShrink: 0
        }}
      >
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value as WatchlistSegment)}
          style={{
            width: '100%',
            backgroundColor: '#121212',
            color: '#ffffff',
            border: '1px solid #5F7A9A',
            borderRadius: '4px',
            padding: '5px 8px',
            fontSize: '0.74rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'Quicksand, sans-serif'
          }}
        >
          <option value="nifty50">NIFTY 50 Constituents (50)</option>
          <option value="fno_stocks">
            NSE F&amp;O Stocks ({catalog ? catalog.fnOUnderlyings.length : '224'})
          </option>
          <option value="all_stocks">
            All NSE Stocks ({catalog ? catalog.equities.length.toLocaleString() : '50+'})
          </option>
          <option value="indices">
            NSE Indices ({catalog ? catalog.indices.length : NIFTY_INDICES.length})
          </option>
          <option value="index_futures">Index Futures (NIFTY, BANKNIFTY, FINNIFTY...)</option>
          <option value="stock_futures">Stock Futures (All NSE F&amp;O Contracts)</option>
          <option value="all_futures">
            All Futures Contracts ({catalog ? catalog.futures.length.toLocaleString() : 'F&O'})
          </option>
        </select>
      </div>

      {/* Search Bar & Secondary Filter (Sector for Nifty 50 / Contract Role for Futures) */}
      <div
        style={{
          padding: '7px 12px',
          borderBottom: '1px solid #171717',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          backgroundColor: '#0a0a0a',
          flexShrink: 0
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isFuturesSegment ? 'Filter future / underlying...' : 'Filter symbols...'}
            style={{
              width: '100%',
              backgroundColor: '#121212',
              border: '1px solid #262626',
              borderRadius: '3px',
              padding: '4px 8px 4px 24px',
              fontSize: '0.70rem',
              color: '#ffffff',
              outline: 'none'
            }}
          />
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#737373"
            strokeWidth="2.5"
            style={{ position: 'absolute', left: '8px', top: '7px' }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        {segment === 'nifty50' && (
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            style={{
              backgroundColor: '#121212',
              color: '#CCCCCC',
              border: '1px solid #262626',
              borderRadius: '3px',
              padding: '4px 6px',
              fontSize: '0.68rem',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '125px'
            }}
          >
            {ALL_SECTORS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        )}

        {isFuturesSegment && (
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value as WatchlistContractFilter)}
            title="Select Futures Contract Month"
            style={{
              backgroundColor: '#121212',
              color: contractFilter !== 'ALL' ? '#93c5fd' : '#CCCCCC',
              border: `1px solid ${contractFilter !== 'ALL' ? '#5F7A9A' : '#262626'}`,
              borderRadius: '3px',
              padding: '4px 6px',
              fontSize: '0.68rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '130px'
            }}
          >
            <option value="ALL">All Contracts</option>
            <option value="CONTINUOUS">Continuous (1!)</option>
            <option value="CURRENT">Current Month</option>
            <option value="NEXT">Next Month</option>
            <option value="FAR">Far Month</option>
          </select>
        )}
      </div>

      {/* Main List Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeCatalogList.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.72rem' }}>
            No matching instruments found.
          </div>
        ) : segment === 'nifty50' ? (
          <div>
            {Array.from(groupedNifty50.entries()).map(([sectorName, items]) => {
              const isCollapsed = collapsedGroups[sectorName];
              return (
                <div key={sectorName} style={{ borderBottom: '1px solid #141414' }}>
                  <div
                    onClick={() => toggleGroup(sectorName)}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#0d0d0d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.60rem',
                          color: '#5F7A9A',
                          transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        ▼
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.02em' }}>
                        {sectorName.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.60rem', color: '#525252' }}>({items.length})</span>
                    </div>
                  </div>
                  {!isCollapsed && <div>{items.map(renderRow)}</div>}
                </div>
              );
            })}
          </div>
        ) : isFuturesSegment && contractFilter === 'ALL' ? (
          <div>
            {Array.from(groupedFuturesByRole.entries()).map(([role, items]) => {
              const groupKey = `fut-${role}`;
              const isCollapsed = collapsedGroups[groupKey];
              const meta = ROLE_LABELS[role];
              return (
                <div key={role} style={{ borderBottom: '1px solid #141414' }}>
                  <div
                    onClick={() => toggleGroup(groupKey)}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: '#0d0d0d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.60rem',
                          color: '#5F7A9A',
                          transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        ▼
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: meta.color, letterSpacing: '0.02em' }}>
                        {meta.title.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.60rem', color: '#525252' }}>({items.length})</span>
                    </div>
                  </div>
                  {!isCollapsed && <div>{items.map(renderRow)}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleItems.map(renderRow)}
          </div>
        )}

        {activeCatalogList.length > displayLimit && (
          <div style={{ padding: '10px 12px', textAlign: 'center', borderTop: '1px solid #171717' }}>
            <button
              onClick={() => setDisplayLimit((prev) => prev + 200)}
              style={{
                backgroundColor: '#141414',
                border: '1px solid #262626',
                color: '#5F7A9A',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Load More ({visibleItems.length.toLocaleString()} of {activeCatalogList.length.toLocaleString()})
            </button>
          </div>
        )}
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu.visible && contextMenu.item && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#0d0d0d',
            border: '1px solid #262626',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.95)',
            padding: '4px 0',
            zIndex: 90,
            minWidth: '185px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '4px 12px', fontSize: '0.66rem', color: '#737373', borderBottom: '1px solid #1a1a1a', fontWeight: 700 }}>
            {contextMenu.item.symbol}
          </div>

          <div
            onClick={() => {
              if (contextMenu.item) {
                onSelectSymbol?.(contextMenu.item.symbol);
              }
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            <span>Open Chart</span>
          </div>

          <div
            onClick={() => {
              if (contextMenu.item) {
                onToggleHighlightSymbol?.(contextMenu.item.symbol);
              }
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>
              {contextMenu.item && highlightSymbols.some((s) => s.toUpperCase() === contextMenu.item!.symbol.toUpperCase())
                ? 'Remove from Highlight'
                : 'Add to Highlight Window'}
            </span>
          </div>

          <div style={{ height: '1px', backgroundColor: '#1a1a1a', margin: '4px 0' }} />

          <div
            onClick={() => {
              if (contextMenu.item) {
                navigator.clipboard.writeText(contextMenu.item.symbol);
              }
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              color: '#a3a3a3',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Symbol</span>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid #171717',
          backgroundColor: '#080808',
          fontSize: '0.64rem',
          color: '#525252',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <span>
          Showing {visibleItems.length.toLocaleString()} of {activeCatalogList.length.toLocaleString()}
        </span>
        <span style={{ color: '#5F7A9A' }}>Right-click for options</span>
      </div>
    </div>
  );
};
