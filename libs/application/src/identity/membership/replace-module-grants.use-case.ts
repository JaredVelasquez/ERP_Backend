import { Inject, Injectable } from '@nestjs/common';
import { PermissionDeniedError, resolveGrants, type ModuleGrant } from '@domain/identity/membership/module-access';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';

export interface ReplaceModuleGrantsCommand {
  token: string;
  userId: string;
  companyId: string;
  grants: ModuleGrant[];
}

@Injectable()
export class ReplaceModuleGrantsUseCase {
  constructor(@Inject(IDENTITY_PORT) private readonly identity: IdentityPort) {}

  async execute(command: ReplaceModuleGrantsCommand): Promise<ModuleGrant[]> {
    const session = await this.identity.findSession(command.token);
    if (session === null || session.companyId !== command.companyId) {
      throw new PermissionDeniedError();
    }
    if (session.role !== 'owner') {
      throw new PermissionDeniedError();
    }
    const membership = await this.identity.findMembership(command.userId, command.companyId);
    if (membership === null) {
      throw new PermissionDeniedError();
    }
    const grants = resolveGrants(membership.role, command.grants);
    await this.identity.replaceGrants(membership.id, grants);
    return grants;
  }
}
