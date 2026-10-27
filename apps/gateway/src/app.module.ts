import { Module } from '@nestjs/common';
import { HealthModule } from '@composition/health.module';
import { OpenApiModule } from '@composition/openapi.module';

@Module({
  imports: [HealthModule.forService('gateway'), OpenApiModule],
})
export class AppModule {}
