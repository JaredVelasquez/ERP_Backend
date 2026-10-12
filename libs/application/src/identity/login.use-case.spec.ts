import { LoginUseCase } from '@application/identity/login.use-case';
import type { PasswordHasher } from '@domain/identity/password-hasher.port';
import type { IdentityPort, Membership, SessionRecord, UserAccount } from '@domain/identity/session.port';
import { defaultGrants } from '@domain/identity/module-access';

class MemoryIdentity implements IdentityPort {
  users: UserAccount[] = [];
  memberships: Membership[] = [];
  sessions: SessionRecord[] = [];

  async insertUserWithMembership(user: UserAccount, membership: Membership): Promise<void> {
    this.users.push(user);
    this.memberships.push(membership);
  }

  async findUserByEmail(email: string): Promise<UserAccount | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findMembership(userId: string, companyId: string): Promise<Membership | null> {
    return this.memberships.find((row) => row.userId === userId && row.companyId === companyId) ?? null;
  }

  async listMemberships(userId: string): Promise<Membership[]> {
    return this.memberships.filter((row) => row.userId === userId);
  }

  async insertSession(session: SessionRecord): Promise<void> {
    this.sessions.push(session);
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    return this.sessions.find((session) => session.token === token) ?? null;
  }

  async replaceGrants(): Promise<void> {
    return undefined;
  }
}

const passwords: PasswordHasher = {
  hash: (password) => password,
  verify: (password, encoded) => password === encoded,
};

describe('login session company', () => {
  it('uses the only membership when the form does not send a company', async () => {
    const identity = new MemoryIdentity();
    await identity.insertUserWithMembership(
      { id: 'user-1', email: 'owner@example.test', passwordHash: 'correct-password', displayName: 'Revision' },
      {
        id: 'member-1',
        userId: 'user-1',
        companyId: 'company-1',
        role: 'owner',
        grants: defaultGrants('owner'),
      },
    );

    const session = await new LoginUseCase(identity, passwords).execute({
      email: 'owner@example.test',
      password: 'correct-password',
      companyId: '',
    });

    expect(session.role).toBe('owner');
    expect(session.companyId).toBe('company-1');
    expect(session.grants.map((grant) => grant.module)).toEqual([
      'dashboard',
      'products',
      'inventory',
      'prices',
      'accounting',
      'imports',
      'documents',
    ]);
  });
});
