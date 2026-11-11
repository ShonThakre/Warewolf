import { Logger } from '@nestjs/common';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
if (!config.databaseUrl) {
  Logger.error('DATABASE_URL is not set. Copy .env.example to .env, or export it.', 'Bootstrap');
  process.exit(1);
}
const app = await createApp(config);
await app.listen(config.port);
Logger.log(`${config.name} ${config.version} listening on port ${config.port}`, 'Bootstrap');
