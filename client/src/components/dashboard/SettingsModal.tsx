import React, { useState } from 'react';
import { CandleColorSettings } from '../chart/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candleColors: CandleColorSettings;
  onUpdateCandleColors: (colors: CandleColorSettings) => void;
  onResetCandleColors: () => void;
  apiStatus: 'online' | 'offline' | 'loading';
  wsStatus: 'online' | 'offline' | 'loading';
  brokerName?: string;
  appId?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  candleColors,
  onUpdateCandleColors,
  onResetCandleColors,
  apiStatus,
  wsStatus,
  brokerName = 'FYERS API v3',
  appId = 'R3ZD795FUR-100'
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'system'>('chart');

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        width: '460px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #262626',
        borderRadius: '6px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '0.85rem 1.2rem',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#050505'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em' }}>
              SETTINGS
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#737373',
              fontSize: '1.1rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #1a1a1a',
          backgroundColor: '#050505',
          padding: '0 1.2rem'
        }}>
          <button
            onClick={() => setActiveTab('chart')}
            style={{
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: activeTab === 'chart' ? 600 : 400,
              color: activeTab === 'chart' ? '#ffffff' : '#737373',
              borderBottom: activeTab === 'chart' ? '2px solid #5F7A9A' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            Chart Appearance
          </button>
          <button
            onClick={() => setActiveTab('system')}
            style={{
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: activeTab === 'system' ? 600 : 400,
              color: activeTab === 'system' ? '#ffffff' : '#737373',
              borderBottom: activeTab === 'system' ? '2px solid #5F7A9A' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            System Status
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto' }}>
          {activeTab === 'chart' ? (
            <>
              {/* Up Candle Customization */}
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.75rem'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                  UP CANDLE (BULLISH)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#737373', display: 'block', marginBottom: '4px' }}>Body</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        value={candleColors.upBodyColor}
                        onChange={(e) => onUpdateCandleColors({ ...candleColors, upBodyColor: e.target.value })}
                        style={{ width: '28px', height: '24px', border: '1px solid #262626', borderRadius: '2px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC' }}>{candleColors.upBodyColor}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#737373', display: 'block', marginBottom: '4px' }}>Border</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        value={candleColors.upBorderColor}
                        onChange={(e) => onUpdateCandleColors({ ...candleColors, upBorderColor: e.target.value })}
                        style={{ width: '28px', height: '24px', border: '1px solid #262626', borderRadius: '2px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC' }}>{candleColors.upBorderColor}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#737373', display: 'block', marginBottom: '4px' }}>Wick</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        value={candleColors.upWickColor}
                        onChange={(e) => onUpdateCandleColors({ ...candleColors, upWickColor: e.target.value })}
                        style={{ width: '28px', height: '24px', border: '1px solid #262626', borderRadius: '2px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC' }}>{candleColors.upWickColor}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Down Candle Customization */}
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.75rem'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                  DOWN CANDLE (BEARISH)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#737373', display: 'block', marginBottom: '4px' }}>Body</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        value={candleColors.downBodyColor}
                        onChange={(e) => onUpdateCandleColors({ ...candleColors, downBodyColor: e.target.value })}
                        style={{ width: '28px', height: '24px', border: '1px solid #262626', borderRadius: '2px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC' }}>{candleColors.downBodyColor}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#737373', display: 'block', marginBottom: '4px' }}>Border</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        value={candleColors.downBorderColor}
                        onChange={(e) => onUpdateCandleColors({ ...candleColors, downBorderColor: e.target.value })}
                        style={{ width: '28px', height: '24px', border: '1px solid #262626', borderRadius: '2px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC' }}>{candleColors.downBorderColor}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#737373', display: 'block', marginBottom: '4px' }}>Wick</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        value={candleColors.downWickColor}
                        onChange={(e) => onUpdateCandleColors({ ...candleColors, downWickColor: e.target.value })}
                        style={{ width: '28px', height: '24px', border: '1px solid #262626', borderRadius: '2px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC' }}>{candleColors.downWickColor}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset to Defaults Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button
                  onClick={onResetCandleColors}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.72rem',
                    backgroundColor: '#171717',
                    border: '1px solid #262626',
                    color: '#CCCCCC',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Apply Defaults
                </button>
              </div>
            </>
          ) : (
            /* System Status Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#737373' }}>API Server:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: apiStatus === 'online' ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ color: '#ffffff', fontWeight: 600, textTransform: 'capitalize' }}>{apiStatus}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#737373' }}>WebSocket Stream:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: wsStatus === 'online' ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ color: '#ffffff', fontWeight: 600, textTransform: 'capitalize' }}>{wsStatus}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#737373' }}>Broker Data Feed:</span>
                  <span style={{ color: '#5F7A9A', fontWeight: 600 }}>{brokerName}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#737373' }}>Broker App ID:</span>
                  <span style={{ fontFamily: 'monospace', color: '#CCCCCC' }}>{appId}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#737373' }}>Exchange:</span>
                  <span style={{ color: '#ffffff' }}>NSE (National Stock Exchange of India)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.2rem',
          borderTop: '1px solid #1a1a1a',
          backgroundColor: '#050505',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '5px 16px',
              fontSize: '0.75rem',
              backgroundColor: '#5F7A9A',
              color: '#ffffff',
              border: 'none',
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
