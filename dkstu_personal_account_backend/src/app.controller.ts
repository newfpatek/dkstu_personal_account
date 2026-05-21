import { Controller, Get } from '@nestjs/common';

@Controller('health') // -> /api/health
export class AppController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Student Cabinet API',
    };
  }
}