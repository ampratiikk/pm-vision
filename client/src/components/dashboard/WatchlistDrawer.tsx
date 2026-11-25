import React, { useState, useMemo, useEffect } from 'react';
import { SecurityQuote } from '@pm-vision/shared';
import {
  WatchlistItem,
  NIFTY_50_CONSTITUENTS,
  NIFTY_INDICES,
  ALL_SECTORS
} from './watchlistData';

export type WatchlistMode = 'docked' | 'fullscreen';

interface WatchlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: WatchlistMode;
  onChangeMode: (mode: WatchlistMode) => void;
  securities?: SecurityQuote[];
  activeSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  highlightSymbols?: string[];
  onToggleHighlightSymbol?: (symbol: string) => void;
}

export const WatchlistDrawer: React.FC<WatchlistDrawerProps> = ({
  isOpen,
  onClose,
  mode: _mode,
  onChangeMode: _onChangeMode,
  securities = [],
  activeSymbol = 'NIFTY 50',
  onSelectSymbol,
  highlightSymbols = [],
  onToggleHighlightSymbol
}) => {
  const [activeTab, setActiveTab] = useState<'nifty50' | 'indices'>('nifty50');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({});

  // Context menu for right-clicking any watchlist item
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: WatchlistItem | null;
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

  // Sync quotes with live securities stream from WebSocket
  const securityMap = useMemo(() => {
    const map = new Map<string, SecurityQuote>();
    for (const s of securities) {
      map.set(s.symbol.toUpperCase(), s);
    }
    return map;
  }, [securities]);

  if (!isOpen) return null;

  const toggleSector = (sec: string) => {
    setCollapsedSectors((prev) => ({
      ...prev,
      [sec]: !prev[sec]
    }));
  };

  // Filtered Nifty 50 items
  const filteredNifty50 = NIFTY_50_CONSTITUENTS.filter((item) => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector =
      selectedSector === 'All Sectors' || item.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  // Group by sector
  const groupedNifty50 = useMemo(() => {
    const map = new Map<string, WatchlistItem[]>();
    for (const item of filteredNifty50) {
      const sec = item.sector || 'Other';
      const list = map.get(sec) || [];
      list.push(item);
      map.set(sec, list);
    }
    return map;
  }, [filteredNifty50]);

  // Filtered Indices (clean list without gift nifty)
  const filteredIndices = NIFTY_INDICES.filter((item) => {
    return (
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getItemLtp = (item: WatchlistItem): { ltp: number; change: number; changePct: number } => {
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

  const handleItemContextMenu = (e: React.MouseEvent, item: WatchlistItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  // Inline docked panel style (non-overlay, sits cleanly beside the chart canvas)
  const getContainerStyle = (): React.CSSProperties => {
    return {
      backgroundColor: '#0a0a0a',
      color: '#e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Quicksand, sans-serif',
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden'
    };
  };

  return (
    <div style={getContainerStyle()}>
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
            {activeTab === 'nifty50' ? 'NIFTY 50' : 'INDICES'}
          </span>
        </div>

        {/* Close Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

          {/* Close Button */}
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
      </div>

      {/* Tabs: NIFTY 50 vs NIFTY INDICES */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#080808',
          flexShrink: 0
        }}
      >
        <button
          onClick={() => setActiveTab('nifty50')}
          style={{
            flex: 1,
            padding: '7px 0',
            fontSize: '0.74rem',
            fontWeight: activeTab === 'nifty50' ? 700 : 500,
            color: activeTab === 'nifty50' ? '#5F7A9A' : '#737373',
            backgroundColor: activeTab === 'nifty50' ? '#0d0d0d' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'nifty50' ? '2px solid #5F7A9A' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          NIFTY 50 (50 Stocks)
        </button>

        <button
          onClick={() => setActiveTab('indices')}
          style={{
            flex: 1,
            padding: '7px 0',
            fontSize: '0.74rem',
            fontWeight: activeTab === 'indices' ? 700 : 500,
            color: activeTab === 'indices' ? '#5F7A9A' : '#737373',
            backgroundColor: activeTab === 'indices' ? '#0d0d0d' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'indices' ? '2px solid #5F7A9A' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          NIFTY INDICES
        </button>
      </div>

      {/* Search Bar & Sector Filter (Sector filter visible on Tab 1) */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #171717',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          backgroundColor: '#0a0a0a',
          flexShrink: 0
        }}
      >
        {/* Search Input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'nifty50' ? 'Filter stocks...' : 'Filter indices...'}
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

        {/* Sector Filter Dropdown for Tab 1 */}
        {activeTab === 'nifty50' && (
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
              maxWidth: '120px'
            }}
          >
            {ALL_SECTORS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main List Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'nifty50' ? (
          /* TAB 1: NIFTY 50 CATEGORIZED BY SECTORS */
          <div>
            {Array.from(groupedNifty50.entries()).map(([sectorName, items]) => {
              const isCollapsed = collapsedSectors[sectorName];

              return (
                <div key={sectorName} style={{ borderBottom: '1px solid #141414' }}>
                  {/* Sector Header (Click to collapse/expand) */}
                  <div
                    onClick={() => toggleSector(sectorName)}
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
                      <span style={{ fontSize: '0.60rem', color: '#5F7A9A', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                        ▼
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.02em' }}>
                        {sectorName.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.60rem', color: '#525252' }}>
                        ({items.length})
                      </span>
                    </div>
                  </div>

                  {/* Sector Constituents */}
                  {!isCollapsed && (
                    <div>
                      {items.map((item) => {
                        const { ltp, change, changePct } = getItemLtp(item);
                        const isPositive = change >= 0;
                        const isSelected = activeSymbol === item.symbol;
                        const isHighlighted = highlightSymbols.some((s) => s.toUpperCase() === item.symbol.toUpperCase());

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
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ffffff' }}>
                                  {item.symbol}
                                </span>
                                {item.weight && (
                                  <span style={{ fontSize: '0.58rem', color: '#525252' }}>
                                    {item.weight.toFixed(1)}%
                                  </span>
                                )}
                                {isHighlighted && (
                                  <span
                                    title="In Highlight Window"
                                    style={{
                                      fontSize: '0.56rem',
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
                                  fontSize: '0.64rem',
                                  color: '#737373',
                                  maxWidth: '180px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.name}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#ffffff' }}>
                                {ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.64rem',
                                  fontWeight: 600,
                                  color: isPositive ? '#10b981' : '#ef4444'
                                }}
                              >
                                {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* TAB 2: NIFTY INDICES */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredIndices.map((item) => {
              const { ltp, change, changePct } = getItemLtp(item);
              const isPositive = change >= 0;
              const isSelected = activeSymbol === item.symbol;
              const isHighlighted = highlightSymbols.some((s) => s.toUpperCase() === item.symbol.toUpperCase());

              return (
                <div
                  key={item.symbol}
                  onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
                  onContextMenu={(e) => handleItemContextMenu(e, item)}
                  title="Click to open chart · Right click for options"
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? 'rgba(95, 122, 154, 0.12)' : 'transparent',
                    borderBottom: '1px solid #141414',
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
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ffffff' }}>
                        {item.symbol}
                      </span>
                      <span
                        style={{
                          fontSize: '0.58rem',
                          color: '#5F7A9A',
                          backgroundColor: 'rgba(95, 122, 154, 0.15)',
                          padding: '1px 4px',
                          borderRadius: '2px'
                        }}
                      >
                        INDEX
                      </span>
                      {isHighlighted && (
                        <span
                          title="In Highlight Window"
                          style={{
                            fontSize: '0.56rem',
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
                    <div style={{ fontSize: '0.64rem', color: '#737373', marginTop: '2px' }}>
                      {item.name}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#ffffff' }}>
                      {ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: isPositive ? '#10b981' : '#ef4444'
                      }}
                    >
                      {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              );
            })}
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
            minWidth: '180px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with symbol name */}
          <div style={{ padding: '4px 12px', fontSize: '0.66rem', color: '#737373', borderBottom: '1px solid #1a1a1a', fontWeight: 700 }}>
            {contextMenu.item.symbol}
          </div>

          {/* Option 1: Open Chart */}
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

          {/* Option 2: Add to / Remove from Highlight Window */}
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
            <span style={{ fontSize: '0.80rem' }}>★</span>
            <span>
              {contextMenu.item && highlightSymbols.some((s) => s.toUpperCase() === contextMenu.item!.symbol.toUpperCase())
                ? 'Remove from Highlight'
                : 'Add to Highlight Window'}
            </span>
          </div>

          <div style={{ height: '1px', backgroundColor: '#1a1a1a', margin: '4px 0' }} />

          {/* Option 3: Copy Symbol Name */}
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
          {activeTab === 'nifty50'
            ? `${filteredNifty50.length} stocks across ${groupedNifty50.size} sectors`
            : `${filteredIndices.length} indices`}
        </span>
        <span style={{ color: '#5F7A9A' }}>Right-click for options</span>
      </div>
    </div>
  );
};
