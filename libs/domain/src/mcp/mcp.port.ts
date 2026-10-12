import { createHash } from 'node:crypto';

export interface McpAuditEntry {
  userId: string;
  companyId: string;
  tool: string;
  result: 'ok' | 'denied' | 'error';
  movementId: string | null;
  documentId: string | null;
  productIds: readonly string[];
}

export interface McpAuditPort {
  record(entry: McpAuditEntry): Promise<void>;
  list(companyId: string): Promise<McpAuditEntry[]>;
}

export interface McpTokenRecord {
  userId: string;
  companyId: string;
  tokenHash: string;
}

export interface McpTokenPort {
  issue(record: McpTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<McpTokenRecord | null>;
}

export const MCP_AUDIT_PORT = Symbol('MCP_AUDIT_PORT');
export const MCP_TOKEN_PORT = Symbol('MCP_TOKEN_PORT');
export const MCP_TOOL_HANDLERS = Symbol('MCP_TOOL_HANDLERS');

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
