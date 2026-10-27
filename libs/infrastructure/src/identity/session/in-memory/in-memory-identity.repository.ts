import { ModulePermissionError } from '@domain/identity/membership/module-access';
import type { ModuleGrant } from '@domain/identity/membership/module-access';
import { CompanyIdentityError } from '@domain/tenancy/company/company';
import type { CompanyUser, IdentityPort, Membership, RefreshSessionIdentity, SessionRecord, UserAccount } from '@domain/identity/session/session.port';

export class InMemoryIdentityRepository implements IdentityPort {
  private readonly users: UserAccount[] = [];
  private readonly memberships: Membership[] = [];
  private readonly sessions: SessionRecord[] = [];

  async insertUserWithMembership(user: UserAccount, membership: Membership): Promise<void> {
    if (this.users.some((row) => row.email === user.email)) {
      throw new CompanyIdentityError('Email already exists');
    }
    this.users.push({ ...user });
    this.memberships.push({ ...membership, grants: copyGrants(membership.grants) });
  }

  async findUserByEmail(email: string): Promise<UserAccount | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findMembership(userId: string, companyId: string): Promise<Membership | null> {
    return this.memberships.find((row) => row.userId === userId && row.companyId === companyId && row.active !== false) ?? null;
  }

  async listMemberships(userId: string): Promise<Membership[]> {
    return this.memberships.filter((row) => row.userId === userId && row.active !== false).map((row) => ({ ...row, grants: copyGrants(row.grants) }));
  }

  async insertSession(session: SessionRecord): Promise<void> {
    this.sessions.push({ ...session });
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    const session = this.sessions.find((row) => row.token === token && (!row.accessExpiresAt || Date.parse(row.accessExpiresAt) > Date.now())) ?? null;
    return session !== null && await this.findMembership(session.userId, session.companyId) !== null ? session : null;
  }

  async findRefreshSession(token: string): Promise<RefreshSessionIdentity | null> {
    const session = this.sessions.find((row) => row.refreshToken === token) ?? null;
    if (!session?.familyId) return null;
    return { familyId: session.familyId, userId: session.userId, companyId: session.companyId };
  }

  async rotateRefreshSession(token: string, session: SessionRecord): Promise<boolean> {
    const previous = this.sessions.find((row) => row.refreshToken === token);
    if (!previous || previous.familyId !== session.familyId || !previous.refreshToken || !session.refreshToken) return false;
    this.sessions.splice(this.sessions.indexOf(previous), 1);
    this.sessions.push({ ...session, grants: copyGrants(session.grants) });
    return true;
  }

  async revokeRefreshSession(token: string): Promise<void> {
    for (let index = this.sessions.length - 1; index >= 0; index -= 1) {
      if (this.sessions[index]?.refreshToken === token) this.sessions.splice(index, 1);
    }
  }

  async replaceGrants(membershipId: string, grants: ModuleGrant[]): Promise<void> {
    const membership = this.memberships.find((row) => row.id === membershipId);
    if (membership === undefined) {
      throw new ModulePermissionError('Membership was not found');
    }
    const next = copyGrants(grants);
    membership.grants = next;
    refreshSessions(this.sessions, membership, next);
  }

  async listCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    return this.memberships.filter((row) => row.companyId === companyId).map((row) => {
      const user = this.users.find((item) => item.id === row.userId)!;
      return { id: user.id, email: user.email, displayName: user.displayName, role: row.role,
        active: row.active !== false, grants: copyGrants(row.grants) };
    });
  }

  async setMembershipActive(userId: string, companyId: string, active: boolean): Promise<boolean> {
    const membership = this.memberships.find((row) => row.userId === userId && row.companyId === companyId);
    if (membership === undefined) return false;
    membership.active = active;
    return true;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.find((row) => row.id === userId);
    if (user === undefined) return;
    user.passwordHash = passwordHash;
    for (let index = this.sessions.length - 1; index >= 0; index -= 1) {
      if (this.sessions[index]?.userId === userId) this.sessions.splice(index, 1);
    }
  }
}

function copyGrants(grants: readonly ModuleGrant[]): ModuleGrant[] {
  return grants.map((grant) => ({ ...grant }));
}

function refreshSessions(sessions: SessionRecord[], membership: Membership, grants: readonly ModuleGrant[]): void {
  for (const session of sessions) {
    assignSessionGrants(session, membership, grants);
  }
}

function assignSessionGrants(session: SessionRecord, membership: Membership, grants: readonly ModuleGrant[]): void {
  if (session.userId !== membership.userId || session.companyId !== membership.companyId) {
    return;
  }
  session.grants = copyGrants(grants);
}
