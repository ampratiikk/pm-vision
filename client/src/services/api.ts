import { HealthCheckResponse, ChartCandleTick, MarketSnapshotPayload } from '@pm-vision/shared';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
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
