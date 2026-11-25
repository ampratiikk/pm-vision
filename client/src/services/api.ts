import { HealthCheckResponse, ChartCandleTick, MarketSnapshotPayload, MarketSessionInfo } from '@pm-vision/shared';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

import type { InstrumentCatalogResponse, SecurityQuote as ApiSecurityQuote } from '@pm-vision/shared';

export async function fetchMarketStatus(): Promise<{
  marketStatus: 'OPEN' | 'CLOSED';
  session: MarketSessionInfo;
  isBrokerConnected: boolean;
}> {
  const response = await fetch('/api/market/status');
  if (!response.ok) {
    throw new Error(`Market status fetch error: ${response.status}`);
  }
  return response.json();
}

export async function fetchInstrumentCatalog(): Promise<InstrumentCatalogResponse> {
  const response = await fetch('/api/market/instruments');
  if (!response.ok) {
    throw new Error(`Instrument catalog fetch error: ${response.status}`);
  }
  return response.json();
}

export async function fetchOnDemandQuotes(symbols: string[]): Promise<{
  quotes: ApiSecurityQuote[];
  isBrokerConnected: boolean;
}> {
  if (!symbols || symbols.length === 0) {
    return { quotes: [], isBrokerConnected: false };
  }
  const response = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
  if (!response.ok) {
    throw new Error(`Quotes fetch error: ${response.status}`);
  }
  const json = await response.json();
  return {
    quotes: Array.isArray(json.quotes) ? json.quotes : [],
    isBrokerConnected: Boolean(json.isBrokerConnected)
  };
}

export interface MarketHistoryResponse {
  candles: ChartCandleTick[];
  casPrice?: number;
  source?: 'FYERS' | 'PUBLIC';
  isBrokerConnected?: boolean;
  requiresBroker?: boolean;
}

export async function fetchMarketHistoryDetailed(
  resolution: string,
  symbol: string = 'NIFTY 50'
): Promise<MarketHistoryResponse> {
  const response = await fetch(`/api/market/history?resolution=${encodeURIComponent(resolution)}&symbol=${encodeURIComponent(symbol)}`);
  if (!response.ok) {
    throw new Error(`History fetch error: ${response.status}`);
  }
  const json = await response.json();
  return {
    candles: json.candles || [],
    casPrice: typeof json.casPrice === 'number' ? json.casPrice : undefined,
    source: json.source,
    isBrokerConnected: typeof json.isBrokerConnected === 'boolean' ? json.isBrokerConnected : undefined,
    requiresBroker: typeof json.requiresBroker === 'boolean' ? json.requiresBroker : undefined
  };
}

export async function fetchMarketHistory(resolution: string, symbol: string = 'NIFTY 50'): Promise<ChartCandleTick[]> {
  const res = await fetchMarketHistoryDetailed(resolution, symbol);
  return res.candles;
}

export async function fetchFyersLoginUrl(): Promise<{ loginUrl: string; appId: string; redirectUri: string }> {
  const response = await fetch('/api/market/fyers-login-url');
  if (!response.ok) {
    throw new Error(`Failed to load FYERS login URL: ${response.status}`);
  }
  return response.json();
}

export async function fetchOptionChainByExpiry(expiry: string): Promise<MarketSnapshotPayload> {
  const response = await fetch(`/api/market/option-chain?expiry=${encodeURIComponent(expiry)}`);
  if (!response.ok) {
    throw new Error(`Option chain fetch error: ${response.status}`);
  }
  const json = await response.json();
  return json.data;
}

export async function updateBrokerToken(tokenOrAuthCode: string): Promise<{
  status: string;
  connected: boolean;
  message: string;
  spotPrice?: number;
}> {
  const response = await fetch('/api/market/broker-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokenOrAuthCode })
  });
  return response.json();
}

export async function executeAutoLogin(credentials?: {
  fyId?: string;
  pin?: string;
  totpKey?: string;
}): Promise<{
  status: string;
  connected: boolean;
  message: string;
  spotPrice?: number;
}> {
  const response = await fetch('/api/market/auto-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials || {})
  });
  return response.json();
}
