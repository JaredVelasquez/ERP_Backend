import { InvokeMcpToolUseCase, type JsonRecord } from '@application/mcp/invoke-mcp-tool.use-case';
import { readSessionToken } from '@domain/identity/access';
import { Body, Controller, Param, Post, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

@Controller('mcp')
@UseFilters(CompanyIdentityFilter)
export class McpController {
  constructor(private readonly invokeTool: InvokeMcpToolUseCase) {}

  @Post('tools/:name')
  invoke(@Param('name') name: string, @Body() body: JsonRecord, @Req() request: Request): Promise<unknown> {
    return this.invokeTool.execute(sessionToken(request), name, body ?? {});
  }
}

function sessionToken(request: Request): string | null {
  return readSessionToken({
    cookie: typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
    authorization: typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
  });
}
