import { Logger } from '@nestjs/common';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApp(config);
await app.listen(config.port);
Logger.log(`${config.name} ${config.version} listening on port ${config.port}`, 'Bootstrap');
