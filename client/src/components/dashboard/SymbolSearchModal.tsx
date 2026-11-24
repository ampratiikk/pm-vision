import React, { useState, useEffect, useRef } from 'react';
import { NIFTY_50_CONSTITUENTS, NIFTY_INDICES, WatchlistItem } from './watchlistData';

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string, name: string, sector: string, basePrice: number) => void;
  activeSymbol?: string;
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
  activeSymbol = 'NIFTY 50'
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'stocks' | 'indices'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Prepare all searchable symbols
  const allItems: WatchlistItem[] = [
    ...NIFTY_INDICES.map((i) => ({ ...i, sector: 'Index' })),
    ...NIFTY_50_CONSTITUENTS
  ];

  const filtered = allItems.filter((item) => {
    const matchesQuery =
      item.symbol.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      (item.sector && item.sector.toLowerCase().includes(query.toLowerCase()));

    if (!matchesQuery) return false;
    if (category === 'stocks') return !item.isIndex;
    if (category === 'indices') return !!item.isIndex;
    return true;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        const item = filtered[selectedIndex];
        onSelectSymbol(item.symbol, item.name, item.sector || (item.isIndex ? 'Index' : 'Stock'), item.basePrice);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        zIndex: 130
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '520px',
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
            placeholder="Search stock, index or sector (e.g. RELIANCE, TCS, BANK, IT)..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.88rem',
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

        {/* Filter Categories */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '6px 1rem',
            borderBottom: '1px solid #141414',
            backgroundColor: '#080808'
          }}
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'stocks', label: 'Nifty 50 Stocks' },
            { id: 'indices', label: 'Indices & GIFT' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setCategory(cat.id as any);
                setSelectedIndex(0);
              }}
              style={{
                padding: '3px 10px',
                fontSize: '0.68rem',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: category === cat.id ? '#5F7A9A' : '#141414',
                color: category === cat.id ? '#ffffff' : '#737373',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.12s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Results List */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#000000' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#525252', fontSize: '0.78rem' }}>
              No symbols found matching "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isActive = activeSymbol.toUpperCase() === item.symbol.toUpperCase();
              const isPositive = item.change >= 0;

              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item.symbol, item.name, item.sector || (item.isIndex ? 'Index' : 'Stock'), item.basePrice);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '8px 1rem',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#ffffff' }}>
                          {item.symbol}
                        </span>
                        {item.sector && (
                          <span
                            style={{
                              fontSize: '0.60rem',
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
                        {item.isGiftNifty && (
                          <span
                            style={{
                              fontSize: '0.60rem',
                              fontWeight: 700,
                              color: '#10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              padding: '1px 5px',
                              borderRadius: '2px'
                            }}
                          >
                            NSE IX
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.66rem', color: '#737373', marginTop: '1px' }}>
                        {item.name}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff' }}>
                      {item.basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: isPositive ? '#10b981' : '#ef4444' }}>
                      {isPositive ? '+' : ''}{item.change.toFixed(2)} ({isPositive ? '+' : ''}{item.changePct.toFixed(2)}%)
                    </div>
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
          <span style={{ color: '#5F7A9A' }}>50 Constituents + Indices</span>
        </div>
      </div>
    </div>
  );
};
