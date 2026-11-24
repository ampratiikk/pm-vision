import React, { useState } from 'react';
import { CandleColorSettings } from '../chart/types';
import { TradingViewColorPicker } from './TradingViewColorPicker';
import { updateBrokerToken, executeAutoLogin } from '../../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  candleColors: CandleColorSettings;
  onUpdateCandleColors: (colors: CandleColorSettings) => void;
  onResetCandleColors: () => void;
  apiStatus: 'online' | 'offline' | 'loading';
  wsStatus: 'online' | 'offline' | 'loading';
  isBrokerConnected?: boolean;
  onBrokerConnected?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  candleColors,
  onUpdateCandleColors,
  onResetCandleColors,
  apiStatus,
  wsStatus,
  isBrokerConnected = false,
  onBrokerConnected
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'system'>('chart');
  const [authMode, setAuthMode] = useState<'auto' | 'manual'>('auto');

  // Method 2: Headless Auto-Login State
  const [autoFyId, setAutoFyId] = useState('FAK52898');
  const [autoPin, setAutoPin] = useState('');
  const [autoTotpKey, setAutoTotpKey] = useState('');
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [autoMessage, setAutoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Method 1: Manual Token / Auth Code State
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleAutoLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoPin.trim() || !autoTotpKey.trim()) return;
    setAutoSubmitting(true);
    setAutoMessage(null);
    try {
      const res = await executeAutoLogin({
        fyId: autoFyId.trim(),
        pin: autoPin.trim(),
        totpKey: autoTotpKey.trim()
      });
      if (res.connected) {
        setAutoMessage({ type: 'success', text: res.message || 'Headless login successful! FYERS Connected.' });
        if (onBrokerConnected) onBrokerConnected();
      } else {
        setAutoMessage({ type: 'error', text: res.message || 'Auto-login failed. Verify PIN and TOTP Key.' });
      }
    } catch (err: any) {
      setAutoMessage({ type: 'error', text: err?.message || 'Network error during auto-login.' });
    } finally {
      setAutoSubmitting(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setTokenSubmitting(true);
    setTokenMessage(null);
    try {
      const res = await updateBrokerToken(tokenInput.trim());
      if (res.connected) {
        setTokenMessage({ type: 'success', text: res.message || 'Successfully connected to FYERS!' });
        setTokenInput('');
        if (onBrokerConnected) onBrokerConnected();
      } else {
        setTokenMessage({ type: 'error', text: res.message || 'Failed to authenticate token.' });
      }
    } catch (err: any) {
      setTokenMessage({ type: 'error', text: err?.message || 'Network error updating token.' });
    } finally {
      setTokenSubmitting(false);
    }
  };

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
        width: '480px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #262626',
        borderRadius: '6px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible'
      }}>
        {/* Header */}
        <div style={{
          padding: '0.85rem 1.2rem',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#050505',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px'
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
            System Status & FYERS
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '460px', overflowY: 'auto' }}>
          {activeTab === 'chart' ? (
            <>
              {/* Up Candle Customization */}
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.85rem'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                  UP CANDLE (BULLISH)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                  <TradingViewColorPicker
                    label="Body"
                    color={candleColors.upBodyColor}
                    onChange={(val) => onUpdateCandleColors({ ...candleColors, upBodyColor: val })}
                  />
                  <TradingViewColorPicker
                    label="Border"
                    color={candleColors.upBorderColor}
                    onChange={(val) => onUpdateCandleColors({ ...candleColors, upBorderColor: val })}
                  />
                  <TradingViewColorPicker
                    label="Wick"
                    color={candleColors.upWickColor}
                    onChange={(val) => onUpdateCandleColors({ ...candleColors, upWickColor: val })}
                  />
                </div>
              </div>

              {/* Down Candle Customization */}
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.85rem'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                  DOWN CANDLE (BEARISH)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                  <TradingViewColorPicker
                    label="Body"
                    color={candleColors.downBodyColor}
                    onChange={(val) => onUpdateCandleColors({ ...candleColors, downBodyColor: val })}
                  />
                  <TradingViewColorPicker
                    label="Border"
                    color={candleColors.downBorderColor}
                    onChange={(val) => onUpdateCandleColors({ ...candleColors, downBorderColor: val })}
                  />
                  <TradingViewColorPicker
                    label="Wick"
                    color={candleColors.downWickColor}
                    onChange={(val) => onUpdateCandleColors({ ...candleColors, downWickColor: val })}
                  />
                </div>
              </div>

              {/* Reset to Defaults Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={onResetCandleColors}
                  style={{
                    padding: '6px 14px',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Server & Broker Overview */}
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isBrokerConnected ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ color: isBrokerConnected ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {isBrokerConnected ? 'FYERS Connected' : 'FYERS Token Expired'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#737373' }}>Exchange:</span>
                  <span style={{ color: '#ffffff' }}>NSE (National Stock Exchange of India)</span>
                </div>
              </div>

              {/* Mode Toggle: Method 2 (Headless Auto-Login) vs Method 1 (Manual Token) */}
              <div style={{
                backgroundColor: '#050505',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.04em' }}>
                    FYERS AUTHENTICATION
                  </span>
                  <div style={{ display: 'flex', gap: '4px', backgroundColor: '#121212', padding: '2px', borderRadius: '3px', border: '1px solid #262626' }}>
                    <button
                      type="button"
                      onClick={() => setAuthMode('auto')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.65rem',
                        fontWeight: authMode === 'auto' ? 600 : 400,
                        backgroundColor: authMode === 'auto' ? '#5F7A9A' : 'transparent',
                        color: authMode === 'auto' ? '#ffffff' : '#737373',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      Method 2: Auto-Login (TOTP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('manual')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.65rem',
                        fontWeight: authMode === 'manual' ? 600 : 400,
                        backgroundColor: authMode === 'manual' ? '#5F7A9A' : 'transparent',
                        color: authMode === 'manual' ? '#ffffff' : '#737373',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      Method 1: Manual Code
                    </button>
                  </div>
                </div>

                {authMode === 'auto' ? (
                  /* METHOD 2: 100% HEADLESS TOTP AUTO-LOGIN */
                  <form onSubmit={handleAutoLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#737373', lineHeight: 1.4 }}>
                      Automatically signs into FYERS using your <b>TOTP Secret Key</b> & <b>PIN</b> without browser redirects. Renews automatically every morning at 08:30 AM IST.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.66rem', color: '#a3a3a3', display: 'block', marginBottom: '3px' }}>FYERS Client ID</label>
                        <input
                          type="text"
                          value={autoFyId}
                          onChange={(e) => setAutoFyId(e.target.value)}
                          placeholder="FAK52898"
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
                      </div>
                      <div>
                        <label style={{ fontSize: '0.66rem', color: '#a3a3a3', display: 'block', marginBottom: '3px' }}>Trading PIN (4-digit)</label>
                        <input
                          type="password"
                          value={autoPin}
                          onChange={(e) => setAutoPin(e.target.value)}
                          placeholder="e.g. 1234"
                          maxLength={6}
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
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.66rem', color: '#a3a3a3', display: 'block', marginBottom: '3px' }}>
                        TOTP Secret Key (from Google Authenticator setup on FYERS)
                      </label>
                      <input
                        type="password"
                        value={autoTotpKey}
                        onChange={(e) => setAutoTotpKey(e.target.value)}
                        placeholder="32-character key from FYERS 2FA setup..."
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
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <button
                        type="submit"
                        disabled={autoSubmitting || !autoPin.trim() || !autoTotpKey.trim()}
                        style={{
                          padding: '6px 16px',
                          fontSize: '0.72rem',
                          backgroundColor: '#5F7A9A',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: autoSubmitting || !autoPin.trim() || !autoTotpKey.trim() ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          opacity: autoSubmitting || !autoPin.trim() || !autoTotpKey.trim() ? 0.6 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {autoSubmitting ? 'Authenticating Headlessly...' : 'Save & Run Auto-Login'}
                      </button>
                    </div>

                    {autoMessage && (
                      <div style={{
                        fontSize: '0.68rem',
                        color: autoMessage.type === 'success' ? '#10b981' : '#ef4444',
                        padding: '6px 10px',
                        backgroundColor: autoMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '3px',
                        border: `1px solid ${autoMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {autoMessage.text}
                      </div>
                    )}
                  </form>
                ) : (
                  /* METHOD 1: MANUAL CODE FLOW */
                  <form onSubmit={handleTokenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.68rem', color: '#737373', lineHeight: 1.4 }}>
                        Open FYERS login, copy the authorization code, and paste it below.
                      </div>
                      <a
                        href="https://api-t1.fyers.in/api/v3/generate-authcode?client_id=R3ZD795FUR-100&redirect_uri=https://trade.fyers.in/api-login/redirect-uri/index.html&response_type=code&state=pmvision"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.68rem',
                          color: '#5F7A9A',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(95, 122, 154, 0.15)',
                          border: '1px solid rgba(95, 122, 154, 0.3)',
                          fontWeight: 600,
                          flexShrink: 0
                        }}
                      >
                        <span>1. Log In to FYERS</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste FYERS Access Token or Auth Code here..."
                        style={{
                          flex: 1,
                          backgroundColor: '#121212',
                          border: '1px solid #262626',
                          borderRadius: '3px',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          padding: '6px 8px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={tokenSubmitting || !tokenInput.trim()}
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.72rem',
                          backgroundColor: '#5F7A9A',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: tokenSubmitting || !tokenInput.trim() ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          opacity: tokenSubmitting || !tokenInput.trim() ? 0.6 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {tokenSubmitting ? 'Verifying...' : 'Connect'}
                      </button>
                    </div>

                    {tokenMessage && (
                      <div style={{
                        fontSize: '0.68rem',
                        color: tokenMessage.type === 'success' ? '#10b981' : '#ef4444',
                        padding: '5px 8px',
                        backgroundColor: tokenMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '3px',
                        border: `1px solid ${tokenMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {tokenMessage.text}
                      </div>
                    )}
                  </form>
                )}
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
          justifyContent: 'flex-end',
          borderBottomLeftRadius: '6px',
          borderBottomRightRadius: '6px'
        }}>
          <button
            type="button"
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
