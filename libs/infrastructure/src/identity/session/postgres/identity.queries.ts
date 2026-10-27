import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { APP_MODULES, ModulePermissionError, type ModuleGrant } from '@domain/identity/membership/module-access';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@domain/identity/membership/access';
import { CompanyIdentityError } from '@domain/tenancy/company/company';
import type { CompanyUser, Membership, RefreshSessionIdentity, SessionRecord, UserAccount } from '@domain/identity/session/session.port';
import { CompanyEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import {
  AccessSessionEntity, AuthSessionFamilyEntity, MembershipEntity, ModuleGrantEntity,
  RefreshSessionEntity, RoleEntity, UserEntity,
} from '@infrastructure/identity/session/postgres/entities/identity.entity';

interface MembershipRow {
  membershipId: string; userId: string; companyId: string; companyName: string | null;
  role: MembershipRole; moduleName: string | null; accessLevel: string | null; active: boolean;
}

interface SessionRow {
  userId: string; companyId: string; roleCode: string; membershipId: string; companyName: string;
}

interface RefreshRow {
  id: string; familyId: string; userId: string; companyId: string; expiresAt: Date | string;
  consumedAt: Date | string | null; revokedAt: Date | string | null; familyRevokedAt: Date | string | null;
}

export async function insertUserWithMembership(manager: EntityManager, user: UserAccount, membership: Membership): Promise<void> {
  const existing = await manager.getRepository(UserEntity).createQueryBuilder('user').select('user.id', 'id')
    .where('user.email = :email', { email: user.email }).getRawOne<{ id: string }>();
  if (existing) throw new CompanyIdentityError('Email already exists');
  const role = await manager.getRepository(RoleEntity).createQueryBuilder('role').select('role.id', 'id')
    .where('role.code = :code', { code: membership.role }).getRawOne<{ id: string }>();
  if (!role) throw new CompanyIdentityError('Role is invalid');
  await manager.getRepository(UserEntity).createQueryBuilder().insert().values(user).execute();
  await manager.getRepository(MembershipEntity).createQueryBuilder().insert().values({
    id: membership.id, userId: membership.userId, companyId: membership.companyId, roleId: role.id, active: true,
  }).execute();
  await insertGrants(manager, membership.id, membership.grants);
}

export async function readUserByEmail(manager: EntityManager, email: string): Promise<UserAccount | null> {
  const user = await manager.getRepository(UserEntity).createQueryBuilder('user').where('user.email = :email', { email }).getOne();
  if (!user) return null;
  return { id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName };
}

export async function readMembershipRows(manager: EntityManager, userId: string, companyId?: string): Promise<MembershipRow[]> {
  const query = manager.getRepository(MembershipEntity).createQueryBuilder('membership')
    .innerJoin(RoleEntity, 'role', 'role.id = membership.roleId')
    .innerJoin(CompanyEntity, 'company', 'company.id = membership.companyId')
    .leftJoin(ModuleGrantEntity, 'grant', 'grant.membershipId = membership.id')
    .select('membership.id', 'membershipId').addSelect('membership.userId', 'userId')
    .addSelect('membership.companyId', 'companyId').addSelect('company.legalName', 'companyName')
    .addSelect('role.code', 'role').addSelect('grant.moduleName', 'moduleName')
    .addSelect('grant.accessLevel', 'accessLevel').addSelect('membership.active', 'active')
    .where('membership.userId = :userId AND membership.active = true', { userId });
  if (companyId !== undefined) query.andWhere('membership.companyId = :companyId', { companyId });
  return query.orderBy('company.legalName', 'ASC').getRawMany<MembershipRow>();
}

export async function insertSession(manager: EntityManager, record: SessionRecord): Promise<void> {
  await manager.getRepository(AuthSessionFamilyEntity).createQueryBuilder().insert().values({
    id: required(record.familyId, 'A complete session token pair is required'), userId: record.userId, companyId: record.companyId,
  }).execute();
  await insertAccessSession(manager, record);
  await insertRefreshSession(manager, record);
}

export async function readSession(manager: EntityManager, token: string, legacyEnabled: boolean, legacyUntil: string): Promise<SessionRecord | null> {
  const row = await manager.getRepository(AccessSessionEntity).createQueryBuilder('session')
    .innerJoin(MembershipEntity, 'membership', 'membership.userId = session.userId AND membership.companyId = session.companyId')
    .innerJoin(RoleEntity, 'role', 'role.id = membership.roleId')
    .innerJoin(CompanyEntity, 'company', 'company.id = session.companyId')
    .leftJoin(AuthSessionFamilyEntity, 'family', 'family.id = session.familyId')
    .select('session.userId', 'userId').addSelect('session.companyId', 'companyId')
    .addSelect('role.code', 'roleCode').addSelect('membership.id', 'membershipId').addSelect('company.legalName', 'companyName')
    .where('membership.active = true')
    .andWhere(`(
      (session.tokenHash = :tokenHash AND session.expiresAt > now() AND family.revokedAt IS NULL)
      OR (session.token = :token AND session.familyId IS NULL AND :legacyEnabled = true AND now() < :legacyUntil)
    )`, { token, tokenHash: hashToken(token), legacyEnabled, legacyUntil }).getRawOne<SessionRow>();
  if (!row) return null;
  const grants = await manager.getRepository(ModuleGrantEntity).createQueryBuilder('grant')
    .where('grant.membershipId = :membershipId', { membershipId: row.membershipId }).getMany();
  return {
    token,
    userId: row.userId,
    companyId: row.companyId,
    companyName: row.companyName,
    role: readRole(row.roleCode),
    grants: grants.map((grant) => readGrant(grant.moduleName, grant.accessLevel)),
  };
}

export async function readRefreshIdentity(manager: EntityManager, token: string): Promise<RefreshSessionIdentity | null> {
  const row = await manager.getRepository(RefreshSessionEntity).createQueryBuilder('refresh')
    .innerJoin(AuthSessionFamilyEntity, 'family', 'family.id = refresh.familyId')
    .select('family.id', 'familyId').addSelect('family.userId', 'userId').addSelect('family.companyId', 'companyId')
    .where('refresh.tokenHash = :tokenHash', { tokenHash: hashToken(token) }).getRawOne<RefreshSessionIdentity>();
  return row ?? null;
}

export async function rotateRefreshSession(manager: EntityManager, token: string, record: SessionRecord): Promise<boolean> {
  const previous = await manager.getRepository(RefreshSessionEntity).createQueryBuilder('refresh')
    .innerJoin(AuthSessionFamilyEntity, 'family', 'family.id = refresh.familyId')
    .select('refresh.id', 'id').addSelect('refresh.familyId', 'familyId').addSelect('family.userId', 'familyUserId')
    .addSelect('family.companyId', 'familyCompanyId').addSelect('refresh.expiresAt', 'expiresAt')
    .addSelect('refresh.consumedAt', 'consumedAt').addSelect('refresh.revokedAt', 'revokedAt').addSelect('family.revokedAt', 'familyRevokedAt')
    .where('refresh.tokenHash = :tokenHash', { tokenHash: hashToken(token) })
    .setLock('pessimistic_write').getRawOne<RefreshRow & { familyUserId: string; familyCompanyId: string }>();
  if (!previous) return false;
  if (previous.consumedAt !== null) {
    await revokeFamily(manager, previous.familyId);
    return false;
  }
  if (!refreshIsUsable(previous, record)) return false;
  const consumed = await manager.getRepository(RefreshSessionEntity).createQueryBuilder().update(RefreshSessionEntity)
    .set({ consumedAt: new Date() }).where('id = :id AND consumedAt IS NULL', { id: previous.id }).execute();
  if (!consumed.affected) return false;
  await insertAccessSession(manager, { ...record, familyId: previous.familyId });
  await insertRefreshSession(manager, { ...record, familyId: previous.familyId });
  return true;
}

export async function revokeRefreshSession(manager: EntityManager, token: string): Promise<void> {
  const row = await manager.getRepository(RefreshSessionEntity).createQueryBuilder('refresh')
    .select('refresh.familyId', 'familyId').where('refresh.tokenHash = :tokenHash', { tokenHash: hashToken(token) })
    .getRawOne<{ familyId: string }>();
  if (!row) return;
  await revokeFamily(manager, row.familyId);
}

export async function replaceMembershipGrants(manager: EntityManager, membershipId: string, grants: ModuleGrant[]): Promise<void> {
  const found = await manager.getRepository(MembershipEntity).createQueryBuilder('membership').select('membership.id', 'id')
    .where('membership.id = :membershipId', { membershipId }).getRawOne<{ id: string }>();
  if (!found) throw new ModulePermissionError('Membership was not found');
  await manager.getRepository(ModuleGrantEntity).createQueryBuilder().delete().where('membershipId = :membershipId', { membershipId }).execute();
  await insertGrants(manager, membershipId, grants);
}

export async function readCompanyUsers(manager: EntityManager, companyId: string): Promise<CompanyUser[]> {
  const rows = await manager.getRepository(MembershipEntity).createQueryBuilder('membership')
    .innerJoin(UserEntity, 'user', 'user.id = membership.userId')
    .innerJoin(RoleEntity, 'role', 'role.id = membership.roleId')
    .leftJoin(ModuleGrantEntity, 'grant', 'grant.membershipId = membership.id')
    .select('user.id', 'id').addSelect('user.email', 'email').addSelect('user.displayName', 'displayName')
    .addSelect('role.code', 'role').addSelect('membership.active', 'active')
    .addSelect('grant.moduleName', 'moduleName').addSelect('grant.accessLevel', 'accessLevel')
    .where('membership.companyId = :companyId', { companyId }).orderBy('user.displayName', 'ASC')
    .addOrderBy('grant.moduleName', 'ASC').getRawMany<CompanyUserRow>();
  const users = new Map<string, CompanyUser>();
  for (const row of rows) {
    const current = users.get(row.id) ?? {
      id: row.id, email: row.email, displayName: row.displayName, role: readRole(row.role), active: row.active, grants: [],
    };
    if (row.moduleName !== null && row.accessLevel !== null) current.grants.push(readGrant(row.moduleName, row.accessLevel));
    users.set(row.id, current);
  }
  return [...users.values()];
}

export async function setMembershipActive(manager: EntityManager, userId: string, companyId: string, active: boolean): Promise<boolean> {
  const result = await manager.getRepository(MembershipEntity).createQueryBuilder().update(MembershipEntity).set({ active })
    .where('userId = :userId AND companyId = :companyId', { userId, companyId }).execute();
  if (!result.affected) return false;
  if (!active) await manager.getRepository(AuthSessionFamilyEntity).createQueryBuilder().update(AuthSessionFamilyEntity)
    .set({ revokedAt: new Date() }).where('userId = :userId AND companyId = :companyId AND revokedAt IS NULL', { userId, companyId }).execute();
  return true;
}

export async function setUserPassword(manager: EntityManager, userId: string, passwordHash: string): Promise<void> {
  await manager.getRepository(UserEntity).createQueryBuilder().update(UserEntity).set({ passwordHash }).where('id = :userId', { userId }).execute();
  await manager.getRepository(AuthSessionFamilyEntity).createQueryBuilder().update(AuthSessionFamilyEntity)
    .set({ revokedAt: new Date() }).where('userId = :userId AND revokedAt IS NULL', { userId }).execute();
  await manager.getRepository(AccessSessionEntity).createQueryBuilder().delete().where('userId = :userId AND familyId IS NULL', { userId }).execute();
}

async function insertAccessSession(manager: EntityManager, record: SessionRecord): Promise<void> {
  await manager.getRepository(AccessSessionEntity).createQueryBuilder().insert().values({
    tokenHash: hashToken(record.token), token: null, userId: record.userId, companyId: record.companyId,
    familyId: required(record.familyId, 'Access session data is required'), expiresAt: new Date(required(record.accessExpiresAt, 'Access session data is required')),
  }).execute();
}

async function insertRefreshSession(manager: EntityManager, record: SessionRecord): Promise<void> {
  const refreshToken = required(record.refreshToken, 'Refresh session data is required');
  const familyId = required(record.familyId, 'Refresh session data is required');
  const expiresAt = required(record.refreshExpiresAt, 'Refresh session data is required');
  await manager.getRepository(RefreshSessionEntity).createQueryBuilder().insert().values({
    id: randomUUID(), familyId, tokenHash: hashToken(refreshToken), expiresAt: new Date(expiresAt), consumedAt: null, revokedAt: null,
  }).execute();
}

async function insertGrants(manager: EntityManager, membershipId: string, grants: readonly ModuleGrant[]): Promise<void> {
  if (grants.length === 0) return;
  const values = grants.map((grant) => Object.assign(new ModuleGrantEntity(), {
    id: randomUUID(), membershipId, moduleName: grant.module, accessLevel: grant.access,
  }));
  await manager.getRepository(ModuleGrantEntity).createQueryBuilder().insert().values(values).execute();
}

async function revokeFamily(manager: EntityManager, familyId: string): Promise<void> {
  await manager.getRepository(AuthSessionFamilyEntity).createQueryBuilder().update(AuthSessionFamilyEntity)
    .set({ revokedAt: new Date() }).where('id = :familyId AND revokedAt IS NULL', { familyId }).execute();
}

function refreshIsUsable(previous: RefreshRow & { familyUserId: string; familyCompanyId: string }, next: SessionRecord): boolean {
  return previous.revokedAt === null && previous.familyRevokedAt === null && dateMillis(previous.expiresAt) > Date.now()
    && next.userId === previous.familyUserId && next.companyId === previous.familyCompanyId;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function required<T extends string | undefined>(value: T, message: string): string {
  if (value === undefined || value === '') throw new Error(message);
  return value;
}

function dateMillis(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

interface CompanyUserRow {
  id: string; email: string; displayName: string; role: string; active: boolean;
  moduleName: string | null; accessLevel: string | null;
}

function readRole(code: string): MembershipRole {
  const role = MEMBERSHIP_ROLES.find((item) => item === code);
  if (!role) throw new CompanyIdentityError('Role is invalid');
  return role;
}

function readGrant(moduleName: string, accessLevel: string): ModuleGrant {
  const module = APP_MODULES.find((item) => item === moduleName);
  if (!module || (accessLevel !== 'view' && accessLevel !== 'edit')) throw new ModulePermissionError('Grant is invalid');
  return { module, access: accessLevel };
}
