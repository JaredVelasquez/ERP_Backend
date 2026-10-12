import { LoginUseCase } from '@application/identity/login.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/register-user.use-case';
import type { MembershipRole } from '@domain/identity/access';
import { ModulePermissionError, type ModuleAccess, type ModuleGrant } from '@domain/identity/module-access';
import { RegistrationError } from '@domain/identity/password-hasher.port';
import { readSessionToken } from '@domain/identity/access';
import { Body, Controller, Header, HttpCode, Param, Post, Put, Req, Res, UnauthorizedException, UseFilters } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

interface JsonBody {
  [key: string]: unknown;
}

@Controller('identity')
@UseFilters(CompanyIdentityFilter)
export class IdentityController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly replaceModuleGrants: ReplaceModuleGrantsUseCase,
  ) {}

  @Post('users')
  register(@Body() body: JsonBody) {
    return this.registerUser.execute({
      email: readText(body, 'email'),
      password: readText(body, 'password'),
      displayName: readText(body, 'displayName'),
      companyId: readText(body, 'companyId'),
      role: readRole(body.role),
    });
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: JsonBody, @Res({ passthrough: true }) response: Response) {
    const session = await this.loginUser.execute({
      email: readText(body, 'email'),
      password: readText(body, 'password'),
      companyId: readOptionalText(body, 'companyId'),
    });
    response.setHeader(
      'Set-Cookie',
      `erp_session=${encodeURIComponent(session.token)}; HttpOnly; Path=/; SameSite=Lax`,
    );
    return {
      token: session.token,
      role: session.role,
      grants: session.grants,
      companyId: session.companyId,
      companyName: session.companyName ?? '',
    };
  }

  @Put('users/:userId/modules')
  replaceModules(@Param('userId') userId: string, @Body() body: JsonBody, @Req() request: Request) {
    const token = readSessionToken({
      cookie: typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
      authorization: typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined,
    });
    if (token === null) {
      throw new UnauthorizedException();
    }
    return this.replaceModuleGrants.execute({
      token,
      userId,
      companyId: readText(body, 'companyId'),
      grants: readGrants(body.grants),
    });
  }
}

function readOptionalText(body: JsonBody, field: string): string {
  const value = body[field];
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new RegistrationError(`${field} is required`);
  }
  return value;
}

function readText(body: JsonBody, field: string): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw new RegistrationError(`${field} is required`);
  }
  return value;
}

function readGrants(value: unknown): ModuleGrant[] {
  if (!Array.isArray(value)) {
    throw new ModulePermissionError('Grants are required');
  }
  return value.map(readGrant);
}

function readGrant(value: unknown): ModuleGrant {
  if (typeof value !== 'object' || value === null) {
    throw new ModulePermissionError('Module is invalid');
  }
  const row = value as { module?: unknown; access?: unknown };
  if (typeof row.module !== 'string' || !isAccess(row.access)) {
    throw new ModulePermissionError('Module is invalid');
  }
  return { module: row.module as ModuleGrant['module'], access: row.access };
}

function isAccess(value: unknown): value is ModuleAccess {
  return value === 'view' || value === 'edit';
}

function readRole(value: unknown): MembershipRole {
  if (value === 'platform-admin' || value === 'owner' || value === 'operator') {
    return value;
  }
  throw new RegistrationError('Role is invalid');
}
