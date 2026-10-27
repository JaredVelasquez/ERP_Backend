import { Controller, Get, Inject } from '@nestjs/common';
import { healthResponse, type HealthResponse } from '@presentation/http/platform/health/health.response';

export const HEALTH_SERVICE = Symbol('HEALTH_SERVICE');

@Controller('health')
export class HealthController {
  constructor(@Inject(HEALTH_SERVICE) private readonly service: string) {}

  @Get()
  check(): HealthResponse {
    return healthResponse(this.service);
  }
}
