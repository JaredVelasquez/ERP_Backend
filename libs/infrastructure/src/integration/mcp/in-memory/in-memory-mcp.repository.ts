import type { McpAuditEntry, McpAuditPort, McpTokenPort, McpTokenRecord } from '@domain/mcp/integration/mcp.port';

export class InMemoryMcpRepository implements McpAuditPort, McpTokenPort {
  private readonly entries: McpAuditEntry[] = [];
  private readonly tokens: McpTokenRecord[] = [];

  async record(entry: McpAuditEntry): Promise<void> {
    this.entries.push({ ...entry });
  }

  async list(companyId: string): Promise<McpAuditEntry[]> {
    return this.entries.filter((entry) => entry.companyId === companyId).map((entry) => ({ ...entry }));
  }

  async listPage(companyId: string, page: number, pageSize: number, search: string, userId: string): Promise<{ items: McpAuditEntry[]; total: number }> {
    const rows = this.entries.filter((entry) => entry.companyId === companyId && (!userId || entry.userId === userId)
      && `${entry.userName ?? ''} ${entry.tokenName ?? ''} ${entry.tool}`.toLowerCase().includes(search.toLowerCase())).reverse();
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  }

  async issue(record: McpTokenRecord): Promise<void> {
    this.tokens.push({ ...record });
  }

  async findByHash(tokenHash: string): Promise<McpTokenRecord | null> {
    return this.tokens.find((record) => record.tokenHash === tokenHash) ?? null;
  }

  async listTokens(userId: string, companyId: string): Promise<McpTokenRecord[]> {
    return this.tokens.filter((record) => record.userId === userId && record.companyId === companyId).map((record) => ({ ...record, tools: [...record.tools] }));
  }

  async listCompanyTokens(companyId: string): Promise<(McpTokenRecord & { userName: string; lastUsedAt: string | null; ownerActive: boolean })[]> {
    return this.tokens.filter((record) => record.companyId === companyId).map((record) => ({ ...record, userName: record.userId, lastUsedAt: null, ownerActive: true }));
  }

  async revokeCompanyToken(id: string, companyId: string): Promise<boolean> {
    const record = this.tokens.find((item) => item.id === id && item.companyId === companyId && item.revokedAt === null);
    if (!record) return false;
    record.revokedAt = new Date().toISOString();
    return true;
  }

  async rotateCompanyToken(id: string, companyId: string, actorUserId: string | null, tokenHash: string, expiresAt: string): Promise<McpTokenRecord | null> {
    const record = this.tokens.find((item) => item.id === id && item.companyId === companyId
      && (actorUserId === null || item.userId === actorUserId));
    if (!record) return null;
    record.tokenHash = tokenHash;
    record.expiresAt = expiresAt;
    record.revokedAt = null;
    return { ...record, tools: [...record.tools] };
  }

  async revoke(id: string, userId: string, companyId: string): Promise<boolean> {
    const record = this.tokens.find((item) => item.id === id && item.userId === userId && item.companyId === companyId);
    if (record === undefined) return false;
    record.revokedAt = new Date().toISOString();
    return true;
  }
}
