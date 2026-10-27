import type { MembershipRole } from '@domain/identity/membership/access';
import type { ModuleGrant } from '@domain/identity/membership/module-access';

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
  active?: boolean;
}

export interface CompanyUser {
  id: string;
  email: string;
  displayName: string;
  role: MembershipRole;
  active: boolean;
  grants: ModuleGrant[];
}

export interface SessionRecord {
  token: string;
  refreshToken?: string;
  familyId?: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  userId: string;
  companyId: string;
  companyName?: string;
  role: MembershipRole;
  grants: ModuleGrant[];
}

export interface RefreshSessionIdentity {
  familyId: string;
  userId: string;
  companyId: string;
}

export interface IdentityPort {
  insertUserWithMembership(user: UserAccount, membership: Membership): Promise<void>;
  findUserByEmail(email: string): Promise<UserAccount | null>;
  findMembership(userId: string, companyId: string): Promise<Membership | null>;
  listMemberships(userId: string): Promise<Membership[]>;
  insertSession(session: SessionRecord): Promise<void>;
  findSession(token: string): Promise<SessionRecord | null>;
  findRefreshSession(token: string): Promise<RefreshSessionIdentity | null>;
  rotateRefreshSession(token: string, session: SessionRecord): Promise<boolean>;
  revokeRefreshSession(token: string): Promise<void>;
  replaceGrants(membershipId: string, grants: ModuleGrant[]): Promise<void>;
  listCompanyUsers?(companyId: string): Promise<CompanyUser[]>;
  setMembershipActive?(userId: string, companyId: string, active: boolean): Promise<boolean>;
  setPassword?(userId: string, passwordHash: string): Promise<void>;
}

export const IDENTITY_PORT = Symbol('IDENTITY_PORT');
