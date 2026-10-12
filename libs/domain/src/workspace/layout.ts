import { canUseModule, PermissionDeniedError, type AppModule, type ModuleGrant } from '@domain/identity/module-access';

export const TABLE_KEYS = ['products', 'prices', 'inventory-documents', 'vouchers', 'imports', 'company-users'] as const;

export type TableKey = (typeof TABLE_KEYS)[number];

export const DASHBOARD_WIDGETS = ['sales', 'shrinkage', 'inventory', 'activity'] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number];

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
}

const TABLE_COLUMNS: Record<TableKey, readonly string[]> = {
  products: ['name', 'category', 'supplier', 'presentation', 'factor', 'barcode', 'salePrice', 'stock'],
  prices: ['name', 'presentation', 'salePrice', 'cost'],
  'inventory-documents': ['type', 'status', 'createdAt'],
  vouchers: ['reference', 'holder', 'amount', 'occurredOn'],
  imports: ['file', 'status', 'rows'],
  'company-users': ['email', 'displayName'],
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
  if (tableKey === 'prices') {
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
  if (tableKey === 'company-users') {
    return 'platform';
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
  return DASHBOARD_WIDGETS.map((key, index) => ({ key, visible: true, x: 0, y: index, w: 1, h: 1 }));
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
    x: axis(widget.x, 0),
    y: axis(widget.y, picked.length),
    w: axis(widget.w, 1),
    h: axis(widget.h, 1),
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
  next.push({ key, visible: true, x: 0, y: next.length, w: 1, h: 1 });
}

function orderWidgets(widgets: readonly WidgetSetting[]): WidgetSetting[] {
  return [...widgets]
    .sort((left, right) => left.y - right.y || left.key.localeCompare(right.key))
    .map((widget, index) => ({ ...widget, y: index }));
}

function axis(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 24) {
    return fallback;
  }
  return value;
}

function isTableKey(value: string): value is TableKey {
  return (TABLE_KEYS as readonly string[]).includes(value);
}

function isDashboardWidget(value: string): value is DashboardWidgetKey {
  return (DASHBOARD_WIDGETS as readonly string[]).includes(value);
}
