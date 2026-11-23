export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
}

export type WebSocketMessageType = 'CONNECT_ACK' | 'PING' | 'PONG' | 'SYSTEM_MESSAGE';

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

export type WebSocketMessage = ConnectAckMessage | PingMessage | PongMessage | SystemMessage;
