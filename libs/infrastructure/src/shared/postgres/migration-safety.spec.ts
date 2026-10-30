import { assertSafeLegacyMigration } from '@infrastructure/shared/postgres/migration-safety';

describe('legacy schema migration safety', () => {
  it('skips an applied migration only when its checksum is unchanged', () => {
    expect(assertSafeLegacyMigration('001_initial.sql', 'sha', 'sha', true)).toBe('already-applied');
    expect(() => assertSafeLegacyMigration('001_initial.sql', 'new', 'old', true)).toThrow('changed after application');
  });

  it('refuses to apply an unregistered migration to a populated schema', () => {
    expect(() => assertSafeLegacyMigration('002_next.sql', 'sha', undefined, true)).toThrow('Refusing to recreate schema');
  });

  it('allows an append-only migration after the registered baseline', () => {
    expect(assertSafeLegacyMigration('020_next.sql', 'sha', undefined, true, true)).toBe('pending');
  });

  it('does not allow an unregistered migration inserted into the historical baseline', () => {
    expect(() => assertSafeLegacyMigration('010_inserted.sql', 'sha', undefined, true, false)).toThrow('Refusing to recreate schema');
  });

  it('allows an initial migration only on an empty database', () => {
    expect(assertSafeLegacyMigration('001_initial.sql', 'sha', undefined, false)).toBe('pending');
  });
});
