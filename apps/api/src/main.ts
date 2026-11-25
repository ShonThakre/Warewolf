import { Logger } from '@nestjs/common';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PresenceService } from './realtime/presence.service.js';

const config = loadConfig();
if (!config.databaseUrl) {
  Logger.error('DATABASE_URL is not set. Copy .env.example to .env, or export it.', 'Bootstrap');
  process.exit(1);
}
const app = await createApp(config);
// ID-02: a fresh process has no sockets, so nobody is connected. Here and not
// at module boot, so test apps sharing a database do not reset each other.
await app.get(PresenceService).resetAll();
await app.listen(config.port);
Logger.log(`${config.name} ${config.version} listening on port ${config.port}`, 'Bootstrap');
