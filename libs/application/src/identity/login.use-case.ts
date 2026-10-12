import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError, PASSWORD_HASHER, type PasswordHasher } from '@domain/identity/password-hasher.port';
import { IDENTITY_PORT, type IdentityPort, type Membership, type SessionRecord } from '@domain/identity/session.port';

export interface LoginCommand {
  email: string;
  password: string;
  companyId: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: LoginCommand): Promise<SessionRecord> {
    const user = await this.identity.findUserByEmail(command.email.trim().toLowerCase());
    if (user === null || !this.passwords.verify(command.password, user.passwordHash)) {
      throw new InvalidCredentialsError();
    }
    const membership = pickMembership(await this.identity.listMemberships(user.id), command.companyId);
    if (membership === null) {
      throw new InvalidCredentialsError();
    }
    const session: SessionRecord = {
      token: randomBytes(32).toString('hex'),
      userId: user.id,
      companyId: membership.companyId,
      role: membership.role,
      companyName: membership.companyName ?? '',
      grants: membership.grants.map((grant) => ({ ...grant })),
    };
    await this.identity.insertSession(session);
    return session;
  }
}

function pickMembership(memberships: readonly Membership[], companyId: string): Membership | null {
  const requested = companyId.trim();
  if (requested !== '') {
    return memberships.find((row) => row.companyId === requested) ?? null;
  }
  if (memberships.length !== 1) {
    return null;
  }
  return memberships[0] ?? null;
}
