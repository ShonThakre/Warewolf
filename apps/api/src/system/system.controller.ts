import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse, VersionResponse } from '@warewolf/contracts';
import { APP_CONFIG, type AppConfig } from '../config.js';

@Controller()
export class SystemController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Liveness. It does not touch the database. */
  @Get('health')
  health(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('version')
  version(): VersionResponse {
    return { name: this.config.name, version: this.config.version, commit: this.config.commit };
  }
}
