import { PermissionDeniedError } from '@domain/identity/module-access';
import type { LayoutPort, TableLayoutRecord } from '@domain/workspace/layout.port';
import { SaveTableLayoutUseCase } from '@application/workspace/table-layout.use-case';

describe('save table layout', () => {
  it('stores a bounded page size and drops an unknown column', async () => {
    const layouts = new RecordingLayouts();
    const saved = await new SaveTableLayoutUseCase(layouts).execute({
      companyId: 'company-1',
      userId: 'user-1',
      grants: [{ module: 'products', access: 'view' }],
      tableKey: 'products',
      pageSize: 400,
      columns: [
        { key: 'name', visible: false, sortOrder: 0 },
        { key: 'missing', visible: true, sortOrder: 1 },
      ],
    });

    expect(saved.pageSize).toBe(100);
    expect(saved.columns.some((column) => column.key === 'missing')).toBe(false);
    expect(saved.columns.find((column) => column.key === 'name')?.visible).toBe(false);
    expect(layouts.saved?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects a table the session cannot view', async () => {
    const layouts = new RecordingLayouts();
    await expect(
      new SaveTableLayoutUseCase(layouts).execute({
        companyId: 'company-1',
        userId: 'user-1',
        grants: [{ module: 'products', access: 'edit' }],
        tableKey: 'company-users',
        pageSize: 25,
        columns: [],
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(layouts.saved).toBeNull();
  });
});

class RecordingLayouts implements LayoutPort {
  saved: TableLayoutRecord | null = null;

  async findTable(): Promise<TableLayoutRecord | null> {
    return this.saved;
  }

  async saveTable(record: TableLayoutRecord): Promise<TableLayoutRecord> {
    this.saved = record;
    return record;
  }

  async findDashboard(): Promise<null> {
    return null;
  }

  async saveDashboard(): Promise<never> {
    throw new Error('unused');
  }

  async findPreferences(): Promise<null> {
    return null;
  }

  async savePreferences(): Promise<never> {
    throw new Error('unused');
  }
}
