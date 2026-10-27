import {
  requireGatewayUpstreams,
  resolveGatewayUpstream,
} from '@domain/gateway/routing/gateway-routes';

const completeEnv = {
  IDENTITY_URL: 'http://identity:3001',
  ERP_URL: 'http://erp:3002/',
  MCPS_URL: 'http://mcps:3003',
};

describe('gateway routes', () => {
  it('refuses to start when an upstream is missing', () => {
    expect(() => requireGatewayUpstreams({ IDENTITY_URL: 'http://identity' })).toThrow(
      'ERP_URL is required',
    );
  });

  it('does not proxy an unknown prefix', () => {
    expect(resolveGatewayUpstream('/health', completeEnv)).toBeNull();
    expect(resolveGatewayUpstream('/administrative', completeEnv)).toBeNull();
    expect(resolveGatewayUpstream('/erp2', completeEnv)).toBeNull();
  });

  it('treats a blank upstream as missing', () => {
    expect(() => requireGatewayUpstreams({ ...completeEnv, MCPS_URL: '  ' })).toThrow(
      'MCPS_URL is required',
    );
  });

  it('sends /admin to the erp process and strips a trailing slash', () => {
    expect(resolveGatewayUpstream('/admin/companies', completeEnv)).toEqual({
      prefix: '/admin',
      upstream: 'http://erp:3002',
    });
  });

  it('keeps /erp and /identity on their own upstreams', () => {
    expect(resolveGatewayUpstream('/erp/products', completeEnv)?.upstream).toBe(
      'http://erp:3002',
    );
    expect(resolveGatewayUpstream('/identity/login', completeEnv)?.prefix).toBe('/identity');
  });
});
