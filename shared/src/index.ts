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
  | 'MARKET_TICK';

export interface BaseWebSocketMessage {
  type: WebSocketMessageType;
  timestamp: string;
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
  | MarketTickMessage;
