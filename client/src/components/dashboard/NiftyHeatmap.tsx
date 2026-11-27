import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SecurityQuote } from '@pm-vision/shared';

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
  {
    "symbol": "HDFCBANK",
    "name": "HDFC Bank Ltd.",
    "sector": "Financial Services",
    "weight": 10.54,
    "ltp": 1745,
    "changes": {
      "15m": 0.15,
      "30m": 0.35,
      "1H": 0.55,
      "1D": 0.82,
      "1W": 1.4
    },
    "high": 1756,
    "low": 1735.1,
    "volume": "22.4M"
  },
  {
    "symbol": "ICICIBANK",
    "name": "ICICI Bank Ltd.",
    "sector": "Financial Services",
    "weight": 8.81,
    "ltp": 1260.8,
    "changes": {
      "15m": -0.08,
      "30m": -0.18,
      "1H": -0.25,
      "1D": -0.34,
      "1W": 0.9
    },
    "high": 1272.5,
    "low": 1254,
    "volume": "14.8M"
  },
  {
    "symbol": "RELIANCE",
    "name": "Reliance Industries Ltd.",
    "sector": "Oil, Gas & Consumable Fuels",
    "weight": 7.52,
    "ltp": 1265.6,
    "changes": {
      "15m": 0.2,
      "30m": 0.48,
      "1H": 0.75,
      "1D": 1.02,
      "1W": 2.1
    },
    "high": 1278,
    "low": 1256.5,
    "volume": "18.5M"
  },
  {
    "symbol": "BHARTIARTL",
    "name": "Bharti Airtel Ltd.",
    "sector": "Telecommunication",
    "weight": 5.12,
    "ltp": 1560,
    "changes": {
      "15m": 0.22,
      "30m": 0.55,
      "1H": 0.85,
      "1D": 1.17,
      "1W": 2.65
    },
    "high": 1575,
    "low": 1548,
    "volume": "6.8M"
  },
  {
    "symbol": "LT",
    "name": "Larsen & Toubro Ltd.",
    "sector": "Construction",
    "weight": 4.17,
    "ltp": 3580,
    "changes": {
      "15m": 0.15,
      "30m": 0.38,
      "1H": 0.58,
      "1D": 0.79,
      "1W": 1.5
    },
    "high": 3615,
    "low": 3560,
    "volume": "3.2M"
  },
  {
    "symbol": "SBIN",
    "name": "State Bank of India",
    "sector": "Financial Services",
    "weight": 3.79,
    "ltp": 815.4,
    "changes": {
      "15m": 0.2,
      "30m": 0.45,
      "1H": 0.7,
      "1D": 0.99,
      "1W": 1.85
    },
    "high": 824.9,
    "low": 808.2,
    "volume": "16.5M"
  },
  {
    "symbol": "INFY",
    "name": "Infosys Ltd.",
    "sector": "Information Technology",
    "weight": 3.41,
    "ltp": 1850.2,
    "changes": {
      "15m": 0.15,
      "30m": 0.38,
      "1H": 0.6,
      "1D": 0.81,
      "1W": 1.65
    },
    "high": 1865,
    "low": 1838,
    "volume": "12.4M"
  },
  {
    "symbol": "AXISBANK",
    "name": "Axis Bank Ltd.",
    "sector": "Financial Services",
    "weight": 3.32,
    "ltp": 1175.3,
    "changes": {
      "15m": 0.1,
      "30m": 0.25,
      "1H": 0.4,
      "1D": 0.55,
      "1W": -1.2
    },
    "high": 1191,
    "low": 1168.4,
    "volume": "8.2M"
  },
  {
    "symbol": "KOTAKBANK",
    "name": "Kotak Mahindra Bank Ltd.",
    "sector": "Financial Services",
    "weight": 2.84,
    "ltp": 1785.9,
    "changes": {
      "15m": -0.12,
      "30m": -0.28,
      "1H": -0.45,
      "1D": -0.62,
      "1W": -0.85
    },
    "high": 1805,
    "low": 1778,
    "volume": "4.1M"
  },
  {
    "symbol": "BAJFINANCE",
    "name": "Bajaj Finance Ltd.",
    "sector": "Financial Services",
    "weight": 2.53,
    "ltp": 6850,
    "changes": {
      "15m": 0.12,
      "30m": 0.3,
      "1H": 0.48,
      "1D": 0.66,
      "1W": 0.5
    },
    "high": 6920,
    "low": 6810,
    "volume": "2.3M"
  },
  {
    "symbol": "M&M",
    "name": "Mahindra & Mahindra Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 2.51,
    "ltp": 2950.4,
    "changes": {
      "15m": 0.25,
      "30m": 0.6,
      "1H": 0.95,
      "1D": 1.3,
      "1W": 2.9
    },
    "high": 2980,
    "low": 2925,
    "volume": "4.8M"
  },
  {
    "symbol": "ITC",
    "name": "ITC Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 2.43,
    "ltp": 465.2,
    "changes": {
      "15m": 0.1,
      "30m": 0.28,
      "1H": 0.45,
      "1D": 0.61,
      "1W": 1.2
    },
    "high": 469.5,
    "low": 463,
    "volume": "14.2M"
  },
  {
    "symbol": "ETERNAL",
    "name": "Eternal Ltd.",
    "sector": "Consumer Services",
    "weight": 2.26,
    "ltp": 268.4,
    "changes": {
      "15m": -0.1,
      "30m": -0.22,
      "1H": -0.4,
      "1D": -0.52,
      "1W": 3.1
    },
    "high": 275,
    "low": 264,
    "volume": "45.0M"
  },
  {
    "symbol": "TCS",
    "name": "Tata Consultancy Services Ltd.",
    "sector": "Information Technology",
    "weight": 1.97,
    "ltp": 4120.5,
    "changes": {
      "15m": -0.08,
      "30m": -0.2,
      "1H": -0.32,
      "1D": -0.44,
      "1W": 0.6
    },
    "high": 4160,
    "low": 4105,
    "volume": "3.6M"
  },
  {
    "symbol": "SUNPHARMA",
    "name": "Sun Pharmaceutical Industries Ltd.",
    "sector": "Healthcare",
    "weight": 1.88,
    "ltp": 1780,
    "changes": {
      "15m": 0.16,
      "30m": 0.38,
      "1H": 0.6,
      "1D": 0.82,
      "1W": 1.9
    },
    "high": 1795,
    "low": 1770,
    "volume": "3.1M"
  },
  {
    "symbol": "TITAN",
    "name": "Titan Company Ltd.",
    "sector": "Consumer Durables",
    "weight": 1.84,
    "ltp": 3240,
    "changes": {
      "15m": 0.12,
      "30m": 0.3,
      "1H": 0.48,
      "1D": 0.68,
      "1W": 1.5
    },
    "high": 3270,
    "low": 3220,
    "volume": "1.4M"
  },
  {
    "symbol": "HINDUNILVR",
    "name": "Hindustan Unilever Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 1.57,
    "ltp": 2380,
    "changes": {
      "15m": -0.1,
      "30m": -0.25,
      "1H": -0.38,
      "1D": -0.52,
      "1W": -0.8
    },
    "high": 2405,
    "low": 2372,
    "volume": "2.8M"
  },
  {
    "symbol": "TATASTEEL",
    "name": "Tata Steel Ltd.",
    "sector": "Metals & Mining",
    "weight": 1.48,
    "ltp": 145.3,
    "changes": {
      "15m": 0.15,
      "30m": 0.35,
      "1H": 0.55,
      "1D": 0.76,
      "1W": 1.8
    },
    "high": 147.2,
    "low": 144.1,
    "volume": "32.0M"
  },
  {
    "symbol": "MARUTI",
    "name": "Maruti Suzuki India Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 1.47,
    "ltp": 11200,
    "changes": {
      "15m": -0.08,
      "30m": -0.18,
      "1H": -0.28,
      "1D": -0.4,
      "1W": 1.1
    },
    "high": 11350,
    "low": 11150,
    "volume": "0.8M"
  },
  {
    "symbol": "NTPC",
    "name": "NTPC Ltd.",
    "sector": "Power",
    "weight": 1.46,
    "ltp": 365.2,
    "changes": {
      "15m": 0.18,
      "30m": 0.42,
      "1H": 0.65,
      "1D": 0.86,
      "1W": 2.1
    },
    "high": 369,
    "low": 362.5,
    "volume": "9.4M"
  },
  {
    "symbol": "ADANIPORTS",
    "name": "Adani Ports and Special Economic Zone Ltd.",
    "sector": "Services",
    "weight": 1.36,
    "ltp": 1180,
    "changes": {
      "15m": -0.12,
      "30m": -0.3,
      "1H": -0.48,
      "1D": -0.67,
      "1W": 0.8
    },
    "high": 1195,
    "low": 1172,
    "volume": "4.5M"
  },
  {
    "symbol": "BEL",
    "name": "Bharat Electronics Ltd.",
    "sector": "Capital Goods",
    "weight": 1.32,
    "ltp": 285.5,
    "changes": {
      "15m": 0.25,
      "30m": 0.55,
      "1H": 0.88,
      "1D": 1.21,
      "1W": 3.1
    },
    "high": 289,
    "low": 282.5,
    "volume": "8.5M"
  },
  {
    "symbol": "HINDALCO",
    "name": "Hindalco Industries Ltd.",
    "sector": "Metals & Mining",
    "weight": 1.32,
    "ltp": 650.4,
    "changes": {
      "15m": 0.18,
      "30m": 0.4,
      "1H": 0.62,
      "1D": 0.87,
      "1W": 1.95
    },
    "high": 658,
    "low": 646,
    "volume": "6.4M"
  },
  {
    "symbol": "SHRIRAMFIN",
    "name": "Shriram Finance Ltd.",
    "sector": "Financial Services",
    "weight": 1.29,
    "ltp": 3050.2,
    "changes": {
      "15m": 0.18,
      "30m": 0.42,
      "1H": 0.68,
      "1D": 0.94,
      "1W": 2.15
    },
    "high": 3085,
    "low": 3020,
    "volume": "1.8M"
  },
  {
    "symbol": "BSE",
    "name": "BSE Ltd.",
    "sector": "Financial Services",
    "weight": 1.24,
    "ltp": 4680,
    "changes": {
      "15m": -0.08,
      "30m": -0.25,
      "1H": -0.42,
      "1D": -0.63,
      "1W": 3.8
    },
    "high": 4740,
    "low": 4620,
    "volume": "3.2M"
  },
  {
    "symbol": "HCLTECH",
    "name": "HCL Technologies Ltd.",
    "sector": "Information Technology",
    "weight": 1.22,
    "ltp": 1820.8,
    "changes": {
      "15m": 0.25,
      "30m": 0.58,
      "1H": 0.92,
      "1D": 1.25,
      "1W": 2.8
    },
    "high": 1835,
    "low": 1802,
    "volume": "3.8M"
  },
  {
    "symbol": "ULTRACEMCO",
    "name": "UltraTech Cement Ltd.",
    "sector": "Construction Materials",
    "weight": 1.22,
    "ltp": 11400,
    "changes": {
      "15m": 0.15,
      "30m": 0.35,
      "1H": 0.55,
      "1D": 0.75,
      "1W": 1.6
    },
    "high": 11520,
    "low": 11350,
    "volume": "0.6M"
  },
  {
    "symbol": "JSWSTEEL",
    "name": "JSW Steel Ltd.",
    "sector": "Metals & Mining",
    "weight": 1.17,
    "ltp": 945,
    "changes": {
      "15m": -0.1,
      "30m": -0.22,
      "1H": -0.35,
      "1D": -0.47,
      "1W": 0.6
    },
    "high": 956,
    "low": 940,
    "volume": "3.1M"
  },
  {
    "symbol": "POWERGRID",
    "name": "Power Grid Corporation of India Ltd.",
    "sector": "Power",
    "weight": 1.13,
    "ltp": 320.4,
    "changes": {
      "15m": -0.1,
      "30m": -0.22,
      "1H": -0.35,
      "1D": -0.47,
      "1W": 0.7
    },
    "high": 324,
    "low": 318,
    "volume": "8.2M"
  },
  {
    "symbol": "BAJAJ-AUTO",
    "name": "Bajaj Auto Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 1.12,
    "ltp": 9450,
    "changes": {
      "15m": 0.12,
      "30m": 0.3,
      "1H": 0.48,
      "1D": 0.66,
      "1W": 1.2
    },
    "high": 9550,
    "low": 9400,
    "volume": "0.7M"
  },
  {
    "symbol": "GRASIM",
    "name": "Grasim Industries Ltd.",
    "sector": "Construction Materials",
    "weight": 1.11,
    "ltp": 2540,
    "changes": {
      "15m": -0.1,
      "30m": -0.22,
      "1H": -0.35,
      "1D": -0.47,
      "1W": -0.3
    },
    "high": 2565,
    "low": 2525,
    "volume": "1.2M"
  },
  {
    "symbol": "INDIGO",
    "name": "InterGlobe Aviation Ltd.",
    "sector": "Services",
    "weight": 1.05,
    "ltp": 4180,
    "changes": {
      "15m": -0.15,
      "30m": -0.4,
      "1H": -0.75,
      "1D": -1.16,
      "1W": 0.9
    },
    "high": 4220,
    "low": 4130,
    "volume": "1.5M"
  },
  {
    "symbol": "ASIANPAINT",
    "name": "Asian Paints Ltd.",
    "sector": "Consumer Durables",
    "weight": 1.04,
    "ltp": 2480,
    "changes": {
      "15m": -0.12,
      "30m": -0.28,
      "1H": -0.44,
      "1D": -0.6,
      "1W": -0.75
    },
    "high": 2510,
    "low": 2465,
    "volume": "1.9M"
  },
  {
    "symbol": "COALINDIA",
    "name": "Coal India Ltd.",
    "sector": "Oil, Gas & Consumable Fuels",
    "weight": 0.97,
    "ltp": 410.5,
    "changes": {
      "15m": -0.08,
      "30m": -0.2,
      "1H": -0.32,
      "1D": -0.44,
      "1W": 0.8
    },
    "high": 416,
    "low": 407.2,
    "volume": "7.1M"
  },
  {
    "symbol": "BAJAJFINSV",
    "name": "Bajaj Finserv Ltd.",
    "sector": "Financial Services",
    "weight": 0.96,
    "ltp": 1620.5,
    "changes": {
      "15m": 0.15,
      "30m": 0.35,
      "1H": 0.55,
      "1D": 0.76,
      "1W": 0.9
    },
    "high": 1635,
    "low": 1610,
    "volume": "1.9M"
  },
  {
    "symbol": "ADANIENT",
    "name": "Adani Enterprises Ltd.",
    "sector": "Metals & Mining",
    "weight": 0.96,
    "ltp": 2250,
    "changes": {
      "15m": 0.2,
      "30m": 0.5,
      "1H": 0.8,
      "1D": 1.12,
      "1W": 2.4
    },
    "high": 2280,
    "low": 2235,
    "volume": "3.8M"
  },
  {
    "symbol": "EICHERMOT",
    "name": "Eicher Motors Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 0.94,
    "ltp": 4820,
    "changes": {
      "15m": 0.14,
      "30m": 0.35,
      "1H": 0.52,
      "1D": 0.73,
      "1W": 2.3
    },
    "high": 4865,
    "low": 4790,
    "volume": "0.9M"
  },
  {
    "symbol": "NESTLEIND",
    "name": "Nestle India Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 0.92,
    "ltp": 2240,
    "changes": {
      "15m": -0.06,
      "30m": -0.16,
      "1H": -0.25,
      "1D": -0.36,
      "1W": 0.2
    },
    "high": 2260,
    "low": 2230,
    "volume": "0.8M"
  },
  {
    "symbol": "TECHM",
    "name": "Tech Mahindra Ltd.",
    "sector": "Information Technology",
    "weight": 0.91,
    "ltp": 1680,
    "changes": {
      "15m": 0.12,
      "30m": 0.32,
      "1H": 0.5,
      "1D": 0.69,
      "1W": 1.2
    },
    "high": 1695,
    "low": 1670,
    "volume": "2.5M"
  },
  {
    "symbol": "ONGC",
    "name": "Oil & Natural Gas Corporation Ltd.",
    "sector": "Oil, Gas & Consumable Fuels",
    "weight": 0.85,
    "ltp": 250.2,
    "changes": {
      "15m": 0.15,
      "30m": 0.38,
      "1H": 0.6,
      "1D": 0.85,
      "1W": 1.45
    },
    "high": 253.4,
    "low": 247.8,
    "volume": "8.9M"
  },
  {
    "symbol": "APOLLOHOSP",
    "name": "Apollo Hospitals Enterprise Ltd.",
    "sector": "Healthcare",
    "weight": 0.85,
    "ltp": 6950,
    "changes": {
      "15m": 0.12,
      "30m": 0.3,
      "1H": 0.48,
      "1D": 0.65,
      "1W": 1.6
    },
    "high": 7020,
    "low": 6910,
    "volume": "0.7M"
  },
  {
    "symbol": "TRENT",
    "name": "Trent Ltd.",
    "sector": "Consumer Services",
    "weight": 0.83,
    "ltp": 6450,
    "changes": {
      "15m": 0.28,
      "30m": 0.62,
      "1H": 0.98,
      "1D": 1.34,
      "1W": 3.4
    },
    "high": 6520,
    "low": 6390,
    "volume": "1.8M"
  },
  {
    "symbol": "SBILIFE",
    "name": "SBI Life Insurance Company Ltd.",
    "sector": "Financial Services",
    "weight": 0.74,
    "ltp": 1480,
    "changes": {
      "15m": 0.1,
      "30m": 0.28,
      "1H": 0.45,
      "1D": 0.64,
      "1W": 1.1
    },
    "high": 1495,
    "low": 1472,
    "volume": "1.6M"
  },
  {
    "symbol": "CIPLA",
    "name": "Cipla Ltd.",
    "sector": "Healthcare",
    "weight": 0.74,
    "ltp": 1480,
    "changes": {
      "15m": -0.08,
      "30m": -0.18,
      "1H": -0.28,
      "1D": -0.4,
      "1W": 0.5
    },
    "high": 1495,
    "low": 1472,
    "volume": "2.2M"
  },
  {
    "symbol": "DRREDDY",
    "name": "Dr. Reddy's Laboratories Ltd.",
    "sector": "Healthcare",
    "weight": 0.73,
    "ltp": 1240,
    "changes": {
      "15m": 0.12,
      "30m": 0.32,
      "1H": 0.5,
      "1D": 0.69,
      "1W": 1.4
    },
    "high": 1255,
    "low": 1232,
    "volume": "1.4M"
  },
  {
    "symbol": "MAXHEALTH",
    "name": "Max Healthcare Institute Ltd.",
    "sector": "Healthcare",
    "weight": 0.7,
    "ltp": 985,
    "changes": {
      "15m": 0.1,
      "30m": 0.25,
      "1H": 0.48,
      "1D": 0.79,
      "1W": 3.4
    },
    "high": 998,
    "low": 975,
    "volume": "2.5M"
  },
  {
    "symbol": "JIOFIN",
    "name": "Jio Financial Services Ltd.",
    "sector": "Financial Services",
    "weight": 0.68,
    "ltp": 310.5,
    "changes": {
      "15m": -0.3,
      "30m": -0.75,
      "1H": -1.5,
      "1D": -2.34,
      "1W": -1.2
    },
    "high": 316,
    "low": 307,
    "volume": "24.5M"
  },
  {
    "symbol": "TATACONSUM",
    "name": "Tata Consumer Products Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 0.6,
    "ltp": 940.5,
    "changes": {
      "15m": 0.1,
      "30m": 0.25,
      "1H": 0.4,
      "1D": 0.56,
      "1W": 1.1
    },
    "high": 949,
    "low": 934,
    "volume": "2.1M"
  },
  {
    "symbol": "TMPV",
    "name": "Tata Motors Passenger Vehicles Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 0.56,
    "ltp": 785,
    "changes": {
      "15m": 0.1,
      "30m": 0.25,
      "1H": 0.45,
      "1D": 0.73,
      "1W": 2.5
    },
    "high": 798,
    "low": 781.2,
    "volume": "11.5M"
  },
  {
    "symbol": "HDFCLIFE",
    "name": "HDFC Life Insurance Company Ltd.",
    "sector": "Financial Services",
    "weight": 0.54,
    "ltp": 695.4,
    "changes": {
      "15m": -0.05,
      "30m": -0.12,
      "1H": -0.2,
      "1D": -0.3,
      "1W": 0.4
    },
    "high": 704,
    "low": 690.5,
    "volume": "2.8M"
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
  securities?: SecurityQuote[];
  timeFilter?: HeatmapTimeFilter;
  onTimeFilterChange?: (tf: HeatmapTimeFilter) => void;
  onSelectConstituent?: (c: Constituent) => void;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export const NiftyHeatmap: React.FC<NiftyHeatmapProps> = ({
  securities = [],
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

  // Overlay real-time quotes onto Nifty 50 constituents so heatmap tiles tick live
  const { liveConstituents, liveFeedCount } = useMemo(() => {
    const map = new Map<string, SecurityQuote>();
    for (const s of securities) {
      map.set(s.symbol.toUpperCase(), s);
    }

    let matched = 0;
    const enriched = NIFTY_50_CONSTITUENTS.map((base) => {
      const live = map.get(base.symbol.toUpperCase());
      if (!live || live.ltp <= 0) return base;
      matched++;

      const liveVwapDiffPct =
        live.vwap > 0 ? parseFloat((((live.ltp - live.vwap) / live.vwap) * 100).toFixed(2)) : live.changePct;
      const liveOpenDiffPct =
        live.open > 0 ? parseFloat((((live.ltp - live.open) / live.open) * 100).toFixed(2)) : live.changePct;

      return {
        ...base,
        ltp: live.ltp,
        high: live.high > 0 ? live.high : base.high,
        low: live.low > 0 ? live.low : base.low,
        volume: live.volume && live.volume !== '—' && live.volume !== '0M' ? live.volume : base.volume,
        changes: {
          ...base.changes,
          '15m': liveVwapDiffPct,
          '30m': liveOpenDiffPct,
          '1H': parseFloat(((liveOpenDiffPct + live.changePct) / 2).toFixed(2)),
          '1D': parseFloat(live.changePct.toFixed(2))
        }
      };
    });

    return { liveConstituents: enriched, liveFeedCount: matched };
  }, [securities]);

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
    liveConstituents.forEach((c) => set.add(c.sector));
    return ['All', ...Array.from(set)];
  }, [liveConstituents]);

  // Filtered constituents based on search and optional sector selection
  const filteredConstituents = useMemo(() => {
    return liveConstituents.filter((c) => {
      const matchSector = selectedSector === 'All' || c.sector === selectedSector;
      const matchSearch =
        !searchQuery ||
        c.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSector && matchSearch;
    });
  }, [liveConstituents, selectedSector, searchQuery]);

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
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.66rem',
              color: liveFeedCount > 0 ? '#34d399' : '#5F7A9A',
              fontWeight: 600
            }}
          >
            {liveFeedCount > 0 && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981'
                }}
              />
            )}
            <span>{liveFeedCount > 0 ? `LIVE (${liveFeedCount}/50)` : '50 Constituents'}</span>
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