import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { McpAuditEntry, McpTokenRecord } from '@domain/mcp/integration/mcp.port';
import { McpAuditEntity, McpTokenEntity } from '@infrastructure/integration/mcp/postgres/entities/mcp.entity';
import { MembershipEntity, UserEntity } from '@infrastructure/identity/session/postgres/entities/identity.entity';

export async function issueToken(manager: EntityManager, record: McpTokenRecord): Promise<void> {
  await manager.getRepository(McpTokenEntity).createQueryBuilder().insert().values(tokenEntity(record)).execute();
}

export async function readTokenByHash(manager: EntityManager, tokenHash: string): Promise<McpTokenEntity | null> {
  return manager.getRepository(McpTokenEntity).createQueryBuilder('token').where('token.tokenHash = :tokenHash', { tokenHash }).getOne();
}

export async function readUserTokens(manager: EntityManager, userId: string, companyId: string): Promise<McpTokenEntity[]> {
  return manager.getRepository(McpTokenEntity).createQueryBuilder('token')
    .where('token.userId = :userId AND token.companyId = :companyId', { userId, companyId })
    .orderBy('token.createdAt', 'DESC').getMany();
}

export async function revokeUserToken(manager: EntityManager, id: string, userId: string, companyId: string): Promise<boolean> {
  const result = await manager.getRepository(McpTokenEntity).createQueryBuilder().update(McpTokenEntity)
    .set({ revokedAt: new Date() }).where('id = :id AND userId = :userId AND companyId = :companyId AND revokedAt IS NULL', { id, userId, companyId }).execute();
  return Boolean(result.affected);
}

export async function readCompanyTokens(manager: EntityManager, companyId: string): Promise<CompanyTokenRow[]> {
  return manager.getRepository(McpTokenEntity).createQueryBuilder('token')
    .innerJoin(UserEntity, 'user', 'user.id = token.userId')
    .leftJoin(MembershipEntity, 'membership', 'membership.userId = token.userId AND membership.companyId = token.companyId')
    .select('token.id', 'id').addSelect('token.userId', 'userId').addSelect('token.companyId', 'companyId')
    .addSelect('token.tokenHash', 'tokenHash').addSelect('token.name', 'name').addSelect('token.profile', 'profile')
    .addSelect('token.tools', 'tools').addSelect('token.createdAt', 'createdAt').addSelect('token.expiresAt', 'expiresAt')
    .addSelect('token.revokedAt', 'revokedAt').addSelect('token.lastUsedAt', 'lastUsedAt')
    .addSelect('user.displayName', 'userName').addSelect('COALESCE(membership.active, false)', 'ownerActive')
    .where('token.companyId = :companyId', { companyId }).orderBy('token.createdAt', 'DESC')
    .getRawMany<CompanyTokenRow>();
}

export async function revokeCompanyToken(manager: EntityManager, id: string, companyId: string): Promise<boolean> {
  const result = await manager.getRepository(McpTokenEntity).createQueryBuilder().update(McpTokenEntity)
    .set({ revokedAt: new Date() }).where('id = :id AND companyId = :companyId AND revokedAt IS NULL', { id, companyId }).execute();
  return Boolean(result.affected);
}

export async function rotateCompanyToken(
  manager: EntityManager,
  id: string,
  companyId: string,
  actorUserId: string | null,
  tokenHash: string,
  expiresAt: string,
): Promise<McpTokenEntity | null> {
  const query = manager.getRepository(McpTokenEntity).createQueryBuilder().update(McpTokenEntity)
    .set({ tokenHash, expiresAt: new Date(expiresAt), lastUsedAt: null, revokedAt: null })
    .where('id = :id AND companyId = :companyId', { id, companyId });
  if (actorUserId !== null) query.andWhere('userId = :actorUserId', { actorUserId });
  const updated = await query.execute();
  if (!updated.affected) return null;
  return manager.getRepository(McpTokenEntity).createQueryBuilder('token')
    .where('token.id = :id AND token.companyId = :companyId', { id, companyId }).getOne();
}

export async function saveAuditEntry(manager: EntityManager, entry: McpAuditEntry): Promise<void> {
  await manager.getRepository(McpAuditEntity).createQueryBuilder().insert().values({
    id: randomUUID(), userId: entry.userId, companyId: entry.companyId, toolName: entry.tool,
    result: entry.result, movementId: entry.movementId, tokenId: entry.tokenId ?? null,
  }).execute();
  if (entry.tokenId) {
    await manager.getRepository(McpTokenEntity).createQueryBuilder().update(McpTokenEntity).set({ lastUsedAt: new Date() })
      .where('id = :tokenId AND companyId = :companyId', { tokenId: entry.tokenId, companyId: entry.companyId }).execute();
  }
}

export async function readAuditPage(
  manager: EntityManager,
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
  userId: string,
): Promise<{ items: McpAuditEntry[]; total: number }> {
  const query = manager.getRepository(McpAuditEntity).createQueryBuilder('audit')
    .leftJoin(UserEntity, 'user', 'user.id = audit.userId')
    .leftJoin(McpTokenEntity, 'token', 'token.id = audit.tokenId')
    .where('audit.companyId = :companyId', { companyId });
  if (userId !== '') query.andWhere('audit.userId = :userId', { userId });
  if (search.trim() !== '') {
    const term = `%${search.trim()}%`;
    query.andWhere('(user.displayName ILIKE :term OR token.name ILIKE :term OR audit.toolName ILIKE :term)', { term });
  }
  const total = await query.clone().getCount();
  const rows = await query.orderBy('audit.createdAt', 'DESC').addOrderBy('audit.id', 'ASC')
    .offset((page - 1) * pageSize).limit(pageSize)
    .select('audit.userId', 'userId').addSelect('audit.companyId', 'companyId').addSelect('audit.toolName', 'tool')
    .addSelect('audit.result', 'result').addSelect('audit.movementId', 'movementId').addSelect('audit.tokenId', 'tokenId')
    .addSelect('audit.createdAt', 'createdAt').addSelect('user.displayName', 'userName').addSelect('token.name', 'tokenName')
    .getRawMany<AuditRow>();
  return { items: rows.map(auditEntry), total };
}

export async function readAudit(manager: EntityManager, companyId: string): Promise<McpAuditEntry[]> {
  const rows = await manager.getRepository(McpAuditEntity).createQueryBuilder('audit')
    .leftJoin(UserEntity, 'user', 'user.id = audit.userId')
    .leftJoin(McpTokenEntity, 'token', 'token.id = audit.tokenId')
    .select('audit.userId', 'userId').addSelect('audit.companyId', 'companyId').addSelect('audit.toolName', 'tool')
    .addSelect('audit.result', 'result').addSelect('audit.movementId', 'movementId').addSelect('audit.tokenId', 'tokenId')
    .addSelect('audit.createdAt', 'createdAt').addSelect('user.displayName', 'userName').addSelect('token.name', 'tokenName')
    .where('audit.companyId = :companyId', { companyId }).orderBy('audit.createdAt', 'DESC').take(500)
    .getRawMany<AuditRow>();
  return rows.map(auditEntry);
}

interface CompanyTokenRow {
  id: string; userId: string; companyId: string; tokenHash: string; name: string; profile: string; tools: string[];
  createdAt: Date | string; expiresAt: Date | string | null; revokedAt: Date | string | null; lastUsedAt: Date | string | null;
  userName: string; ownerActive: boolean;
}

interface AuditRow {
  userId: string; companyId: string; tool: string; result: McpAuditEntry['result']; movementId: string | null;
  tokenId: string | null; createdAt: Date | string; userName?: string; tokenName: string | null;
}

export function tokenEntity(record: McpTokenRecord): McpTokenEntity {
  return Object.assign(new McpTokenEntity(), {
    id: record.id, userId: record.userId, companyId: record.companyId, tokenHash: record.tokenHash,
    name: record.name, profile: record.profile, tools: record.tools, createdAt: new Date(record.createdAt),
    expiresAt: record.expiresAt ? new Date(record.expiresAt) : null, revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
  });
}

export function tokenRecord(entity: McpTokenEntity): McpTokenRecord {
  return {
    id: entity.id, userId: entity.userId, companyId: entity.companyId, tokenHash: entity.tokenHash,
    name: entity.name, profile: entity.profile, tools: entity.tools, createdAt: toIso(entity.createdAt),
    expiresAt: entity.expiresAt ? toIso(entity.expiresAt) : null, revokedAt: entity.revokedAt ? toIso(entity.revokedAt) : null,
  };
}

export function auditEntry(row: AuditRow): McpAuditEntry {
  return {
    userId: row.userId, companyId: row.companyId, tool: row.tool, result: row.result,
    movementId: row.movementId, documentId: null, productIds: [], tokenId: row.tokenId,
    createdAt: toIso(row.createdAt), userName: row.userName, tokenName: row.tokenName,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
