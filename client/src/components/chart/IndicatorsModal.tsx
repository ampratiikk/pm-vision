import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IndicatorConfig, MA_DEFAULT_COLORS, MAX_MA_COUNT } from './types';

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicators: IndicatorConfig[];
  onUpdateIndicators: (indicators: IndicatorConfig[]) => void;
  onResetIndicators: () => void;
  initialIndicatorId?: string | null;
}

const DEFAULT_MA_PERIODS = [10, 20, 50, 100, 200, 9, 12, 26];

interface ColorBoxPickerProps {
  color: string;
  onChange: (c: string) => void;
}

/**
 * Large rounded box filled with the applied color so users clearly see the selected indicator color.
 */
const ColorBoxPicker: React.FC<ColorBoxPickerProps> = ({ color, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title={`Selected color: ${color.toUpperCase()} (Click to change)`}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '5px',
          backgroundColor: color,
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: 'inset 0 0 4px rgba(0, 0, 0, 0.35)',
          cursor: 'pointer',
          padding: 0
        }}
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none'
        }}
      />
      <span style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600 }}>
        {color.toUpperCase()}
      </span>
    </div>
  );
};

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  isOpen,
  onClose,
  indicators,
  onUpdateIndicators,
  onResetIndicators,
  initialIndicatorId
}) => {
  const [selectedId, setSelectedId] = useState<string>('indicator-or-1h');

  useEffect(() => {
    if (isOpen) {
      if (initialIndicatorId && indicators.some((i) => i.id === initialIndicatorId)) {
        setSelectedId(initialIndicatorId);
      } else if (!indicators.some((i) => i.id === selectedId) && indicators.length > 0) {
        setSelectedId(indicators[0].id);
      }
    }
  }, [isOpen, initialIndicatorId, indicators, selectedId]);

  const emaList = useMemo(() => indicators.filter((i) => i.type === 'EMA'), [indicators]);
  const smaList = useMemo(() => indicators.filter((i) => i.type === 'SMA'), [indicators]);
  const studyList = useMemo(
    () => indicators.filter((i) => i.type === 'OR' || i.type === 'VWAP' || i.type === 'VOLUME'),
    [indicators]
  );
  const oscillatorList = useMemo(
    () => indicators.filter((i) => i.type === 'RSI' || i.type === 'ADX'),
    [indicators]
  );

  if (!isOpen) return null;

  const selected = indicators.find((i) => i.id === selectedId) || indicators[0];

  const handleToggleEnabled = (id: string) => {
    const next = indicators.map((ind) =>
      ind.id === id ? { ...ind, enabled: !ind.enabled, visible: ind.enabled ? ind.visible : true } : ind
    );
    onUpdateIndicators(next);
  };

  const handleToggleVisible = (id: string) => {
    const next = indicators.map((ind) =>
      ind.id === id ? { ...ind, visible: !ind.visible } : ind
    );
    onUpdateIndicators(next);
  };

  const handleUpdateField = (id: string, patch: Partial<IndicatorConfig>) => {
    const next = indicators.map((ind) => (ind.id === id ? { ...ind, ...patch } : ind));
    onUpdateIndicators(next);
  };

  const handleUpdateOptions = (id: string, options: Partial<IndicatorConfig['options']>) => {
    const next = indicators.map((ind) => {
      if (ind.id !== id) return ind;
      const mergedOpts = { ...ind.options, ...options };
      let nextShortName = ind.shortName;
      if ((ind.type === 'EMA' || ind.type === 'SMA') && options.period !== undefined) {
        nextShortName = `${ind.type} ${options.period}`;
      }
      return { ...ind, shortName: nextShortName, options: mergedOpts };
    });
    onUpdateIndicators(next);
  };

  const handleAddMA = (type: 'EMA' | 'SMA') => {
    const existing = indicators.filter((i) => i.type === type);
    if (existing.length >= MAX_MA_COUNT) return;
    const idx = existing.length;
    const nextColor = MA_DEFAULT_COLORS[idx] || MA_DEFAULT_COLORS[idx % MA_DEFAULT_COLORS.length];
    const nextPeriod = DEFAULT_MA_PERIODS[idx] || 20 * (idx + 1);
    const newId = `indicator-${type.toLowerCase()}-${Date.now()}-${idx + 1}`;
    const newItem: IndicatorConfig = {
      id: newId,
      type,
      name: type === 'EMA' ? 'Exponential Moving Average' : 'Simple Moving Average',
      shortName: `${type} ${nextPeriod}`,
      enabled: true,
      visible: true,
      color: nextColor,
      lineWidth: 1,
      options: { period: nextPeriod }
    };
    onUpdateIndicators([...indicators, newItem]);
    setSelectedId(newId);
  };

  const handleRemoveMA = (id: string) => {
    const target = indicators.find((i) => i.id === id);
    if (!target) return;
    const sameType = indicators.filter((i) => i.type === target.type);
    if (sameType.length <= 1) return;
    const next = indicators.filter((i) => i.id !== id);
    onUpdateIndicators(next);
    if (selectedId === id && next.length > 0) {
      setSelectedId(next[0].id);
    }
  };

  const formatOrDuration = (mins: number = 60) => {
    if (mins >= 60 && mins % 60 === 0) return `${mins / 60}H`;
    return `${mins}m`;
  };

  const renderSidebarRow = (ind: IndicatorConfig, displayLabel: string) => {
    const isSel = selected?.id === ind.id;
    const dotColor = !ind.enabled
      ? '#404040'
      : ind.visible
      ? ind.color || '#10b981'
      : '#9ca3af';

    return (
      <div
        key={ind.id}
        onClick={() => setSelectedId(ind.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 9px',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: isSel ? 'rgba(95, 122, 154, 0.22)' : 'transparent',
          border: `1px solid ${isSel ? '#5F7A9A' : 'transparent'}`,
          transition: 'all 0.12s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span
            title={!ind.enabled ? 'Disabled' : ind.visible ? 'Enabled & Visible' : 'Enabled (Hidden)'}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: ind.enabled && !ind.visible ? 'transparent' : dotColor,
              border: `1.5px solid ${dotColor}`,
              flexShrink: 0,
              boxShadow: ind.enabled && ind.visible ? `0 0 6px ${dotColor}66` : 'none'
            }}
          />
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: isSel ? 700 : 600,
              color: !ind.enabled ? '#737373' : ind.visible ? '#ffffff' : '#9ca3af',
              textDecoration: ind.enabled && !ind.visible ? 'line-through' : 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {displayLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleEnabled(ind.id);
          }}
          title={ind.enabled ? 'Disable indicator' : 'Enable indicator'}
          style={{
            padding: '1px 5px',
            fontSize: '0.58rem',
            fontWeight: 700,
            borderRadius: '2px',
            backgroundColor: ind.enabled ? 'rgba(95, 122, 154, 0.2)' : '#141414',
            color: ind.enabled ? '#93c5fd' : '#525252',
            border: `1px solid ${ind.enabled ? '#5F7A9A' : '#262626'}`,
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          {ind.enabled ? 'ON' : 'OFF'}
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
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
          width: '680px',
          maxWidth: '94vw',
          height: '520px',
          maxHeight: '85vh',
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
            padding: '0.85rem 1.2rem',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#050505',
            flexShrink: 0
          }}
        >
          <div>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
              INDICATORS & TECHNICAL STUDIES
            </span>
            <div style={{ fontSize: '0.67rem', color: '#737373', marginTop: '2px' }}>
              Select an indicator on the left to enable, hide/show, or customize its parameters
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a3a3a3',
              fontSize: '1.15rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Two-Pane Body: LHS List Panel + RHS Customization Panel */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* LHS Indicator Navigation Sidebar */}
          <div
            style={{
              width: '235px',
              flexShrink: 0,
              borderRight: '1px solid #1a1a1a',
              backgroundColor: '#060606',
              overflowY: 'auto',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {/* Chart Overlays */}
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#737373', letterSpacing: '0.05em', marginBottom: '4px', paddingLeft: '4px' }}>
                OVERLAYS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {studyList.map((ind) =>
                  renderSidebarRow(
                    ind,
                    ind.type === 'OR'
                      ? `OR (${formatOrDuration(ind.options.durationMinutes)})`
                      : ind.shortName
                  )
                )}
              </div>
            </div>

            {/* Multiple EMAs (up to 8) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#737373', letterSpacing: '0.05em' }}>
                  EMA ({emaList.length}/{MAX_MA_COUNT})
                </span>
                <button
                  type="button"
                  onClick={() => handleAddMA('EMA')}
                  disabled={emaList.length >= MAX_MA_COUNT}
                  style={{
                    padding: '1px 6px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    backgroundColor: emaList.length >= MAX_MA_COUNT ? '#141414' : 'rgba(95, 122, 154, 0.2)',
                    color: emaList.length >= MAX_MA_COUNT ? '#404040' : '#93c5fd',
                    border: '1px solid #262626',
                    borderRadius: '3px',
                    cursor: emaList.length >= MAX_MA_COUNT ? 'not-allowed' : 'pointer'
                  }}
                >
                  + Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {emaList.map((ind, idx) => renderSidebarRow(ind, `EMA #${idx + 1} (${ind.options.period || 20})`))}
              </div>
            </div>

            {/* Multiple SMAs (up to 8) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#737373', letterSpacing: '0.05em' }}>
                  SMA ({smaList.length}/{MAX_MA_COUNT})
                </span>
                <button
                  type="button"
                  onClick={() => handleAddMA('SMA')}
                  disabled={smaList.length >= MAX_MA_COUNT}
                  style={{
                    padding: '1px 6px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    backgroundColor: smaList.length >= MAX_MA_COUNT ? '#141414' : 'rgba(95, 122, 154, 0.2)',
                    color: smaList.length >= MAX_MA_COUNT ? '#404040' : '#93c5fd',
                    border: '1px solid #262626',
                    borderRadius: '3px',
                    cursor: smaList.length >= MAX_MA_COUNT ? 'not-allowed' : 'pointer'
                  }}
                >
                  + Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {smaList.map((ind, idx) => renderSidebarRow(ind, `SMA #${idx + 1} (${ind.options.period || 50})`))}
              </div>
            </div>

            {/* Oscillators & Trend */}
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#737373', letterSpacing: '0.05em', marginBottom: '4px', paddingLeft: '4px' }}>
                MOMENTUM & TREND
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {oscillatorList.map((ind) =>
                  renderSidebarRow(ind, `${ind.shortName} (${ind.options.period || 14})`)
                )}
              </div>
            </div>
          </div>

          {/* RHS Selected Indicator Customization Panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {selected && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff' }}>
                      {selected.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#737373', marginTop: '2px' }}>
                      {selected.type === 'OR' && `Opening Range high/low levels (${formatOrDuration(selected.options.durationMinutes)})`}
                      {selected.type === 'VWAP' && 'Volume-Weighted Average Price benchmark'}
                      {selected.type === 'EMA' && `Exponential Moving Average (${selected.options.period || 20} periods)`}
                      {selected.type === 'SMA' && `Simple Moving Average (${selected.options.period || 50} periods)`}
                      {selected.type === 'VOLUME' && 'Trading volume overlay'}
                      {selected.type === 'RSI' && `Wilder Relative Strength Index (${selected.options.period || 14})`}
                      {selected.type === 'ADX' && `Average Directional Index & +DI/-DI (${selected.options.period || 14})`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {((selected.type === 'EMA' && emaList.length > 1) ||
                      (selected.type === 'SMA' && smaList.length > 1)) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMA(selected.id)}
                        title="Remove this moving average"
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.66rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#fca5a5',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleVisible(selected.id)}
                      disabled={!selected.enabled}
                      title={selected.visible ? 'Hide on chart' : 'Show on chart'}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        backgroundColor: selected.visible ? '#141414' : 'rgba(234, 179, 8, 0.15)',
                        border: `1px solid ${selected.visible ? '#262626' : '#eab308'}`,
                        color: !selected.enabled ? '#404040' : selected.visible ? '#e5e7eb' : '#fde047',
                        borderRadius: '3px',
                        cursor: selected.enabled ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {selected.visible ? 'Visible' : 'Hidden'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(selected.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: selected.enabled ? '#5F7A9A' : '#141414',
                        border: `1px solid ${selected.enabled ? '#5F7A9A' : '#262626'}`,
                        color: selected.enabled ? '#ffffff' : '#9ca3af',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      {selected.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* Customization Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {/* OR Customizations */}
                  {selected.type === 'OR' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Opening Duration</span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {[15, 30, 60, 120].map((dur) => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => handleUpdateOptions(selected.id, { durationMinutes: dur })}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                borderRadius: '3px',
                                backgroundColor: (selected.options.durationMinutes || 60) === dur ? '#5F7A9A' : '#141414',
                                color: (selected.options.durationMinutes || 60) === dur ? '#ffffff' : '#a3a3a3',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              {formatOrDuration(dur)}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            max={375}
                            value={selected.options.durationMinutes || 60}
                            onChange={(e) => handleUpdateOptions(selected.id, { durationMinutes: Math.max(1, parseInt(e.target.value, 10) || 60) })}
                            style={{
                              width: '52px',
                              backgroundColor: '#121212',
                              border: '1px solid #262626',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              padding: '3px 5px',
                              borderRadius: '3px'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>OR High Color</span>
                        <ColorBoxPicker
                          color={selected.options.highColor || '#38bdf8'}
                          onChange={(c) => handleUpdateOptions(selected.id, { highColor: c })}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>OR Low Color</span>
                        <ColorBoxPicker
                          color={selected.options.lowColor || '#38bdf8'}
                          onChange={(c) => handleUpdateOptions(selected.id, { lowColor: c })}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Show Midpoint Level</span>
                        <input
                          type="checkbox"
                          checked={selected.options.showMid === true}
                          onChange={(e) => handleUpdateOptions(selected.id, { showMid: e.target.checked })}
                          style={{ accentColor: '#5F7A9A', cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </div>
                    </>
                  )}

                  {/* EMA / SMA Customizations */}
                  {(selected.type === 'EMA' || selected.type === 'SMA') && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Period</span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {[9, 10, 20, 50, 200].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleUpdateOptions(selected.id, { period: p })}
                              style={{
                                padding: '3px 7px',
                                fontSize: '0.68rem',
                                borderRadius: '3px',
                                backgroundColor: (selected.options.period || 20) === p ? '#5F7A9A' : '#141414',
                                color: (selected.options.period || 20) === p ? '#ffffff' : '#a3a3a3',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              {p}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={2}
                            max={500}
                            value={selected.options.period || 20}
                            onChange={(e) =>
                              handleUpdateOptions(selected.id, { period: Math.max(2, parseInt(e.target.value, 10) || 20) })
                            }
                            style={{
                              width: '54px',
                              backgroundColor: '#121212',
                              border: '1px solid #262626',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              padding: '3px 6px',
                              borderRadius: '3px'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Line Color</span>
                        <ColorBoxPicker
                          color={selected.color}
                          onChange={(c) => handleUpdateField(selected.id, { color: c })}
                        />
                      </div>
                    </>
                  )}

                  {/* VWAP Customizations */}
                  {selected.type === 'VWAP' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Reset at Session Start (09:15 IST)</span>
                        <input
                          type="checkbox"
                          checked={selected.options.sessionSpecific !== false}
                          onChange={(e) => handleUpdateOptions(selected.id, { sessionSpecific: e.target.checked })}
                          style={{ accentColor: '#5F7A9A', cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Line Color</span>
                        <ColorBoxPicker
                          color={selected.color}
                          onChange={(c) => handleUpdateField(selected.id, { color: c })}
                        />
                      </div>
                    </>
                  )}

                  {/* VOLUME Customizations */}
                  {selected.type === 'VOLUME' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Display Style</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateOptions(selected.id, { volumeStyle: 'area' })}
                            style={{
                              padding: '3px 10px',
                              fontSize: '0.68rem',
                              borderRadius: '3px',
                              backgroundColor: (selected.options.volumeStyle || 'area') === 'area' ? '#5F7A9A' : '#141414',
                              color: (selected.options.volumeStyle || 'area') === 'area' ? '#ffffff' : '#a3a3a3',
                              border: '1px solid #262626',
                              cursor: 'pointer'
                            }}
                          >
                            Area
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateOptions(selected.id, { volumeStyle: 'bar' })}
                            style={{
                              padding: '3px 10px',
                              fontSize: '0.68rem',
                              borderRadius: '3px',
                              backgroundColor: selected.options.volumeStyle === 'bar' ? '#5F7A9A' : '#141414',
                              color: selected.options.volumeStyle === 'bar' ? '#ffffff' : '#a3a3a3',
                              border: '1px solid #262626',
                              cursor: 'pointer'
                            }}
                          >
                            Histogram Bar
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Volume Color</span>
                        <ColorBoxPicker
                          color={selected.options.volumeColor || selected.color || '#808080'}
                          onChange={(c) => {
                            handleUpdateOptions(selected.id, { volumeColor: c });
                            handleUpdateField(selected.id, { color: c });
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* RSI Customizations */}
                  {selected.type === 'RSI' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>RSI Length</span>
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={selected.options.period || 14}
                          onChange={(e) => handleUpdateOptions(selected.id, { period: Math.max(2, parseInt(e.target.value, 10) || 14) })}
                          style={{
                            width: '60px',
                            backgroundColor: '#121212',
                            border: '1px solid #262626',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            padding: '3px 6px',
                            borderRadius: '3px'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Overbought / Oversold</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="number"
                            min={50}
                            max={95}
                            value={selected.options.rsiOverbought ?? 70}
                            onChange={(e) => handleUpdateOptions(selected.id, { rsiOverbought: parseInt(e.target.value, 10) || 70 })}
                            style={{ width: '50px', backgroundColor: '#121212', border: '1px solid #262626', color: '#ffffff', fontSize: '0.72rem', padding: '3px 5px', borderRadius: '3px' }}
                          />
                          <span style={{ color: '#737373' }}>/</span>
                          <input
                            type="number"
                            min={5}
                            max={50}
                            value={selected.options.rsiOversold ?? 30}
                            onChange={(e) => handleUpdateOptions(selected.id, { rsiOversold: parseInt(e.target.value, 10) || 30 })}
                            style={{ width: '50px', backgroundColor: '#121212', border: '1px solid #262626', color: '#ffffff', fontSize: '0.72rem', padding: '3px 5px', borderRadius: '3px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>RSI Line Color</span>
                        <ColorBoxPicker
                          color={selected.color || '#a855f7'}
                          onChange={(c) => handleUpdateField(selected.id, { color: c })}
                        />
                      </div>
                    </>
                  )}

                  {/* ADX Customizations */}
                  {selected.type === 'ADX' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>ADX Length</span>
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={selected.options.period || 14}
                          onChange={(e) => handleUpdateOptions(selected.id, { period: Math.max(2, parseInt(e.target.value, 10) || 14) })}
                          style={{
                            width: '60px',
                            backgroundColor: '#121212',
                            border: '1px solid #262626',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            padding: '3px 6px',
                            borderRadius: '3px'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>ADX Line Color</span>
                        <ColorBoxPicker
                          color={selected.color || '#eab308'}
                          onChange={(c) => handleUpdateField(selected.id, { color: c })}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Show +DI / -DI Lines</span>
                        <input
                          type="checkbox"
                          checked={selected.options.showDI !== false}
                          onChange={(e) => handleUpdateOptions(selected.id, { showDI: e.target.checked })}
                          style={{ accentColor: '#5F7A9A', cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </div>

                      {selected.options.showDI !== false && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>+DI Color</span>
                            <ColorBoxPicker
                              color={selected.options.plusDiColor || '#22c55e'}
                              onChange={(c) => handleUpdateOptions(selected.id, { plusDiColor: c })}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>-DI Color</span>
                            <ColorBoxPicker
                              color={selected.options.minusDiColor || '#ef4444'}
                              onChange={(c) => handleUpdateOptions(selected.id, { minusDiColor: c })}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Line Width Selector (Shared for all line/OR indicators) */}
                  {selected.type !== 'VOLUME' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: '#CCCCCC', fontWeight: 600 }}>Line Thickness</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {([1, 2, 3, 4] as Array<1 | 2 | 3 | 4>).map((lw) => (
                          <button
                            key={lw}
                            type="button"
                            onClick={() => handleUpdateField(selected.id, { lineWidth: lw })}
                            style={{
                              padding: '3px 9px',
                              fontSize: '0.68rem',
                              borderRadius: '3px',
                              backgroundColor: (selected.lineWidth || 1) === lw ? '#5F7A9A' : '#141414',
                              color: (selected.lineWidth || 1) === lw ? '#ffffff' : '#a3a3a3',
                              border: '1px solid #262626',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {lw}px
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.2rem',
            borderTop: '1px solid #1a1a1a',
            backgroundColor: '#050505',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
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
              padding: '5px 18px',
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
