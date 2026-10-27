import { canUseModule, PermissionDeniedError, type AppModule, type ModuleGrant } from '@domain/identity/membership/module-access';

export const TABLE_KEYS = ['products', 'prices', 'commercial-prices', 'price-proposals', 'commercial-price-history', 'inventory-documents', 'vouchers', 'imports', 'company-users', 'mcp-connectors', 'mcp-usage'] as const;

export type TableKey = (typeof TABLE_KEYS)[number];

export const DASHBOARD_WIDGETS = ['sales', 'shrinkage', 'inventory', 'sales-chart', 'movement-chart', 'activity'] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number];
export const DASHBOARD_CHART_TYPES = ['bar', 'line', 'area'] as const;
export type DashboardChartType = (typeof DASHBOARD_CHART_TYPES)[number];

export interface ColumnSetting {
  key: string;
  visible: boolean;
  sortOrder: number;
}

export interface WidgetSetting {
  key: string;
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  chartType: DashboardChartType;
}

const TABLE_COLUMNS: Record<TableKey, readonly string[]> = {
  products: ['name', 'category', 'supplier', 'presentation', 'factor', 'barcode', 'salePrice', 'stock'],
  prices: ['name', 'presentation', 'salePrice', 'cost'],
  'commercial-prices': ['product', 'unit', 'cost', 'markup', 'suggested', 'management', 'actions'],
  'price-proposals': ['product', 'unit', 'previous', 'proposed', 'proposer', 'date', 'actions'],
  'commercial-price-history': ['product', 'unit', 'cost', 'price', 'source', 'actor', 'date'],
  'inventory-documents': ['type', 'status', 'createdAt'],
  vouchers: ['reference', 'holder', 'amount', 'occurredOn'],
  imports: ['file', 'status', 'rows'],
  'company-users': ['name', 'email', 'role', 'status', 'access', 'actions'],
  'mcp-connectors': ['name', 'user', 'profile', 'status', 'lastUsed', 'expires', 'actions'],
  'mcp-usage': ['date', 'user', 'connector', 'tool', 'status'],
};

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}

export function requireTableKey(value: string): TableKey {
  if (!isTableKey(value)) {
    throw new LayoutError('Unknown table');
  }
  return value;
}

export function moduleForTable(tableKey: string): AppModule | null {
  if (tableKey === 'products') {
    return 'products';
  }
  if (tableKey === 'prices' || tableKey === 'commercial-prices' || tableKey === 'price-proposals' || tableKey === 'commercial-price-history') {
    return 'prices';
  }
  if (tableKey === 'inventory-documents') {
    return 'inventory';
  }
  if (tableKey === 'vouchers') {
    return 'documents';
  }
  if (tableKey === 'imports') {
    return 'imports';
  }
  if (tableKey === 'company-users' || tableKey === 'mcp-connectors' || tableKey === 'mcp-usage') {
    return 'settings';
  }
  return null;
}

export function assertCanViewTable(grants: readonly ModuleGrant[], tableKey: string): TableKey {
  const key = requireTableKey(tableKey);
  const module = moduleForTable(key);
  if (module === null) {
    throw new LayoutError('Unknown table');
  }
  if (!canUseModule(grants, module, 'view')) {
    throw new PermissionDeniedError();
  }
  return key;
}

export function defaultColumns(tableKey: TableKey): ColumnSetting[] {
  return TABLE_COLUMNS[tableKey].map((key, sortOrder) => ({ key, visible: true, sortOrder }));
}

export function applyColumnLayout(tableKey: TableKey, saved: readonly ColumnSetting[] | null): ColumnSetting[] {
  if (saved === null) {
    return defaultColumns(tableKey);
  }
  return numberColumns(appendMissingColumns(tableKey, knownColumns(tableKey, saved)));
}

export function defaultWidgets(): WidgetSetting[] {
  return DASHBOARD_WIDGETS.map((key, index) => defaultWidget(key, index));
}

function defaultWidget(key: DashboardWidgetKey, index: number): WidgetSetting {
  const isChart = key === 'sales-chart' || key === 'movement-chart';
  return {
    key,
    visible: true,
    x: 0,
    y: index,
    w: widgetWidth(key),
    h: isChart ? 2 : 1,
    chartType: 'bar',
  };
}

function widgetWidth(key: DashboardWidgetKey): number {
  if (key === 'sales-chart' || key === 'movement-chart' || key === 'activity') {
    return 4;
  }
  if (key === 'inventory') {
    return 2;
  }
  return 1;
}

export function applyWidgetLayout(saved: readonly WidgetSetting[] | null): WidgetSetting[] {
  if (saved === null) {
    return defaultWidgets();
  }
  return orderWidgets(appendMissingWidgets(knownWidgets(saved)));
}

function knownColumns(tableKey: TableKey, saved: readonly ColumnSetting[]): ColumnSetting[] {
  const allowed = new Set<string>(TABLE_COLUMNS[tableKey]);
  const picked: ColumnSetting[] = [];
  const seen = new Set<string>();
  for (const column of [...saved].sort((left, right) => left.sortOrder - right.sortOrder)) {
    pushColumn(picked, seen, allowed, column);
  }
  return picked;
}

function pushColumn(
  picked: ColumnSetting[],
  seen: Set<string>,
  allowed: ReadonlySet<string>,
  column: ColumnSetting,
): void {
  if (!allowed.has(column.key) || seen.has(column.key)) {
    return;
  }
  seen.add(column.key);
  picked.push({ key: column.key, visible: column.visible === true, sortOrder: column.sortOrder });
}

function appendMissingColumns(tableKey: TableKey, picked: readonly ColumnSetting[]): ColumnSetting[] {
  const present = new Set(picked.map((column) => column.key));
  const next = [...picked];
  for (const key of TABLE_COLUMNS[tableKey]) {
    pushMissingColumn(next, present, key);
  }
  return next;
}

function pushMissingColumn(next: ColumnSetting[], present: ReadonlySet<string>, key: string): void {
  if (present.has(key)) {
    return;
  }
  next.push({ key, visible: true, sortOrder: next.length });
}

function numberColumns(columns: readonly ColumnSetting[]): ColumnSetting[] {
  return columns.map((column, sortOrder) => ({ ...column, sortOrder }));
}

function knownWidgets(saved: readonly WidgetSetting[]): WidgetSetting[] {
  const picked: WidgetSetting[] = [];
  const seen = new Set<string>();
  for (const widget of saved) {
    pushWidget(picked, seen, widget);
  }
  return picked;
}

function pushWidget(picked: WidgetSetting[], seen: Set<string>, widget: WidgetSetting): void {
  if (!isDashboardWidget(widget.key) || seen.has(widget.key)) {
    return;
  }
  seen.add(widget.key);
  picked.push({
    key: widget.key,
    visible: widget.visible === true,
    x: coordinate(widget.x, 0),
    y: coordinate(widget.y, picked.length),
    w: span(widget.w, 4),
    h: span(widget.h, 3),
    chartType: chartTypeOf(widget.chartType),
  });
}

function appendMissingWidgets(picked: readonly WidgetSetting[]): WidgetSetting[] {
  const present = new Set(picked.map((widget) => widget.key));
  const next = [...picked];
  for (const key of DASHBOARD_WIDGETS) {
    pushMissingWidget(next, present, key);
  }
  return next;
}

function pushMissingWidget(next: WidgetSetting[], present: ReadonlySet<string>, key: DashboardWidgetKey): void {
  if (present.has(key)) {
    return;
  }
  next.push(defaultWidget(key, next.length));
}

function chartTypeOf(value: DashboardChartType): DashboardChartType {
  return DASHBOARD_CHART_TYPES.includes(value) ? value : 'bar';
}

function orderWidgets(widgets: readonly WidgetSetting[]): WidgetSetting[] {
  return [...widgets]
    .sort((left, right) => left.y - right.y || left.key.localeCompare(right.key))
    .map((widget, index) => ({ ...widget, y: index }));
}

function coordinate(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 24) {
    return fallback;
  }
  return value;
}

function span(value: number, maximum: number): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    return 1;
  }
  return value;
}

function isTableKey(value: string): value is TableKey {
  return (TABLE_KEYS as readonly string[]).includes(value);
}

function isDashboardWidget(value: string): value is DashboardWidgetKey {
  return (DASHBOARD_WIDGETS as readonly string[]).includes(value);
}
