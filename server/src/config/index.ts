import fs from 'fs';
import path from 'path';

// Automatically load environment variables from .env file
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../../.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      break;
    } catch (e) {
      console.error('Failed to parse .env file:', e);
    }
  }
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  host: process.env.HOST || '0.0.0.0',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  env: process.env.NODE_ENV || 'development',
  version: '0.1.0'
};
