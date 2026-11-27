import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  InstrumentCatalogResponse,
  SecurityQuote,
  FuturesMonthRole,
  InstrumentCategory
} from '@pm-vision/shared';
import { NIFTY_50_CONSTITUENTS, NIFTY_INDICES } from './watchlistData';

export type SearchCategory =
  | 'all'
  | 'nifty50'
  | 'fno_stocks'
  | 'stocks'
  | 'indices'
  | 'index_futures'
  | 'stock_futures'
  | 'futures';

export type ContractFilter = 'ALL' | FuturesMonthRole;

interface SearchCatalogItem {
  symbol: string;
  name: string;
  sector: string;
  category: InstrumentCategory;
  isNifty50?: boolean;
  isFnO?: boolean;
  futuresRole?: FuturesMonthRole;
  expiryLabel?: string;
  lotSize?: number;
  underlying?: string;
  basePrice: number;
  change: number;
  changePct: number;
}

const ROLE_ORDER: Record<FuturesMonthRole, number> = {
  CONTINUOUS: 0,
  CURRENT: 1,
  NEXT: 2,
  FAR: 3
};

const ROLE_BADGE_MAP: Record<FuturesMonthRole, { label: string; bg: string; fg: string; border: string }> = {
  CONTINUOUS: {
    label: 'CONTINUOUS 1!',
    bg: 'rgba(95, 122, 154, 0.22)',
    fg: '#93c5fd',
    border: 'rgba(95, 122, 154, 0.45)'
  },
  CURRENT: {
    label: 'CURRENT MO',
    bg: 'rgba(16, 185, 129, 0.14)',
    fg: '#34d399',
    border: 'rgba(16, 185, 129, 0.35)'
  },
  NEXT: {
    label: 'NEXT MO',
    bg: 'rgba(245, 158, 11, 0.14)',
    fg: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.35)'
  },
  FAR: {
    label: 'FAR MO',
    bg: 'rgba(168, 85, 247, 0.14)',
    fg: '#c084fc',
    border: 'rgba(168, 85, 247, 0.35)'
  }
};

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string, name: string, sector: string, basePrice: number) => void;
  activeSymbol?: string;
  initialQuery?: string;
  catalog?: InstrumentCatalogResponse | null;
  securities?: SecurityQuote[];
  onRequestQuotes?: (symbols: string[]) => void;
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
  activeSymbol = 'NIFTY 50',
  initialQuery = '',
  catalog = null,
  securities = [],
  onRequestQuotes
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [contractFilter, setContractFilter] = useState<ContractFilter>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || '');
      setSelectedIndex(0);
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          const len = (initialQuery || '').length;
          el.setSelectionRange(len, len);
        }
      }, 30);
    }
  }, [isOpen, initialQuery]);

  const securityMap = useMemo(() => {
    const map = new Map<string, SecurityQuote>();
    for (const s of securities) {
      map.set(s.symbol.toUpperCase(), s);
    }
    return map;
  }, [securities]);

  // Build unified catalog from local Nifty 50/Indices baselines + full FYERS CSV catalog
  const allItems: SearchCatalogItem[] = useMemo(() => {
    const items: SearchCatalogItem[] = [];
    const seen = new Set<string>();
    const fnOSet = new Set((catalog?.fnOUnderlyings || []).map((u) => u.toUpperCase()));

    for (const idx of NIFTY_INDICES) {
      const key = idx.symbol.toUpperCase();
      seen.add(key);
      items.push({
        symbol: idx.symbol,
        name: idx.name,
        sector: 'Index',
        category: 'INDEX',
        basePrice: idx.basePrice,
        change: idx.change,
        changePct: idx.changePct
      });
    }

    for (const n50 of NIFTY_50_CONSTITUENTS) {
      const key = n50.symbol.toUpperCase();
      seen.add(key);
      items.push({
        symbol: n50.symbol,
        name: n50.name,
        sector: n50.sector || 'Nifty 50',
        category: 'EQUITY',
        isNifty50: true,
        isFnO: fnOSet.size > 0 ? fnOSet.has(key) : true,
        basePrice: n50.basePrice,
        change: n50.change,
        changePct: n50.changePct
      });
    }

    if (catalog) {
      for (const f of catalog.futures) {
        const key = f.symbol.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          symbol: f.symbol,
          name: f.name,
          sector: f.category === 'INDEX_FUTURES' ? 'Index Futures' : 'Stock Futures',
          category: f.category,
          futuresRole: f.futuresRole,
          expiryLabel: f.expiryLabel,
          lotSize: f.lotSize,
          underlying: f.underlying,
          isFnO: true,
          basePrice: 0,
          change: 0,
          changePct: 0
        });
      }

      for (const idx of catalog.indices) {
        const key = idx.symbol.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          symbol: idx.symbol,
          name: idx.name,
          sector: 'NSE Index',
          category: 'INDEX',
          basePrice: 0,
          change: 0,
          changePct: 0
        });
      }

      for (const eq of catalog.equities) {
        const key = eq.symbol.toUpperCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          symbol: eq.symbol,
          name: eq.name,
          sector: eq.isFnO ? 'NSE F&O' : 'NSE Equity',
          category: 'EQUITY',
          isFnO: eq.isFnO,
          basePrice: 0,
          change: 0,
          changePct: 0
        });
      }
    }

    return items;
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isFuturesView =
      category === 'futures' || category === 'index_futures' || category === 'stock_futures';

    const matches = allItems.filter((item) => {
      if (category === 'nifty50' && !item.isNifty50) return false;
      if (category === 'fno_stocks' && !(item.category === 'EQUITY' && item.isFnO)) return false;
      if (category === 'stocks' && item.category !== 'EQUITY') return false;
      if (category === 'indices' && item.category !== 'INDEX') return false;
      if (category === 'index_futures' && item.category !== 'INDEX_FUTURES') return false;
      if (category === 'stock_futures' && item.category !== 'STOCK_FUTURES') return false;
      if (
        category === 'futures' &&
        item.category !== 'INDEX_FUTURES' &&
        item.category !== 'STOCK_FUTURES'
      ) {
        return false;
      }

      // Contract filter applies in Futures views or whenever explicitly set from All
      if (contractFilter !== 'ALL' && (isFuturesView || category === 'all')) {
        if (item.futuresRole !== contractFilter) return false;
      }

      if (!q) return true;
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.sector.toLowerCase().includes(q) ||
        (item.underlying && item.underlying.toLowerCase().includes(q)) ||
        (item.expiryLabel && item.expiryLabel.toLowerCase().includes(q)) ||
        (item.futuresRole && item.futuresRole.toLowerCase().includes(q))
      );
    });

    if (!q) {
      if (isFuturesView || contractFilter !== 'ALL') {
        return [...matches].sort((a, b) => {
          if (a.category !== b.category) {
            return a.category === 'INDEX_FUTURES' ? -1 : 1;
          }
          const uA = a.underlying || a.symbol;
          const uB = b.underlying || b.symbol;
          if (uA !== uB) return uA.localeCompare(uB);
          const rA = a.futuresRole ? ROLE_ORDER[a.futuresRole] : 9;
          const rB = b.futuresRole ? ROLE_ORDER[b.futuresRole] : 9;
          return rA - rB;
        });
      }
      return matches;
    }

    return [...matches].sort((a, b) => {
      const aSym = a.symbol.toLowerCase();
      const bSym = b.symbol.toLowerCase();
      const aUnd = (a.underlying || '').toLowerCase();
      const bUnd = (b.underlying || '').toLowerCase();

      const score = (sym: string, und: string, item: SearchCatalogItem): number => {
        if (sym === q) return 0;
        if (und === q && item.category === 'EQUITY') return 1;
        if (und === q) return 2;
        if (sym.startsWith(q)) return 3;
        if (item.name.toLowerCase().startsWith(q)) return 4;
        return 5;
      };

      const sA = score(aSym, aUnd, a);
      const sB = score(bSym, bUnd, b);
      if (sA !== sB) return sA - sB;

      if (aUnd && aUnd === bUnd) {
        const rA = a.futuresRole ? ROLE_ORDER[a.futuresRole] : 9;
        const rB = b.futuresRole ? ROLE_ORDER[b.futuresRole] : 9;
        if (rA !== rB) return rA - rB;
      }
      return aSym.localeCompare(bSym);
    });
  }, [allItems, category, contractFilter, query]);

  const visibleItems = useMemo(() => filtered.slice(0, 120), [filtered]);

  // On-demand quote hydration for top search hits missing live prices
  useEffect(() => {
    if (!isOpen || !onRequestQuotes || visibleItems.length === 0) return;
    const missing = visibleItems
      .slice(0, 35)
      .filter((item) => {
        const live = securityMap.get(item.symbol.toUpperCase());
        return !live || live.ltp <= 0;
      })
      .map((item) => item.symbol);

    if (missing.length === 0) return;
    const timer = setTimeout(() => {
      onRequestQuotes(missing);
    }, 220);
    return () => clearTimeout(timer);
  }, [isOpen, visibleItems, securityMap, onRequestQuotes]);

  if (!isOpen) return null;

  const getBadgeLabel = (item: SearchCatalogItem): string => {
    if (item.category === 'INDEX_FUTURES' || item.category === 'STOCK_FUTURES') {
      const role = item.futuresRole ? ROLE_BADGE_MAP[item.futuresRole]?.label : 'FUT';
      return item.expiryLabel ? `${role} · ${item.expiryLabel}` : role;
    }
    return item.sector || 'NSE';
  };

  const handleSelectItem = (item: SearchCatalogItem) => {
    const live = securityMap.get(item.symbol.toUpperCase());
    const price = live && live.ltp > 0 ? live.ltp : item.basePrice;
    onSelectSymbol(item.symbol, item.name, getBadgeLabel(item), price);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleItems[selectedIndex]) {
        handleSelectItem(visibleItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const isCashCategory =
    category === 'nifty50' ||
    category === 'fno_stocks' ||
    category === 'stocks' ||
    category === 'indices';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '70px',
        zIndex: 130
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '700px',
          maxWidth: '94vw',
          maxHeight: '560px',
          backgroundColor: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: '8px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Search Header */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderBottom: '1px solid #1a1a1a',
            backgroundColor: '#050505',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5F7A9A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search any NSE stock, index, or futures (e.g. RELIANCE, RELIANCE1!, NIFTY26NOVFUT)..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.86rem',
              outline: 'none',
              fontFamily: 'Quicksand, sans-serif'
            }}
          />
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#141414',
              border: '1px solid #262626',
              color: '#a3a3a3',
              fontSize: '0.66rem',
              padding: '2px 6px',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            ESC
          </button>
        </div>

        {/* Filter Categories + Futures Contract Month Dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '7px 1rem',
            borderBottom: '1px solid #141414',
            backgroundColor: '#080808'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', flex: 1 }}>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'nifty50', label: 'Nifty 50' },
                { id: 'fno_stocks', label: 'F&O Stocks' },
                { id: 'stocks', label: 'NSE Stocks' },
                { id: 'indices', label: 'Indices' },
                { id: 'index_futures', label: 'Index Futures' },
                { id: 'stock_futures', label: 'Stock Futures' },
                { id: 'futures', label: 'All Futures' }
              ] as { id: SearchCategory; label: string }[]
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.id);
                  setSelectedIndex(0);
                }}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.66rem',
                  borderRadius: '3px',
                  border: 'none',
                  backgroundColor: category === cat.id ? '#5F7A9A' : '#141414',
                  color: category === cat.id ? '#ffffff' : '#8a8a8a',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.12s ease'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <select
            value={isCashCategory ? 'ALL' : contractFilter}
            onChange={(e) => {
              const val = e.target.value as ContractFilter;
              setContractFilter(val);
              if (val !== 'ALL' && isCashCategory) {
                setCategory('futures');
              }
              setSelectedIndex(0);
            }}
            title="Filter Futures Contracts by Expiry Role"
            style={{
              backgroundColor: '#121212',
              color: contractFilter !== 'ALL' && !isCashCategory ? '#93c5fd' : '#CCCCCC',
              border: `1px solid ${contractFilter !== 'ALL' && !isCashCategory ? '#5F7A9A' : '#262626'}`,
              borderRadius: '3px',
              padding: '3px 7px',
              fontSize: '0.66rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Contracts: All</option>
            <option value="CONTINUOUS">Continuous (1!)</option>
            <option value="CURRENT">Current Month</option>
            <option value="NEXT">Next Month</option>
            <option value="FAR">Far Month</option>
          </select>
        </div>

        {/* Search Results List */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#000000' }}>
          {visibleItems.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#525252', fontSize: '0.78rem' }}>
              No instruments found matching "{query}"
            </div>
          ) : (
            visibleItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isActive = activeSymbol.toUpperCase() === item.symbol.toUpperCase();
              const live = securityMap.get(item.symbol.toUpperCase());
              const ltp = live && live.ltp > 0 ? live.ltp : item.basePrice;
              const change = live && live.ltp > 0 ? live.change : item.change;
              const changePct = live && live.ltp > 0 ? live.changePct : item.changePct;
              const isPositive = change >= 0;
              const roleMeta = item.futuresRole ? ROLE_BADGE_MAP[item.futuresRole] : null;

              return (
                <div
                  key={item.symbol}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '7px 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected
                      ? 'rgba(95, 122, 154, 0.18)'
                      : isActive
                      ? 'rgba(95, 122, 154, 0.08)'
                      : 'transparent',
                    borderBottom: '1px solid #121212',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#ffffff' }}>
                        {item.symbol}
                      </span>

                      {roleMeta && (
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            color: roleMeta.fg,
                            backgroundColor: roleMeta.bg,
                            padding: '1px 5px',
                            borderRadius: '2px',
                            border: `1px solid ${roleMeta.border}`
                          }}
                        >
                          {roleMeta.label}
                        </span>
                      )}

                      {item.expiryLabel && (
                        <span style={{ fontSize: '0.60rem', color: '#9ca3af', fontWeight: 600 }}>
                          {item.expiryLabel}
                        </span>
                      )}

                      {item.lotSize && item.lotSize > 1 && (
                        <span style={{ fontSize: '0.58rem', color: '#737373' }}>
                          Lot {item.lotSize}
                        </span>
                      )}

                      {!roleMeta && item.sector && (
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 600,
                            color: '#5F7A9A',
                            backgroundColor: 'rgba(95, 122, 154, 0.15)',
                            padding: '1px 5px',
                            borderRadius: '2px',
                            border: '1px solid rgba(95, 122, 154, 0.25)'
                          }}
                        >
                          {item.sector}
                        </span>
                      )}

                      {!roleMeta && item.category === 'EQUITY' && item.isFnO && !item.sector.includes('F&O') && (
                        <span
                          style={{
                            fontSize: '0.56rem',
                            fontWeight: 700,
                            color: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            padding: '1px 4px',
                            borderRadius: '2px'
                          }}
                        >
                          F&O
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        color: '#737373',
                        marginTop: '1px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.name}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff', fontFamily: 'Quicksand, sans-serif' }}>
                      {ltp > 0 ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </div>
                    {ltp > 0 ? (
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: isPositive ? '#10b981' : '#ef4444', fontFamily: 'Quicksand, sans-serif' }}>
                        {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.60rem', color: '#525252' }}>
                        {item.category === 'INDEX_FUTURES' || item.category === 'STOCK_FUTURES' ? 'FUT' : 'NSE'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '6px 1rem',
            borderTop: '1px solid #141414',
            backgroundColor: '#050505',
            fontSize: '0.64rem',
            color: '#525252',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Use ↑ ↓ keys to navigate · Enter to select</span>
          <span style={{ color: '#5F7A9A' }}>
            {filtered.length.toLocaleString()} matching · {allItems.length.toLocaleString()} instruments
          </span>
        </div>
      </div>
    </div>
  );
};
