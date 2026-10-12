import type {
  DashboardLayoutRecord,
  LayoutPort,
  TableLayoutRecord,
  UiPreferenceRecord,
} from '@domain/workspace/layout.port';

export class InMemoryLayoutRepository implements LayoutPort {
  private readonly tables = new Map<string, TableLayoutRecord>();
  private readonly dashboards = new Map<string, DashboardLayoutRecord>();
  private readonly preferences = new Map<string, UiPreferenceRecord>();

  async findTable(companyId: string, userId: string, tableKey: string): Promise<TableLayoutRecord | null> {
    return this.tables.get(tableScope(companyId, userId, tableKey)) ?? null;
  }

  async saveTable(record: TableLayoutRecord): Promise<TableLayoutRecord> {
    const existing = await this.findTable(record.companyId, record.userId, record.tableKey);
    const stored = keepId(existing, record);
    this.tables.set(tableScope(record.companyId, record.userId, record.tableKey), stored);
    return stored;
  }

  async findDashboard(companyId: string, userId: string): Promise<DashboardLayoutRecord | null> {
    return this.dashboards.get(userScope(companyId, userId)) ?? null;
  }

  async saveDashboard(record: DashboardLayoutRecord): Promise<DashboardLayoutRecord> {
    const existing = await this.findDashboard(record.companyId, record.userId);
    const stored = keepId(existing, record);
    this.dashboards.set(userScope(record.companyId, record.userId), stored);
    return stored;
  }

  async findPreferences(companyId: string, userId: string): Promise<UiPreferenceRecord | null> {
    return this.preferences.get(userScope(companyId, userId)) ?? null;
  }

  async savePreferences(record: UiPreferenceRecord): Promise<UiPreferenceRecord> {
    const existing = await this.findPreferences(record.companyId, record.userId);
    const stored = keepId(existing, record);
    this.preferences.set(userScope(record.companyId, record.userId), stored);
    return stored;
  }
}

function keepId<T extends { id: string }>(existing: T | null, record: T): T {
  if (existing === null) {
    return record;
  }
  return { ...record, id: existing.id };
}

function tableScope(companyId: string, userId: string, tableKey: string): string {
  return `${companyId}:${userId}:${tableKey}`;
}

function userScope(companyId: string, userId: string): string {
  return `${companyId}:${userId}`;
}
