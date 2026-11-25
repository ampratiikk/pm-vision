export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
}

export type WebSocketMessageType =
  | 'CONNECT_ACK'
  | 'PING'
  | 'PONG'
  | 'SYSTEM_MESSAGE'
  | 'MARKET_SNAPSHOT'
  | 'MARKET_TICK'
  | 'SUBSCRIBE';

export interface BaseWebSocketMessage {
  type: WebSocketMessageType;
  timestamp: string;
}

export interface SubscribeMessage extends BaseWebSocketMessage {
  type: 'SUBSCRIBE';
  symbols: string[];
}

export interface ConnectAckMessage extends BaseWebSocketMessage {
  type: 'CONNECT_ACK';
  clientId: string;
  message: string;
}

export interface PingMessage extends BaseWebSocketMessage {
  type: 'PING';
}

export interface PongMessage extends BaseWebSocketMessage {
  type: 'PONG';
}

export interface SystemMessage extends BaseWebSocketMessage {
  type: 'SYSTEM_MESSAGE';
  content: string;
}

export interface SecurityQuote {
  id: string;
  name: string;
  symbol: string;
  ltp: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  vwap: number;
  volume: string;
}

export type MarketTick = SecurityQuote;

export interface BasisSpreadPair {
  id: string;
  name: string;
  leg1: string;
  leg2: string;
  price1: number;
  price2: number;
  spread: number;
  spreadPct: number;
  annualizedYield: number;
  isDefault?: boolean;
}

export interface OptionRow {
  strike: number;
  call: {
    theta: number;
    gamma: number;
    delta: number;
    oi: number;
    ltp: number;
  };
  put: {
    ltp: number;
    oi: number;
    delta: number;
    gamma: number;
    theta: number;
  };
}

export interface ExpiryOption {
  date: string;
  expiry: string;
  expiry_flag?: string;
}

export interface ChartCandleTick {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type MarketStatus = 'OPEN' | 'CLOSED';

export type InstrumentCategory = 'INDEX' | 'EQUITY' | 'INDEX_FUTURES' | 'STOCK_FUTURES';

export type FuturesMonthRole = 'CONTINUOUS' | 'CURRENT' | 'NEXT' | 'FAR';

export interface MasterInstrument {
  symbol: string;
  displaySymbol: string;
  name: string;
  fyersSymbol: string;
  underlying: string;
  category: InstrumentCategory;
  futuresRole?: FuturesMonthRole;
  expiryDate?: string;
  expiryLabel?: string;
  lotSize?: number;
  isFnO?: boolean;
  contFlag?: boolean;
  sector?: string;
}

export interface InstrumentCatalogResponse {
  equities: MasterInstrument[];
  indices: MasterInstrument[];
  futures: MasterInstrument[];
  fnOUnderlyings: string[];
  updatedAt: string;
}

export interface MarketSnapshotPayload {
  securities: SecurityQuote[];
  basisSpreads: BasisSpreadPair[];
  optionChain: OptionRow[];
  expiries: ExpiryOption[];
  selectedExpiry?: string;
  latestCandle: ChartCandleTick;
  spotPrice: number;
  fut1Price: number;
  pcr: number;
  maxPain: number;
  indiaVix: number;
  marketStatus: MarketStatus;
  dataSource?: 'FYERS' | 'PUBLIC';
  isBrokerConnected?: boolean;
}

export interface MarketSnapshotMessage extends BaseWebSocketMessage {
  type: 'MARKET_SNAPSHOT';
  data: MarketSnapshotPayload;
}

export interface MarketTickMessage extends BaseWebSocketMessage {
  type: 'MARKET_TICK';
  data: MarketSnapshotPayload;
}

export type WebSocketMessage =
  | ConnectAckMessage
  | PingMessage
  | PongMessage
  | SystemMessage
  | MarketSnapshotMessage
  | MarketTickMessage
  | SubscribeMessage;

/**
 * Official NSE Trading Holidays for Equity and F&O segments
 * Format: 'YYYY-MM-DD': 'Holiday Description'
 */
export const NSE_TRADING_HOLIDAYS: Record<string, string> = {
  // 2026 Official Calendar
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id',
  '2026-06-26': 'Muharram',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada',
  '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2026-12-25': 'Christmas',

  // 2025 Calendar
  '2025-01-26': 'Republic Day',
  '2025-02-26': 'Mahashivratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Id-Ul-Fitr',
  '2025-04-10': 'Shri Mahavir Jayanti',
  '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day',
  '2025-06-07': 'Bakri Id',
  '2025-07-06': 'Muharram',
  '2025-08-15': 'Independence Day',
  '2025-08-27': 'Ganesh Chaturthi',
  '2025-10-02': 'Mahatma Gandhi Jayanti',
  '2025-10-21': 'Dussehra',
  '2025-10-22': 'Diwali Balipratipada',
  '2025-11-05': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2025-12-25': 'Christmas'
};

function getISTShiftedDate(checkDate: Date = new Date()): Date {
  return new Date(checkDate.getTime() + 19800000);
}

/**
 * Checks if the Indian Market (NSE) is actively open for normal trading.
 * Returns false on weekends, market holidays, and outside 09:15-15:30 IST.
 */
export function isIndianMarketOpen(checkDate: Date = new Date()): boolean {
  const ist = getISTShiftedDate(checkDate);

  const day = ist.getUTCDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const dateStr = ist.toISOString().slice(0, 10);
  if (NSE_TRADING_HOLIDAYS[dateStr]) {
    return false;
  }

  const currentMinute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const marketOpenMinute = 9 * 60 + 15; // 09:15 AM IST
  const marketCloseMinute = 15 * 60 + 30; // 03:30 PM IST

  return currentMinute >= marketOpenMinute && currentMinute <= marketCloseMinute;
}

export interface MarketSessionInfo {
  status: 'LIVE' | 'PRE_MARKET' | 'POST_MARKET' | 'CLOSED';
  label: string;
  dotColor: string;
  reason?: string;
}

/**
 * Returns user-facing market session info (label & dot color) accounting for holidays & weekends.
 */
export function getMarketSessionInfo(checkDate: Date = new Date()): MarketSessionInfo {
  const ist = getISTShiftedDate(checkDate);

  const dateStr = ist.toISOString().slice(0, 10);
  const holidayName = NSE_TRADING_HOLIDAYS[dateStr];
  if (holidayName) {
    return {
      status: 'CLOSED',
      label: `Markets Closed (${holidayName})`,
      dotColor: '#ef4444',
      reason: holidayName
    };
  }

  const day = ist.getUTCDay();
  if (day === 0 || day === 6) {
    return {
      status: 'CLOSED',
      label: 'Markets Closed (Weekend)',
      dotColor: '#ef4444',
      reason: 'Weekend'
    };
  }

  const currentMinute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const preStart = 9 * 60; // 09:00 AM
  const normalStart = 9 * 60 + 15; // 09:15 AM
  const normalEnd = 15 * 60 + 30; // 03:30 PM
  const postEnd = 16 * 60; // 04:00 PM

  if (currentMinute >= preStart && currentMinute < normalStart) {
    return { status: 'PRE_MARKET', label: 'Pre-Market Session', dotColor: '#eab308' };
  }
  if (currentMinute >= normalStart && currentMinute <= normalEnd) {
    return { status: 'LIVE', label: 'Markets Live', dotColor: '#10b981' };
  }
  if (currentMinute > normalEnd && currentMinute <= postEnd) {
    return { status: 'POST_MARKET', label: 'Post-Market Session', dotColor: '#eab308' };
  }
  return { status: 'CLOSED', label: 'Markets Closed', dotColor: '#ef4444' };
}

