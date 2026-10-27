import { readSessionToken } from '@domain/identity/membership/access';
import { PermissionDeniedError } from '@domain/identity/membership/module-access';
import type { IdentityPort, SessionRecord } from '@domain/identity/session/session.port';

export async function requireCompanySession(
  identity: IdentityPort,
  headers: { authorization?: string; cookie?: string },
): Promise<SessionRecord> {
  const token = readSessionToken(headers);
  if (token === null) {
    throw new PermissionDeniedError();
  }
  const session = await identity.findSession(token);
  if (session === null) {
    throw new PermissionDeniedError();
  }
  return session;
}

export function assertSameCompany(session: SessionRecord, companyId: string): void {
  if (companyId.trim() !== '' && companyId !== session.companyId) {
    throw new PermissionDeniedError();
  }
}
