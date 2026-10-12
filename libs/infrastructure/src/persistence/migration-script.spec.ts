import { join } from 'node:path';
import {
  assertIdempotentMigration,
  assertSchemaOnly,
  assertTableGuards,
  listMigrationFiles,
  readMigration,
} from '@infrastructure/persistence/migration-script';

describe('tenancy migration', () => {
  it('guards every table so the script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const tenancy = files.find((file) => file.endsWith('001_tenancy.sql'));

    expect(tenancy).toBeDefined();
    assertIdempotentMigration(readMigration(tenancy ?? ''));
  });

  it('guards the accounting tables so the chart script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const accounting = files.find((file) => file.endsWith('002_accounting.sql'));

    expect(accounting).toBeDefined();
    const sql = readMigration(accounting ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.accounts', 'dbo.posting_rules', 'dbo.tax_categories']);
  });

  it('guards product tables so the catalog script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const products = files.find((file) => file.endsWith('003_products.sql'));

    expect(products).toBeDefined();
    const sql = readMigration(products ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.products', 'dbo.presentations']);
  });

  it('guards inventory document tables so the script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const documents = files.find((file) => file.endsWith('004_inventory_documents.sql'));

    expect(documents).toBeDefined();
    const sql = readMigration(documents ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.inventory_documents', 'dbo.cost_layers', 'dbo.journal_entries', 'dbo.journal_lines']);
  });

  it('guards price history so the script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const prices = files.find((file) => file.endsWith('005_price_changes.sql'));

    expect(prices).toBeDefined();
    const sql = readMigration(prices ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.price_changes']);
  });

  it('guards voucher tables so the script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const vouchers = files.find((file) => file.endsWith('006_vouchers.sql'));

    expect(vouchers).toBeDefined();
    const sql = readMigration(vouchers ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.document_submissions', 'dbo.document_signatures']);
  });

  it('guards module grants so the script can run twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const grants = files.find((file) => file.endsWith('007_module_permissions.sql'));

    expect(grants).toBeDefined();
    const sql = readMigration(grants ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.module_grants']);
  });

  it('adds the voucher bank reference without procedures', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const link = files.find((file) => file.endsWith('008_voucher_movement.sql'));

    expect(link).toBeDefined();
    const sql = readMigration(link ?? '');
    assertSchemaOnly(sql);
    expect(sql).toContain('bank_reference');
    expect(sql).toContain('money_movement_id');
  });

  it('guards the session table so login can be stored twice', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const sessions = files.find((file) => file.endsWith('009_sessions.sql'));

    expect(sessions).toBeDefined();
    const sql = readMigration(sessions ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.sessions']);
  });

  it('stores an mcp audit without the signature or the bank reference', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const audit = files.find((file) => file.endsWith('010_mcp_audit.sql'));

    expect(audit).toBeDefined();
    const sql = readMigration(audit ?? '');
    assertSchemaOnly(sql);
    assertTableGuards(sql, ['dbo.mcp_tokens', 'dbo.mcp_audit_log']);
    expect(sql).toContain('token_hash');
    expect(sql).not.toContain('bank_reference');
    expect(sql).not.toContain('signature');
  });

  it('adds the other-service note without procedures', () => {
    const files = listMigrationFiles(join(process.cwd(), 'migrations'));
    const note = files.find((file) => file.endsWith('015_voucher_service_note.sql'));

    expect(note).toBeDefined();
    const sql = readMigration(note ?? '');
    assertSchemaOnly(sql);
    expect(sql).toContain('service_note');
    expect(sql).toContain('COL_LENGTH');
  });

  it('rejects a script that creates a view', () => {
    expect(() => assertIdempotentMigration("CREATE VIEW dbo.v AS SELECT 1 AS n;\nIF OBJECT_ID(N'dbo.tenants', N'U') IS NULL")).toThrow(
      'schema-only',
    );
  });
});
