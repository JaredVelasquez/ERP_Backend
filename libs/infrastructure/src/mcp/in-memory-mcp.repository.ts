import type { McpAuditEntry, McpAuditPort, McpTokenPort, McpTokenRecord } from '@domain/mcp/mcp.port';

export class InMemoryMcpRepository implements McpAuditPort, McpTokenPort {
  private readonly entries: McpAuditEntry[] = [];
  private readonly tokens: McpTokenRecord[] = [];

  async record(entry: McpAuditEntry): Promise<void> {
    this.entries.push({ ...entry });
  }

  async list(companyId: string): Promise<McpAuditEntry[]> {
    return this.entries.filter((entry) => entry.companyId === companyId).map((entry) => ({ ...entry }));
  }

  async issue(record: McpTokenRecord): Promise<void> {
    this.tokens.push({ ...record });
  }

  async findByHash(tokenHash: string): Promise<McpTokenRecord | null> {
    return this.tokens.find((record) => record.tokenHash === tokenHash) ?? null;
  }
}
