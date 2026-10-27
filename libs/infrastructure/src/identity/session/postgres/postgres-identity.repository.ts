import { ModulePermissionError, type ModuleGrant } from '@domain/identity/membership/module-access';
import type { CompanyUser, IdentityPort, Membership, RefreshSessionIdentity, SessionRecord, UserAccount } from '@domain/identity/session/session.port';
import {
  insertSession, insertUserWithMembership, readCompanyUsers, readMembershipRows, readRefreshIdentity,
  readSession, readUserByEmail, replaceMembershipGrants, revokeRefreshSession, rotateRefreshSession,
  setMembershipActive, setUserPassword,
} from '@infrastructure/identity/session/postgres/identity.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresIdentityRepository implements IdentityPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async insertUserWithMembership(user: UserAccount, membership: Membership): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => insertUserWithMembership(manager, user, membership)));
  }

  async findUserByEmail(email: string): Promise<UserAccount | null> {
    return this.database.withManager((manager) => readUserByEmail(manager, email));
  }

  async findMembership(userId: string, companyId: string): Promise<Membership | null> {
    const rows = await this.database.withManager((manager) => readMembershipRows(manager, userId, companyId));
    return groupMemberships(rows)[0] ?? null;
  }

  async listMemberships(userId: string): Promise<Membership[]> {
    const rows = await this.database.withManager((manager) => readMembershipRows(manager, userId));
    return groupMemberships(rows);
  }

  async insertSession(record: SessionRecord): Promise<void> {
    assertSession(record);
    await this.database.transaction(() => this.database.withManager((manager) => insertSession(manager, record)));
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    const legacyUntil = process.env.LEGACY_SESSION_UNTIL ?? '1970-01-01T00:00:00.000Z';
    const legacyEnabled = validLegacyDeadline(legacyUntil);
    return this.database.withManager((manager) => readSession(manager, token, legacyEnabled, legacyUntil));
  }

  async findRefreshSession(token: string): Promise<RefreshSessionIdentity | null> {
    return this.database.withManager((manager) => readRefreshIdentity(manager, token));
  }

  async rotateRefreshSession(token: string, record: SessionRecord): Promise<boolean> {
    assertSession(record);
    return this.database.transaction(() => this.database.withManager((manager) => rotateRefreshSession(manager, token, record)));
  }

  async revokeRefreshSession(token: string): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => revokeRefreshSession(manager, token)));
  }

  async replaceGrants(membershipId: string, grants: ModuleGrant[]): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => replaceMembershipGrants(manager, membershipId, grants)));
  }

  async listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    return this.database.withManager((manager) => readCompanyUsers(manager, companyId));
  }

  async setMembershipActive(userId: string, companyId: string, active: boolean): Promise<boolean> {
    return this.database.transaction(() => this.database.withManager((manager) => setMembershipActive(manager, userId, companyId, active)));
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.database.transaction(() => this.database.withManager((manager) => setUserPassword(manager, userId, passwordHash)));
  }
}

function assertSession(record: SessionRecord): void {
  if (!record.refreshToken || !record.familyId || !record.accessExpiresAt || !record.refreshExpiresAt) {
    throw new Error('A complete session token pair is required');
  }
}

function validLegacyDeadline(value: string): boolean {
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline > Date.now();
}

function groupMemberships(rows: readonly MembershipRow[]): Membership[] {
  const grouped: Membership[] = [];
  for (const row of rows) {
    const current = grouped.find((membership) => membership.id === row.membershipId);
    if (!current) {
      grouped.push({
        id: row.membershipId, userId: row.userId, companyId: row.companyId, companyName: row.companyName ?? '',
        role: row.role, active: row.active, grants: row.moduleName && row.accessLevel ? [grant(row.moduleName, row.accessLevel)] : [],
      });
      continue;
    }
    if (row.moduleName && row.accessLevel) current.grants.push(grant(row.moduleName, row.accessLevel));
  }
  return grouped;
}

function grant(moduleName: string, accessLevel: string): ModuleGrant {
  if (accessLevel !== 'view' && accessLevel !== 'edit') throw new ModulePermissionError('Grant is invalid');
  const module = (['dashboard', 'products', 'inventory', 'prices', 'accounting', 'imports', 'documents', 'settings', 'platform'] as const)
    .find((item) => item === moduleName);
  if (!module) throw new ModulePermissionError('Grant is invalid');
  return { module, access: accessLevel };
}

interface MembershipRow {
  membershipId: string; userId: string; companyId: string; companyName: string | null;
  role: Membership['role']; active: boolean; moduleName: string | null; accessLevel: string | null;
}
