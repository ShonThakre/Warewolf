import { type DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './config.js';
import { SystemController } from './system/system.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [SystemController],
      providers: [{ provide: APP_CONFIG, useValue: config }],
    };
  }
}
