import { app } from './app';
import { config } from './config';

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[ERP-Backend] Server running on http://0.0.0.0:${config.port} (${config.nodeEnv})`);
  console.log(`[ERP-Backend] Health check: http://localhost:${config.port}/health`);
});

process.on('SIGTERM', () => {
  console.log('[ERP-Backend] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('[ERP-Backend] Server closed.');
    process.exit(0);
  });
});
