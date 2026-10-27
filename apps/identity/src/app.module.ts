import { Module } from '@nestjs/common';
import { HealthModule } from '@composition/health.module';
import { IdentityModule } from '@composition/identity.module';

@Module({
  imports: [HealthModule.forService('identity'), IdentityModule],
})
export class AppModule {}
