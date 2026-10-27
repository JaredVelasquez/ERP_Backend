import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError, PASSWORD_HASHER, type PasswordHasher } from '@domain/identity/session/password-hasher.port';
import { IDENTITY_PORT, type IdentityPort, type Membership, type SessionRecord } from '@domain/identity/session/session.port';

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
    const user = await this.authenticate(command.email, command.password);
    const membership = pickMembership(await this.identity.listMemberships(user.id), command.companyId);
    if (membership === null) {
      throw new InvalidCredentialsError();
    }
    const now = Date.now();
    const session: SessionRecord = {
      token: randomBytes(32).toString('base64url'),
      refreshToken: randomBytes(48).toString('base64url'),
      familyId: randomBytes(16).toString('hex'),
      accessExpiresAt: new Date(now + accessTokenLifetimeSeconds() * 1000).toISOString(),
      refreshExpiresAt: new Date(now + refreshTokenLifetimeDays() * 24 * 60 * 60 * 1000).toISOString(),
      userId: user.id,
      companyId: membership.companyId,
      role: membership.role,
      companyName: membership.companyName ?? '',
      grants: membership.grants.map((grant) => ({ ...grant })),
    };
    await this.identity.insertSession(session);
    return session;
  }

  async listCompanies(email: string, password: string): Promise<{ companyId: string; companyName: string }[]> {
    const user = await this.authenticate(email, password);
    const memberships = await this.identity.listMemberships(user.id);
    return memberships.map((membership) => ({
      companyId: membership.companyId,
      companyName: membership.companyName ?? '',
    }));
  }

  private async authenticate(email: string, password: string) {
    const user = await this.identity.findUserByEmail(email.trim().toLowerCase());
    if (user === null || !this.passwords.verify(password, user.passwordHash)) {
      throw new InvalidCredentialsError();
    }
    return user;
  }
}

function accessTokenLifetimeSeconds(): number {
  return configuredPositiveInteger(process.env.ACCESS_TOKEN_TTL_SECONDS, 900);
}

function refreshTokenLifetimeDays(): number {
  return configuredPositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 30);
}

function configuredPositiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (raw === undefined || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
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
