import type { ColumnSetting, WidgetSetting } from '@domain/workspace/layout';

export interface TableLayoutRecord {
  id: string;
  companyId: string;
  userId: string;
  tableKey: string;
  pageSize: number;
  columns: ColumnSetting[];
}

export interface DashboardLayoutRecord {
  id: string;
  companyId: string;
  userId: string;
  widgets: WidgetSetting[];
}

export interface UiPreferenceRecord {
  id: string;
  companyId: string;
  userId: string;
  sidebarCollapsed: boolean;
}

export interface LayoutPort {
  findTable(companyId: string, userId: string, tableKey: string): Promise<TableLayoutRecord | null>;
  saveTable(record: TableLayoutRecord): Promise<TableLayoutRecord>;
  findDashboard(companyId: string, userId: string): Promise<DashboardLayoutRecord | null>;
  saveDashboard(record: DashboardLayoutRecord): Promise<DashboardLayoutRecord>;
  findPreferences(companyId: string, userId: string): Promise<UiPreferenceRecord | null>;
  savePreferences(record: UiPreferenceRecord): Promise<UiPreferenceRecord>;
}

export const LAYOUT_PORT = Symbol('LAYOUT_PORT');
