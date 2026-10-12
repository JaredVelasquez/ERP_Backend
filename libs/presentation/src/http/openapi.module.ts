import { Module } from '@nestjs/common';
import { OpenApiController } from '@presentation/http/openapi.controller';

@Module({
  controllers: [OpenApiController],
})
export class OpenApiModule {}
