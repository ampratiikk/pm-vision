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
  isGiftNifty?: boolean;
}

export const NIFTY_50_CONSTITUENTS: WatchlistItem[] = [
  // 1. Financial Services & Banking
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    sector: 'Financial Services',
    weight: 11.45,
    basePrice: 1748.50,
    change: 14.20,
    changePct: 0.82,
    high: 1756.00,
    low: 1735.10
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    sector: 'Financial Services',
    weight: 8.12,
    basePrice: 1264.80,
    change: -4.30,
    changePct: -0.34,
    high: 1272.50,
    low: 1258.00
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    sector: 'Financial Services',
    weight: 3.15,
    basePrice: 822.40,
    change: 8.10,
    changePct: 0.99,
    high: 826.90,
    low: 814.20
  },
  {
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd.',
    sector: 'Financial Services',
    weight: 3.28,
    basePrice: 1182.30,
    change: 6.50,
    changePct: 0.55,
    high: 1191.00,
    low: 1176.40
  },
  {
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Ltd.',
    sector: 'Financial Services',
    weight: 2.85,
    basePrice: 1788.90,
    change: -11.20,
    changePct: -0.62,
    high: 1805.00,
    low: 1782.00
  },
  {
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd.',
    sector: 'Financial Services',
    weight: 2.24,
    basePrice: 7120.00,
    change: 45.00,
    changePct: 0.64,
    high: 7180.00,
    low: 7085.00
  },
  {
    symbol: 'BAJAJFINSV',
    name: 'Bajaj Finserv Ltd.',
    sector: 'Financial Services',
    weight: 1.12,
    basePrice: 1845.50,
    change: 12.30,
    changePct: 0.67,
    high: 1860.00,
    low: 1834.00
  },
  {
    symbol: 'HDFCLIFE',
    name: 'HDFC Life Insurance Co. Ltd.',
    sector: 'Financial Services',
    weight: 0.88,
    basePrice: 718.40,
    change: -2.10,
    changePct: -0.29,
    high: 724.00,
    low: 715.00
  },
  {
    symbol: 'SBILIFE',
    name: 'SBI Life Insurance Co. Ltd.',
    sector: 'Financial Services',
    weight: 0.85,
    basePrice: 1610.00,
    change: 9.40,
    changePct: 0.59,
    high: 1622.00,
    low: 1601.50
  },
  {
    symbol: 'SHRIRAMFIN',
    name: 'Shriram Finance Ltd.',
    sector: 'Financial Services',
    weight: 0.95,
    basePrice: 3240.20,
    change: 28.50,
    changePct: 0.89,
    high: 3265.00,
    low: 3215.00
  },

  // 2. Information Technology
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    sector: 'Information Technology',
    weight: 4.10,
    basePrice: 4210.50,
    change: -18.40,
    changePct: -0.44,
    high: 4245.00,
    low: 4195.00
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    sector: 'Information Technology',
    weight: 5.65,
    basePrice: 1885.20,
    change: 14.60,
    changePct: 0.78,
    high: 1898.00,
    low: 1872.10
  },
  {
    symbol: 'HCLTECH',
    name: 'HCL Technologies Ltd.',
    sector: 'Information Technology',
    weight: 1.82,
    basePrice: 1835.00,
    change: 8.20,
    changePct: 0.45,
    high: 1849.00,
    low: 1828.00
  },
  {
    symbol: 'WIPRO',
    name: 'Wipro Ltd.',
    sector: 'Information Technology',
    weight: 0.95,
    basePrice: 565.40,
    change: -1.80,
    changePct: -0.32,
    high: 571.00,
    low: 563.00
  },
  {
    symbol: 'TECHM',
    name: 'Tech Mahindra Ltd.',
    sector: 'Information Technology',
    weight: 1.10,
    basePrice: 1680.00,
    change: 11.50,
    changePct: 0.69,
    high: 1695.00,
    low: 1670.00
  },
  {
    symbol: 'LTIM',
    name: 'LTIMindtree Ltd.',
    sector: 'Information Technology',
    weight: 0.75,
    basePrice: 6025.00,
    change: -32.00,
    changePct: -0.53,
    high: 6080.00,
    low: 5995.00
  },

  // 3. Oil, Gas & Consumable Fuels / Energy
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    sector: 'Oil, Gas & Energy',
    weight: 8.95,
    basePrice: 1294.60,
    change: 12.80,
    changePct: 1.00,
    high: 1302.00,
    low: 1284.50
  },
  {
    symbol: 'ONGC',
    name: 'Oil & Natural Gas Corp. Ltd.',
    sector: 'Oil, Gas & Energy',
    weight: 1.35,
    basePrice: 262.40,
    change: 2.10,
    changePct: 0.81,
    high: 265.00,
    low: 260.80
  },
  {
    symbol: 'BPCL',
    name: 'Bharat Petroleum Corp. Ltd.',
    sector: 'Oil, Gas & Energy',
    weight: 0.72,
    basePrice: 318.50,
    change: -1.90,
    changePct: -0.59,
    high: 322.00,
    low: 316.40
  },
  {
    symbol: 'COALINDIA',
    name: 'Coal India Ltd.',
    sector: 'Oil, Gas & Energy',
    weight: 1.25,
    basePrice: 425.80,
    change: 3.40,
    changePct: 0.80,
    high: 429.50,
    low: 422.00
  },
  {
    symbol: 'NTPC',
    name: 'NTPC Ltd.',
    sector: 'Oil, Gas & Energy',
    weight: 2.15,
    basePrice: 388.20,
    change: 4.60,
    changePct: 1.20,
    high: 391.00,
    low: 384.50
  },
  {
    symbol: 'POWERGRID',
    name: 'Power Grid Corp. of India Ltd.',
    sector: 'Oil, Gas & Energy',
    weight: 1.85,
    basePrice: 324.70,
    change: 1.80,
    changePct: 0.56,
    high: 327.40,
    low: 322.10
  },

  // 4. Automobiles & Auto Components
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    sector: 'Automobile',
    weight: 2.10,
    basePrice: 812.50,
    change: 7.30,
    changePct: 0.91,
    high: 818.00,
    low: 806.20
  },
  {
    symbol: 'M&M',
    name: 'Mahindra & Mahindra Ltd.',
    sector: 'Automobile',
    weight: 2.85,
    basePrice: 3012.00,
    change: 38.00,
    changePct: 1.28,
    high: 3035.00,
    low: 2980.00
  },
  {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India Ltd.',
    sector: 'Automobile',
    weight: 1.82,
    basePrice: 11450.00,
    change: -45.00,
    changePct: -0.39,
    high: 11540.00,
    low: 11400.00
  },
  {
    symbol: 'BAJAJ-AUTO',
    name: 'Bajaj Auto Ltd.',
    sector: 'Automobile',
    weight: 1.25,
    basePrice: 9480.00,
    change: 62.00,
    changePct: 0.66,
    high: 9540.00,
    low: 9420.00
  },
  {
    symbol: 'EICHERMOT',
    name: 'Eicher Motors Ltd.',
    sector: 'Automobile',
    weight: 0.85,
    basePrice: 4890.00,
    change: 24.00,
    changePct: 0.49,
    high: 4925.00,
    low: 4860.00
  },
  {
    symbol: 'HEROMOTOCO',
    name: 'Hero MotoCorp Ltd.',
    sector: 'Automobile',
    weight: 0.78,
    basePrice: 4720.00,
    change: -18.00,
    changePct: -0.38,
    high: 4760.00,
    low: 4695.00
  },

  // 5. Fast Moving Consumer Goods (FMCG)
  {
    symbol: 'ITC',
    name: 'ITC Ltd.',
    sector: 'FMCG',
    weight: 3.90,
    basePrice: 482.60,
    change: 2.80,
    changePct: 0.58,
    high: 485.40,
    low: 479.80
  },
  {
    symbol: 'HINDUNILVR',
    name: 'Hindustan Unilever Ltd.',
    sector: 'FMCG',
    weight: 2.35,
    basePrice: 2435.00,
    change: -8.50,
    changePct: -0.35,
    high: 2452.00,
    low: 2426.00
  },
  {
    symbol: 'NESTLEIND',
    name: 'Nestle India Ltd.',
    sector: 'FMCG',
    weight: 1.15,
    basePrice: 2280.00,
    change: 5.00,
    changePct: 0.22,
    high: 2295.00,
    low: 2270.00
  },
  {
    symbol: 'BRITANNIA',
    name: 'Britannia Industries Ltd.',
    sector: 'FMCG',
    weight: 0.72,
    basePrice: 5120.00,
    change: 18.00,
    changePct: 0.35,
    high: 5150.00,
    low: 5095.00
  },
  {
    symbol: 'TATACONSUM',
    name: 'Tata Consumer Products Ltd.',
    sector: 'FMCG',
    weight: 0.75,
    basePrice: 964.00,
    change: -3.20,
    changePct: -0.33,
    high: 971.00,
    low: 960.50
  },

  // 6. Metals & Mining
  {
    symbol: 'TATASTEEL',
    name: 'Tata Steel Ltd.',
    sector: 'Metals & Mining',
    weight: 1.45,
    basePrice: 154.20,
    change: 1.65,
    changePct: 1.08,
    high: 155.80,
    low: 152.90
  },
  {
    symbol: 'JSWSTEEL',
    name: 'JSW Steel Ltd.',
    sector: 'Metals & Mining',
    weight: 1.10,
    basePrice: 968.40,
    change: 8.90,
    changePct: 0.93,
    high: 974.50,
    low: 959.00
  },
  {
    symbol: 'HINDALCO',
    name: 'Hindalco Industries Ltd.',
    sector: 'Metals & Mining',
    weight: 1.20,
    basePrice: 672.50,
    change: 7.20,
    changePct: 1.08,
    high: 678.00,
    low: 666.00
  },

  // 7. Healthcare & Pharmaceuticals
  {
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries Ltd.',
    sector: 'Healthcare & Pharma',
    weight: 2.15,
    basePrice: 1842.00,
    change: 14.50,
    changePct: 0.79,
    high: 1855.00,
    low: 1830.00
  },
  {
    symbol: 'CIPLA',
    name: 'Cipla Ltd.',
    sector: 'Healthcare & Pharma',
    weight: 0.95,
    basePrice: 1528.00,
    change: 6.00,
    changePct: 0.39,
    high: 1538.00,
    low: 1520.00
  },
  {
    symbol: 'DRREDDY',
    name: 'Dr. Reddy\'s Laboratories Ltd.',
    sector: 'Healthcare & Pharma',
    weight: 0.85,
    basePrice: 1285.00,
    change: -4.50,
    changePct: -0.35,
    high: 1296.00,
    low: 1279.00
  },
  {
    symbol: 'APOLLOHOSP',
    name: 'Apollo Hospitals Enterprise Ltd.',
    sector: 'Healthcare & Pharma',
    weight: 0.92,
    basePrice: 7180.00,
    change: 54.00,
    changePct: 0.76,
    high: 7240.00,
    low: 7130.00
  },

  // 8. Construction & Infrastructure
  {
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd.',
    sector: 'Construction & Infra',
    weight: 4.10,
    basePrice: 3680.00,
    change: 32.00,
    changePct: 0.88,
    high: 3710.00,
    low: 3655.00
  },
  {
    symbol: 'ULTRACEMCO',
    name: 'UltraTech Cement Ltd.',
    sector: 'Construction & Infra',
    weight: 1.35,
    basePrice: 11420.00,
    change: 85.00,
    changePct: 0.75,
    high: 11510.00,
    low: 11360.00
  },
  {
    symbol: 'GRASIM',
    name: 'Grasim Industries Ltd.',
    sector: 'Construction & Infra',
    weight: 0.88,
    basePrice: 2615.00,
    change: -12.00,
    changePct: -0.46,
    high: 2640.00,
    low: 2605.00
  },
  {
    symbol: 'ADANIENT',
    name: 'Adani Enterprises Ltd.',
    sector: 'Construction & Infra',
    weight: 1.15,
    basePrice: 2480.00,
    change: 18.00,
    changePct: 0.73,
    high: 2510.00,
    low: 2460.00
  },
  {
    symbol: 'ADANIPORTS',
    name: 'Adani Ports & SEZ Ltd.',
    sector: 'Construction & Infra',
    weight: 1.25,
    basePrice: 1285.00,
    change: 9.50,
    changePct: 0.75,
    high: 1298.00,
    low: 1276.00
  },

  // 9. Consumer Durables & Retail
  {
    symbol: 'TITAN',
    name: 'Titan Company Ltd.',
    sector: 'Consumer Durables',
    weight: 1.65,
    basePrice: 3340.00,
    change: -15.00,
    changePct: -0.45,
    high: 3370.00,
    low: 3325.00
  },
  {
    symbol: 'TRENT',
    name: 'Trent Ltd.',
    sector: 'Consumer Durables',
    weight: 1.45,
    basePrice: 6850.00,
    change: 72.00,
    changePct: 1.06,
    high: 6920.00,
    low: 6790.00
  },
  {
    symbol: 'ASIANPAINT',
    name: 'Asian Paints Ltd.',
    sector: 'Consumer Durables',
    weight: 1.35,
    basePrice: 2480.00,
    change: -8.00,
    changePct: -0.32,
    high: 2498.00,
    low: 2465.00
  },

  // 10. Telecommunication & Capital Goods
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    sector: 'Telecom & Defense',
    weight: 4.85,
    basePrice: 1612.00,
    change: 18.50,
    changePct: 1.16,
    high: 1625.00,
    low: 1598.00
  },
  {
    symbol: 'BEL',
    name: 'Bharat Electronics Ltd.',
    sector: 'Telecom & Defense',
    weight: 1.25,
    basePrice: 308.40,
    change: 4.20,
    changePct: 1.38,
    high: 311.50,
    low: 304.80
  }
];

export const NIFTY_INDICES: WatchlistItem[] = [
  {
    symbol: 'GIFT NIFTY',
    name: 'GIFT Nifty 50 Futures (NSE IX)',
    basePrice: 25544.65,
    change: 195.00,
    changePct: 0.77,
    high: 25620.00,
    low: 25480.00,
    isIndex: true,
    isGiftNifty: true
  },
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
  'Information Technology',
  'Oil, Gas & Energy',
  'Automobile',
  'FMCG',
  'Metals & Mining',
  'Healthcare & Pharma',
  'Construction & Infra',
  'Consumer Durables',
  'Telecom & Defense'
];
