import { Module } from '@nestjs/common';
import { OpenApiController } from '@presentation/http/gateway/openapi/openapi.controller';

@Module({
  controllers: [OpenApiController],
})
export class OpenApiModule {}
