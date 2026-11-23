export const config = {
  port: Number(process.env.PORT) || 5000,
  host: process.env.HOST || '0.0.0.0',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  env: process.env.NODE_ENV || 'development',
  version: '0.1.0'
};
