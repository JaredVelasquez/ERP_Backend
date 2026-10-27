import { DASHBOARD_CHART_TYPES, type ColumnSetting, type DashboardChartType, type WidgetSetting } from '@domain/workspace/layout/layout';
import type { DashboardLayoutRecord, LayoutPort, TableLayoutRecord, UiPreferenceRecord } from '@domain/workspace/layout/layout.port';
import { readDashboardLayout, readTableLayout, readUiPreference, saveDashboardLayout, saveTableLayout, saveUiPreference } from '@infrastructure/workspace/layout/postgres/layout.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresLayoutRepository implements LayoutPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async findTable(companyId: string, userId: string, tableKey: string): Promise<TableLayoutRecord | null> {
    const entity = await this.database.withManager((manager) => readTableLayout(manager, companyId, userId, tableKey));
    if (!entity) return null;
    return {
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId,
      tableKey: entity.tableKey,
      pageSize: entity.pageSize,
      columns: readColumns(entity.columnsJson),
    };
  }

  async saveTable(record: TableLayoutRecord): Promise<TableLayoutRecord> {
    const id = await this.database.transaction(() => this.database.withManager((manager) => saveTableLayout(manager, record)));
    return { ...record, id };
  }

  async findDashboard(companyId: string, userId: string): Promise<DashboardLayoutRecord | null> {
    const entity = await this.database.withManager((manager) => readDashboardLayout(manager, companyId, userId));
    if (!entity) return null;
    return { id: entity.id, companyId: entity.companyId, userId: entity.userId, widgets: readWidgets(entity.widgetsJson) };
  }

  async saveDashboard(record: DashboardLayoutRecord): Promise<DashboardLayoutRecord> {
    const id = await this.database.transaction(() => this.database.withManager((manager) => saveDashboardLayout(manager, record)));
    return { ...record, id };
  }

  async findPreferences(companyId: string, userId: string): Promise<UiPreferenceRecord | null> {
    const entity = await this.database.withManager((manager) => readUiPreference(manager, companyId, userId));
    if (!entity) return null;
    return { id: entity.id, companyId: entity.companyId, userId: entity.userId, sidebarCollapsed: entity.sidebarCollapsed };
  }

  async savePreferences(record: UiPreferenceRecord): Promise<UiPreferenceRecord> {
    const id = await this.database.transaction(() => this.database.withManager((manager) => saveUiPreference(manager, record)));
    return { ...record, id };
  }
}

function readColumns(value: string): ColumnSetting[] {
  return listed(parseJson(value)).flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.visible !== 'boolean') return [];
    return [{ key: item.key, visible: item.visible, sortOrder: finite(item.sortOrder) }];
  });
}

function readWidgets(value: string): WidgetSetting[] {
  return listed(parseJson(value)).flatMap((item) => {
    if (!isRecord(item) || typeof item.key !== 'string' || typeof item.visible !== 'boolean') return [];
    return [{ key: item.key, visible: item.visible, x: finite(item.x), y: finite(item.y), w: finite(item.w), h: finite(item.h), chartType: dashboardChartType(item.chartType) }];
  });
}

function dashboardChartType(value: unknown): DashboardChartType {
  return DASHBOARD_CHART_TYPES.find((chartType) => chartType === value) ?? 'bar';
}

function listed(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

function finite(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
