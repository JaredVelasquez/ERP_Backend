import { Inject, Injectable } from '@nestjs/common';
import { canUseModule, PermissionDeniedError } from '@domain/identity/membership/module-access';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';
import { McpError, type McpToolDefinition } from '@domain/mcp/tool-catalog/tool-catalog';
import { MCP_AUDIT_PORT, MCP_TOKEN_PORT, MCP_TOOL_HANDLERS, hashMcpToken, type McpAuditEntry, type McpAuditPort, type McpTokenPort } from '@domain/mcp/integration/mcp.port';
import { IDENTITY_PORT, type IdentityPort, type SessionRecord } from '@domain/identity/session/session.port';

export interface JsonRecord {
  [key: string]: unknown;
}

export interface McpToolHandler extends McpToolDefinition {
  execute(session: SessionRecord | null, input: JsonRecord): Promise<unknown>;
}

@Injectable()
export class InvokeMcpToolUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(MCP_AUDIT_PORT) private readonly audit: McpAuditPort,
    @Inject(MCP_TOKEN_PORT) private readonly tokens: McpTokenPort,
    @Inject(MCP_TOOL_HANDLERS) private readonly handlers: readonly McpToolHandler[],
  ) {}

  async execute(token: string | null, name: string, input: JsonRecord, credential: 'session' | 'integration' = 'session'): Promise<unknown> {
    const tool = this.handlers.find((item) => item.name === name) ?? null;
    if (tool === null) {
      throw new McpError('Unknown tool');
    }
    if (tool.audience === 'public') {
      return this.run(null, tool, input);
    }
    if (credential === 'integration') {
      const authorized = await this.requireIntegration(token);
      return this.run(authorized.session, tool, input, authorized.tools, authorized.tokenId);
    }
    return this.run(await this.requireSession(token), tool, input);
  }

  async availableTools(token: string | null): Promise<string[]> {
    const authorized = await this.requireIntegration(token);
    return this.handlers.filter((tool) => authorized.tools.includes(tool.name)
      && (tool.module === null || canUseModule(authorized.session.grants, tool.module, tool.access)))
      .map((tool) => tool.name);
  }

  private async requireSession(token: string | null): Promise<SessionRecord> {
    if (token === null || token.trim() === '') {
      throw new InvalidCredentialsError();
    }
    const session = await this.identity.findSession(token);
    if (session === null) {
      throw new InvalidCredentialsError();
    }
    return session;
  }

  private async requireIntegration(token: string | null): Promise<{ session: SessionRecord; tools: readonly string[]; tokenId: string }> {
    if (token === null || !token.startsWith('erp_mcp_')) throw new InvalidCredentialsError();
    const record = await this.tokens.findByHash(hashMcpToken(token));
    if (record === null || record.revokedAt !== null || (record.expiresAt !== null && Date.parse(record.expiresAt) <= Date.now())) {
      throw new InvalidCredentialsError();
    }
    const membership = await this.identity.findMembership(record.userId, record.companyId);
    if (membership === null) throw new InvalidCredentialsError();
    return {
      session: { token: '', userId: record.userId, companyId: record.companyId, role: membership.role, grants: membership.grants },
      tools: record.tools,
      tokenId: record.id,
    };
  }

  private async run(session: SessionRecord | null, tool: McpToolHandler, input: JsonRecord, tools?: readonly string[], tokenId: string | null = null): Promise<unknown> {
    try {
      if (tools !== undefined && !tools.includes(tool.name)) throw new PermissionDeniedError();
      const scoped = session === null ? input : scopeCompany(session, input);
      assertModule(session, tool);
      const result = await tool.execute(session, scoped);
      await this.audit.record({ ...auditEntry(session, tool.name, 'ok', movementId(scoped), documentIdOf(result), productIdsOf(scoped), result), tokenId });
      return result;
    } catch (error) {
      await this.audit.record({ ...auditEntry(session, tool.name, auditResult(error), movementId(input), null, productIdsOf(input), null), tokenId });
      throw error;
    }
  }
}

function assertModule(session: SessionRecord | null, tool: McpToolHandler): void {
  if (session === null || tool.module === null) {
    return;
  }
  if (!canUseModule(session.grants, tool.module, tool.access)) {
    throw new PermissionDeniedError();
  }
}

function scopeCompany(session: SessionRecord, input: JsonRecord): JsonRecord {
  const requested = input.companyId;
  if (typeof requested === 'string' && requested.trim() !== '' && requested !== session.companyId) {
    throw new PermissionDeniedError();
  }
  return { ...input, companyId: session.companyId };
}

function movementId(input: JsonRecord): string | null {
  const value = input.moneyMovementId;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
}

function auditResult(error: unknown): 'denied' | 'error' {
  if (error instanceof PermissionDeniedError) {
    return 'denied';
  }
  return 'error';
}

function auditEntry(
  session: SessionRecord | null,
  tool: string,
  result: McpAuditEntry['result'],
  linkedMovementId: string | null,
  documentId: string | null,
  productIds: readonly string[],
  payload: unknown,
): McpAuditEntry {
  return {
    userId: session?.userId ?? readField(payload, 'userId'),
    companyId: session?.companyId ?? readField(payload, 'companyId'),
    tool,
    result,
    movementId: linkedMovementId,
    documentId,
    productIds,
  };
}

function documentIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const document = Reflect.get(payload, 'document');
  if (typeof document !== 'object' || document === null) {
    return null;
  }
  const id = Reflect.get(document, 'id');
  if (typeof id !== 'string' || id.trim() === '') {
    return null;
  }
  return id;
}

function productIdsOf(input: JsonRecord): string[] {
  const ids: string[] = [];
  pushProductId(ids, input.productId);
  pushProductIdList(ids, input.productIds);
  pushLineProductIds(ids, input.lines);
  return ids;
}

function pushProductId(ids: string[], value: unknown): void {
  if (typeof value !== 'string' || value.trim() === '') {
    return;
  }
  if (ids.includes(value)) {
    return;
  }
  ids.push(value);
}

function pushProductIdList(ids: string[], value: unknown): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const item of value) {
    pushProductId(ids, item);
  }
}

function pushLineProductIds(ids: string[], value: unknown): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const item of value) {
    pushLineProductId(ids, item);
  }
}

function pushLineProductId(ids: string[], value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  pushProductId(ids, Reflect.get(value, 'productId'));
}

function readField(payload: unknown, field: 'userId' | 'companyId'): string {
  if (typeof payload !== 'object' || payload === null) {
    return '';
  }
  const value = Reflect.get(payload, field);
  if (typeof value !== 'string') {
    return '';
  }
  return value;
}
