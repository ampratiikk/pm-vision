import React, { useState, useEffect } from 'react';
import { IndicatorConfig } from './types';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicators: IndicatorConfig[];
  onUpdateIndicators: (indicators: IndicatorConfig[]) => void;
  onResetIndicators: () => void;
  initialIndicatorId?: string | null;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  isOpen,
  onClose,
  indicators,
  onUpdateIndicators,
  onResetIndicators,
  initialIndicatorId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialIndicatorId) {
      setExpandedId(initialIndicatorId);
    }
  }, [isOpen, initialIndicatorId]);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    const next = indicators.map((ind) =>
      ind.id === id ? { ...ind, enabled: !ind.enabled, visible: ind.enabled ? ind.visible : true } : ind
    );
    onUpdateIndicators(next);
  };

  const handleUpdateOptions = (id: string, options: Partial<IndicatorConfig['options']>) => {
    const next = indicators.map((ind) =>
      ind.id === id ? { ...ind, options: { ...ind.options, ...options } } : ind
    );
    onUpdateIndicators(next);
  };

  const handleUpdateColor = (id: string, color: string) => {
    const next = indicators.map((ind) =>
      ind.id === id ? { ...ind, color } : ind
    );
    onUpdateIndicators(next);
  };

  const filtered = indicators.filter(
    (ind) =>
      ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ind.shortName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '520px',
          maxHeight: '80vh',
          backgroundColor: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: '8px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#050505'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.04em'
              }}
            >
              CHART INDICATORS & OVERLAYS
            </span>
            <div style={{ fontSize: '0.68rem', color: '#737373', marginTop: '2px' }}>
              Select technical studies to overlay on the candlestick chart
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a3a3a3',
              fontSize: '1.25rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px',
              borderRadius: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #1a1a1a', backgroundColor: '#050505' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search indicators (e.g. OR 1H, VWAP, EMA, Volume)..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#121212',
              border: '1px solid #262626',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '0.75rem',
              padding: '7px 10px',
              outline: 'none'
            }}
          />
        </div>

        {/* Indicator List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filtered.map((ind) => {
            const isExpanded = expandedId === ind.id;
            return (
              <div
                key={ind.id}
                style={{
                  backgroundColor: ind.enabled ? 'rgba(95, 122, 154, 0.08)' : '#0d0d0d',
                  border: `1px solid ${ind.enabled ? '#5F7A9A' : '#1f1f1f'}`,
                  borderRadius: '6px',
                  padding: '0.75rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={ind.enabled}
                      onChange={() => handleToggle(ind.id)}
                      style={{ cursor: 'pointer', accentColor: '#5F7A9A', width: '15px', height: '15px' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff' }}>
                          {ind.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(95, 122, 154, 0.2)',
                            color: '#5F7A9A',
                            border: '1px solid rgba(95, 122, 154, 0.3)'
                          }}
                        >
                          {ind.shortName}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.67rem', color: '#737373', marginTop: '2px' }}>
                        {ind.type === 'OR' &&
                          `Opening Range Breakout channel (${ind.options.durationMinutes || 60}m duration)`}
                        {ind.type === 'VWAP' && 'Intraday benchmark volume-weighted average price'}
                        {ind.type === 'EMA' &&
                          `Exponential Moving Average (${ind.options.period || 20} periods)`}
                        {ind.type === 'SMA' &&
                          `Simple Moving Average (${ind.options.period || 50} periods)`}
                        {ind.type === 'VOLUME' && 'Color-coded trading volume histogram overlay'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ind.id)}
                      title="Configure indicator settings"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.66rem',
                        backgroundColor: isExpanded ? 'rgba(95, 122, 154, 0.2)' : '#171717',
                        border: '1px solid #262626',
                        color: isExpanded ? '#5F7A9A' : '#a3a3a3',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </div>

                {/* Expanded Settings Panel */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid #1f1f1f',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}
                  >
                    {/* OR Indicator Settings */}
                    {ind.type === 'OR' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Opening Duration:</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[15, 30, 60, 120].map((dur) => (
                              <button
                                key={dur}
                                onClick={() => handleUpdateOptions(ind.id, { durationMinutes: dur })}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.66rem',
                                  borderRadius: '3px',
                                  backgroundColor:
                                    (ind.options.durationMinutes || 60) === dur
                                      ? '#5F7A9A'
                                      : '#141414',
                                  color: (ind.options.durationMinutes || 60) === dur ? '#ffffff' : '#a3a3a3',
                                  border: '1px solid #262626',
                                  cursor: 'pointer'
                                }}
                              >
                                {dur >= 60 ? `${dur / 60}H` : `${dur}m`}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>OR High Color:</span>
                          <input
                            type="color"
                            value={ind.options.highColor || '#38bdf8'}
                            onChange={(e) => handleUpdateOptions(ind.id, { highColor: e.target.value })}
                            style={{
                              width: '28px',
                              height: '22px',
                              backgroundColor: 'transparent',
                              border: '1px solid #262626',
                              cursor: 'pointer',
                              borderRadius: '2px'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>OR Low Color:</span>
                          <input
                            type="color"
                            value={ind.options.lowColor || '#38bdf8'}
                            onChange={(e) => handleUpdateOptions(ind.id, { lowColor: e.target.value })}
                            style={{
                              width: '28px',
                              height: '22px',
                              backgroundColor: 'transparent',
                              border: '1px solid #262626',
                              cursor: 'pointer',
                              borderRadius: '2px'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Show Midpoint Level:</span>
                          <input
                            type="checkbox"
                            checked={ind.options.showMid !== false}
                            onChange={(e) => handleUpdateOptions(ind.id, { showMid: e.target.checked })}
                            style={{ accentColor: '#5F7A9A', cursor: 'pointer' }}
                          />
                        </div>
                      </>
                    )}

                    {/* EMA / SMA Settings */}
                    {(ind.type === 'EMA' || ind.type === 'SMA') && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Period:</span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {[9, 20, 50, 200].map((p) => (
                              <button
                                key={p}
                                onClick={() => handleUpdateOptions(ind.id, { period: p })}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '0.66rem',
                                  borderRadius: '3px',
                                  backgroundColor:
                                    (ind.options.period || 20) === p ? '#5F7A9A' : '#141414',
                                  color: (ind.options.period || 20) === p ? '#ffffff' : '#a3a3a3',
                                  border: '1px solid #262626',
                                  cursor: 'pointer'
                                }}
                              >
                                {p}
                              </button>
                            ))}
                            <input
                              type="number"
                              min="2"
                              max="500"
                              value={ind.options.period || (ind.type === 'EMA' ? 20 : 50)}
                              onChange={(e) =>
                                handleUpdateOptions(ind.id, { period: parseInt(e.target.value) || 20 })
                              }
                              style={{
                                width: '45px',
                                backgroundColor: '#141414',
                                border: '1px solid #262626',
                                color: '#ffffff',
                                fontSize: '0.70rem',
                                padding: '2px 4px',
                                borderRadius: '2px',
                                outline: 'none'
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Line Color:</span>
                          <input
                            type="color"
                            value={ind.color}
                            onChange={(e) => handleUpdateColor(ind.id, e.target.value)}
                            style={{
                              width: '28px',
                              height: '22px',
                              backgroundColor: 'transparent',
                              border: '1px solid #262626',
                              cursor: 'pointer',
                              borderRadius: '2px'
                            }}
                          />
                        </div>
                      </>
                    )}

                    {/* VWAP Settings */}
                    {ind.type === 'VWAP' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Session Specific:</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={ind.options.sessionSpecific !== false}
                              onChange={(e) => handleUpdateOptions(ind.id, { sessionSpecific: e.target.checked })}
                              style={{ accentColor: '#5F7A9A', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.68rem', color: '#e5e7eb' }}>
                              Reset daily at 09:15 AM IST
                            </span>
                          </label>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Line Color:</span>
                          <input
                            type="color"
                            value={ind.color}
                            onChange={(e) => handleUpdateColor(ind.id, e.target.value)}
                            style={{
                              width: '28px',
                              height: '22px',
                              backgroundColor: 'transparent',
                              border: '1px solid #262626',
                              cursor: 'pointer',
                              borderRadius: '2px'
                            }}
                          />
                        </div>
                      </>
                    )}

                    {/* Volume Overlay Settings */}
                    {ind.type === 'VOLUME' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Display Style:</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => handleUpdateOptions(ind.id, { volumeStyle: 'area' })}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.66rem',
                                borderRadius: '3px',
                                backgroundColor: (ind.options.volumeStyle || 'area') === 'area' ? '#5F7A9A' : '#141414',
                                color: (ind.options.volumeStyle || 'area') === 'area' ? '#ffffff' : '#a3a3a3',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                                fontWeight: (ind.options.volumeStyle || 'area') === 'area' ? 600 : 400
                              }}
                            >
                              Area Chart (Default)
                            </button>
                            <button
                              onClick={() => handleUpdateOptions(ind.id, { volumeStyle: 'bar' })}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.66rem',
                                borderRadius: '3px',
                                backgroundColor: ind.options.volumeStyle === 'bar' ? '#5F7A9A' : '#141414',
                                color: ind.options.volumeStyle === 'bar' ? '#ffffff' : '#a3a3a3',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                                fontWeight: ind.options.volumeStyle === 'bar' ? 600 : 400
                              }}
                            >
                              Bar Chart (Histogram)
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.70rem', color: '#a3a3a3' }}>Volume Color:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="color"
                              value={ind.options.volumeColor || ind.color || '#808080'}
                              onChange={(e) => {
                                handleUpdateOptions(ind.id, { volumeColor: e.target.value });
                                handleUpdateColor(ind.id, e.target.value);
                              }}
                              style={{
                                width: '28px',
                                height: '22px',
                                backgroundColor: 'transparent',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                                borderRadius: '2px'
                              }}
                            />
                            <span style={{ fontSize: '0.68rem', color: '#e5e7eb' }}>
                              {ind.options.volumeColor || ind.color || '#808080'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #1a1a1a',
            backgroundColor: '#050505',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            onClick={onResetIndicators}
            style={{
              padding: '5px 12px',
              fontSize: '0.70rem',
              backgroundColor: '#171717',
              border: '1px solid #262626',
              color: '#a3a3a3',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '5px 16px',
              fontSize: '0.72rem',
              backgroundColor: '#5F7A9A',
              border: 'none',
              color: '#ffffff',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
