import React, { useState, useEffect } from 'react';
import { CandleColorSettings, CANDLESTICK_THEMES } from '../chart/types';
import { TradingViewColorPicker } from './TradingViewColorPicker';
import { WatchlistSegment, WATCHLIST_SEGMENT_OPTIONS } from './watchlistData';
import { updateBrokerToken, executeAutoLogin, fetchFyersLoginUrl } from '../../services/api';

const FALLBACK_FEED_LOGIN_URL =
  'https://api-t1.fyers.in/api/v3/generate-authcode?client_id=R3ZD795FUR-100&redirect_uri=https://trade.fyers.in/api-login/redirect-uri/index.html&response_type=code&state=pmvision';

type SettingsTab = 'appearance' | 'watchlist' | 'feed' | 'shortcuts' | 'system';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  candleColors: CandleColorSettings;
  onUpdateCandleColors: (colors: CandleColorSettings) => void;
  onResetCandleColors: () => void;
  defaultWatchlist: WatchlistSegment;
  onChangeDefaultWatchlist: (segment: WatchlistSegment) => void;
  apiStatus: 'online' | 'offline' | 'loading';
  wsStatus: 'online' | 'offline' | 'loading';
  isBrokerConnected?: boolean;
  feedStatus?: 'LIVE' | 'RATE_LIMITED' | 'STALE' | 'PUBLIC' | 'OFFLINE';
  dataSource?: 'FYERS' | 'PUBLIC';
  onBrokerConnected?: () => void;
}

const KEYBOARD_SHORTCUT_GROUPS: Array<{
  title: string;
  items: Array<{ keys: string; desc: string }>;
}> = [
  {
    title: 'Navigation & Workspace',
    items: [
      { keys: 'PageDown / PageUp', desc: 'Switch between Dashboard, Chart, and Heatmap tabs' },
      { keys: 'Alt + W', desc: 'Open or close Watchlist panel (Dashboard & Chart tabs)' },
      { keys: 'Alt + Q', desc: 'Open or close Watchlist selector dropdown (when Watchlist is open)' },
      { keys: 'Up / Down Arrow', desc: 'Step through symbols in active Watchlist (when Watchlist is engaged)' },
      { keys: 'Any Letter (A-Z) or Ctrl+K', desc: 'Open Symbol Search immediately with typed query' }
    ]
  },
  {
    title: 'Chart Timeframes',
    items: [
      { keys: '1..9 + Enter', desc: 'Apply custom minute timeframe (>385m -> 1D, >2000m -> 1W, >40000m -> 1M)' },
      { keys: '1 + d + Enter', desc: 'Switch chart directly to 1D (Daily)' },
      { keys: '1 + w + Enter', desc: 'Switch chart directly to 1W (Weekly)' },
      { keys: '1 + M + Enter', desc: 'Switch chart directly to 1M (Monthly; capital M)' }
    ]
  },
  {
    title: 'Chart Navigation & Zoom',
    items: [
      { keys: 'Left / Right Arrow', desc: 'Move chart left or right by 1 candle' },
      { keys: 'Ctrl + Left / Right Arrow', desc: 'Move chart left or right by 10 candles' },
      { keys: 'Ctrl + Up / Down Arrow (or Up/Down on Chart)', desc: 'Zoom chart candles horizontally in or out' },
      { keys: 'Shift + Up / Down Arrow', desc: 'Zoom price axis (Y-axis) range in or out' },
      { keys: 'Alt + R', desc: 'Reset chart viewport and price scale' }
    ]
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'appearance',
  candleColors,
  onUpdateCandleColors,
  onResetCandleColors,
  defaultWatchlist,
  onChangeDefaultWatchlist,
  apiStatus,
  wsStatus,
  isBrokerConnected = false,
  feedStatus = 'PUBLIC',
  dataSource = 'PUBLIC',
  onBrokerConnected
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [authMode, setAuthMode] = useState<'auto' | 'manual'>('manual');
  const [feedLoginUrl, setFeedLoginUrl] = useState<string>(FALLBACK_FEED_LOGIN_URL);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchFyersLoginUrl()
        .then((res) => {
          if (res?.loginUrl) setFeedLoginUrl(res.loginUrl);
        })
        .catch(() => {});
    }
  }, [isOpen, initialTab]);

  // Method 2: Automated Login State
  const [autoClientId, setAutoClientId] = useState('FAK52898');
  const [autoPin, setAutoPin] = useState('');
  const [autoTotpKey, setAutoTotpKey] = useState('');
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [autoMessage, setAutoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Method 1: Manual Auth Code / Token State
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleAutoLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAutoSubmitting(true);
    setAutoMessage(null);
    try {
      const res = await executeAutoLogin({
        fyId: autoClientId.trim() || undefined,
        pin: autoPin.trim() || undefined,
        totpKey: autoTotpKey.trim() || undefined
      });
      if (res.connected) {
        setAutoMessage({ type: 'success', text: 'Automated login successful. Connected.' });
        onBrokerConnected?.();
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
        setTokenMessage({ type: 'success', text: 'Successfully connected to Data Feed.' });
        setTokenInput('');
        onBrokerConnected?.();
      } else {
        setTokenMessage({ type: 'error', text: res.message || 'Failed to authenticate token.' });
      }
    } catch (err: any) {
      setTokenMessage({ type: 'error', text: err?.message || 'Network error updating token.' });
    } finally {
      setTokenSubmitting(false);
    }
  };

  const getFeedStatusLabel = () => {
    if (isBrokerConnected && feedStatus === 'RATE_LIMITED') return 'Connected (Rate-Limited Fallback Active)';
    if (isBrokerConnected && feedStatus === 'STALE') return 'Connected (Refreshing Stream...)';
    if (isBrokerConnected) return 'Connected';
    if (dataSource === 'PUBLIC') return 'Public Fallback';
    return 'Disconnected';
  };

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'feed', label: 'Data Feed' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'system', label: 'System Status' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '620px',
          maxWidth: '94vw',
          backgroundColor: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: '6px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.85rem 1.2rem',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#050505'
          }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em' }}>
            SETTINGS
          </span>

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

        {/* Categorized Tab Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #1a1a1a',
            backgroundColor: '#050505',
            padding: '0 1.2rem',
            gap: '4px',
            overflowX: 'auto'
          }}
        >
          {tabs.map((tab) => {
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '9px 12px',
                  fontSize: '0.73rem',
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? '#ffffff' : '#737373',
                  borderBottom: isSel ? '2px solid #5F7A9A' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '440px', overflowY: 'auto' }}>
          {/* 1. APPEARANCE */}
          {activeTab === 'appearance' && (
            <>
              <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e5e7eb', marginBottom: '0.65rem', letterSpacing: '0.05em' }}>
                  CANDLESTICK THEME
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {CANDLESTICK_THEMES.map((theme) => {
                    const isSelected =
                      candleColors.upBodyColor.toLowerCase() === theme.colors.upBodyColor.toLowerCase() &&
                      candleColors.downBodyColor.toLowerCase() === theme.colors.downBodyColor.toLowerCase() &&
                      candleColors.upBorderColor.toLowerCase() === theme.colors.upBorderColor.toLowerCase() &&
                      candleColors.downBorderColor.toLowerCase() === theme.colors.downBorderColor.toLowerCase();

                    const isJewel = theme.id === 'jewel';
                    const bullBg = isJewel
                      ? 'linear-gradient(135deg, #fff6b3 0%, #dfb430 55%, #997316 100%)'
                      : theme.colors.upBodyColor;
                    const bearBg = isJewel
                      ? 'linear-gradient(135deg, #ffffff 0%, #b4bec8 55%, #64748b 100%)'
                      : theme.colors.downBodyColor;

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => onUpdateCandleColors(theme.colors)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? 'rgba(95, 122, 154, 0.16)' : '#0c0c0c',
                          border: `1px solid ${isSelected ? '#5F7A9A' : '#1f1f1f'}`,
                          color: isSelected ? '#ffffff' : '#d4d4d4',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#5F7A9A' : '#262626',
                            border: `1px solid ${isSelected ? '#8ba7c7' : '#404040'}`,
                            flexShrink: 0
                          }} />
                          <span style={{ fontSize: '0.74rem', fontWeight: isSelected ? 600 : 500 }}>
                            {theme.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            width: '9px',
                            height: '15px',
                            borderRadius: '1.5px',
                            background: bullBg,
                            border: `1px solid ${theme.colors.upBorderColor}`,
                            display: 'inline-block'
                          }} />
                          <span style={{
                            width: '9px',
                            height: '15px',
                            borderRadius: '1.5px',
                            background: bearBg,
                            border: `1px solid ${theme.colors.downBorderColor}`,
                            display: 'inline-block'
                          }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.85rem' }}>
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

              <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.85rem' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                    cursor: 'pointer'
                  }}
                >
                  Apply Defaults
                </button>
              </div>
            </>
          )}

          {/* 2. WATCHLIST & DEFAULTS */}
          {activeTab === 'watchlist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.04em' }}>
                    DEFAULT WATCHLIST
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#737373', marginTop: '3px' }}>
                    Choose which watchlist opens by default and responds to Up/Down arrow stepping when Watchlist navigation is active.
                  </div>
                </div>

                <select
                  value={defaultWatchlist}
                  onChange={(e) => onChangeDefaultWatchlist(e.target.value as WatchlistSegment)}
                  style={{
                    width: '100%',
                    backgroundColor: '#121212',
                    color: '#ffffff',
                    border: '1px solid #5F7A9A',
                    borderRadius: '4px',
                    padding: '7px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {WATCHLIST_SEGMENT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 3. DATA FEED & CREDENTIALS */}
          {activeTab === 'feed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 600 }}>Data Feed:</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '3px',
                  backgroundColor: isBrokerConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(95, 122, 154, 0.12)',
                  border: `1px solid ${isBrokerConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(95, 122, 154, 0.35)'}`
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isBrokerConnected ? '#10b981' : '#5F7A9A'
                  }} />
                  <span style={{ color: isBrokerConnected ? '#10b981' : '#e5e7eb', fontWeight: 700, fontSize: '0.72rem' }}>
                    {getFeedStatusLabel()}
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.04em' }}>
                    FEED AUTHENTICATION
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
                      Auto-Login (TOTP)
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
                      Manual Code
                    </button>
                  </div>
                </div>

                {authMode === 'auto' ? (
                  <form onSubmit={handleAutoLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ fontSize: '0.68rem', color: '#737373', lineHeight: 1.4 }}>
                      Automatically signs into the Main Data Feed using your <b>TOTP Secret Key</b> and <b>PIN</b> without browser redirects.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.66rem', color: '#a3a3a3', display: 'block', marginBottom: '3px' }}>Client ID</label>
                        <input
                          type="text"
                          value={autoClientId}
                          onChange={(e) => setAutoClientId(e.target.value)}
                          placeholder="FAK52898"
                          style={{ width: '100%', backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '3px', color: '#ffffff', fontSize: '0.72rem', padding: '5px 8px', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.66rem', color: '#a3a3a3', display: 'block', marginBottom: '3px' }}>Trading PIN (4-digit)</label>
                        <input
                          type="password"
                          value={autoPin}
                          onChange={(e) => setAutoPin(e.target.value)}
                          placeholder="Saved on server (or enter new)"
                          maxLength={6}
                          style={{ width: '100%', backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '3px', color: '#ffffff', fontSize: '0.72rem', padding: '5px 8px', outline: 'none' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.66rem', color: '#a3a3a3', display: 'block', marginBottom: '3px' }}>
                        TOTP Secret Key
                      </label>
                      <input
                        type="password"
                        value={autoTotpKey}
                        onChange={(e) => setAutoTotpKey(e.target.value)}
                        placeholder="Saved on server (or enter new key)"
                        style={{ width: '100%', backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '3px', color: '#ffffff', fontSize: '0.72rem', padding: '5px 8px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <button
                        type="submit"
                        disabled={autoSubmitting}
                        style={{
                          padding: '6px 16px',
                          fontSize: '0.72rem',
                          backgroundColor: '#5F7A9A',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: autoSubmitting ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          opacity: autoSubmitting ? 0.6 : 1
                        }}
                      >
                        {autoSubmitting ? 'Authenticating...' : 'Run Auto-Login Now'}
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
                  <form onSubmit={handleTokenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ fontSize: '0.68rem', color: '#737373', lineHeight: 1.4 }}>
                        Open the Data Feed login portal, copy the redirect URL (or auth code), and paste it below.
                      </div>
                      <a
                        href={feedLoginUrl}
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
                        <span>1. Open Login</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste Redirect URL, Auth Code, or Access Token..."
                        style={{ flex: 1, backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '3px', color: '#ffffff', fontSize: '0.72rem', padding: '6px 8px', outline: 'none' }}
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
                          opacity: tokenSubmitting || !tokenInput.trim() ? 0.6 : 1
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

          {/* 4. KEYBOARD SHORTCUTS REFERENCE */}
          {activeTab === 'shortcuts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {KEYBOARD_SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.75rem 0.9rem' }}>
                  <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#5F7A9A', letterSpacing: '0.04em', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    {group.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {group.items.map((item) => (
                      <div key={item.keys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderBottom: '1px solid #121212', paddingBottom: '4px' }}>
                        <span style={{ fontSize: '0.70rem', color: '#d4d4d4' }}>{item.desc}</span>
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          backgroundColor: '#141414',
                          border: '1px solid #262626',
                          borderRadius: '3px',
                          padding: '2px 7px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {item.keys}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 5. SYSTEM STATUS */}
          {activeTab === 'system' && (
            <div style={{ backgroundColor: '#050505', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '0.95rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ color: '#737373' }}>API Server:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: apiStatus === 'online' ? '#10b981' : '#ef4444' }} />
                  <span style={{ color: '#ffffff', fontWeight: 600, textTransform: 'capitalize' }}>{apiStatus}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ color: '#737373' }}>WebSocket Stream:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: wsStatus === 'online' ? '#10b981' : '#ef4444' }} />
                  <span style={{ color: '#ffffff', fontWeight: 600, textTransform: 'capitalize' }}>{wsStatus}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ color: '#737373' }}>Data Feed:</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  backgroundColor: isBrokerConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(95, 122, 154, 0.12)',
                  border: `1px solid ${isBrokerConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(95, 122, 154, 0.35)'}`
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isBrokerConnected ? '#10b981' : '#5F7A9A' }} />
                  <span style={{ color: isBrokerConnected ? '#10b981' : '#e5e7eb', fontWeight: 600, fontSize: '0.70rem' }}>
                    {getFeedStatusLabel()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ color: '#737373' }}>Exchange:</span>
                <span style={{ color: '#ffffff' }}>NSE (National Stock Exchange of India)</span>
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
