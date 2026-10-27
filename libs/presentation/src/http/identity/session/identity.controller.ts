import { LoginUseCase } from '@application/identity/session/login.use-case';
import { RefreshSessionUseCase } from '@application/identity/session/refresh-session.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/membership/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import type { MembershipRole } from '@domain/identity/membership/access';
import { canUseModule, defaultGrants, ModulePermissionError, type ModuleAccess, type ModuleGrant } from '@domain/identity/membership/module-access';
import { PASSWORD_HASHER, InvalidCredentialsError, RegistrationError, type PasswordHasher } from '@domain/identity/session/password-hasher.port';
import { readSessionToken } from '@domain/identity/membership/access';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Body, Controller, ForbiddenException, Get, Header, HttpCode, Inject, Param, Patch, Post, Put, Req, Res, UnauthorizedException, UseFilters } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { assertSameCompany, requireCompanySession } from '@presentation/http/workspace/session/company-session';
import { LoginAttemptLimiter } from '@presentation/http/identity/session/login-attempt-limiter';

interface JsonBody {
  [key: string]: unknown;
}

@Controller('identity')
@UseFilters(CompanyIdentityFilter)
export class IdentityController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly loginAttempts: LoginAttemptLimiter,
    private readonly replaceModuleGrants: ReplaceModuleGrantsUseCase,
  ) {}

  @Post('users')
  async register(@Req() request: Request, @Body() body: JsonBody) {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, readText(body, 'companyId'));
    if (!canUseModule(session.grants, 'settings', 'edit') || readRole(body.role) !== 'operator') {
      throw new ForbiddenException();
    }
    return this.registerUser.execute({
      email: readText(body, 'email'),
      password: readText(body, 'password'),
      displayName: readText(body, 'displayName'),
      companyId: session.companyId,
      role: 'operator',
      grants: defaultGrants('operator').flatMap((grant) => {
        if (canUseModule(session.grants, grant.module, grant.access)) return [grant];
        if (canUseModule(session.grants, grant.module, 'view')) return [{ ...grant, access: 'view' as const }];
        return [];
      }),
    });
  }

  @Get('users')
  async listUsers(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    if (!canUseModule(session.grants, 'settings', 'view')) throw new ForbiddenException();
    return this.identity.listCompanyUsers?.(session.companyId) ?? [];
  }

  @Patch('users/:userId/active')
  async setActive(@Req() request: Request, @Param('userId') userId: string, @Body() body: { active?: boolean }) {
    const session = await requireCompanySession(this.identity, request.headers);
    if (!canUseModule(session.grants, 'settings', 'edit') || typeof body?.active !== 'boolean' || session.userId === userId) throw new ForbiddenException();
    const target = (await this.identity.listCompanyUsers?.(session.companyId))?.find((user) => user.id === userId);
    if (!target || target.role !== 'operator') throw new ForbiddenException();
    if (!await this.identity.setMembershipActive?.(userId, session.companyId, body.active)) throw new ForbiddenException();
    return { active: body.active };
  }

  @Put('users/:userId/password')
  async changePassword(@Req() request: Request, @Param('userId') userId: string, @Body() body: { password?: string; currentPassword?: string }) {
    const session = await requireCompanySession(this.identity, request.headers);
    if (typeof body?.password !== 'string' || body.password.length < 12 || body.password.length > 200) throw new RegistrationError('La clave debe tener entre 12 y 200 caracteres.');
    const own = session.userId === userId;
    if (!own) throw new ForbiddenException();
    const users = await this.identity.listCompanyUsers?.(session.companyId);
    const email = users?.find((user) => user.id === userId)?.email;
    const account = email ? await this.identity.findUserByEmail(email) : null;
    if (!account || !this.passwords.verify(body.currentPassword ?? '', account.passwordHash)) throw new InvalidCredentialsError();
    await this.identity.setPassword?.(userId, this.passwords.hash(body.password));
    return { changed: true };
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body() body: JsonBody, @Res({ passthrough: true }) response: Response) {
    const email = readText(body, 'email');
    const session = await this.loginAttempts.attempt(email, () => this.loginUser.execute({
      email,
      password: readText(body, 'password'),
      companyId: readOptionalText(body, 'companyId'),
    }));
    const nativeClient = isNativeClient(body?.clientPlatform);
    setSessionCookie(response, nativeClient, session.refreshToken ?? '', session.refreshExpiresAt ?? '');
    return {
      token: session.token,
      accessToken: session.token,
      ...(nativeClient ? { refreshToken: session.refreshToken } : {}),
      expiresAt: session.accessExpiresAt,
      userId: session.userId,
      role: session.role,
      grants: session.grants,
      companyId: session.companyId,
      companyName: session.companyName ?? '',
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async refresh(@Req() request: Request, @Body() body: JsonBody, @Res({ passthrough: true }) response: Response) {
    const cookieToken = readCookieValue(request.headers.cookie, 'erp_refresh');
    if (cookieToken !== null) assertBrowserOrigin(request.headers.origin);
    const token = cookieToken ?? readOptionalText(body, 'refreshToken');
    const session = await this.refreshSession.execute(token);
    const nativeClient = isNativeClient(body?.clientPlatform);
    setSessionCookie(response, nativeClient, session.refreshToken ?? '', session.refreshExpiresAt ?? '');
    return {
      token: session.token,
      accessToken: session.token,
      ...(nativeClient ? { refreshToken: session.refreshToken } : {}),
      expiresAt: session.accessExpiresAt,
    };
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() request: Request, @Body() body: JsonBody, @Res({ passthrough: true }) response: Response) {
    const cookieToken = readCookieValue(request.headers.cookie, 'erp_refresh');
    if (cookieToken !== null) assertBrowserOrigin(request.headers.origin);
    const token = cookieToken ?? readOptionalText(body, 'refreshToken');
    if (token !== '') await this.identity.revokeRefreshSession(token);
    response.setHeader('Set-Cookie', [clearCookie('erp_session', '/'), clearCookie('erp_refresh', '/identity')]);
  }

  @Post('companies')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async companies(@Body() body: JsonBody) {
    const email = readText(body, 'email');
    return { companies: await this.loginAttempts.attempt(email, () => this.loginUser.listCompanies(email, readText(body, 'password'))) };
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

function setSessionCookie(response: Response, nativeClient: boolean, refreshToken: string, expiresAt: string): void {
  if (nativeClient) {
    clearLegacyAccessCookie(response);
    return;
  }
  setRefreshCookie(response, refreshToken, expiresAt);
}

function setRefreshCookie(response: Response, refreshToken: string, refreshExpiresAt: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = Math.max(0, Date.parse(refreshExpiresAt) - Date.now());
  response.setHeader('Set-Cookie', [
    clearCookie('erp_session', '/'),
    `erp_refresh=${encodeURIComponent(refreshToken)}; HttpOnly; Path=/identity; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`,
  ]);
}

function clearLegacyAccessCookie(response: Response): void {
  response.setHeader('Set-Cookie', clearCookie('erp_session', '/'));
}

function isNativeClient(value: unknown): boolean {
  return value === 'capacitor' || value === 'electron' || value === 'native';
}

function assertBrowserOrigin(origin: string | undefined): void {
  const defaults = ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://127.0.0.1:5175', 'http://localhost:5175'];
  const origins = process.env.WEB_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean) ?? defaults;
  if (origin === undefined || !origins.includes(origin)) throw new ForbiddenException('Origin not allowed');
}

function clearCookie(name: string, path: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; HttpOnly; Path=${path}; SameSite=Lax; Max-Age=0${secure}`;
}

function readCookieValue(header: string | undefined, name: string): string | null {
  if (header === undefined) return null;
  const part = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part === undefined ? null : decodeURIComponent(part.slice(name.length + 1));
}

function readOptionalText(body: JsonBody | undefined, field: string): string {
  const value = body?.[field];
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
