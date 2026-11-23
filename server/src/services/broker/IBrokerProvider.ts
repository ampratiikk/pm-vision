import { MarketTick } from '@pm-vision/shared';

export interface BrokerCredentials {
  appId?: string;
  secretKey?: string;
  accessToken?: string;
  pin?: string;
}

export type TickCallback = (tick: MarketTick) => void;

export interface IBrokerProvider {
  name: string;
  isConnected(): boolean;
  connect(credentials: BrokerCredentials): Promise<boolean>;
  disconnect(): void;
  subscribe(symbols: string[]): void;
  onTick(callback: TickCallback): void;
}
