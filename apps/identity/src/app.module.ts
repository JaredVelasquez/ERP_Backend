import { Module } from '@nestjs/common';
import { HealthModule } from '@presentation/http/health.module';
import { IdentityModule } from '@presentation/http/identity.module';

@Module({
  imports: [HealthModule.forService('identity'), IdentityModule],
})
export class AppModule {}
