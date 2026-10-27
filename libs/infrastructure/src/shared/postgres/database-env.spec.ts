import { missingDatabaseKeys, usePostgres } from '@infrastructure/shared/postgres/database-env';

describe('database env', () => {
  it('reports every missing key so migrate does not guess a server', () => {
    expect(missingDatabaseKeys({})).toEqual(['PG_HOST', 'PG_NAME', 'PG_USER', 'PG_PASSWORD']);
  });

  it('accepts a complete development env', () => {
    expect(
      missingDatabaseKeys({
        PG_HOST: 'localhost',
        PG_NAME: 'michelle_dev',
        PG_USER: 'erp',
        PG_PASSWORD: 'secret',
      }),
    ).toEqual([]);
  });

  it('uses PostgreSQL except in the explicit test or memory environment', () => {
    expect(usePostgres({ NODE_ENV: 'test' })).toBe(false);
    expect(usePostgres({ IDENTITY_STORE: 'memory' })).toBe(false);
    expect(usePostgres({ NODE_ENV: 'development' })).toBe(true);
  });
});
