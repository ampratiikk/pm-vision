import React, { useState } from 'react';
import { BasisSpreadPair } from '@pm-vision/shared';

export type { BasisSpreadPair };

export const DEFAULT_PAIRS: BasisSpreadPair[] = [
  {
    id: 'nifty-fut1',
    name: 'Nifty ↔ Nifty Fut #1',
    leg1: 'NIFTY SPOT',
    leg2: 'NIFTY FUT-I',
    price1: 24700.80,
    price2: 24785.40,
    spread: 84.60,
    spreadPct: 0.34,
    annualizedYield: 7.42,
    isDefault: true
  },
  {
    id: 'fut1-fut2',
    name: 'Nifty Fut #1 ↔ Nifty Fut #2',
    leg1: 'NIFTY FUT-I',
    leg2: 'NIFTY FUT-II',
    price1: 24785.40,
    price2: 24860.20,
    spread: 74.80,
    spreadPct: 0.30,
    annualizedYield: 7.15
  },
  {
    id: 'fut2-fut3',
    name: 'Nifty Fut #2 ↔ Nifty Fut #3',
    leg1: 'NIFTY FUT-II',
    leg2: 'NIFTY FUT-III',
    price1: 24860.20,
    price2: 24945.00,
    spread: 84.80,
    spreadPct: 0.34,
    annualizedYield: 7.20
  },
  {
    id: 'fut1-fut3',
    name: 'Nifty Fut #1 ↔ Nifty Fut #3',
    leg1: 'NIFTY FUT-I',
    leg2: 'NIFTY FUT-III',
    price1: 24785.40,
    price2: 24945.00,
    spread: 159.60,
    spreadPct: 0.64,
    annualizedYield: 7.18
  }
];

interface BasisSpreadWidgetProps {
  pairs?: BasisSpreadPair[];
  onSelectPair?: (pair: BasisSpreadPair) => void;
  style?: React.CSSProperties;
}

export const BasisSpreadWidget: React.FC<BasisSpreadWidgetProps> = ({
  pairs = DEFAULT_PAIRS,
  onSelectPair,
  style
}) => {
  const [selectedPairId, setSelectedPairId] = useState<string>('nifty-fut1');

  const activePairs = pairs && pairs.length > 0 ? pairs : DEFAULT_PAIRS;
  const selectedPair = activePairs.find((p) => p.id === selectedPairId) || activePairs[0];

  const handleSelect = (pair: BasisSpreadPair) => {
    setSelectedPairId(pair.id);
    onSelectPair?.(pair);
  };

  return (
    <div style={{
      backgroundColor: '#050505',
      border: '1px solid #1a1a1a',
      borderRadius: '4px',
      padding: '0.85rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.65rem',
      overflow: 'auto',
      ...style
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#CCCCCC', fontWeight: 600 }}>
            BASIS SPREAD
          </span>
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 4px #10b981'
          }} />
        </div>
        <span style={{
          fontSize: '0.65rem',
          color: '#5F7A9A',
          backgroundColor: 'rgba(95, 122, 154, 0.12)',
          padding: '1px 6px',
          borderRadius: '2px',
          border: '1px solid rgba(95, 122, 154, 0.35)',
          fontWeight: 600
        }}>
          ACTIVE: {selectedPair.name}
        </span>
      </div>

      {/* Selected Pair Detail Card */}
      <div style={{
        backgroundColor: '#0a0a0a',
        border: '1px solid #1f1f1f',
        borderRadius: '3px',
        padding: '0.6rem 0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#CCCCCC' }}>{selectedPair.name}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>
            {selectedPair.spread >= 0 ? '+' : ''}{selectedPair.spread.toFixed(2)} pts
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#CCCCCC' }}>
          <div>Premium: <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>+{selectedPair.spreadPct.toFixed(2)}%</span></div>
          <div>Ann. Yield: <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>{selectedPair.annualizedYield.toFixed(2)}%</span></div>
        </div>
      </div>

      {/* Compact Spread Table of All 5 Pairs */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        fontSize: '0.72rem'
      }}>
        {activePairs.map((pair) => {
          const isSelected = pair.id === selectedPairId;
          return (
            <div
              key={pair.id}
              onClick={() => handleSelect(pair)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 6px',
                borderRadius: '2px',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(95, 122, 154, 0.15)' : 'transparent',
                borderLeft: isSelected ? '2px solid #5F7A9A' : '2px solid transparent',
                transition: 'background-color 0.15s ease'
              }}
            >
              <span style={{ color: isSelected ? '#ffffff' : '#CCCCCC' }}>
                {pair.name}
                {pair.isDefault && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#5F7A9A' }}>(Default)</span>}
              </span>
              <span style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: isSelected ? 600 : 400 }}>
                {pair.spread >= 0 ? '+' : ''}{pair.spread.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
