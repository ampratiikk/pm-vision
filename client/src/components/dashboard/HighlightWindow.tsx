import React, { useState } from 'react';

export interface SecurityInfo {
  id: string;
  name: string;
  symbol: string;
  ltp: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  vwap: number;
  volume: string;
}

const DEFAULT_SECURITIES: SecurityInfo[] = [
  { id: 'nifty-spot', name: 'Nifty 50 Spot', symbol: 'NIFTY 50', ltp: 24700.80, change: +110.60, changePct: +0.45, high: 24740.00, low: 24590.20, open: 24650.00, vwap: 24682.40, volume: '14.2M' },
  { id: 'nifty-fut-1', name: 'Nifty Fut #1 (Current)', symbol: 'NIFTY FUT-I', ltp: 24785.40, change: +122.10, changePct: +0.50, high: 24820.00, low: 24670.00, open: 24720.00, vwap: 24760.10, volume: '8.4M' },
  { id: 'nifty-fut-2', name: 'Nifty Fut #2 (Next)', symbol: 'NIFTY FUT-II', ltp: 24860.20, change: +128.50, changePct: +0.52, high: 24895.00, low: 24740.00, open: 24800.00, vwap: 24835.00, volume: '1.2M' },
  { id: 'nifty-fut-3', name: 'Nifty Fut #3 (Far)', symbol: 'NIFTY FUT-III', ltp: 24945.00, change: +135.00, changePct: +0.54, high: 24980.00, low: 24820.00, open: 24880.00, vwap: 24915.00, volume: '220K' },
  { id: 'gift-nifty-1', name: 'Gift Nifty Fut #1', symbol: 'GIFT NIFTY', ltp: 24810.00, change: +145.00, changePct: +0.59, high: 24845.00, low: 24680.00, open: 24730.00, vwap: 24785.00, volume: '5.1M' }
];

interface HighlightWindowProps {
  onSelectSecurity?: (sec: SecurityInfo) => void;
  style?: React.CSSProperties;
}

export const HighlightWindow: React.FC<HighlightWindowProps> = ({ onSelectSecurity, style }) => {
  const [selectedId, setSelectedId] = useState<string>('nifty-fut-1');
  const current = DEFAULT_SECURITIES.find((s) => s.id === selectedId) || DEFAULT_SECURITIES[1];
  const spot = DEFAULT_SECURITIES[0];
  const basisPts = (current.ltp - spot.ltp).toFixed(2);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sec = DEFAULT_SECURITIES.find((s) => s.id === e.target.value);
    if (sec) {
      setSelectedId(sec.id);
      onSelectSecurity?.(sec);
    }
  };

  return (
    <div style={{
      backgroundColor: '#050505',
      border: '1px solid #1a1a1a',
      padding: '0.85rem 1rem',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      overflow: 'auto',
      ...style
    }}>
      {/* Header & Basket Dropdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#CCCCCC', fontWeight: 600 }}>
          HIGHLIGHT WINDOW
        </span>
        <select
          value={selectedId}
          onChange={handleSelect}
          style={{
            backgroundColor: '#0a0a0a',
            color: '#e5e7eb',
            border: '1px solid #262626',
            borderRadius: '4px',
            fontSize: '0.75rem',
            padding: '2px 6px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {DEFAULT_SECURITIES.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Main Quote */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>
            {current.ltp.toFixed(2)}
          </span>
          <span style={{
            marginLeft: '0.5rem',
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            color: current.change >= 0 ? '#d1d5db' : '#9ca3af'
          }}>
            {current.change >= 0 ? '+' : ''}{current.change.toFixed(2)} ({current.changePct >= 0 ? '+' : ''}{current.changePct.toFixed(2)}%)
          </span>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#CCCCCC', textAlign: 'right' }}>
          Basis (Fut - Spot): <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>+{basisPts}</span>
        </div>
      </div>

      {/* Grid Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.5rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid #141414',
        fontSize: '0.72rem'
      }}>
        <div>
          <div style={{ color: '#CCCCCC' }}>HIGH</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff' }}>{current.high.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ color: '#CCCCCC' }}>LOW</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff' }}>{current.low.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ color: '#CCCCCC' }}>VWAP</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff' }}>{current.vwap.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ color: '#CCCCCC' }}>VOL</div>
          <div style={{ fontFamily: 'monospace', color: '#ffffff' }}>{current.volume}</div>
        </div>
      </div>
    </div>
  );
};
