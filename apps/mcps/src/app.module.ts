import { Module } from '@nestjs/common';
import { HealthModule } from '@presentation/http/health.module';
import { McpModule } from '@presentation/http/mcp.module';

@Module({
  imports: [HealthModule.forService('mcps'), McpModule],
})
export class AppModule {}
