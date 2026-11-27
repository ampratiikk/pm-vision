export interface WatchlistItem {
  symbol: string;
  name: string;
  sector?: string;
  weight?: number;
  basePrice: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  isIndex?: boolean;
}

export const NIFTY_50_CONSTITUENTS: WatchlistItem[] = [
  {
    "symbol": "HDFCBANK",
    "name": "HDFC Bank Ltd.",
    "sector": "Financial Services",
    "weight": 10.54,
    "basePrice": 1745,
    "change": 14.31,
    "changePct": 0.82,
    "high": 1756,
    "low": 1735.1
  },
  {
    "symbol": "ICICIBANK",
    "name": "ICICI Bank Ltd.",
    "sector": "Financial Services",
    "weight": 8.81,
    "basePrice": 1260.8,
    "change": -4.29,
    "changePct": -0.34,
    "high": 1272.5,
    "low": 1254
  },
  {
    "symbol": "RELIANCE",
    "name": "Reliance Industries Ltd.",
    "sector": "Oil, Gas & Consumable Fuels",
    "weight": 7.52,
    "basePrice": 1265.6,
    "change": 12.91,
    "changePct": 1.02,
    "high": 1278,
    "low": 1256.5
  },
  {
    "symbol": "BHARTIARTL",
    "name": "Bharti Airtel Ltd.",
    "sector": "Telecommunication",
    "weight": 5.12,
    "basePrice": 1560,
    "change": 18.25,
    "changePct": 1.17,
    "high": 1575,
    "low": 1548
  },
  {
    "symbol": "LT",
    "name": "Larsen & Toubro Ltd.",
    "sector": "Construction",
    "weight": 4.17,
    "basePrice": 3580,
    "change": 28.28,
    "changePct": 0.79,
    "high": 3615,
    "low": 3560
  },
  {
    "symbol": "SBIN",
    "name": "State Bank of India",
    "sector": "Financial Services",
    "weight": 3.79,
    "basePrice": 815.4,
    "change": 8.07,
    "changePct": 0.99,
    "high": 824.9,
    "low": 808.2
  },
  {
    "symbol": "INFY",
    "name": "Infosys Ltd.",
    "sector": "Information Technology",
    "weight": 3.41,
    "basePrice": 1850.2,
    "change": 14.99,
    "changePct": 0.81,
    "high": 1865,
    "low": 1838
  },
  {
    "symbol": "AXISBANK",
    "name": "Axis Bank Ltd.",
    "sector": "Financial Services",
    "weight": 3.32,
    "basePrice": 1175.3,
    "change": 6.46,
    "changePct": 0.55,
    "high": 1191,
    "low": 1168.4
  },
  {
    "symbol": "KOTAKBANK",
    "name": "Kotak Mahindra Bank Ltd.",
    "sector": "Financial Services",
    "weight": 2.84,
    "basePrice": 1785.9,
    "change": -11.07,
    "changePct": -0.62,
    "high": 1805,
    "low": 1778
  },
  {
    "symbol": "BAJFINANCE",
    "name": "Bajaj Finance Ltd.",
    "sector": "Financial Services",
    "weight": 2.53,
    "basePrice": 6850,
    "change": 45.21,
    "changePct": 0.66,
    "high": 6920,
    "low": 6810
  },
  {
    "symbol": "M&M",
    "name": "Mahindra & Mahindra Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 2.51,
    "basePrice": 2950.4,
    "change": 38.36,
    "changePct": 1.3,
    "high": 2980,
    "low": 2925
  },
  {
    "symbol": "ITC",
    "name": "ITC Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 2.43,
    "basePrice": 465.2,
    "change": 2.84,
    "changePct": 0.61,
    "high": 469.5,
    "low": 463
  },
  {
    "symbol": "ETERNAL",
    "name": "Eternal Ltd.",
    "sector": "Consumer Services",
    "weight": 2.26,
    "basePrice": 268.4,
    "change": -1.4,
    "changePct": -0.52,
    "high": 275,
    "low": 264
  },
  {
    "symbol": "TCS",
    "name": "Tata Consultancy Services Ltd.",
    "sector": "Information Technology",
    "weight": 1.97,
    "basePrice": 4120.5,
    "change": -18.13,
    "changePct": -0.44,
    "high": 4160,
    "low": 4105
  },
  {
    "symbol": "SUNPHARMA",
    "name": "Sun Pharmaceutical Industries Ltd.",
    "sector": "Healthcare",
    "weight": 1.88,
    "basePrice": 1780,
    "change": 14.6,
    "changePct": 0.82,
    "high": 1795,
    "low": 1770
  },
  {
    "symbol": "TITAN",
    "name": "Titan Company Ltd.",
    "sector": "Consumer Durables",
    "weight": 1.84,
    "basePrice": 3240,
    "change": 22.03,
    "changePct": 0.68,
    "high": 3270,
    "low": 3220
  },
  {
    "symbol": "HINDUNILVR",
    "name": "Hindustan Unilever Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 1.57,
    "basePrice": 2380,
    "change": -12.38,
    "changePct": -0.52,
    "high": 2405,
    "low": 2372
  },
  {
    "symbol": "TATASTEEL",
    "name": "Tata Steel Ltd.",
    "sector": "Metals & Mining",
    "weight": 1.48,
    "basePrice": 145.3,
    "change": 1.1,
    "changePct": 0.76,
    "high": 147.2,
    "low": 144.1
  },
  {
    "symbol": "MARUTI",
    "name": "Maruti Suzuki India Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 1.47,
    "basePrice": 11200,
    "change": -44.8,
    "changePct": -0.4,
    "high": 11350,
    "low": 11150
  },
  {
    "symbol": "NTPC",
    "name": "NTPC Ltd.",
    "sector": "Power",
    "weight": 1.46,
    "basePrice": 365.2,
    "change": 3.14,
    "changePct": 0.86,
    "high": 369,
    "low": 362.5
  },
  {
    "symbol": "ADANIPORTS",
    "name": "Adani Ports and Special Economic Zone Ltd.",
    "sector": "Services",
    "weight": 1.36,
    "basePrice": 1180,
    "change": -7.91,
    "changePct": -0.67,
    "high": 1195,
    "low": 1172
  },
  {
    "symbol": "BEL",
    "name": "Bharat Electronics Ltd.",
    "sector": "Capital Goods",
    "weight": 1.32,
    "basePrice": 285.5,
    "change": 3.45,
    "changePct": 1.21,
    "high": 289,
    "low": 282.5
  },
  {
    "symbol": "HINDALCO",
    "name": "Hindalco Industries Ltd.",
    "sector": "Metals & Mining",
    "weight": 1.32,
    "basePrice": 650.4,
    "change": 5.66,
    "changePct": 0.87,
    "high": 658,
    "low": 646
  },
  {
    "symbol": "SHRIRAMFIN",
    "name": "Shriram Finance Ltd.",
    "sector": "Financial Services",
    "weight": 1.29,
    "basePrice": 3050.2,
    "change": 28.67,
    "changePct": 0.94,
    "high": 3085,
    "low": 3020
  },
  {
    "symbol": "BSE",
    "name": "BSE Ltd.",
    "sector": "Financial Services",
    "weight": 1.24,
    "basePrice": 4680,
    "change": -29.48,
    "changePct": -0.63,
    "high": 4740,
    "low": 4620
  },
  {
    "symbol": "HCLTECH",
    "name": "HCL Technologies Ltd.",
    "sector": "Information Technology",
    "weight": 1.22,
    "basePrice": 1820.8,
    "change": 22.76,
    "changePct": 1.25,
    "high": 1835,
    "low": 1802
  },
  {
    "symbol": "ULTRACEMCO",
    "name": "UltraTech Cement Ltd.",
    "sector": "Construction Materials",
    "weight": 1.22,
    "basePrice": 11400,
    "change": 85.5,
    "changePct": 0.75,
    "high": 11520,
    "low": 11350
  },
  {
    "symbol": "JSWSTEEL",
    "name": "JSW Steel Ltd.",
    "sector": "Metals & Mining",
    "weight": 1.17,
    "basePrice": 945,
    "change": -4.44,
    "changePct": -0.47,
    "high": 956,
    "low": 940
  },
  {
    "symbol": "POWERGRID",
    "name": "Power Grid Corporation of India Ltd.",
    "sector": "Power",
    "weight": 1.13,
    "basePrice": 320.4,
    "change": -1.51,
    "changePct": -0.47,
    "high": 324,
    "low": 318
  },
  {
    "symbol": "BAJAJ-AUTO",
    "name": "Bajaj Auto Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 1.12,
    "basePrice": 9450,
    "change": 62.37,
    "changePct": 0.66,
    "high": 9550,
    "low": 9400
  },
  {
    "symbol": "GRASIM",
    "name": "Grasim Industries Ltd.",
    "sector": "Construction Materials",
    "weight": 1.11,
    "basePrice": 2540,
    "change": -11.94,
    "changePct": -0.47,
    "high": 2565,
    "low": 2525
  },
  {
    "symbol": "INDIGO",
    "name": "InterGlobe Aviation Ltd.",
    "sector": "Services",
    "weight": 1.05,
    "basePrice": 4180,
    "change": -48.49,
    "changePct": -1.16,
    "high": 4220,
    "low": 4130
  },
  {
    "symbol": "ASIANPAINT",
    "name": "Asian Paints Ltd.",
    "sector": "Consumer Durables",
    "weight": 1.04,
    "basePrice": 2480,
    "change": -14.88,
    "changePct": -0.6,
    "high": 2510,
    "low": 2465
  },
  {
    "symbol": "COALINDIA",
    "name": "Coal India Ltd.",
    "sector": "Oil, Gas & Consumable Fuels",
    "weight": 0.97,
    "basePrice": 410.5,
    "change": -1.81,
    "changePct": -0.44,
    "high": 416,
    "low": 407.2
  },
  {
    "symbol": "BAJAJFINSV",
    "name": "Bajaj Finserv Ltd.",
    "sector": "Financial Services",
    "weight": 0.96,
    "basePrice": 1620.5,
    "change": 12.32,
    "changePct": 0.76,
    "high": 1635,
    "low": 1610
  },
  {
    "symbol": "ADANIENT",
    "name": "Adani Enterprises Ltd.",
    "sector": "Metals & Mining",
    "weight": 0.96,
    "basePrice": 2250,
    "change": 25.2,
    "changePct": 1.12,
    "high": 2280,
    "low": 2235
  },
  {
    "symbol": "EICHERMOT",
    "name": "Eicher Motors Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 0.94,
    "basePrice": 4820,
    "change": 35.19,
    "changePct": 0.73,
    "high": 4865,
    "low": 4790
  },
  {
    "symbol": "NESTLEIND",
    "name": "Nestle India Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 0.92,
    "basePrice": 2240,
    "change": -8.06,
    "changePct": -0.36,
    "high": 2260,
    "low": 2230
  },
  {
    "symbol": "TECHM",
    "name": "Tech Mahindra Ltd.",
    "sector": "Information Technology",
    "weight": 0.91,
    "basePrice": 1680,
    "change": 11.59,
    "changePct": 0.69,
    "high": 1695,
    "low": 1670
  },
  {
    "symbol": "ONGC",
    "name": "Oil & Natural Gas Corporation Ltd.",
    "sector": "Oil, Gas & Consumable Fuels",
    "weight": 0.85,
    "basePrice": 250.2,
    "change": 2.13,
    "changePct": 0.85,
    "high": 253.4,
    "low": 247.8
  },
  {
    "symbol": "APOLLOHOSP",
    "name": "Apollo Hospitals Enterprise Ltd.",
    "sector": "Healthcare",
    "weight": 0.85,
    "basePrice": 6950,
    "change": 45.17,
    "changePct": 0.65,
    "high": 7020,
    "low": 6910
  },
  {
    "symbol": "TRENT",
    "name": "Trent Ltd.",
    "sector": "Consumer Services",
    "weight": 0.83,
    "basePrice": 6450,
    "change": 86.43,
    "changePct": 1.34,
    "high": 6520,
    "low": 6390
  },
  {
    "symbol": "SBILIFE",
    "name": "SBI Life Insurance Company Ltd.",
    "sector": "Financial Services",
    "weight": 0.74,
    "basePrice": 1480,
    "change": 9.47,
    "changePct": 0.64,
    "high": 1495,
    "low": 1472
  },
  {
    "symbol": "CIPLA",
    "name": "Cipla Ltd.",
    "sector": "Healthcare",
    "weight": 0.74,
    "basePrice": 1480,
    "change": -5.92,
    "changePct": -0.4,
    "high": 1495,
    "low": 1472
  },
  {
    "symbol": "DRREDDY",
    "name": "Dr. Reddy's Laboratories Ltd.",
    "sector": "Healthcare",
    "weight": 0.73,
    "basePrice": 1240,
    "change": 8.56,
    "changePct": 0.69,
    "high": 1255,
    "low": 1232
  },
  {
    "symbol": "MAXHEALTH",
    "name": "Max Healthcare Institute Ltd.",
    "sector": "Healthcare",
    "weight": 0.7,
    "basePrice": 985,
    "change": 7.78,
    "changePct": 0.79,
    "high": 998,
    "low": 975
  },
  {
    "symbol": "JIOFIN",
    "name": "Jio Financial Services Ltd.",
    "sector": "Financial Services",
    "weight": 0.68,
    "basePrice": 310.5,
    "change": -7.27,
    "changePct": -2.34,
    "high": 316,
    "low": 307
  },
  {
    "symbol": "TATACONSUM",
    "name": "Tata Consumer Products Ltd.",
    "sector": "Fast Moving Consumer Goods",
    "weight": 0.6,
    "basePrice": 940.5,
    "change": 5.27,
    "changePct": 0.56,
    "high": 949,
    "low": 934
  },
  {
    "symbol": "TMPV",
    "name": "Tata Motors Passenger Vehicles Ltd.",
    "sector": "Automobile and Auto Components",
    "weight": 0.56,
    "basePrice": 785,
    "change": 5.73,
    "changePct": 0.73,
    "high": 798,
    "low": 781.2
  },
  {
    "symbol": "HDFCLIFE",
    "name": "HDFC Life Insurance Company Ltd.",
    "sector": "Financial Services",
    "weight": 0.54,
    "basePrice": 695.4,
    "change": -2.09,
    "changePct": -0.3,
    "high": 704,
    "low": 690.5
  }
];

export const NIFTY_INDICES: WatchlistItem[] = [
  {
    symbol: 'NIFTY 50',
    name: 'Nifty 50 Index (NSE Benchmark)',
    basePrice: 25349.65,
    change: 149.05,
    changePct: 0.59,
    high: 25412.30,
    low: 25285.10,
    isIndex: true
  },
  {
    symbol: 'NIFTY BANK',
    name: 'Nifty Bank Index',
    basePrice: 53820.40,
    change: 342.80,
    changePct: 0.64,
    high: 53980.00,
    low: 53540.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY FIN SERVICE',
    name: 'Nifty Financial Services Index',
    basePrice: 24680.15,
    change: 158.40,
    changePct: 0.65,
    high: 24750.00,
    low: 24560.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY NEXT 50',
    name: 'Nifty Next 50 Index',
    basePrice: 71450.00,
    change: 480.00,
    changePct: 0.68,
    high: 71680.00,
    low: 71120.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY MIDCAP 50',
    name: 'Nifty Midcap 50 Index',
    basePrice: 16180.25,
    change: 112.50,
    changePct: 0.70,
    high: 16240.00,
    low: 16095.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY IT',
    name: 'Nifty IT Index',
    basePrice: 43250.80,
    change: 185.20,
    changePct: 0.43,
    high: 43420.00,
    low: 43110.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY AUTO',
    name: 'Nifty Auto Index',
    basePrice: 24920.00,
    change: 220.00,
    changePct: 0.89,
    high: 25050.00,
    low: 24780.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY FMCG',
    name: 'Nifty FMCG Index',
    basePrice: 58640.00,
    change: 160.00,
    changePct: 0.27,
    high: 58820.00,
    low: 58510.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY METAL',
    name: 'Nifty Metal Index',
    basePrice: 9480.50,
    change: 98.20,
    changePct: 1.05,
    high: 9540.00,
    low: 9410.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY PHARMA',
    name: 'Nifty Pharma Index',
    basePrice: 22850.00,
    change: 145.00,
    changePct: 0.64,
    high: 22960.00,
    low: 22740.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY REALTY',
    name: 'Nifty Realty Index',
    basePrice: 1065.40,
    change: 14.80,
    changePct: 1.41,
    high: 1074.00,
    low: 1054.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY ENERGY',
    name: 'Nifty Energy Index',
    basePrice: 39850.00,
    change: 310.00,
    changePct: 0.78,
    high: 40020.00,
    low: 39640.00,
    isIndex: true
  },
  {
    symbol: 'NIFTY INFRA',
    name: 'Nifty Infrastructure Index',
    basePrice: 8940.00,
    change: 64.00,
    changePct: 0.72,
    high: 8990.00,
    low: 8895.00,
    isIndex: true
  },
  {
    symbol: 'INDIA VIX',
    name: 'India Volatility Index',
    basePrice: 14.85,
    change: -0.42,
    changePct: -2.75,
    high: 15.40,
    low: 14.65,
    isIndex: true
  }
];

export const ALL_SECTORS = [
  'All Sectors',
  'Financial Services',
  'Oil, Gas & Consumable Fuels',
  'Information Technology',
  'Automobile and Auto Components',
  'Telecommunication',
  'Fast Moving Consumer Goods',
  'Healthcare',
  'Metals & Mining',
  'Construction',
  'Consumer Services',
  'Consumer Durables',
  'Power',
  'Services',
  'Construction Materials',
  'Capital Goods'
];

export type WatchlistSegment =
  | 'major_indices'
  | 'nifty50'
  | 'fno_stocks'
  | 'all_stocks'
  | 'indices'
  | 'index_futures'
  | 'stock_futures'
  | 'all_futures';

export const WATCHLIST_SEGMENT_OPTIONS: Array<{ id: WatchlistSegment; label: string }> = [
  { id: 'major_indices', label: 'NSE Major Indices' },
  { id: 'nifty50', label: 'NIFTY 50 Constituents (50)' },
  { id: 'fno_stocks', label: 'NSE F&O Stocks' },
  { id: 'all_stocks', label: 'All NSE Stocks' },
  { id: 'indices', label: 'All NSE Indices' },
  { id: 'index_futures', label: 'Index Futures (NIFTY, BANKNIFTY...)' },
  { id: 'stock_futures', label: 'Stock Futures (F&O Contracts)' },
  { id: 'all_futures', label: 'All Futures Contracts' }
];

