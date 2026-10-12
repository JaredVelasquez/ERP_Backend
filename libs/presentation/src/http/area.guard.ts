import { readSessionToken, type ProtectedArea } from '@domain/identity/access';
import { accessForHttpMethod, canUseModule, moduleForPath, type AppModule, type ModuleAccess } from '@domain/identity/module-access';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session.port';
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PROTECTED_AREA = 'protected-area';
export const PROTECTED_MODULE = 'protected-module';
export const PROTECTED_ACCESS = 'protected-access';

export const ProtectedAreaMeta = (area: ProtectedArea) => SetMetadata(PROTECTED_AREA, area);
export const ProtectedModuleMeta = (module: AppModule) => SetMetadata(PROTECTED_MODULE, module);
export const ProtectedAccessMeta = (access: ModuleAccess) => SetMetadata(PROTECTED_ACCESS, access);

interface GuardRequest {
  method: string;
  path?: string;
  url?: string;
  headers: { cookie?: string; authorization?: string };
}

@Injectable()
export class AreaGuard implements CanActivate {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const area = this.reflector.getAllAndOverride<ProtectedArea | undefined>(PROTECTED_AREA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const declared = this.reflector.getAllAndOverride<AppModule | undefined>(PROTECTED_MODULE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (area === undefined && declared === undefined) {
      return true;
    }
    const request = context.switchToHttp().getRequest<GuardRequest>();
    const token = readSessionToken(request.headers);
    if (token === null) {
      throw new UnauthorizedException();
    }
    const session = await this.identity.findSession(token);
    if (session === null) {
      throw new UnauthorizedException();
    }
    const path = request.path ?? request.url ?? '';
    const module = declared ?? moduleForPath(path) ?? (area === undefined ? null : moduleForArea(area));
    const declaredAccess = this.reflector.getAllAndOverride<ModuleAccess | undefined>(PROTECTED_ACCESS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (module === null) {
      throw new ForbiddenException();
    }
    if (!canUseModule(session.grants, module, declaredAccess ?? accessForHttpMethod(request.method))) {
      throw new ForbiddenException();
    }
    return true;
  }
}

function moduleForArea(area: ProtectedArea): AppModule {
  if (area === 'platform') {
    return 'platform';
  }
  if (area === 'accounting') {
    return 'accounting';
  }
  return 'inventory';
}
