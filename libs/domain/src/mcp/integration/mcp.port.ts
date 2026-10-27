import { createHash } from 'node:crypto';

export interface McpAuditEntry {
  userId: string;
  companyId: string;
  tool: string;
  result: 'ok' | 'denied' | 'error';
  movementId: string | null;
  documentId: string | null;
  productIds: readonly string[];
  tokenId?: string | null;
  createdAt?: string;
  userName?: string;
  tokenName?: string | null;
}

export interface McpAuditPort {
  record(entry: McpAuditEntry): Promise<void>;
  list(companyId: string): Promise<McpAuditEntry[]>;
  listPage?(companyId: string, page: number, pageSize: number, search: string, userId: string): Promise<{ items: McpAuditEntry[]; total: number }>;
}

export interface McpTokenRecord {
  id: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  name: string;
  profile: string;
  tools: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface McpTokenPort {
  issue(record: McpTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<McpTokenRecord | null>;
  listTokens(userId: string, companyId: string): Promise<McpTokenRecord[]>;
  revoke(id: string, userId: string, companyId: string): Promise<boolean>;
  listCompanyTokens?(companyId: string): Promise<(McpTokenRecord & { userName: string; lastUsedAt: string | null; ownerActive: boolean })[]>;
  revokeCompanyToken?(id: string, companyId: string): Promise<boolean>;
  rotateCompanyToken?(id: string, companyId: string, actorUserId: string | null, tokenHash: string, expiresAt: string): Promise<McpTokenRecord | null>;
}

export const MCP_AUDIT_PORT = Symbol('MCP_AUDIT_PORT');
export const MCP_TOKEN_PORT = Symbol('MCP_TOKEN_PORT');
export const MCP_TOOL_HANDLERS = Symbol('MCP_TOOL_HANDLERS');

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
