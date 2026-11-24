import React, { useState, useMemo } from 'react';
import { SecurityQuote } from '@pm-vision/shared';
import { NIFTY_50_CONSTITUENTS, NIFTY_INDICES, WatchlistItem } from './watchlistData';

export type SecurityInfo = SecurityQuote;

export const DEFAULT_SECURITIES: SecurityInfo[] = [
  { id: 'nifty-spot', name: 'Nifty 50 Spot', symbol: 'NIFTY 50', ltp: 25349.65, change: +149.05, changePct: +0.59, high: 25412.30, low: 25285.10, open: 25300.00, vwap: 25350.00, volume: '18.4M' },
  { id: 'nifty-fut-1', name: 'Nifty Fut #1 (Current)', symbol: 'NIFTY FUT-I', ltp: 25530.00, change: +180.35, changePct: +0.71, high: 25555.00, low: 25485.00, open: 25500.00, vwap: 25525.00, volume: '9.8M' },
  { id: 'nifty-fut-2', name: 'Nifty Fut #2 (Next)', symbol: 'NIFTY FUT-II', ltp: 25625.00, change: +195.00, changePct: +0.77, high: 25650.00, low: 25580.00, open: 25600.00, vwap: 25615.00, volume: '1.4M' },
  { id: 'nifty-fut-3', name: 'Nifty Fut #3 (Far)', symbol: 'NIFTY FUT-III', ltp: 25730.00, change: +210.00, changePct: +0.82, high: 25760.00, low: 25680.00, open: 25700.00, vwap: 25715.00, volume: '240K' }
];

interface HighlightWindowProps {
  securities?: SecurityInfo[];
  customSymbols?: string[];
  onAddSymbol?: (symbol: string) => void;
  onRemoveSymbol?: (symbol: string) => void;
  onSelectSymbol?: (symbol: string) => void;
  activeChartSymbol?: string;
  style?: React.CSSProperties;
}

export const HighlightWindow: React.FC<HighlightWindowProps> = ({
  securities = DEFAULT_SECURITIES,
  customSymbols = ['NIFTY 50', 'NIFTY FUT-I', 'BANK NIFTY', 'RELIANCE', 'HDFCBANK'],
  onAddSymbol,
  onRemoveSymbol,
  onSelectSymbol,
  activeChartSymbol = 'NIFTY 50',
  style
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Map live quotes from securities
  const securityMap = useMemo(() => {
    const map = new Map<string, SecurityInfo>();
    const list = securities && securities.length > 0 ? securities : DEFAULT_SECURITIES;
    for (const s of list) {
      map.set(s.symbol.toUpperCase(), s);
    }
    return map;
  }, [securities]);

  // Combined master catalog of all available stocks & indices
  const allCatalogItems = useMemo(() => {
    return [...NIFTY_INDICES, ...NIFTY_50_CONSTITUENTS];
  }, []);

  // Build the list of active items in Highlight Window
  const highlightItems: SecurityInfo[] = useMemo(() => {
    const baseDerivatives = DEFAULT_SECURITIES.filter((s) => s.symbol.startsWith('NIFTY FUT'));
    const items: SecurityInfo[] = [...baseDerivatives];

    for (const sym of customSymbols) {
      const upper = sym.toUpperCase();
      if (items.some((i) => i.symbol.toUpperCase() === upper)) continue;

      const live = securityMap.get(upper);
      if (live) {
        items.push(live);
      } else {
        const found = allCatalogItems.find((c) => c.symbol.toUpperCase() === upper);
        if (found) {
          items.push({
            id: `hl-${found.symbol.toLowerCase()}`,
            name: found.name,
            symbol: found.symbol,
            ltp: found.basePrice,
            change: found.change,
            changePct: found.changePct,
            high: found.high,
            low: found.low,
            open: found.basePrice,
            vwap: found.basePrice,
            volume: '—'
          });
        }
      }
    }
    return items;
  }, [customSymbols, securityMap, allCatalogItems]);

  // Current selected security
  const current = useMemo(() => {
    return (
      highlightItems.find((s) => s.symbol.toUpperCase() === selectedSymbol.toUpperCase()) ||
      highlightItems[0] ||
      DEFAULT_SECURITIES[0]
    );
  }, [highlightItems, selectedSymbol]);

  const spot = securityMap.get('NIFTY 50') || DEFAULT_SECURITIES[0];
  const basisPts = ((current?.ltp ?? 0) - (spot?.ltp ?? 0)).toFixed(2);

  // Available symbols to add (excluding already added)
  const availableToAdd = useMemo(() => {
    const existing = new Set(highlightItems.map((i) => i.symbol.toUpperCase()));
    return allCatalogItems.filter(
      (item) =>
        !existing.has(item.symbol.toUpperCase()) &&
        (item.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
          item.name.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  }, [allCatalogItems, highlightItems, searchFilter]);

  const handleSelectSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    onSelectSymbol?.(sym);
  };

  const handleAdd = (item: WatchlistItem) => {
    onAddSymbol?.(item.symbol);
    setSelectedSymbol(item.symbol);
    onSelectSymbol?.(item.symbol);
    setIsAddOpen(false);
    setSearchFilter('');
  };

  return (
    <div
      style={{
        backgroundColor: '#050505',
        border: '1px solid #1a1a1a',
        padding: '0.75rem 0.95rem',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.60rem',
        overflow: 'auto',
        position: 'relative',
        ...style
      }}
    >
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.70rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#CCCCCC', fontWeight: 700 }}>
            HIGHLIGHT WINDOW
          </span>
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 5px #10b981'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* + Add Symbol Button */}
          <button
            onClick={() => setIsAddOpen(!isAddOpen)}
            title="Add stock or index to Highlight Window"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: isAddOpen ? 'rgba(95, 122, 154, 0.25)' : '#121212',
              border: `1px solid ${isAddOpen ? '#5F7A9A' : '#262626'}`,
              color: isAddOpen ? '#5F7A9A' : '#CCCCCC',
              padding: '2px 7px',
              borderRadius: '3px',
              fontSize: '0.66rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>+</span>
            <span>Add</span>
          </button>

          {/* Symbol Selector Dropdown */}
          <select
            value={current.symbol}
            onChange={(e) => handleSelectSymbolChange(e.target.value)}
            style={{
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              border: '1px solid #262626',
              borderRadius: '3px',
              fontSize: '0.72rem',
              padding: '2px 6px',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '150px'
            }}
          >
            {highlightItems.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inline Add Symbol Dropdown Search Box */}
      {isAddOpen && (
        <div
          style={{
            backgroundColor: '#0d0d0d',
            border: '1px solid #5F7A9A',
            borderRadius: '4px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.95)',
            zIndex: 30
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.64rem', color: '#9ca3af', fontWeight: 600 }}>ADD TO HIGHLIGHT WINDOW</span>
            <span
              onClick={() => setIsAddOpen(false)}
              style={{ fontSize: '0.70rem', color: '#737373', cursor: 'pointer', padding: '0 4px' }}
            >
              ✕
            </span>
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Search stock or index (e.g. INFY, TCS)..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#171717',
              border: '1px solid #262626',
              borderRadius: '2px',
              padding: '4px 6px',
              color: '#ffffff',
              fontSize: '0.70rem',
              outline: 'none'
            }}
          />
          <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {availableToAdd.slice(0, 15).map((item) => (
              <div
                key={item.symbol}
                onClick={() => handleAdd(item)}
                style={{
                  padding: '3px 6px',
                  borderRadius: '2px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '0.68rem',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#ffffff' }}>{item.symbol}</span>
                  <span style={{ color: '#737373', fontSize: '0.62rem' }}>{item.name}</span>
                </div>
                <span style={{ color: '#5F7A9A', fontSize: '0.62rem', fontWeight: 600 }}>+ Add</span>
              </div>
            ))}
            {availableToAdd.length === 0 && (
              <div style={{ padding: '6px', fontSize: '0.66rem', color: '#737373', textAlign: 'center' }}>
                No matching symbols found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clickable Active Symbol Bar (Engaging / Clicking opens symbol chart) */}
      <div
        onClick={() => onSelectSymbol?.(current.symbol)}
        title={`Click to open ${current.symbol} in the main chart`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          backgroundColor: activeChartSymbol === current.symbol ? 'rgba(95, 122, 154, 0.15)' : 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${activeChartSymbol === current.symbol ? '#5F7A9A' : '#1f1f1f'}`,
          borderRadius: '3px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#5F7A9A';
          e.currentTarget.style.backgroundColor = 'rgba(95, 122, 154, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = activeChartSymbol === current.symbol ? '#5F7A9A' : '#1f1f1f';
          e.currentTarget.style.backgroundColor = activeChartSymbol === current.symbol ? 'rgba(95, 122, 154, 0.15)' : 'rgba(255, 255, 255, 0.03)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
            {current.symbol}
          </span>
          <span style={{ fontSize: '0.64rem', color: '#9ca3af' }}>
            {current.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Action indicator pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.64rem',
              color: '#5F7A9A',
              fontWeight: 600,
              backgroundColor: 'rgba(95, 122, 154, 0.15)',
              padding: '1px 5px',
              borderRadius: '2px'
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            <span>{activeChartSymbol === current.symbol ? 'Active Chart' : 'Open Chart'}</span>
          </div>

          {/* Remove custom symbol button */}
          {customSymbols.includes(current.symbol) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSymbol?.(current.symbol);
                setSelectedSymbol('NIFTY 50');
              }}
              title="Remove from Highlight Window"
              style={{
                background: 'none',
                border: 'none',
                color: '#737373',
                cursor: 'pointer',
                fontSize: '0.72rem',
                padding: '0 2px',
                lineHeight: 1
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#737373')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Quote Card (Clickable to open chart) */}
      <div
        onClick={() => onSelectSymbol?.(current.symbol)}
        title={`Click to open ${current.symbol} in the main chart`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px'
        }}
      >
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>
            {current?.ltp !== undefined ? current.ltp.toFixed(2) : '—'}
          </span>
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              color: (current?.change ?? 0) >= 0 ? '#10b981' : '#ef4444'
            }}
          >
            {(current?.change ?? 0) >= 0 ? '+' : ''}
            {(current?.change ?? 0).toFixed(2)} ({(current?.changePct ?? 0) >= 0 ? '+' : ''}
            {(current?.changePct ?? 0).toFixed(2)}%)
          </span>
        </div>
        <div style={{ fontSize: '0.70rem', color: '#CCCCCC', textAlign: 'right' }}>
          Basis (Fut - Spot): <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>+{basisPts}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          backgroundColor: '#0a0a0a',
          border: '1px solid #1f1f1f',
          borderRadius: '3px',
          padding: '0.45rem 0.60rem',
          fontSize: '0.68rem'
        }}
      >
        <div>
          <div style={{ color: '#888888' }}>High</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 600 }}>{current.high.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#888888' }}>Low</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 600 }}>{current.low.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#888888' }}>VWAP</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 600 }}>{current.vwap.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#888888' }}>Volume</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 600 }}>{current.volume}</div>
        </div>
      </div>
    </div>
  );
};
