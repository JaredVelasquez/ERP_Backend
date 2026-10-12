import { canUseModule, defaultGrants } from '@domain/identity/module-access';

export const MEMBERSHIP_ROLES = ['platform-admin', 'owner', 'operator'] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export type ProtectedArea = 'platform' | 'accounting' | 'operations';

export function canAccess(role: MembershipRole, area: ProtectedArea): boolean {
  const grants = defaultGrants(role);
  if (area === 'platform') {
    return canUseModule(grants, 'platform', 'edit');
  }
  if (area === 'accounting') {
    return canUseModule(grants, 'accounting', 'view');
  }
  return canUseModule(grants, 'inventory', 'edit');
}

export function isPublicGatewayRequest(method: string, pathname: string): boolean {
  if (pathname === '/health' || pathname.startsWith('/health/')) {
    return true;
  }
  if (method.toUpperCase() === 'POST' && isPublicLogin(pathname)) {
    return true;
  }
  return false;
}

export function gatewayAllows(method: string, pathname: string, hasCredential: boolean): boolean {
  if (isPublicGatewayRequest(method, pathname)) {
    return true;
  }
  return hasCredential;
}

export function readSessionToken(headers: { cookie?: string; authorization?: string }): string | null {
  const bearer = readBearer(headers.authorization);
  if (bearer !== null) {
    return bearer;
  }
  return readCookie(headers.cookie, 'erp_session');
}

function isPublicLogin(pathname: string): boolean {
  if (pathname === '/identity/login' || pathname === '/mcp/tools/login' || pathname === '/mcp/tools/register-user') {
    return true;
  }
  return false;
}

function readBearer(authorization: string | undefined): string | null {
  if (authorization === undefined || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (token === '') {
    return null;
  }
  return token;
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (cookieHeader === undefined) {
    return null;
  }
  const pair = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (pair === undefined) {
    return null;
  }
  const token = decodeURIComponent(pair.slice(name.length + 1));
  if (token === '') {
    return null;
  }
  return token;
}
