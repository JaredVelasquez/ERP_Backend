import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TenancyModule } from '@composition/tenancy.module';
import { registerTestUser } from '@presentation/http/identity/session/test-identity';

describe('tenancy http', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TenancyModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates a company from POST /admin/companies for a platform admin', async () => {
    const baseUrl = await listenUrl(app);
    const token = await loginAs(app, baseUrl, 'platform-admin');
    const response = await fetch(`${baseUrl}/admin/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        societyId: 'society-1',
        legalName: 'Michelle Market',
        rtn: '08010000000001',
        currencyCode: 'HNL',
      }),
    });
    const body = (await response.json()) as { company: { costingMethod: string; taxEnabled: boolean } };

    expect(response.status).toBe(201);
    expect(body.company.costingMethod).toBe('PEPS');
    expect(body.company.taxEnabled).toBe(false);
  });

  it('blocks an operator from platform and accounting routes', async () => {
    const baseUrl = await listenUrl(app);
    const token = await loginAs(app, baseUrl, 'operator');
    const headers = { authorization: `Bearer ${token}` };
    const platform = await fetch(`${baseUrl}/admin/companies`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        societyId: 'society-1',
        legalName: 'Michelle Market',
        rtn: '08010000000009',
        currencyCode: 'HNL',
      }),
    });
    const accounting = await fetch(`${baseUrl}/erp/accounts`, { headers });

    expect(platform.status).toBe(403);
    expect(accounting.status).toBe(403);
  });

  it('seeds Caja efectivo as a collection account and rejects a parent entry', async () => {
    const baseUrl = await listenUrl(app);
    const token = await loginAs(app, baseUrl, 'platform-admin');
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const list = await fetch(`${baseUrl}/erp/accounts?companyId=company-1`, { headers });
    const body = (await list.json()) as {
      accounts: Array<{ children: Array<{ children: Array<{ children: Array<{ code: string; collection: boolean }> }> }> }>;
    };
    const rejected = await fetch(`${baseUrl}/erp/accounts/entries?companyId=company-1`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: '1' }),
    });

    expect(list.status).toBe(200);
    expect(body.accounts[0]?.children[0]?.children[0]?.children[0]).toMatchObject({ code: '1.01.01.001', collection: true });
    expect(rejected.status).toBe(400);
  });

  it('returns 400 when the RTN is missing', async () => {
    const baseUrl = await listenUrl(app);
    const token = await loginAs(app, baseUrl, 'platform-admin');
    const response = await fetch(`${baseUrl}/admin/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ societyId: 'society-1', legalName: 'Michelle Market', currencyCode: 'HNL' }),
    });

    expect(response.status).toBe(400);
  });
});

async function loginAs(app: INestApplication, baseUrl: string, role: 'platform-admin' | 'operator'): Promise<string> {
  const email = `${role}@michelle.test`;
  const user = await registerTestUser(app, { email, displayName: role, companyId: 'company-1', role });
  const login = await fetch(`${baseUrl}/identity/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: user.password, companyId: 'company-1' }),
  });
  const cookie = login.headers.get('set-cookie') ?? '';
  if (!cookie.includes('HttpOnly')) {
    throw new Error('Login did not set an HttpOnly cookie');
  }
  const body = (await login.json()) as { token: string };
  return body.token;
}

async function listenUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}
