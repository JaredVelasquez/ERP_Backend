import type { MembershipRole } from '@domain/identity/access';
import type { ModuleGrant } from '@domain/identity/module-access';

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  companyName?: string;
  role: MembershipRole;
  grants: ModuleGrant[];
}

export interface SessionRecord {
  token: string;
  userId: string;
  companyId: string;
  companyName?: string;
  role: MembershipRole;
  grants: ModuleGrant[];
}

export interface IdentityPort {
  insertUserWithMembership(user: UserAccount, membership: Membership): Promise<void>;
  findUserByEmail(email: string): Promise<UserAccount | null>;
  findMembership(userId: string, companyId: string): Promise<Membership | null>;
  listMemberships(userId: string): Promise<Membership[]>;
  insertSession(session: SessionRecord): Promise<void>;
  findSession(token: string): Promise<SessionRecord | null>;
  replaceGrants(membershipId: string, grants: ModuleGrant[]): Promise<void>;
}

export const IDENTITY_PORT = Symbol('IDENTITY_PORT');
