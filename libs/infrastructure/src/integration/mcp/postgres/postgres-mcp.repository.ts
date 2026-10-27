import type { McpAuditEntry, McpAuditPort, McpTokenPort, McpTokenRecord } from '@domain/mcp/integration/mcp.port';
import { readAudit, readAuditPage, readCompanyTokens, readTokenByHash, readUserTokens, issueToken, revokeCompanyToken, revokeUserToken, rotateCompanyToken, saveAuditEntry, tokenRecord } from '@infrastructure/integration/mcp/postgres/mcp.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresMcpRepository implements McpAuditPort, McpTokenPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async issue(record: McpTokenRecord): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => issueToken(manager, record)));
  }

  async findByHash(tokenHash: string): Promise<McpTokenRecord | null> {
    const entity = await this.database.withManager((manager) => readTokenByHash(manager, tokenHash));
    return entity ? tokenRecord(entity) : null;
  }

  async listTokens(userId: string, companyId: string): Promise<McpTokenRecord[]> {
    const entities = await this.database.withManager((manager) => readUserTokens(manager, userId, companyId));
    return entities.map(tokenRecord);
  }

  async revoke(id: string, userId: string, companyId: string): Promise<boolean> {
    return this.database.transaction(() => this.database.withManager((manager) => revokeUserToken(manager, id, userId, companyId)));
  }

  async listCompanyTokens(companyId: string): Promise<(McpTokenRecord & { userName: string; lastUsedAt: string | null; ownerActive: boolean })[]> {
    const rows = await this.database.withManager((manager) => readCompanyTokens(manager, companyId));
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      companyId: row.companyId,
      tokenHash: row.tokenHash,
      name: row.name,
      profile: row.profile,
      tools: row.tools,
      createdAt: iso(row.createdAt),
      expiresAt: row.expiresAt ? iso(row.expiresAt) : null,
      revokedAt: row.revokedAt ? iso(row.revokedAt) : null,
      userName: row.userName,
      lastUsedAt: row.lastUsedAt ? iso(row.lastUsedAt) : null,
      ownerActive: row.ownerActive,
    }));
  }

  async revokeCompanyToken(id: string, companyId: string): Promise<boolean> {
    return this.database.transaction(() => this.database.withManager((manager) => revokeCompanyToken(manager, id, companyId)));
  }

  async rotateCompanyToken(id: string, companyId: string, actorUserId: string | null, tokenHash: string, expiresAt: string): Promise<McpTokenRecord | null> {
    const entity = await this.database.transaction(() => this.database.withManager((manager) =>
      rotateCompanyToken(manager, id, companyId, actorUserId, tokenHash, expiresAt)));
    return entity ? tokenRecord(entity) : null;
  }

  async record(entry: McpAuditEntry): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => saveAuditEntry(manager, entry)));
  }

  async list(companyId: string): Promise<McpAuditEntry[]> {
    return this.database.withManager((manager) => readAudit(manager, companyId));
  }

  async listPage(companyId: string, page: number, pageSize: number, search: string, userId: string): Promise<{ items: McpAuditEntry[]; total: number }> {
    return this.database.withManager((manager) => readAuditPage(manager, companyId, page, pageSize, search, userId));
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
