import { HealthCheckResponse, ChartCandleTick, MarketSnapshotPayload, MarketSessionInfo } from '@pm-vision/shared';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

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

export async function fetchMarketHistory(resolution: string): Promise<ChartCandleTick[]> {
  const response = await fetch(`/api/market/history?resolution=${encodeURIComponent(resolution)}`);
  if (!response.ok) {
    throw new Error(`History fetch error: ${response.status}`);
  }
  const json = await response.json();
  return json.candles || [];
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

export async function executeAutoLogin(credentials: {
  fyId?: string;
  pin: string;
  totpKey: string;
}): Promise<{
  status: string;
  connected: boolean;
  message: string;
  spotPrice?: number;
}> {
  const response = await fetch('/api/market/auto-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  return response.json();
}
