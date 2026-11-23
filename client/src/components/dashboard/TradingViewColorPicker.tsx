import React, { useState, useRef, useEffect } from 'react';

interface TradingViewColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_PALETTES = [
  // Monochrome & Neutrals
  ['#ffffff', '#e5e7eb', '#9ca3af', '#6b7280', '#4b5563', '#1f2937', '#000000'],
  // Ancestor Steel Blues & Slates (Platform Signature)
  ['#c5d7e8', '#8fa5bd', '#5F7A9A', '#47607c', '#304358', '#1c2836', '#0e151d'],
  // Bullish Greens & Teals
  ['#a7f3d0', '#34d399', '#10b981', '#059669', '#047857', '#064e3b', '#022c22'],
  // Bearish Reds & Corals
  ['#fecaca', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#450a0a'],
  // Amber / Accents / Purple
  ['#fde68a', '#fbbf24', '#f59e0b', '#d97706', '#c084fc', '#8b5cf6', '#6d28d9']
];

export const TradingViewColorPicker: React.FC<TradingViewColorPickerProps> = ({
  color,
  onChange,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const popoverRef = useRef<HTMLDivElement>(null);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(color);
  }, [color]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (c: string) => {
    onChange(c);
    setHexInput(c);
  };

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <span style={{ fontSize: '0.68rem', color: '#737373', fontWeight: 500 }}>
          {label}
        </span>
      )}

      {/* Swatch Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#0a0a0a',
          border: isOpen ? '1px solid #5F7A9A' : '1px solid #262626',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <span
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '3px',
            backgroundColor: color,
            border: color.toLowerCase() === '#000000' ? '1px solid #333333' : '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.4)',
            flexShrink: 0
          }}
        />
        <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#CCCCCC', letterSpacing: '0.04em' }}>
          {color.toUpperCase()}
        </span>
      </button>

      {/* Popover Flyout */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 110,
            backgroundColor: '#0a0a0a',
            border: '1px solid #262626',
            borderRadius: '6px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.95), 0 0 10px rgba(95,122,154,0.15)',
            padding: '10px',
            width: '210px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* Swatch Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {PRESET_PALETTES.map((row, rIdx) => (
              <div key={rIdx} style={{ display: 'flex', gap: '5px' }}>
                {row.map((itemColor) => {
                  const isSelected = itemColor.toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={itemColor}
                      type="button"
                      onClick={() => handleSelect(itemColor)}
                      title={itemColor}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '3px',
                        backgroundColor: itemColor,
                        border: isSelected
                          ? '2px solid #5F7A9A'
                          : itemColor.toLowerCase() === '#000000'
                          ? '1px solid #333333'
                          : '1px solid rgba(255,255,255,0.1)',
                        boxShadow: isSelected ? '0 0 6px #5F7A9A' : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transform: isSelected ? 'scale(1.1)' : 'none',
                        transition: 'transform 0.1s ease',
                        position: 'relative'
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ height: '1px', backgroundColor: '#1f1f1f', margin: '2px 0' }} />

          {/* Custom Hex Input and Native Picker Eye */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#737373', fontFamily: 'monospace' }}>HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#FFFFFF"
              maxLength={7}
              style={{
                flex: 1,
                backgroundColor: '#141414',
                border: '1px solid #262626',
                borderRadius: '3px',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '0.70rem',
                padding: '3px 6px',
                outline: 'none'
              }}
            />

            {/* Native Full Spectrum Eye Dropper */}
            <input
              ref={nativePickerRef}
              type="color"
              value={color}
              onChange={(e) => handleSelect(e.target.value)}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 0,
                height: 0
              }}
            />
            <button
              type="button"
              onClick={() => nativePickerRef.current?.click()}
              title="Custom Color Spectrum"
              style={{
                width: '24px',
                height: '22px',
                backgroundColor: '#171717',
                border: '1px solid #262626',
                borderRadius: '3px',
                color: '#5F7A9A',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
