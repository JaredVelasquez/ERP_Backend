import { Module } from '@nestjs/common';
import { HealthModule } from '@presentation/http/health.module';
import { OpenApiModule } from '@presentation/http/openapi.module';

@Module({
  imports: [HealthModule.forService('gateway'), OpenApiModule],
})
export class AppModule {}
