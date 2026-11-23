import React, { useState, useMemo, useRef, useEffect } from 'react';

export type HeatmapTimeFilter = '15m' | '30m' | '1H' | '1D' | '1W';

export interface Constituent {
  symbol: string;
  name: string;
  sector: string;
  weight: number; // % weightage in Nifty 50 Index as of 19 Nov 2026
  ltp: number;
  changes: Record<HeatmapTimeFilter, number>; // dynamic percentage changes
  high: number;
  low: number;
  volume: string;
}

/**
 * Nifty 50 Index constituents and exact weights — 19 Nov 2026.
 * All 50 constituents categorized into TradingView sector blocks. Total weight = 100.00%.
 */
export const NIFTY_50_CONSTITUENTS: Constituent[] = [
  // 1. Finance (38.79%)
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Finance',
    weight: 10.68,
    ltp: 1735.40,
    changes: { '15m': -0.45, '30m': -1.10, '1H': -1.85, '1D': -3.33, '1W': -1.80 },
    high: 1795.00,
    low: 1728.00,
    volume: '22.4M'
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    sector: 'Finance',
    weight: 9.78,
    ltp: 1252.80,
    changes: { '15m': -0.38, '30m': -0.95, '1H': -1.72, '1D': -3.32, '1W': -0.90 },
    high: 1298.00,
    low: 1245.00,
    volume: '14.8M'
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Finance',
    weight: 4.05,
    ltp: 812.50,
    changes: { '15m': -0.30, '30m': -0.80, '1H': -1.55, '1D': -2.79, '1W': +0.45 },
    high: 836.00,
    low: 808.00,
    volume: '16.5M'
  },
  {
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd.',
    sector: 'Finance',
    weight: 3.37,
    ltp: 1165.20,
    changes: { '15m': -0.52, '30m': -1.25, '1H': -2.10, '1D': -3.97, '1W': -2.40 },
    high: 1215.00,
    low: 1158.00,
    volume: '8.2M'
  },
  {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank',
    sector: 'Finance',
    weight: 3.14,
    ltp: 1782.00,
    changes: { '15m': -0.25, '30m': -0.65, '1H': -1.35, '1D': -2.51, '1W': -1.15 },
    high: 1830.00,
    low: 1775.00,
    volume: '4.1M'
  },
  {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd.',
    sector: 'Finance',
    weight: 2.53,
    ltp: 6820.00,
    changes: { '15m': -0.28, '30m': -0.72, '1H': -1.45, '1D': -2.36, '1W': -0.50 },
    high: 6990.00,
    low: 6790.00,
    volume: '2.3M'
  },
  {
    symbol: 'BSE',
    name: 'BSE Ltd.',
    sector: 'Finance',
    weight: 1.30,
    ltp: 4680.00,
    changes: { '15m': -0.08, '30m': -0.25, '1H': -0.42, '1D': -0.63, '1W': +3.80 },
    high: 4740.00,
    low: 4620.00,
    volume: '1.7M'
  },
  {
    symbol: 'SHRIRAMFIN',
    name: 'Shriram Finance Ltd.',
    sector: 'Finance',
    weight: 1.16,
    ltp: 3120.00,
    changes: { '15m': +0.35, '30m': +0.85, '1H': +1.60, '1D': +2.46, '1W': +4.10 },
    high: 3165.00,
    low: 3040.00,
    volume: '2.1M'
  },
  {
    symbol: 'BAJAJFINSV',
    name: 'Bajaj Finserv Ltd.',
    sector: 'Finance',
    weight: 0.93,
    ltp: 1725.00,
    changes: { '15m': -0.08, '30m': -0.22, '1H': -0.40, '1D': -0.63, '1W': +0.80 },
    high: 1745.00,
    low: 1715.00,
    volume: '2.0M'
  },
  {
    symbol: 'SBILIFE',
    name: 'SBI Life Insurance Co.',
    sector: 'Finance',
    weight: 0.69,
    ltp: 1480.00,
    changes: { '15m': -0.15, '30m': -0.38, '1H': -0.75, '1D': -1.18, '1W': +0.20 },
    high: 1505.00,
    low: 1468.00,
    volume: '1.6M'
  },
  {
    symbol: 'JIOFIN',
    name: 'Jio Financial Services',
    sector: 'Finance',
    weight: 0.63,
    ltp: 310.50,
    changes: { '15m': -0.30, '30m': -0.75, '1H': -1.50, '1D': -2.34, '1W': -1.20 },
    high: 320.00,
    low: 307.00,
    volume: '19.5M'
  },
  {
    symbol: 'HDFCLIFE',
    name: 'HDFC Life Insurance Co.',
    sector: 'Finance',
    weight: 0.53,
    ltp: 682.00,
    changes: { '15m': -0.30, '30m': -0.75, '1H': -1.48, '1D': -2.33, '1W': -1.40 },
    high: 702.00,
    low: 678.00,
    volume: '4.2M'
  },

  // 2. Energy minerals (9.34%)
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy minerals',
    weight: 7.80,
    ltp: 2518.50,
    changes: { '15m': -0.22, '30m': -0.65, '1H': -1.15, '1D': -1.92, '1W': -0.40 },
    high: 2570.00,
    low: 2505.00,
    volume: '11.2M'
  },
  {
    symbol: 'COALINDIA',
    name: 'Coal India Ltd.',
    sector: 'Energy minerals',
    weight: 0.80,
    ltp: 385.00,
    changes: { '15m': -0.28, '30m': -0.68, '1H': -1.30, '1D': -2.05, '1W': -1.10 },
    high: 395.00,
    low: 381.00,
    volume: '10.5M'
  },
  {
    symbol: 'ONGC',
    name: 'ONGC Ltd.',
    sector: 'Energy minerals',
    weight: 0.74,
    ltp: 248.50,
    changes: { '15m': -0.04, '30m': -0.10, '1H': -0.18, '1D': -0.27, '1W': +0.60 },
    high: 251.00,
    low: 246.50,
    volume: '14.1M'
  },

  // 3. Consumer durables (8.22%)
  {
    symbol: 'M&M',
    name: 'Mahindra & Mahindra Ltd.',
    sector: 'Consumer durables',
    weight: 2.66,
    ltp: 2890.00,
    changes: { '15m': -0.15, '30m': -0.45, '1H': -0.92, '1D': -1.62, '1W': +0.80 },
    high: 2945.00,
    low: 2872.00,
    volume: '3.1M'
  },
  {
    symbol: 'TITAN',
    name: 'Titan Company Ltd.',
    sector: 'Consumer durables',
    weight: 1.65,
    ltp: 3240.00,
    changes: { '15m': +0.18, '30m': +0.42, '1H': +0.85, '1D': +1.30, '1W': +2.60 },
    high: 3265.00,
    low: 3190.00,
    volume: '1.9M'
  },
  {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India',
    sector: 'Consumer durables',
    weight: 1.50,
    ltp: 11450.00,
    changes: { '15m': 0.00, '30m': -0.05, '1H': -0.02, '1D': -0.01, '1W': +1.40 },
    high: 11520.00,
    low: 11390.00,
    volume: '0.8M'
  },
  {
    symbol: 'BAJAJ_AUTO',
    name: 'Bajaj Auto Ltd.',
    sector: 'Consumer durables',
    weight: 1.00,
    ltp: 8950.00,
    changes: { '15m': -0.14, '30m': -0.38, '1H': -0.72, '1D': -1.13, '1W': +0.40 },
    high: 9080.00,
    low: 8890.00,
    volume: '0.7M'
  },
  {
    symbol: 'EICHERMOT',
    name: 'Eicher Motors Ltd.',
    sector: 'Consumer durables',
    weight: 0.94,
    ltp: 4820.00,
    changes: { '15m': +0.06, '30m': +0.15, '1H': +0.28, '1D': +0.42, '1W': +2.30 },
    high: 4860.00,
    low: 4780.00,
    volume: '0.9M'
  },
  {
    symbol: 'TMPV',
    name: 'Tata Motors Passenger Vehicles',
    sector: 'Consumer durables',
    weight: 0.47,
    ltp: 785.00,
    changes: { '15m': +0.10, '30m': +0.25, '1H': +0.45, '1D': +0.73, '1W': +2.50 },
    high: 796.00,
    low: 776.00,
    volume: '8.4M'
  },

  // 4. Technology services (7.42%)
  {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'Technology services',
    weight: 3.27,
    ltp: 1865.00,
    changes: { '15m': +0.12, '30m': +0.25, '1H': +0.38, '1D': +0.49, '1W': +2.15 },
    high: 1882.00,
    low: 1848.00,
    volume: '7.8M'
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    sector: 'Technology services',
    weight: 2.03,
    ltp: 4150.00,
    changes: { '15m': +0.45, '30m': +1.15, '1H': +2.20, '1D': +3.53, '1W': +4.20 },
    high: 4180.00,
    low: 4010.00,
    volume: '4.2M'
  },
  {
    symbol: 'HCLTECH',
    name: 'HCL Technologies Ltd.',
    sector: 'Technology services',
    weight: 1.19,
    ltp: 1840.00,
    changes: { '15m': +0.22, '30m': +0.55, '1H': +0.95, '1D': +1.48, '1W': +2.80 },
    high: 1860.00,
    low: 1812.00,
    volume: '3.6M'
  },
  {
    symbol: 'TECHM',
    name: 'Tech Mahindra Ltd.',
    sector: 'Technology services',
    weight: 0.93,
    ltp: 1685.00,
    changes: { '15m': +0.12, '30m': +0.30, '1H': +0.55, '1D': +0.85, '1W': +2.10 },
    high: 1705.00,
    low: 1665.00,
    volume: '2.4M'
  },

  // 5. Non-energy minerals (5.74%)
  {
    symbol: 'TATASTEEL',
    name: 'Tata Steel Ltd.',
    sector: 'Non-energy minerals',
    weight: 1.27,
    ltp: 138.50,
    changes: { '15m': -1.15, '30m': -2.80, '1H': -5.10, '1D': -8.43, '1W': -6.80 },
    high: 152.00,
    low: 136.50,
    volume: '48.2M'
  },
  {
    symbol: 'ULTRACEMCO',
    name: 'UltraTech Cement Ltd.',
    sector: 'Non-energy minerals',
    weight: 1.26,
    ltp: 11050.00,
    changes: { '15m': -0.32, '30m': -0.75, '1H': -1.40, '1D': -2.23, '1W': -1.50 },
    high: 11340.00,
    low: 10980.00,
    volume: '0.6M'
  },
  {
    symbol: 'HINDALCO',
    name: 'Hindalco Industries Ltd.',
    sector: 'Non-energy minerals',
    weight: 1.12,
    ltp: 642.00,
    changes: { '15m': -0.42, '30m': -1.05, '1H': -1.95, '1D': -3.13, '1W': -2.60 },
    high: 665.00,
    low: 638.00,
    volume: '7.4M'
  },
  {
    symbol: 'JSWSTEEL',
    name: 'JSW Steel Ltd.',
    sector: 'Non-energy minerals',
    weight: 1.09,
    ltp: 945.00,
    changes: { '15m': -0.25, '30m': -0.62, '1H': -1.20, '1D': -1.88, '1W': -1.40 },
    high: 968.00,
    low: 938.00,
    volume: '4.8M'
  },
  {
    symbol: 'GRASIM',
    name: 'Grasim Industries Ltd.',
    sector: 'Non-energy minerals',
    weight: 1.00,
    ltp: 2540.00,
    changes: { '15m': -0.12, '30m': -0.30, '1H': -0.58, '1D': -0.92, '1W': +0.50 },
    high: 2575.00,
    low: 2520.00,
    volume: '1.2M'
  },

  // 6. Communications (5.53%)
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    sector: 'Communications',
    weight: 5.53,
    ltp: 1582.40,
    changes: { '15m': -0.18, '30m': -0.45, '1H': -0.90, '1D': -1.54, '1W': +1.20 },
    high: 1610.00,
    low: 1572.00,
    volume: '6.9M'
  },

  // 7. Consumer non durables (5.44%)
  {
    symbol: 'ITC',
    name: 'ITC Ltd.',
    sector: 'Consumer non durables',
    weight: 2.46,
    ltp: 472.50,
    changes: { '15m': +0.08, '30m': +0.22, '1H': +0.42, '1D': +0.64, '1W': +1.85 },
    high: 476.00,
    low: 468.00,
    volume: '18.4M'
  },
  {
    symbol: 'HINDUNILVR',
    name: 'Hindustan Unilever Ltd.',
    sector: 'Consumer non durables',
    weight: 1.56,
    ltp: 2390.00,
    changes: { '15m': -0.20, '30m': -0.52, '1H': -1.05, '1D': -1.63, '1W': -2.10 },
    high: 2435.00,
    low: 2380.00,
    volume: '2.5M'
  },
  {
    symbol: 'NESTLEIND',
    name: 'Nestlé India Ltd.',
    sector: 'Consumer non durables',
    weight: 0.79,
    ltp: 2240.00,
    changes: { '15m': -0.18, '30m': -0.45, '1H': -0.90, '1D': -1.44, '1W': -1.70 },
    high: 2280.00,
    low: 2225.00,
    volume: '0.8M'
  },
  {
    symbol: 'TATACONSUM',
    name: 'Tata Consumer Products',
    sector: 'Consumer non durables',
    weight: 0.63,
    ltp: 925.00,
    changes: { '15m': -0.25, '30m': -0.65, '1H': -1.25, '1D': -1.98, '1W': -1.60 },
    high: 948.00,
    low: 918.00,
    volume: '2.8M'
  },

  // 8. Transportation (4.57%)
  {
    symbol: 'ETERNAL',
    name: 'Eternal Ltd. (Zomato)',
    sector: 'Transportation',
    weight: 2.25,
    ltp: 268.40,
    changes: { '15m': -0.10, '30m': -0.22, '1H': -0.40, '1D': -0.52, '1W': +3.10 },
    high: 274.00,
    low: 265.00,
    volume: '28.0M'
  },
  {
    symbol: 'ADANIPORTS',
    name: 'Adani Ports & SEZ Ltd.',
    sector: 'Transportation',
    weight: 1.27,
    ltp: 1210.00,
    changes: { '15m': +0.02, '30m': +0.05, '1H': +0.08, '1D': +0.10, '1W': +1.60 },
    high: 1225.00,
    low: 1198.00,
    volume: '4.5M'
  },
  {
    symbol: 'INDIGO',
    name: 'InterGlobe Aviation (IndiGo)',
    sector: 'Transportation',
    weight: 1.05,
    ltp: 4180.00,
    changes: { '15m': -0.15, '30m': -0.40, '1H': -0.75, '1D': -1.16, '1W': +0.90 },
    high: 4240.00,
    low: 4140.00,
    volume: '1.4M'
  },

  // 9. Health technology (4.53%)
  {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharma Industries',
    sector: 'Health technology',
    weight: 1.71,
    ltp: 1785.00,
    changes: { '15m': -0.12, '30m': -0.38, '1H': -0.80, '1D': -1.32, '1W': +0.60 },
    high: 1812.00,
    low: 1776.00,
    volume: '2.8M'
  },
  {
    symbol: 'APOLLOHOSP',
    name: 'Apollo Hospitals',
    sector: 'Health technology',
    weight: 0.76,
    ltp: 6940.00,
    changes: { '15m': -0.10, '30m': -0.25, '1H': -0.48, '1D': -0.73, '1W': +1.20 },
    high: 7020.00,
    low: 6890.00,
    volume: '0.7M'
  },
  {
    symbol: 'DRREDDY',
    name: "Dr. Reddy's Laboratories",
    sector: 'Health technology',
    weight: 0.72,
    ltp: 1245.00,
    changes: { '15m': -0.14, '30m': -0.35, '1H': -0.68, '1D': -1.07, '1W': +0.50 },
    high: 1265.00,
    low: 1235.00,
    volume: '1.5M'
  },
  {
    symbol: 'CIPLA',
    name: 'Cipla Ltd.',
    sector: 'Health technology',
    weight: 0.68,
    ltp: 1515.00,
    changes: { '15m': +0.08, '30m': +0.20, '1H': +0.38, '1D': +0.62, '1W': +1.90 },
    high: 1530.00,
    low: 1495.00,
    volume: '2.2M'
  },
  {
    symbol: 'MAXHEALTH',
    name: 'Max Healthcare Institute',
    sector: 'Health technology',
    weight: 0.66,
    ltp: 985.00,
    changes: { '15m': +0.10, '30m': +0.25, '1H': +0.48, '1D': +0.79, '1W': +3.40 },
    high: 998.00,
    low: 972.00,
    volume: '3.1M'
  },

  // 10. Industrial services (4.18%)
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd.',
    sector: 'Industrial services',
    weight: 4.18,
    ltp: 3520.00,
    changes: { '15m': -0.35, '30m': -0.80, '1H': -1.60, '1D': -2.59, '1W': -1.10 },
    high: 3625.00,
    low: 3502.00,
    volume: '3.4M'
  },

  // 11. Utilities (2.33%)
  {
    symbol: 'NTPC',
    name: 'NTPC Ltd.',
    sector: 'Utilities',
    weight: 1.31,
    ltp: 368.20,
    changes: { '15m': -0.22, '30m': -0.60, '1H': -1.15, '1D': -1.88, '1W': -0.80 },
    high: 376.00,
    low: 365.00,
    volume: '11.8M'
  },
  {
    symbol: 'POWERGRID',
    name: 'Power Grid Corporation',
    sector: 'Utilities',
    weight: 1.02,
    ltp: 318.50,
    changes: { '15m': -0.18, '30m': -0.45, '1H': -0.92, '1D': -1.54, '1W': -0.60 },
    high: 324.00,
    low: 316.00,
    volume: '9.2M'
  },

  // 12. Electronic technology (1.23%)
  {
    symbol: 'BEL',
    name: 'Bharat Electronics Ltd.',
    sector: 'Electronic technology',
    weight: 1.23,
    ltp: 288.40,
    changes: { '15m': -0.18, '30m': -0.48, '1H': -0.95, '1D': -1.54, '1W': +1.10 },
    high: 294.00,
    low: 285.50,
    volume: '13.2M'
  },

  // 13. Process industries (0.99%)
  {
    symbol: 'ASIANPAINT',
    name: 'Asian Paints Ltd.',
    sector: 'Process industries',
    weight: 0.99,
    ltp: 2480.00,
    changes: { '15m': -0.14, '30m': -0.35, '1H': -0.68, '1D': -1.07, '1W': -1.90 },
    high: 2515.00,
    low: 2465.00,
    volume: '1.8M'
  },

  // 14. Retail (0.91%)
  {
    symbol: 'TRENT',
    name: 'Trent Ltd.',
    sector: 'Retail',
    weight: 0.91,
    ltp: 6350.00,
    changes: { '15m': -0.20, '30m': -0.50, '1H': -0.95, '1D': -1.48, '1W': +1.80 },
    high: 6480.00,
    low: 6280.00,
    volume: '1.6M'
  },

  // 15. Distribution services (0.78%)
  {
    symbol: 'ADANIENT',
    name: 'Adani Enterprises Ltd.',
    sector: 'Distribution services',
    weight: 0.78,
    ltp: 2820.00,
    changes: { '15m': -0.15, '30m': -0.38, '1H': -0.72, '1D': -1.15, '1W': +0.40 },
    high: 2865.00,
    low: 2795.00,
    volume: '2.9M'
  }
];

export interface HeatmapTile extends Constituent {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SectorBlock {
  sector: string;
  weight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  tiles: HeatmapTile[];
}

/**
 * Dynamic continuous color calculation based on percentage change.
 * Interpolates smoothly from -3.0% (vibrant crimson) to 0.0% (dark neutral) to +3.0% (vibrant emerald).
 */
export function getDynamicHeatmapColor(pct: number): { bg: string; border: string; text: string } {
  const clamped = Math.max(-3.0, Math.min(pct, 3.0));

  if (clamped < 0) {
    const t = Math.abs(clamped) / 3.0; // 0 (neutral) to 1 (-3% max red)
    const r = Math.round(26 + t * (195 - 26));
    const g = Math.round(26 + t * (28 - 26));
    const b = Math.round(26 + t * (38 - 26));
    const brR = Math.round(40 + t * (220 - 40));
    const brG = Math.round(40 + t * (35 - 40));
    const brB = Math.round(40 + t * (45 - 40));
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      border: `rgb(${brR}, ${brG}, ${brB})`,
      text: '#ffffff'
    };
  } else if (clamped > 0) {
    const t = clamped / 3.0; // 0 (neutral) to 1 (+3% max green)
    const r = Math.round(26 + t * (22 - 26));
    const g = Math.round(26 + t * (165 - 26));
    const b = Math.round(26 + t * (74 - 26));
    const brR = Math.round(40 + t * (34 - 40));
    const brG = Math.round(40 + t * (197 - 40));
    const brB = Math.round(40 + t * (94 - 40));
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      border: `rgb(${brR}, ${brG}, ${brB})`,
      text: '#ffffff'
    };
  } else {
    return {
      bg: '#1a1a1a',
      border: '#2e2e2e',
      text: '#ffffff'
    };
  }
}

/**
 * Squarified Treemap Algorithm (Bruls, Huizing, van Wijk).
 * Subdivides along the shorter edge to maintain near-1:1 aspect ratios.
 */
function layoutSquarified<T extends { weight: number }>(
  items: T[],
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Array<T & { x: number; y: number; width: number; height: number }> {
  if (items.length === 0 || rw <= 0 || rh <= 0) return [];

  const totalWeight = items.reduce((s, it) => s + it.weight, 0);
  if (totalWeight <= 0) return [];

  const totalArea = rw * rh;
  const nodes = items
    .map((it) => ({
      item: it,
      area: (it.weight / totalWeight) * totalArea
    }))
    .sort((a, b) => b.area - a.area);

  const rects: Array<T & { x: number; y: number; width: number; height: number }> = [];

  function worstAspect(row: typeof nodes, rowLength: number): number {
    if (row.length === 0) return Infinity;
    const rowArea = row.reduce((s, n) => s + n.area, 0);
    const rowBreadth = rowArea / rowLength;
    if (rowBreadth <= 0) return Infinity;

    let worst = 0;
    for (const node of row) {
      const len = node.area / rowBreadth;
      const aspect = Math.max(len / rowBreadth, rowBreadth / len);
      if (aspect > worst) worst = aspect;
    }
    return worst;
  }

  function layoutRow(
    row: typeof nodes,
    rowLength: number,
    alongWidth: boolean,
    x: number,
    y: number
  ): number {
    const rowArea = row.reduce((s, n) => s + n.area, 0);
    const rowBreadth = Math.max(1, rowArea / rowLength);
    let offset = 0;

    for (const node of row) {
      const nodeLength = Math.max(1, node.area / rowBreadth);
      if (alongWidth) {
        rects.push({
          ...node.item,
          x: x + offset,
          y,
          width: nodeLength,
          height: rowBreadth
        });
      } else {
        rects.push({
          ...node.item,
          x,
          y: y + offset,
          width: rowBreadth,
          height: nodeLength
        });
      }
      offset += nodeLength;
    }
    return rowBreadth;
  }

  function step(remaining: typeof nodes, x: number, y: number, w: number, h: number) {
    if (remaining.length === 0 || w <= 0 || h <= 0) return;

    // Subdivide along the shorter edge
    const alongWidth = w < h;
    const rowLength = alongWidth ? w : h;

    let row = [remaining[0]];
    let i = 1;

    while (i < remaining.length) {
      const candidate = [...row, remaining[i]];
      if (worstAspect(candidate, rowLength) <= worstAspect(row, rowLength)) {
        row = candidate;
        i++;
      } else {
        break;
      }
    }

    const rowBreadth = layoutRow(row, rowLength, alongWidth, x, y);
    const unplaced = remaining.slice(row.length);

    if (alongWidth) {
      step(unplaced, x, y + rowBreadth, w, Math.max(0, h - rowBreadth));
    } else {
      step(unplaced, x + rowBreadth, y, Math.max(0, w - rowBreadth), h);
    }
  }

  step(nodes, rx, ry, rw, rh);
  return rects;
}

interface NiftyHeatmapProps {
  timeFilter?: HeatmapTimeFilter;
  onTimeFilterChange?: (tf: HeatmapTimeFilter) => void;
  onSelectConstituent?: (c: Constituent) => void;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export const NiftyHeatmap: React.FC<NiftyHeatmapProps> = ({
  timeFilter: externalTimeFilter,
  onTimeFilterChange,
  onSelectConstituent,
  onClose,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalTimeFilter, setInternalTimeFilter] = useState<HeatmapTimeFilter>('1D');
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [selectedSector, setSelectedSector] = useState<string>('All');
  const [hoveredTile, setHoveredTile] = useState<HeatmapTile | null>(null);
  const [selectedTile, setSelectedTile] = useState<HeatmapTile | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const currentTimeFilter = externalTimeFilter || internalTimeFilter;

  const handleTimeChange = (tf: HeatmapTimeFilter) => {
    setInternalTimeFilter(tf);
    onTimeFilterChange?.(tf);
  };

  // Measure container size dynamically via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries.length) return;
      const entry = entries[0];
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Distinct sectors list (with 'All' at beginning)
  const sectors = useMemo(() => {
    const set = new Set<string>();
    NIFTY_50_CONSTITUENTS.forEach((c) => set.add(c.sector));
    return ['All', ...Array.from(set)];
  }, []);

  // Filtered constituents based on search and optional sector selection
  const filteredConstituents = useMemo(() => {
    return NIFTY_50_CONSTITUENTS.filter((c) => {
      const matchSector = selectedSector === 'All' || c.sector === selectedSector;
      const matchSearch =
        !searchQuery ||
        c.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSector && matchSearch;
    });
  }, [selectedSector, searchQuery]);

  // Compute Hierarchical TradingView-Style Sector Split Treemap
  const sectorBlocks = useMemo<SectorBlock[]>(() => {
    const paddingX = 8;
    const headerSpace = 78; // top header bar & sector pills
    const footerSpace = 38; // bottom dynamic legend & inspector
    const availableW = Math.max(100, dimensions.width - paddingX * 2);
    const availableH = Math.max(100, dimensions.height - headerSpace - footerSpace);

    // If a specific sector is selected, render only that sector filling 100% of the canvas
    if (selectedSector !== 'All') {
      const sectorConstituents = filteredConstituents;
      if (sectorConstituents.length === 0) return [];

      const sectorWeight = sectorConstituents.reduce((s, c) => s + c.weight, 0);
      const headerH = 20;
      const innerW = Math.max(1, availableW - 2);
      const innerH = Math.max(1, availableH - headerH - 2);
      const tiles = layoutSquarified(sectorConstituents, 0, 0, innerW, innerH);

      return [
        {
          sector: selectedSector,
          weight: sectorWeight,
          x: 0,
          y: 0,
          width: availableW,
          height: availableH,
          tiles
        }
      ];
    }

    // When 'All' is selected: Group constituents by sector
    const sectorMap = new Map<string, { sector: string; weight: number; constituents: Constituent[] }>();
    filteredConstituents.forEach((c) => {
      if (!sectorMap.has(c.sector)) {
        sectorMap.set(c.sector, { sector: c.sector, weight: 0, constituents: [] });
      }
      const s = sectorMap.get(c.sector)!;
      s.weight += c.weight;
      s.constituents.push(c);
    });

    const sectorGroups = Array.from(sectorMap.values());
    if (sectorGroups.length === 0) return [];

    // 1. Layout sector containers across canvas
    const placedSectors = layoutSquarified(sectorGroups, 0, 0, availableW, availableH);

    // 2. Layout stocks inside each sector container
    return placedSectors.map((sec) => {
      const headerH = Math.min(20, Math.max(14, sec.height * 0.16));
      const innerW = Math.max(1, sec.width - 2);
      const innerH = Math.max(1, sec.height - headerH - 2);
      const tiles = layoutSquarified(sec.constituents, 0, 0, innerW, innerH);

      return {
        sector: sec.sector,
        weight: sec.weight,
        x: sec.x,
        y: sec.y,
        width: sec.width,
        height: sec.height,
        tiles
      };
    });
  }, [filteredConstituents, selectedSector, dimensions]);

  // Breadth stats
  const summary = useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;

    filteredConstituents.forEach((c) => {
      const chg = c.changes[currentTimeFilter];
      if (chg > 0.05) advances++;
      else if (chg < -0.05) declines++;
      else unchanged++;
    });

    return { advances, declines, unchanged };
  }, [filteredConstituents, currentTimeFilter]);

  const activeConstituent = hoveredTile || selectedTile || null;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        color: '#e5e7eb',
        fontFamily: 'Quicksand, sans-serif',
        userSelect: 'none',
        ...style
      }}
    >
      {/* Top Header Bar: Navigation, Title, Timeframes */}
      <div
        style={{
          padding: '0.45rem 0.75rem',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#050505',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {onClose && (
            <button
              onClick={onClose}
              title="Return to Dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                color: '#CCCCCC',
                backgroundColor: '#121212',
                border: '1px solid #262626',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Dashboard</span>
            </button>
          )}

          {/* Minimalist Treemap Grid SVG Icon (no emojis) */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#5F7A9A' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="10" height="11" rx="1.5" />
              <rect x="15" y="3" width="6" height="6" rx="1.5" />
              <rect x="15" y="11" width="6" height="10" rx="1.5" />
              <rect x="3" y="16" width="10" height="5" rx="1.5" />
            </svg>
          </div>

          <span style={{ fontWeight: 800, fontSize: '0.86rem', letterSpacing: '-0.01em', color: '#ffffff' }}>
            NIFTY 50 HEATMAP
          </span>
          <span style={{ fontSize: '0.68rem', color: '#5F7A9A', fontWeight: 600 }}>
            (Nov 19, 2026)
          </span>
        </div>

        {/* Time Filter Tabs: 15m, 30m, 1H, 1D, 1W */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '2px',
              backgroundColor: '#0a0a0a',
              padding: '2px',
              borderRadius: '4px',
              border: '1px solid #1f1f1f'
            }}
          >
            {(['15m', '30m', '1H', '1D', '1W'] as HeatmapTimeFilter[]).map((tf) => {
              const isActive = currentTimeFilter === tf;
              return (
                <button
                  key={tf}
                  onClick={() => handleTimeChange(tf)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.70rem',
                    fontWeight: isActive ? 700 : 400,
                    border: 'none',
                    backgroundColor: isActive ? '#5F7A9A' : 'transparent',
                    color: isActive ? '#ffffff' : '#CCCCCC',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sector Filter Pills & Search Bar */}
      <div
        style={{
          padding: '0.35rem 0.75rem',
          borderBottom: '1px solid #141414',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#030303',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        {/* Sector Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            maxWidth: '80%'
          }}
        >
          {sectors.map((sec) => {
            const isSelected = selectedSector === sec;
            return (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.67rem',
                  fontWeight: isSelected ? 700 : 400,
                  borderRadius: '3px',
                  border: isSelected ? '1px solid #5F7A9A' : '1px solid #1f1f1f',
                  backgroundColor: isSelected ? 'rgba(95, 122, 154, 0.25)' : '#080808',
                  color: isSelected ? '#5F7A9A' : '#CCCCCC',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease'
                }}
              >
                {sec}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <input
          type="text"
          placeholder="Filter stock..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            backgroundColor: '#0a0a0a',
            border: '1px solid #262626',
            borderRadius: '3px',
            padding: '2px 8px',
            fontSize: '0.67rem',
            color: '#ffffff',
            outline: 'none',
            width: '100px'
          }}
        />
      </div>

      {/* Main Visual Treemap Canvas (Split in Sectors like TradingView) */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: '4px',
          overflow: 'hidden',
          minHeight: 0
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%'
          }}
        >
          {sectorBlocks.map((block) => {
            const headerH = Math.min(20, Math.max(14, block.height * 0.16));
            return (
              <div
                key={block.sector}
                style={{
                  position: 'absolute',
                  left: `${block.x}px`,
                  top: `${block.y}px`,
                  width: `${Math.max(4, block.width - 2)}px`,
                  height: `${Math.max(4, block.height - 2)}px`,
                  border: '1px solid #161616',
                  backgroundColor: '#000000',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Sector Header Label (TradingView Style, e.g. "Finance >") */}
                <div
                  onClick={() => setSelectedSector((prev) => (prev === block.sector ? 'All' : block.sector))}
                  title={`Filter to ${block.sector}`}
                  style={{
                    height: `${headerH}px`,
                    padding: '0 6px',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: '#CCCCCC',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: '#060606',
                    borderBottom: '1px solid #121212',
                    transition: 'color 0.15s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#5F7A9A')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {block.sector}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#666666' }}>›</span>
                </div>

                {/* Inner Area: Stock Tiles within this Sector */}
                <div
                  style={{
                    flex: 1,
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden'
                  }}
                >
                  {block.tiles.map((tile) => {
                    const chg = tile.changes[currentTimeFilter];
                    const colorScheme = getDynamicHeatmapColor(chg);
                    const isSelected = selectedTile?.symbol === tile.symbol;
                    const isHovered = hoveredTile?.symbol === tile.symbol;

                    const tileW = Math.max(2, tile.width - 1);
                    const tileH = Math.max(2, tile.height - 1);
                    const minDim = Math.min(tileW, tileH);

                    // Dynamic font size calculation based on tile area
                    let symbolFontSize = '0.72rem';
                    let changeFontSize = '0.68rem';

                    if (minDim >= 180) {
                      symbolFontSize = '1.15rem';
                      changeFontSize = '1.02rem';
                    } else if (minDim >= 120) {
                      symbolFontSize = '0.98rem';
                      changeFontSize = '0.88rem';
                    } else if (minDim >= 80) {
                      symbolFontSize = '0.85rem';
                      changeFontSize = '0.76rem';
                    } else if (minDim >= 52) {
                      symbolFontSize = '0.72rem';
                      changeFontSize = '0.66rem';
                    } else if (minDim >= 36) {
                      symbolFontSize = '0.62rem';
                      changeFontSize = '0.58rem';
                    } else {
                      symbolFontSize = '0.54rem';
                      changeFontSize = '0.50rem';
                    }

                    return (
                      <div
                        key={tile.symbol}
                        onMouseEnter={() => setHoveredTile(tile)}
                        onMouseLeave={() => setHoveredTile(null)}
                        onClick={() => {
                          setSelectedTile(tile);
                          onSelectConstituent?.(tile);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${tile.x}px`,
                          top: `${tile.y}px`,
                          width: `${tileW}px`,
                          height: `${tileH}px`,
                          backgroundColor: colorScheme.bg,
                          border: isSelected || isHovered ? '2px solid #5F7A9A' : `1px solid ${colorScheme.border}`,
                          borderRadius: '2px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '2px',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          zIndex: isSelected || isHovered ? 10 : 1,
                          boxShadow: isSelected || isHovered ? '0 0 10px rgba(95, 122, 154, 0.6)' : 'none',
                          transition: 'border 0.12s ease'
                        }}
                      >
                        {/* Stock Symbol (Pure text, no logos) */}
                        <span
                          style={{
                            fontSize: symbolFontSize,
                            fontWeight: 800,
                            color: '#ffffff',
                            lineHeight: 1.1,
                            textAlign: 'center',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            maxWidth: '96%',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {tile.symbol}
                        </span>

                        {/* Percentage Change (Pure text, formatted clearly) */}
                        {tileH >= 24 && (
                          <span
                            style={{
                              fontSize: changeFontSize,
                              fontWeight: 600,
                              color: '#ffffff',
                              lineHeight: 1.1,
                              marginTop: '2px'
                            }}
                          >
                            {chg > 0 ? '+' : ''}
                            {chg.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Bar: Dynamic Color Legend Scale & Stock Inspector */}
      <div
        style={{
          padding: '0.35rem 0.75rem',
          borderTop: '1px solid #141414',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#050505',
          fontSize: '0.68rem',
          flexShrink: 0
        }}
      >
        {/* Continuous Dynamic Color Scale (-3% to +3%) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              height: '8px',
              width: '130px',
              borderRadius: '2px',
              background: 'linear-gradient(to right, rgb(195, 28, 38) 0%, rgb(111, 27, 32) 30%, rgb(26, 26, 26) 50%, rgb(24, 96, 50) 70%, rgb(22, 165, 74) 100%)',
              border: '1px solid #262626'
            }}
          />
          <div style={{ display: 'flex', gap: '6px', fontSize: '0.63rem', color: '#CCCCCC' }}>
            <span>-3%</span>
            <span>-2%</span>
            <span>-1%</span>
            <span>0%</span>
            <span>+1%</span>
            <span>+2%</span>
            <span>+3%</span>
          </div>
        </div>

        {/* Selected or Hovered Stock Info */}
        {activeConstituent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, color: '#ffffff' }}>{activeConstituent.symbol}</span>
            <span style={{ color: '#888888', fontSize: '0.64rem' }}>{activeConstituent.name}</span>
            <span style={{ color: '#5F7A9A' }}>Wt: {activeConstituent.weight.toFixed(2)}%</span>
            <span style={{ color: '#ffffff', fontWeight: 600 }}>₹{activeConstituent.ltp.toFixed(1)}</span>
            <span
              style={{
                fontWeight: 700,
                color: activeConstituent.changes[currentTimeFilter] >= 0 ? '#4ade80' : '#f87171'
              }}
            >
              {activeConstituent.changes[currentTimeFilter] >= 0 ? '+' : ''}
              {activeConstituent.changes[currentTimeFilter].toFixed(2)}%
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.68rem' }}>
            <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontWeight: 800 }}>+{summary.advances}</span>
              <span style={{ color: '#888', fontSize: '0.62rem' }}>Adv</span>
            </span>
            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontWeight: 800 }}>-{summary.declines}</span>
              <span style={{ color: '#888', fontSize: '0.62rem' }}>Dec</span>
            </span>
            <span style={{ color: '#CCCCCC', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontWeight: 800 }}>{summary.unchanged}</span>
              <span style={{ color: '#888', fontSize: '0.62rem' }}>Unch</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NiftyHeatmap;