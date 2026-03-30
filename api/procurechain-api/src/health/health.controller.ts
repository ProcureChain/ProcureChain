import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'procurechain-api',
      env: process.env.ENV_NAME || 'dev',
      ts: new Date().toISOString(),
    };
  }
}
