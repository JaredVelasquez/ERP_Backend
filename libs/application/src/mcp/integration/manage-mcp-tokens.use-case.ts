import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { canUseModule } from '@domain/identity/membership/module-access';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';
import { IDENTITY_PORT, type IdentityPort, type SessionRecord } from '@domain/identity/session/session.port';
import { MCP_AUDIT_PORT, MCP_TOKEN_PORT, hashMcpToken, type McpAuditPort, type McpTokenPort, type McpTokenRecord } from '@domain/mcp/integration/mcp.port';
import { MCP_TOOL_CATALOG, McpError } from '@domain/mcp/tool-catalog/tool-catalog';

const READ_TOOLS = new Set([
  'list-accounts', 'list-journal-entries', 'sales-report', 'financial-report', 'preview-barcode', 'render-barcode-sheet', 'search-products-by-name', 'read-product',
  'read-stock-card', 'analyze-media', 'list-commercial-prices', 'list-price-proposals', 'list-commercial-price-history',
  'read-price-settings', 'dashboard', 'catalog-template', 'count-template', 'download-voucher',
  'read-table-layout', 'read-dashboard-layout', 'read-ui-preferences',
]);
const OPERATION_TOOLS = new Set(['issue-stock', 'confirm-document', 'post-journal-entry', 'void-journal-entry', 'save-voucher', 'confirm-voucher', 'link-voucher']);
const CATALOG_TOOLS = new Set(['create-product', 'propose-price', 'import-catalog', 'import-count']);

export type TokenProfile = 'consulta' | 'operacion' | 'catalogo' | 'gerencia' | 'personalizado';
export type TokenDetails = Omit<McpTokenRecord, 'tokenHash'>;

@Injectable()
export class ManageMcpTokensUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(MCP_TOKEN_PORT) private readonly tokens: McpTokenPort,
    @Inject(MCP_AUDIT_PORT) private readonly audit: McpAuditPort = { record: async () => undefined, list: async () => [] },
  ) {}

  async options(sessionToken: string): Promise<{ profiles: TokenProfile[]; tools: string[] }> {
    const session = await this.session(sessionToken);
    return { profiles: ['consulta', 'operacion', 'catalogo', 'gerencia', 'personalizado'], tools: allowedTools(session) };
  }

  async create(sessionToken: string, input: { name: string; profile: TokenProfile; tools?: string[]; days?: number }): Promise<{ token: string; details: TokenDetails }> {
    const session = await this.session(sessionToken);
    if (typeof input !== 'object' || input === null) throw new McpError('Token details are required');
    const name = input.name?.trim();
    const days = input.days ?? 90;
    if (!name || name.length > 120 || !Number.isInteger(days) || days < 1 || days > 365) throw new McpError('Invalid token name or expiration');
    if (!['consulta', 'operacion', 'catalogo', 'gerencia', 'personalizado'].includes(input.profile)) throw new McpError('Invalid token profile');
    const allowed = new Set(allowedTools(session));
    const selected = input.profile === 'personalizado' ? input.tools : profileTools(input.profile).filter((tool) => allowed.has(tool));
    if (!Array.isArray(selected) || selected.length === 0 || selected.length > 50 || selected.some((tool) => typeof tool !== 'string' || !allowed.has(tool))) {
      throw new McpError('Token tools exceed this user’s permissions');
    }
    const tools = [...new Set(selected)];
    const token = `erp_mcp_${randomBytes(32).toString('base64url')}`;
    const record: McpTokenRecord = {
      id: randomUUID(), userId: session.userId, companyId: session.companyId,
      tokenHash: hashMcpToken(token), name, profile: input.profile, tools,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(), revokedAt: null,
    };
    await this.tokens.issue(record);
    return { token, details: publicDetails(record) };
  }

  async list(sessionToken: string): Promise<TokenDetails[]> {
    const session = await this.session(sessionToken);
    return (await this.tokens.listTokens(session.userId, session.companyId)).map(publicDetails);
  }

  async revoke(sessionToken: string, id: string): Promise<void> {
    const session = await this.session(sessionToken);
    if (!(await this.tokens.revoke(id, session.userId, session.companyId))) throw new McpError('Token was not found');
  }

  async companyTokens(sessionToken: string) {
    const session = await this.settingsSession(sessionToken);
    return (await this.tokens.listCompanyTokens?.(session.companyId) ?? []).map(({ tokenHash: _hash, ...row }) => row);
  }

  async usage(sessionToken: string, page = 1, pageSize = 25, search = '', userId = '') {
    const session = await this.settingsSession(sessionToken);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || search.length > 100 || (userId !== '' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))) {
      throw new McpError('Consulta de historial inválida.');
    }
    const result = await this.audit.listPage?.(session.companyId, page, pageSize, search.trim(), userId)
      ?? { items: (await this.audit.list(session.companyId)).slice((page - 1) * pageSize, page * pageSize), total: 0 };
    return { ...result, page, pageSize };
  }

  async revokeCompany(sessionToken: string, id: string): Promise<void> {
    const session = await this.settingsSession(sessionToken, 'edit');
    if (!await this.tokens.revokeCompanyToken?.(id, session.companyId)) throw new McpError('Token was not found');
  }

  async rotateCompany(sessionToken: string, id: string): Promise<{ token: string; details: TokenDetails }> {
    const session = await this.settingsSession(sessionToken, 'edit');
    const token = `erp_mcp_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const record = await this.tokens.rotateCompanyToken?.(id, session.companyId,
      session.role === 'owner' ? null : session.userId, hashMcpToken(token), expiresAt);
    if (!record) throw new McpError('Token no encontrado o sin permiso para rotarlo.');
    return { token, details: publicDetails(record) };
  }

  private async settingsSession(token: string, access: 'view' | 'edit' = 'view'): Promise<SessionRecord> {
    const session = await this.session(token);
    if (!canUseModule(session.grants, 'settings', access)) throw new McpError('No tienes permiso para administrar integraciones.');
    return session;
  }

  private async session(token: string): Promise<SessionRecord> {
    const session = await this.identity.findSession(token);
    if (session === null) throw new InvalidCredentialsError();
    return session;
  }
}

function allowedTools(session: SessionRecord): string[] {
  return MCP_TOOL_CATALOG.filter((tool) => tool.audience === 'session'
    && tool.module !== 'platform'
    && (tool.module === null ? READ_TOOLS.has(tool.name) : canUseModule(session.grants, tool.module, tool.access)))
    .map((tool) => tool.name);
}

function profileTools(profile: Exclude<TokenProfile, 'personalizado'>): string[] {
  const all = MCP_TOOL_CATALOG.filter((tool) => tool.audience === 'session' && tool.module !== 'platform').map((tool) => tool.name);
  if (profile === 'consulta') return all.filter((name) => READ_TOOLS.has(name));
  if (profile === 'operacion') return all.filter((name) => READ_TOOLS.has(name) || OPERATION_TOOLS.has(name));
  if (profile === 'catalogo') return all.filter((name) => READ_TOOLS.has(name) || CATALOG_TOOLS.has(name));
  return all.filter((name) => !['register-user', 'replace-modules'].includes(name));
}

function publicDetails(record: McpTokenRecord): TokenDetails {
  return {
    id: record.id, userId: record.userId, companyId: record.companyId,
    name: record.name, profile: record.profile, tools: record.tools,
    createdAt: record.createdAt, expiresAt: record.expiresAt, revokedAt: record.revokedAt,
  };
}
