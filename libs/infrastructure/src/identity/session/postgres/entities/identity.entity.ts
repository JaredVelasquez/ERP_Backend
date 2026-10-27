import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('varchar', { length: 320, unique: true })
  declare email: string;

  @Column('varchar', { name: 'password_hash', length: 255 })
  declare passwordHash: string;

  @Column('varchar', { name: 'display_name', length: 200 })
  declare displayName: string;
}

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('varchar', { length: 40, unique: true })
  declare code: string;

  @Column('varchar', { length: 100 })
  declare name: string;
}

@Entity({ name: 'memberships' })
export class MembershipEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'role_id' })
  declare roleId: string;

  @Column('boolean')
  declare active: boolean;
}

@Entity({ name: 'module_grants' })
export class ModuleGrantEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'membership_id' })
  declare membershipId: string;

  @Column('varchar', { name: 'module_name', length: 40 })
  declare moduleName: string;

  @Column('varchar', { name: 'access_level', length: 10 })
  declare accessLevel: string;
}

@Entity({ name: 'auth_session_families' })
export class AuthSessionFamilyEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  declare revokedAt: Date | null;
}

@Entity({ name: 'sessions' })
export class AccessSessionEntity {
  @PrimaryColumn('char', { name: 'token_hash', length: 64 })
  declare tokenHash: string;

  @Column('varchar', { length: 128, nullable: true })
  declare token: string | null;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'family_id', nullable: true })
  declare familyId: string | null;

  @Column('timestamptz', { name: 'expires_at', nullable: true })
  declare expiresAt: Date | null;
}

@Entity({ name: 'refresh_sessions' })
export class RefreshSessionEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'family_id' })
  declare familyId: string;

  @Column('char', { name: 'token_hash', length: 64, unique: true })
  declare tokenHash: string;

  @Column('timestamptz', { name: 'expires_at' })
  declare expiresAt: Date;

  @Column('timestamptz', { name: 'consumed_at', nullable: true })
  declare consumedAt: Date | null;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  declare revokedAt: Date | null;
}
