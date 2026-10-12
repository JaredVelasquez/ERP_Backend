import { missingDatabaseKeys } from '@infrastructure/persistence/database-env';

describe('database env', () => {
  it('reports every missing key so migrate does not guess a server', () => {
    expect(missingDatabaseKeys({})).toEqual(['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']);
  });

  it('accepts a complete development env', () => {
    expect(
      missingDatabaseKeys({
        DB_HOST: 'localhost',
        DB_NAME: 'michelle_dev',
        DB_USER: 'erp',
        DB_PASSWORD: 'secret',
      }),
    ).toEqual([]);
  });
});
