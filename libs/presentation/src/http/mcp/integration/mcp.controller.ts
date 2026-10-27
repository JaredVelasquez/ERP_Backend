import { InvokeMcpToolUseCase, type JsonRecord } from '@application/mcp/integration/invoke-mcp-tool.use-case';
import { AssistantChatUseCase } from '@application/mcp/integration/assistant-chat.use-case';
import { ListAssistantConversationsUseCase } from '@application/mcp/conversation/list-assistant-conversations.use-case';
import { ReadAssistantConversationUseCase } from '@application/mcp/conversation/read-assistant-conversation.use-case';
import { ManageMcpTokensUseCase, type TokenProfile } from '@application/mcp/integration/manage-mcp-tokens.use-case';
import { AI_SETTINGS_PORT, type AiSettingsPort } from '@domain/mcp/assistant/ai-settings.port';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { canUseModule } from '@domain/identity/membership/module-access';
import { readSessionToken } from '@domain/identity/membership/access';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';
import { Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, Inject, Param, Post, Put, Query, Req, UseFilters } from '@nestjs/common';
import type { Request } from 'express';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';

@Controller('mcp')
@UseFilters(CompanyIdentityFilter)
export class McpController {
  constructor(private readonly invokeTool: InvokeMcpToolUseCase, private readonly manageTokens: ManageMcpTokensUseCase,
    private readonly assistant: AssistantChatUseCase,
    private readonly listAssistantConversations: ListAssistantConversationsUseCase,
    private readonly readAssistantConversation: ReadAssistantConversationUseCase,
    @Inject(AI_SETTINGS_PORT) private readonly aiSettings: AiSettingsPort,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort) {}

  @Get('company-tokens')
  companyTokens(@Req() request: Request) { return this.manageTokens.companyTokens(browserSessionToken(request)); }

  @Get('usage')
  usage(@Req() request: Request, @Query('page') page = '1', @Query('pageSize') pageSize = '25',
    @Query('search') search = '', @Query('userId') userId = '') {
    return this.manageTokens.usage(browserSessionToken(request), Number(page), Number(pageSize), search, userId);
  }

  @Delete('company-tokens/:id')
  async revokeCompany(@Req() request: Request, @Param('id') id: string) {
    await this.manageTokens.revokeCompany(browserSessionToken(request), id);
    return { revoked: true };
  }

  @Post('company-tokens/:id/rotate')
  @Header('Cache-Control', 'no-store')
  rotateCompany(@Req() request: Request, @Param('id') id: string) {
    return this.manageTokens.rotateCompany(browserSessionToken(request), id);
  }

  @Get('assistant/settings')
  async assistantSettings(@Req() request: Request) {
    const session = await this.settingsSession(request, 'view');
    return this.aiSettings.read(session.companyId);
  }

  @Put('assistant/settings')
  async saveAssistantSettings(@Req() request: Request, @Body() body: { provider: string; model: string; apiKey?: string }) {
    const session = await this.settingsSession(request, 'edit');
    return this.aiSettings.save(session.companyId, session.userId, body);
  }

  @Post('assistant/chat')
  @Header('Cache-Control', 'no-store')
  chat(@Req() request: Request, @Body() body: Parameters<AssistantChatUseCase['execute']>[1]) {
    return this.assistant.execute(browserSessionToken(request), body);
  }

  @Get('assistant/conversations')
  @Header('Cache-Control', 'no-store')
  listConversations(@Req() request: Request, @Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.listAssistantConversations.execute(browserSessionToken(request), Number(page), Number(pageSize));
  }

  @Get('assistant/conversations/:id')
  @Header('Cache-Control', 'no-store')
  readConversation(@Req() request: Request, @Param('id') id: string) {
    return this.readAssistantConversation.execute(browserSessionToken(request), id);
  }

  @Get('token-options')
  options(@Req() request: Request) {
    return this.manageTokens.options(browserSessionToken(request));
  }

  @Get('tokens')
  listTokens(@Req() request: Request) {
    return this.manageTokens.list(browserSessionToken(request));
  }

  @Post('tokens')
  @Header('Cache-Control', 'no-store')
  createToken(@Req() request: Request, @Body() body: { name: string; profile: TokenProfile; tools?: string[]; days?: number }) {
    return this.manageTokens.create(browserSessionToken(request), body);
  }

  @Delete('tokens/:id')
  async revokeToken(@Req() request: Request, @Param('id') id: string) {
    await this.manageTokens.revoke(browserSessionToken(request), id);
    return { revoked: true };
  }

  @Post('tools/:name')
  invoke(@Param('name') name: string, @Body() body: JsonRecord, @Req() request: Request): Promise<unknown> {
    const credential = typeof request.headers.authorization === 'string' ? 'integration' : 'session';
    return this.invokeTool.execute(sessionToken(request), name, body ?? {}, credential);
  }

  @Post('connector')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async connector(@Req() request: Request, @Body() body: { jsonrpc?: string; id?: string | number; method?: string; params?: JsonRecord }) {
    const token = sessionToken(request);
    if (typeof request.headers.authorization !== 'string') throw new InvalidCredentialsError();
    const id = body?.id;
    if (body?.jsonrpc !== '2.0' || typeof body.method !== 'string') return rpcError(id ?? null, -32600, 'Invalid request');
    if (body.method === 'notifications/initialized') { await this.invokeTool.availableTools(token); return; }
    if (body.method === 'ping' && id === undefined) { await this.invokeTool.availableTools(token); return; }
    if (id === undefined) return rpcError(null, -32600, 'Request id is required');
    if (body.method === 'initialize') {
      await this.invokeTool.availableTools(token);
      return rpcResult(id, { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'erp', version: '1.0.0' } });
    }
    if (body.method === 'ping') return rpcResult(id, {});
    if (body.method === 'tools/list') {
      const names = await this.invokeTool.availableTools(token);
      return rpcResult(id, { tools: names.map((name) => ({ name, description: `ERP: ${name}`, inputSchema: { type: 'object', additionalProperties: true } })) });
    }
    if (body.method === 'tools/call') {
      const name = body.params?.name;
      const args = body.params?.arguments;
      if (typeof name !== 'string' || (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args)))) {
        return rpcError(id, -32602, 'Invalid tool arguments');
      }
      const result = await this.invokeTool.execute(token, name, (args ?? {}) as JsonRecord, 'integration');
      return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(result) ?? 'null' }] });
    }
    return rpcError(id, -32601, 'Method not found');
  }

  private async settingsSession(request: Request, access: 'view' | 'edit') {
    const session = await this.identity.findSession(browserSessionToken(request));
    if (!session || !canUseModule(session.grants, 'settings', access)) throw new ForbiddenException();
    return session;
  }
}

function rpcResult(id: string | number, result: unknown) { return { jsonrpc: '2.0', id, result }; }
function rpcError(id: string | number | null, code: number, message: string) { return { jsonrpc: '2.0', id, error: { code, message } }; }

function browserSessionToken(request: Request): string {
  const token = readSessionToken({
    cookie: typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
    authorization: typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
  });
  if (token === null) throw new InvalidCredentialsError();
  return token;
}

function sessionToken(request: Request): string | null {
  return readSessionToken({
    cookie: typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
    authorization: typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
  });
}
