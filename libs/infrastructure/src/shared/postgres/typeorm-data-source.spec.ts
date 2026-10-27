import { typeOrmDataSourceOptions } from '@infrastructure/shared/postgres/typeorm-data-source';

describe('TypeORM PostgreSQL configuration', () => {
  it('pins PostgreSQL and never synchronizes or auto-runs migrations', () => {
    const options = typeOrmDataSourceOptions({
      PG_HOST: 'localhost', PG_PORT: '5432', PG_NAME: 'erp_test', PG_USER: 'erp_app', PG_PASSWORD: 'test', PG_SSL: 'false',
    });
    expect(options.type).toBe('postgres');
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });
});
