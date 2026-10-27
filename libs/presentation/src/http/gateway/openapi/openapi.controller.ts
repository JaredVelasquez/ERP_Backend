import { phase1Contract } from '@domain/gateway/openapi/openapi-contract';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class OpenApiController {
  @Get('openapi.json')
  document(): typeof phase1Contract {
    return phase1Contract;
  }
}
