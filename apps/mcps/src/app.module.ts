import { Module } from '@nestjs/common';
import { HealthModule } from '@composition/health.module';
import { McpModule } from '@composition/mcp.module';

@Module({
  imports: [HealthModule.forService('mcps'), McpModule],
})
export class AppModule {}
