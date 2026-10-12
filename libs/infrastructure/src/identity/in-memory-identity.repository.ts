import { ModulePermissionError } from '@domain/identity/module-access';
import type { ModuleGrant } from '@domain/identity/module-access';
import { CompanyIdentityError } from '@domain/tenancy/company';
import type { IdentityPort, Membership, SessionRecord, UserAccount } from '@domain/identity/session.port';

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
    return this.memberships.find((row) => row.userId === userId && row.companyId === companyId) ?? null;
  }

  async listMemberships(userId: string): Promise<Membership[]> {
    return this.memberships.filter((row) => row.userId === userId).map((row) => ({ ...row, grants: copyGrants(row.grants) }));
  }

  async insertSession(session: SessionRecord): Promise<void> {
    this.sessions.push({ ...session });
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    return this.sessions.find((session) => session.token === token) ?? null;
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
