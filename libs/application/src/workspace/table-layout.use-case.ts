import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ModuleGrant } from '@domain/identity/module-access';
import {
  applyColumnLayout,
  assertCanViewTable,
  requireTableKey,
  type ColumnSetting,
  type TableKey,
} from '@domain/workspace/layout';
import { LAYOUT_PORT, type LayoutPort, type TableLayoutRecord } from '@domain/workspace/layout.port';
import { clampPageSize } from '@domain/workspace/page';

export interface TableLayoutView {
  tableKey: string;
  pageSize: number;
  columns: ColumnSetting[];
}

export interface SaveTableLayoutCommand {
  companyId: string;
  userId: string;
  grants: readonly ModuleGrant[];
  tableKey: string;
  pageSize: number;
  columns: readonly ColumnSetting[];
}

@Injectable()
export class ReadTableLayoutUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(companyId: string, userId: string, grants: readonly ModuleGrant[], tableKey: string): Promise<TableLayoutView> {
    const key = assertCanViewTable(grants, tableKey);
    const stored = await this.layouts.findTable(companyId, userId, key);
    return viewOf(key, stored);
  }
}

@Injectable()
export class SaveTableLayoutUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(command: SaveTableLayoutCommand): Promise<TableLayoutView> {
    const key = assertCanViewTable(command.grants, command.tableKey);
    const saved = await this.layouts.saveTable({
      id: randomUUID(),
      companyId: command.companyId,
      userId: command.userId,
      tableKey: key,
      pageSize: clampPageSize(command.pageSize),
      columns: applyColumnLayout(key, command.columns),
    });
    return viewOf(key, saved);
  }
}

function viewOf(tableKey: TableKey, stored: TableLayoutRecord | null): TableLayoutView {
  const key = requireTableKey(tableKey);
  return {
    tableKey: key,
    pageSize: pageSizeOf(stored),
    columns: applyColumnLayout(key, stored === null ? null : stored.columns),
  };
}

function pageSizeOf(stored: TableLayoutRecord | null): number {
  if (stored === null) {
    return 25;
  }
  return clampPageSize(stored.pageSize);
}
