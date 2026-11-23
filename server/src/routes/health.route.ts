import { Router, Request, Response } from 'express';
import { HealthCheckResponse } from '@pm-vision/shared';
import { config } from '../config/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const payload: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.env,
    version: config.version
  };

  res.status(200).json(payload);
});
