import { HealthCheckResponse } from '@pm-vision/shared';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
