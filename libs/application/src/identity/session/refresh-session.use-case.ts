import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '@domain/identity/session/password-hasher.port';
import { IDENTITY_PORT, type IdentityPort, type SessionRecord } from '@domain/identity/session/session.port';

@Injectable()
export class RefreshSessionUseCase {
  constructor(@Inject(IDENTITY_PORT) private readonly identity: IdentityPort) {}

  async execute(refreshToken: string): Promise<SessionRecord> {
    const normalizedToken = refreshToken.trim();
    if (normalizedToken === '') {
      throw new InvalidCredentialsError();
    }
    const previous = await this.identity.findRefreshSession(normalizedToken);
    if (previous === null) {
      throw new InvalidCredentialsError();
    }
    const membership = await this.identity.findMembership(previous.userId, previous.companyId);
    if (membership === null) {
      await this.identity.revokeRefreshSession(normalizedToken);
      throw new InvalidCredentialsError();
    }
    const session = nextSession(previous.familyId, membership);
    const rotated = await this.identity.rotateRefreshSession(normalizedToken, session);
    if (!rotated) {
      throw new InvalidCredentialsError();
    }
    return session;
  }
}

function nextSession(familyId: string, membership: Awaited<ReturnType<IdentityPort['findMembership']>>): SessionRecord {
  if (membership === null) {
    throw new InvalidCredentialsError();
  }
  const now = Date.now();
  return {
    token: randomBytes(32).toString('base64url'),
    refreshToken: randomBytes(48).toString('base64url'),
    familyId,
    accessExpiresAt: new Date(now + accessTokenLifetimeSeconds() * 1000).toISOString(),
    refreshExpiresAt: new Date(now + refreshTokenLifetimeDays() * 24 * 60 * 60 * 1000).toISOString(),
    userId: membership.userId,
    companyId: membership.companyId,
    companyName: membership.companyName ?? '',
    role: membership.role,
    grants: membership.grants.map((grant) => ({ ...grant })),
  };
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
