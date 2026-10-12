import { Module, type DynamicModule } from '@nestjs/common';
import { HEALTH_SERVICE, HealthController } from '@presentation/http/health.controller';

@Module({})
export class HealthModule {
  static forService(service: string): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [{ provide: HEALTH_SERVICE, useValue: service }],
    };
  }
}
