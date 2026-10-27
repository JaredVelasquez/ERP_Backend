import { canAccess, gatewayAllows, readSessionToken } from '@domain/identity/membership/access';

describe('access', () => {
  it('keeps an operator out of accounting and platform', () => {
    expect(canAccess('operator', 'operations')).toBe(true);
    expect(canAccess('operator', 'accounting')).toBe(false);
    expect(canAccess('operator', 'platform')).toBe(false);
  });

  it('lets the owner open accounting and keeps platform for the platform admin', () => {
    expect(canAccess('owner', 'accounting')).toBe(true);
    expect(canAccess('owner', 'platform')).toBe(false);
    expect(canAccess('platform-admin', 'platform')).toBe(true);
  });

  it('lets health and login through the gateway without a session', () => {
    expect(gatewayAllows('GET', '/health', false)).toBe(true);
    expect(gatewayAllows('POST', '/identity/login', false)).toBe(true);
    expect(gatewayAllows('POST', '/mcp/tools/login', false)).toBe(false);
    expect(gatewayAllows('POST', '/mcp/tools/register-user', false)).toBe(false);
    expect(gatewayAllows('POST', '/mcp/tools/create-product', false)).toBe(false);
    expect(gatewayAllows('GET', '/erp/accounts', false)).toBe(false);
    expect(gatewayAllows('POST', '/admin/companies', false)).toBe(false);
    expect(gatewayAllows('GET', '/erp/accounts', true)).toBe(true);
  });

  it('reads the bearer token before the cookie', () => {
    expect(
      readSessionToken({ authorization: 'Bearer mobile-token', cookie: 'erp_session=web-token' }),
    ).toBe('mobile-token');
    expect(readSessionToken({ cookie: 'erp_session=web-token' })).toBe('web-token');
    expect(readSessionToken({})).toBeNull();
  });
});
