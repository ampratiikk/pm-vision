import React, { useState, useMemo } from 'react';
import { SecurityQuote, isGiftNiftyMarketOpen, getGiftNiftySessionInfo } from '@pm-vision/shared';
import {
  WatchlistItem,
  NIFTY_50_CONSTITUENTS,
  NIFTY_INDICES,
  ALL_SECTORS
} from './watchlistData';

export type WatchlistMode = 'overlay' | 'docked' | 'fullscreen';

interface WatchlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: WatchlistMode;
  onChangeMode: (mode: WatchlistMode) => void;
  securities?: SecurityQuote[];
  activeSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
}

export const WatchlistDrawer: React.FC<WatchlistDrawerProps> = ({
  isOpen,
  onClose,
  mode,
  onChangeMode,
  securities = [],
  activeSymbol = 'NIFTY 50',
  onSelectSymbol
}) => {
  const [activeTab, setActiveTab] = useState<'nifty50' | 'indices'>('nifty50');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({});

  // Sync quotes with live securities stream from WebSocket
  const securityMap = useMemo(() => {
    const map = new Map<string, SecurityQuote>();
    for (const s of securities) {
      map.set(s.symbol.toUpperCase(), s);
    }
    return map;
  }, [securities]);

  const giftNiftySession = useMemo(() => getGiftNiftySessionInfo(), []);
  const isGiftLive = useMemo(() => isGiftNiftyMarketOpen(), []);

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

  // Filtered Indices
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

  // Outer container styles based on active mode
  const getContainerStyle = (): React.CSSProperties => {
    if (mode === 'fullscreen') {
      return {
        position: 'absolute',
        inset: 0,
        zIndex: 85,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };
    }

    if (mode === 'overlay') {
      return {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '380px',
        maxWidth: '90vw',
        zIndex: 50,
        backgroundColor: '#050505',
        borderLeft: '1px solid #262626',
        boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };
    }

    // Docked mode: fits directly into the layout column
    return {
      width: '100%',
      height: '100%',
      backgroundColor: '#050505',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    };
  };

  return (
    <div style={getContainerStyle()}>
      {/* Header Bar */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#080808',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '2px',
              backgroundColor: 'rgba(95, 122, 154, 0.15)',
              color: '#5F7A9A',
              border: '1px solid rgba(95, 122, 154, 0.3)',
              textTransform: 'uppercase'
            }}
          >
            {mode}
          </span>
        </div>

        {/* Action Controls: Fit into Dashboard, Full Size, Back to Slider, Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Fit into Dashboard Button (dock) */}
          {mode !== 'docked' && (
            <button
              onClick={() => onChangeMode('docked')}
              title="Fit into Main Dashboard layout"
              style={{
                padding: '3px 8px',
                fontSize: '0.66rem',
                backgroundColor: '#141414',
                border: '1px solid #262626',
                color: '#a3a3a3',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Fit in Dashboard
            </button>
          )}

          {/* Full Size / Maximize Button */}
          {mode !== 'fullscreen' && (
            <button
              onClick={() => onChangeMode('fullscreen')}
              title="Full size the watchlist"
              style={{
                padding: '3px 8px',
                fontSize: '0.66rem',
                backgroundColor: '#141414',
                border: '1px solid #262626',
                color: '#a3a3a3',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Full Size
            </button>
          )}

          {/* Back to Slider / Fly-over Button (shown in docked or fullscreen) */}
          {mode !== 'overlay' && (
            <button
              onClick={() => onChangeMode('overlay')}
              title="Return to Slider fly-over view"
              style={{
                padding: '3px 8px',
                fontSize: '0.66rem',
                backgroundColor: 'rgba(95, 122, 154, 0.2)',
                border: '1px solid #5F7A9A',
                color: '#ffffff',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Slider View
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            title="Close Watchlist"
            style={{
              padding: '2px 7px',
              fontSize: '1rem',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a3a3a3',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Navigation Tabs: NIFTY 50 vs NIFTY INDICES */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#050505',
          flexShrink: 0
        }}
      >
        <button
          onClick={() => setActiveTab('nifty50')}
          style={{
            flex: 1,
            padding: '7px 0',
            fontSize: '0.70rem',
            fontWeight: activeTab === 'nifty50' ? 700 : 500,
            color: activeTab === 'nifty50' ? '#ffffff' : '#737373',
            backgroundColor: activeTab === 'nifty50' ? '#0f0f0f' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'nifty50' ? '2px solid #5F7A9A' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          NIFTY 50 ({NIFTY_50_CONSTITUENTS.length})
        </button>

        <button
          onClick={() => setActiveTab('indices')}
          style={{
            flex: 1,
            padding: '7px 0',
            fontSize: '0.70rem',
            fontWeight: activeTab === 'indices' ? 700 : 500,
            color: activeTab === 'indices' ? '#ffffff' : '#737373',
            backgroundColor: activeTab === 'indices' ? '#0f0f0f' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'indices' ? '2px solid #5F7A9A' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>NIFTY INDICES ({NIFTY_INDICES.length})</span>
          {isGiftLive && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 5px #10b981'
              }}
              title="GIFT NIFTY Live Session Active"
            />
          )}
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div
        style={{
          padding: '0.65rem 0.85rem',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#080808',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0
        }}
      >
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={
            activeTab === 'nifty50'
              ? 'Search 50 constituents (e.g. RELIANCE, TCS)...'
              : 'Search indices (e.g. GIFT NIFTY, BANK)...'
          }
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#121212',
            border: '1px solid #262626',
            borderRadius: '3px',
            color: '#ffffff',
            fontSize: '0.72rem',
            padding: '5px 8px',
            outline: 'none'
          }}
        />

        {/* Sector dropdown when on Nifty 50 tab */}
        {activeTab === 'nifty50' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
            <span style={{ color: '#737373' }}>Filter Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              style={{
                backgroundColor: '#121212',
                border: '1px solid #262626',
                color: '#ffffff',
                fontSize: '0.68rem',
                padding: '3px 6px',
                borderRadius: '3px',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '180px'
              }}
            >
              {ALL_SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#000000' }}>
        {activeTab === 'nifty50' ? (
          /* TAB 1: NIFTY 50 CATEGORIZED BY SECTORS */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from(groupedNifty50.entries()).map(([sectorName, items]) => {
              const isCollapsed = collapsedSectors[sectorName];
              return (
                <div key={sectorName} style={{ borderBottom: '1px solid #141414' }}>
                  {/* Sector Header Accordion */}
                  <div
                    onClick={() => toggleSector(sectorName)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#0a0a0a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderBottom: isCollapsed ? 'none' : '1px solid #171717'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.62rem', color: '#5F7A9A', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease' }}>
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

                        return (
                          <div
                            key={item.symbol}
                            onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
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
          /* TAB 2: NIFTY INDICES (INCLUDING GIFT NIFTY) */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredIndices.map((item) => {
              const { ltp, change, changePct } = getItemLtp(item);
              const isPositive = change >= 0;
              const isSelected = activeSymbol === item.symbol;
              const isGift = item.isGiftNifty;

              return (
                <div
                  key={item.symbol}
                  onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isGift
                      ? 'rgba(95, 122, 154, 0.08)'
                      : isSelected
                      ? 'rgba(95, 122, 154, 0.12)'
                      : 'transparent',
                    borderBottom: '1px solid #141414',
                    borderLeft: isGift ? '3px solid #5F7A9A' : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ffffff' }}>
                        {item.symbol}
                      </span>
                      {isGift ? (
                        <span
                          style={{
                            fontSize: '0.60rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '2px',
                            backgroundColor: isGiftLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                            color: isGiftLive ? '#10b981' : '#ef4444',
                            border: `1px solid ${isGiftLive ? '#10b981' : '#ef4444'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span
                            style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              backgroundColor: isGiftLive ? '#10b981' : '#ef4444'
                            }}
                          />
                          {giftNiftySession.label}
                        </span>
                      ) : (
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
            ? `${filteredNifty50.length} stocks across 10 sectors`
            : `${filteredIndices.length} indices | GIFT NIFTY active`}
        </span>
        <span style={{ color: '#5F7A9A' }}>PM Vision</span>
      </div>
    </div>
  );
};
