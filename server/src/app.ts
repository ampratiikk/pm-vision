import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/index.js';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  app.use(cors({
    origin: config.env === 'production' ? true : config.clientOrigin,
    credentials: true
  }));
  app.use(express.json());

  // Mount API routes
  app.use('/api', apiRouter);

  // Fallback 404 handler for unknown API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // In production (or when client/dist exists), serve the compiled frontend React app
  const possibleDistPaths = [
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../../../client/dist')
  ];

  const clientDist = possibleDistPaths.find((p) => fs.existsSync(p));

  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
