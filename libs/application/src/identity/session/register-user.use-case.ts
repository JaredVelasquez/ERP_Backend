import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@domain/identity/membership/access';
import { resolveGrants, type ModuleGrant } from '@domain/identity/membership/module-access';
import { PASSWORD_HASHER, RegistrationError, type PasswordHasher } from '@domain/identity/session/password-hasher.port';
import { IDENTITY_PORT, type IdentityPort, type UserAccount } from '@domain/identity/session/session.port';

export interface RegisterUserCommand {
  email: string;
  password: string;
  displayName: string;
  companyId: string;
  role: MembershipRole;
  grants?: ModuleGrant[] | null;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
  ) {}

  async execute(command: RegisterUserCommand): Promise<{ userId: string }> {
    if (command.password.length < 8) {
      throw new RegistrationError('Password must have at least 8 characters');
    }
    if (!MEMBERSHIP_ROLES.includes(command.role)) {
      throw new RegistrationError('Role is invalid');
    }
    const user: UserAccount = {
      id: randomUUID(),
      email: command.email.trim().toLowerCase(),
      passwordHash: this.passwords.hash(command.password),
      displayName: command.displayName.trim(),
    };
    if (user.email === '' || user.displayName === '') {
      throw new RegistrationError('Email and display name are required');
    }
    await this.identity.insertUserWithMembership(user, {
      id: randomUUID(),
      userId: user.id,
      companyId: command.companyId,
      role: command.role,
      grants: resolveGrants(command.role, command.grants ?? null),
    });
    return { userId: user.id };
  }
}
