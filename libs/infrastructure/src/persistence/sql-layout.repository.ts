import type { ColumnSetting, WidgetSetting } from '@domain/workspace/layout';
import type {
  DashboardLayoutRecord,
  LayoutPort,
  TableLayoutRecord,
  UiPreferenceRecord,
} from '@domain/workspace/layout.port';
import type { SqlExecutor } from '@infrastructure/persistence/sql-executor';

interface TableRow {
  id: string;
  companyId: string;
  userId: string;
  tableKey: string;
  pageSize: number;
  columnsJson: string;
}

interface DashboardRow {
  id: string;
  companyId: string;
  userId: string;
  widgetsJson: string;
}

interface PreferenceRow {
  id: string;
  companyId: string;
  userId: string;
  sidebarCollapsed: unknown;
}

export class SqlLayoutRepository implements LayoutPort {
  constructor(private readonly sql: SqlExecutor) {}

  async findTable(companyId: string, userId: string, tableKey: string): Promise<TableLayoutRecord | null> {
    const rows = await this.sql.transaction((session) =>
      session.query<TableRow>(
        `SELECT id, company_id AS companyId, user_id AS userId, table_key AS tableKey,
                page_size AS pageSize, columns_json AS columnsJson
         FROM dbo.table_layouts
         WHERE company_id = @companyId AND user_id = @userId AND table_key = @tableKey`,
        { companyId, userId, tableKey },
      ),
    );
    return tableFrom(rows[0]);
  }

  async saveTable(record: TableLayoutRecord): Promise<TableLayoutRecord> {
    const stored = await this.sql.transaction(async (session) => {
      const existing = await session.query<{ id: string }>(
        `SELECT id FROM dbo.table_layouts
         WHERE company_id = @companyId AND user_id = @userId AND table_key = @tableKey`,
        { companyId: record.companyId, userId: record.userId, tableKey: record.tableKey },
      );
      const id = existing[0]?.id ?? record.id;
      if (existing.length === 0) {
        await session.query(
          `INSERT INTO dbo.table_layouts (id, company_id, user_id, table_key, page_size, columns_json)
           VALUES (@id, @companyId, @userId, @tableKey, @pageSize, @columnsJson)`,
          tableParams(record, id),
        );
        return { ...record, id };
      }
      await session.query(
        `UPDATE dbo.table_layouts
         SET page_size = @pageSize, columns_json = @columnsJson
         WHERE id = @id`,
        tableParams(record, id),
      );
      return { ...record, id };
    });
    return stored;
  }

  async findDashboard(companyId: string, userId: string): Promise<DashboardLayoutRecord | null> {
    const rows = await this.sql.transaction((session) =>
      session.query<DashboardRow>(
        `SELECT id, company_id AS companyId, user_id AS userId, widgets_json AS widgetsJson
         FROM dbo.dashboard_layouts
         WHERE company_id = @companyId AND user_id = @userId`,
        { companyId, userId },
      ),
    );
    return dashboardFrom(rows[0]);
  }

  async saveDashboard(record: DashboardLayoutRecord): Promise<DashboardLayoutRecord> {
    return this.sql.transaction(async (session) => {
      const existing = await session.query<{ id: string }>(
        `SELECT id FROM dbo.dashboard_layouts WHERE company_id = @companyId AND user_id = @userId`,
        { companyId: record.companyId, userId: record.userId },
      );
      const id = existing[0]?.id ?? record.id;
      if (existing.length === 0) {
        await session.query(
          `INSERT INTO dbo.dashboard_layouts (id, company_id, user_id, widgets_json)
           VALUES (@id, @companyId, @userId, @widgetsJson)`,
          { id, companyId: record.companyId, userId: record.userId, widgetsJson: JSON.stringify(record.widgets) },
        );
        return { ...record, id };
      }
      await session.query(
        `UPDATE dbo.dashboard_layouts SET widgets_json = @widgetsJson WHERE id = @id`,
        { id, widgetsJson: JSON.stringify(record.widgets) },
      );
      return { ...record, id };
    });
  }

  async findPreferences(companyId: string, userId: string): Promise<UiPreferenceRecord | null> {
    const rows = await this.sql.transaction((session) =>
      session.query<PreferenceRow>(
        `SELECT id, company_id AS companyId, user_id AS userId, sidebar_collapsed AS sidebarCollapsed
         FROM dbo.ui_preferences
         WHERE company_id = @companyId AND user_id = @userId`,
        { companyId, userId },
      ),
    );
    return preferenceFrom(rows[0]);
  }

  async savePreferences(record: UiPreferenceRecord): Promise<UiPreferenceRecord> {
    return this.sql.transaction(async (session) => {
      const existing = await session.query<{ id: string }>(
        `SELECT id FROM dbo.ui_preferences WHERE company_id = @companyId AND user_id = @userId`,
        { companyId: record.companyId, userId: record.userId },
      );
      const id = existing[0]?.id ?? record.id;
      const sidebarCollapsed = record.sidebarCollapsed ? 1 : 0;
      if (existing.length === 0) {
        await session.query(
          `INSERT INTO dbo.ui_preferences (id, company_id, user_id, sidebar_collapsed)
           VALUES (@id, @companyId, @userId, @sidebarCollapsed)`,
          { id, companyId: record.companyId, userId: record.userId, sidebarCollapsed },
        );
        return { ...record, id };
      }
      await session.query(
        `UPDATE dbo.ui_preferences SET sidebar_collapsed = @sidebarCollapsed WHERE id = @id`,
        { id, sidebarCollapsed },
      );
      return { ...record, id };
    });
  }
}

function tableParams(record: TableLayoutRecord, id: string): Record<string, unknown> {
  return {
    id,
    companyId: record.companyId,
    userId: record.userId,
    tableKey: record.tableKey,
    pageSize: record.pageSize,
    columnsJson: JSON.stringify(record.columns),
  };
}

function tableFrom(row: TableRow | undefined): TableLayoutRecord | null {
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    tableKey: row.tableKey,
    pageSize: Number(row.pageSize),
    columns: readColumns(row.columnsJson),
  };
}

function dashboardFrom(row: DashboardRow | undefined): DashboardLayoutRecord | null {
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    widgets: readWidgets(row.widgetsJson),
  };
}

function preferenceFrom(row: PreferenceRow | undefined): UiPreferenceRecord | null {
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    sidebarCollapsed: collapsedFlag(row.sidebarCollapsed),
  };
}

function readColumns(value: string): ColumnSetting[] {
  return listed(parseJson(value)).flatMap(readColumn);
}

function readWidgets(value: string): WidgetSetting[] {
  return listed(parseJson(value)).flatMap(readWidget);
}

function readColumn(value: unknown): ColumnSetting[] {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean') {
    return [];
  }
  return [{ key: value.key, visible: value.visible, sortOrder: finite(value.sortOrder) }];
}

function readWidget(value: unknown): WidgetSetting[] {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean') {
    return [];
  }
  return [{
    key: value.key,
    visible: value.visible,
    x: finite(value.x),
    y: finite(value.y),
    w: finite(value.w),
    h: finite(value.h),
  }];
}

function listed(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collapsedFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'True';
}

function finite(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
