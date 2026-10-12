import { randomUUID } from 'node:crypto';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@domain/identity/access';
import { APP_MODULES, ModulePermissionError, type ModuleGrant } from '@domain/identity/module-access';
import { CompanyIdentityError } from '@domain/tenancy/company';
import type { IdentityPort, Membership, SessionRecord, UserAccount } from '@domain/identity/session.port';
import type { SqlExecutor, SqlSession } from '@infrastructure/persistence/sql-executor';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
}

interface MembershipRow {
  membershipId: string;
  userId: string;
  companyId: string;
  companyName: string | null;
  roleCode: string;
  moduleName: string | null;
  accessLevel: string | null;
}

interface SessionRow {
  token: string;
  userId: string;
  companyId: string;
  roleCode: string;
  membershipId: string;
}

export class SqlIdentityRepository implements IdentityPort {
  constructor(private readonly sql: SqlExecutor) {}

  async insertUserWithMembership(user: UserAccount, membership: Membership): Promise<void> {
    await this.sql.transaction(async (session) => {
      const existing = await session.query<{ id: string }>(
        'SELECT id FROM dbo.users WHERE email = @email',
        { email: user.email },
      );
      if (existing.length > 0) {
        throw new CompanyIdentityError('Email already exists');
      }
      await session.query(
        `INSERT INTO dbo.users (id, email, password_hash, display_name)
         VALUES (@id, @email, @passwordHash, @displayName)`,
        { id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName },
      );
      const roleId = await requireRoleId(session, membership.role);
      await session.query(
        `INSERT INTO dbo.memberships (id, user_id, company_id, role_id)
         VALUES (@id, @userId, @companyId, @roleId)`,
        { id: membership.id, userId: membership.userId, companyId: membership.companyId, roleId },
      );
      await insertGrants(session, membership.id, membership.grants);
    });
  }

  async findUserByEmail(email: string): Promise<UserAccount | null> {
    const rows = await this.sql.transaction((session) =>
      session.query<UserRow>(
        `SELECT id, email, password_hash AS passwordHash, display_name AS displayName
         FROM dbo.users WHERE email = @email`,
        { email },
      ),
    );
    return rows[0] ?? null;
  }

  async findMembership(userId: string, companyId: string): Promise<Membership | null> {
    const rows = await this.membershipRows(userId, companyId);
    return groupMemberships(rows)[0] ?? null;
  }

  async listMemberships(userId: string): Promise<Membership[]> {
    return groupMemberships(await this.membershipRows(userId, ''));
  }

  async insertSession(record: SessionRecord): Promise<void> {
    await this.sql.transaction((session) =>
      session.query(
        'INSERT INTO dbo.sessions (token, user_id, company_id) VALUES (@token, @userId, @companyId)',
        { token: record.token, userId: record.userId, companyId: record.companyId },
      ),
    );
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    return this.sql.transaction(async (session) => {
      const rows = await session.query<SessionRow>(
        `SELECT s.token, s.user_id AS userId, s.company_id AS companyId, r.code AS roleCode, m.id AS membershipId
         FROM dbo.sessions s
         INNER JOIN dbo.memberships m ON m.user_id = s.user_id AND m.company_id = s.company_id
         INNER JOIN dbo.roles r ON r.id = m.role_id
         WHERE s.token = @token`,
        { token },
      );
      const row = rows[0];
      if (row === undefined) {
        return null;
      }
      const grants = await session.query<{ moduleName: string; accessLevel: string }>(
        `SELECT module_name AS moduleName, access_level AS accessLevel
         FROM dbo.module_grants WHERE membership_id = @membershipId`,
        { membershipId: row.membershipId },
      );
      return {
        token: row.token,
        userId: row.userId,
        companyId: row.companyId,
        role: readRole(row.roleCode),
        grants: grants.map((grant) => readGrant(grant.moduleName, grant.accessLevel)),
      };
    });
  }

  async replaceGrants(membershipId: string, grants: ModuleGrant[]): Promise<void> {
    await this.sql.transaction(async (session) => {
      const found = await session.query<{ id: string }>(
        'SELECT id FROM dbo.memberships WHERE id = @membershipId',
        { membershipId },
      );
      if (found.length === 0) {
        throw new ModulePermissionError('Membership was not found');
      }
      await session.query('DELETE FROM dbo.module_grants WHERE membership_id = @membershipId', { membershipId });
      await insertGrants(session, membershipId, grants);
    });
  }

  private membershipRows(userId: string, companyId: string): Promise<MembershipRow[]> {
    const companyFilter = companyId === '' ? '' : ' AND m.company_id = @companyId';
    return this.sql.transaction((session) =>
      session.query<MembershipRow>(
        `SELECT m.id AS membershipId, m.user_id AS userId, m.company_id AS companyId, c.legal_name AS companyName,
                r.code AS roleCode, g.module_name AS moduleName, g.access_level AS accessLevel
         FROM dbo.memberships m
         INNER JOIN dbo.roles r ON r.id = m.role_id
         INNER JOIN dbo.companies c ON c.id = m.company_id
         LEFT JOIN dbo.module_grants g ON g.membership_id = m.id
         WHERE m.user_id = @userId${companyFilter}`,
        { userId, companyId },
      ),
    );
  }
}

async function requireRoleId(session: SqlSession, role: MembershipRole): Promise<string> {
  const rows = await session.query<{ id: string }>('SELECT id FROM dbo.roles WHERE code = @code', { code: role });
  const row = rows[0];
  if (row === undefined) {
    throw new CompanyIdentityError('Role is invalid');
  }
  return row.id;
}

async function insertGrants(session: SqlSession, membershipId: string, grants: readonly ModuleGrant[]): Promise<void> {
  const [grant, ...rest] = grants;
  if (grant === undefined) {
    return;
  }
  await session.query(
    `INSERT INTO dbo.module_grants (id, membership_id, module_name, access_level)
     VALUES (@id, @membershipId, @moduleName, @accessLevel)`,
    { id: randomUUID(), membershipId, moduleName: grant.module, accessLevel: grant.access },
  );
  await insertGrants(session, membershipId, rest);
}

function groupMemberships(rows: readonly MembershipRow[]): Membership[] {
  const grouped: Membership[] = [];
  for (const row of rows) {
    pushMembershipRow(grouped, row);
  }
  return grouped;
}

function pushMembershipRow(grouped: Membership[], row: MembershipRow): void {
  const current = grouped.find((item) => item.id === row.membershipId);
  if (current === undefined) {
    grouped.push({
      id: row.membershipId,
      userId: row.userId,
      companyId: row.companyId,
      companyName: row.companyName ?? '',
      role: readRole(row.roleCode),
      grants: grantList(row),
    });
    return;
  }
  appendGrant(current, row);
}

function grantList(row: MembershipRow): ModuleGrant[] {
  if (row.moduleName === null || row.accessLevel === null) {
    return [];
  }
  return [readGrant(row.moduleName, row.accessLevel)];
}

function appendGrant(membership: Membership, row: MembershipRow): void {
  if (row.moduleName === null || row.accessLevel === null) {
    return;
  }
  membership.grants.push(readGrant(row.moduleName, row.accessLevel));
}

function readRole(code: string): MembershipRole {
  const role = MEMBERSHIP_ROLES.find((item) => item === code);
  if (role === undefined) {
    throw new CompanyIdentityError('Role is invalid');
  }
  return role;
}

function readGrant(moduleName: string, accessLevel: string): ModuleGrant {
  const module = APP_MODULES.find((item) => item === moduleName);
  const access = readAccess(accessLevel);
  if (module === undefined || access === null) {
    throw new ModulePermissionError('Grant is invalid');
  }
  return { module, access };
}

function readAccess(accessLevel: string): 'view' | 'edit' | null {
  if (accessLevel === 'view' || accessLevel === 'edit') {
    return accessLevel;
  }
  return null;
}
