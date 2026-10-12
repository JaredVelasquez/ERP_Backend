import {
  ListCompanyUsersUseCase,
  ListImportHistoryUseCase,
  ListInventoryDocumentsUseCase,
  ListVouchersUseCase,
} from '@application/workspace/company-lists.use-case';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/dashboard-layout.use-case';
import { ReadCurrentSessionUseCase, type CurrentSessionView } from '@application/workspace/read-current-session.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase, type TableLayoutView } from '@application/workspace/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase, type UiPreferenceView } from '@application/workspace/ui-preferences.use-case';
import type { DashboardLayoutView } from '@application/workspace/dashboard-layout.use-case';
import { LayoutError, type ColumnSetting, type WidgetSetting } from '@domain/workspace/layout';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session.port';
import { Body, Controller, Get, Headers, Inject, Param, Put, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAccessMeta, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { assertSameCompany, requireCompanySession } from '@presentation/http/company-session';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

interface TableBody {
  pageSize?: unknown;
  columns?: unknown;
}

interface DashboardBody {
  widgets?: unknown;
}

interface PreferenceBody {
  sidebarCollapsed?: unknown;
}

@Controller('erp')
@UseFilters(CompanyIdentityFilter)
export class WorkspaceController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly currentSession: ReadCurrentSessionUseCase,
    private readonly readTable: ReadTableLayoutUseCase,
    private readonly saveTable: SaveTableLayoutUseCase,
    private readonly readDashboard: ReadDashboardLayoutUseCase,
    private readonly saveDashboard: SaveDashboardLayoutUseCase,
    private readonly readPreferences: ReadUiPreferencesUseCase,
    private readonly savePreferences: SaveUiPreferencesUseCase,
    private readonly documents: ListInventoryDocumentsUseCase,
    private readonly vouchers: ListVouchersUseCase,
    private readonly users: ListCompanyUsersUseCase,
    private readonly imports: ListImportHistoryUseCase,
  ) {}

  @Get('session')
  current(
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<CurrentSessionView> {
    return this.currentSession.execute({ cookie: headerText(cookie), authorization: headerText(authorization) });
  }

  @Get('layouts/tables/:tableKey')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('dashboard')
  @ProtectedAccessMeta('view')
  @UseGuards(AreaGuard)
  async table(
    @Param('tableKey') tableKey: string,
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<TableLayoutView> {
    const session = await requireCompanySession(this.identity, headerPair(cookie, authorization));
    return this.readTable.execute(session.companyId, session.userId, session.grants, tableKey);
  }

  @Put('layouts/tables/:tableKey')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('dashboard')
  @ProtectedAccessMeta('view')
  @UseGuards(AreaGuard)
  async saveTableLayout(
    @Param('tableKey') tableKey: string,
    @Body() body: TableBody,
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<TableLayoutView> {
    const session = await requireCompanySession(this.identity, headerPair(cookie, authorization));
    return this.saveTable.execute({
      companyId: session.companyId,
      userId: session.userId,
      grants: session.grants,
      tableKey,
      pageSize: readPageSize(body.pageSize),
      columns: readColumns(body.columns),
    });
  }

  @Get('layouts/dashboard')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('dashboard')
  @ProtectedAccessMeta('view')
  @UseGuards(AreaGuard)
  async dashboard(
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<DashboardLayoutView> {
    const session = await requireCompanySession(this.identity, headerPair(cookie, authorization));
    return this.readDashboard.execute(session.companyId, session.userId, session.grants);
  }

  @Put('layouts/dashboard')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('dashboard')
  @ProtectedAccessMeta('view')
  @UseGuards(AreaGuard)
  async saveDashboardLayout(
    @Body() body: DashboardBody,
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<DashboardLayoutView> {
    const session = await requireCompanySession(this.identity, headerPair(cookie, authorization));
    return this.saveDashboard.execute(session.companyId, session.userId, session.grants, readWidgets(body.widgets));
  }

  @Get('preferences')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('dashboard')
  @ProtectedAccessMeta('view')
  @UseGuards(AreaGuard)
  async preferences(
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<UiPreferenceView> {
    const session = await requireCompanySession(this.identity, headerPair(cookie, authorization));
    return this.readPreferences.execute(session.companyId, session.userId, session.grants);
  }

  @Put('preferences')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('dashboard')
  @ProtectedAccessMeta('view')
  @UseGuards(AreaGuard)
  async savePreference(
    @Body() body: PreferenceBody,
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ): Promise<UiPreferenceView> {
    const session = await requireCompanySession(this.identity, headerPair(cookie, authorization));
    return this.savePreferences.execute(session.companyId, session.userId, session.grants, readFlag(body.sidebarCollapsed));
  }

  @Get('inventory-documents')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('inventory')
  @UseGuards(AreaGuard)
  async inventoryDocuments(
    @Query('companyId') companyId = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('search') search = '',
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ) {
    const session = await scopedCompany(this.identity, companyId, cookie, authorization);
    return this.documents.execute({ companyId: session, page, pageSize, search });
  }

  @Get('vouchers')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('documents')
  @UseGuards(AreaGuard)
  async voucherPage(
    @Query('companyId') companyId = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('search') search = '',
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ) {
    const session = await scopedCompany(this.identity, companyId, cookie, authorization);
    return this.vouchers.execute({ companyId: session, page, pageSize, search });
  }

  @Get('company-users')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('platform')
  @UseGuards(AreaGuard)
  async companyUsers(
    @Query('companyId') companyId = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('search') search = '',
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ) {
    const session = await scopedCompany(this.identity, companyId, cookie, authorization);
    return this.users.execute({ companyId: session, page, pageSize, search });
  }

  @Get('import-history')
  @ProtectedAreaMeta('operations')
  @ProtectedModuleMeta('imports')
  @UseGuards(AreaGuard)
  async importHistory(
    @Query('companyId') companyId = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('search') search = '',
    @Headers('cookie') cookie?: string | string[],
    @Headers('authorization') authorization?: string | string[],
  ) {
    const session = await scopedCompany(this.identity, companyId, cookie, authorization);
    return this.imports.execute({ companyId: session, page, pageSize, search });
  }
}

async function scopedCompany(
  identity: IdentityPort,
  companyId: string,
  cookie?: string | string[],
  authorization?: string | string[],
): Promise<string> {
  const session = await requireCompanySession(identity, headerPair(cookie, authorization));
  assertSameCompany(session, companyId);
  return session.companyId;
}

function headerPair(cookie?: string | string[], authorization?: string | string[]): { cookie?: string; authorization?: string } {
  return { cookie: headerText(cookie), authorization: headerText(authorization) };
}

function headerText(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return value?.[0];
}

function readPageSize(value: unknown): number {
  if (typeof value !== 'number') {
    throw new LayoutError('pageSize is required');
  }
  return value;
}

function readFlag(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new LayoutError('sidebarCollapsed is required');
  }
  return value;
}

function readColumns(value: unknown): ColumnSetting[] {
  if (!Array.isArray(value)) {
    throw new LayoutError('Columns are required');
  }
  return value.flatMap(readColumn);
}

function readColumn(value: unknown): ColumnSetting[] {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean' || typeof value.sortOrder !== 'number') {
    return [];
  }
  return [{ key: value.key, visible: value.visible, sortOrder: value.sortOrder }];
}

function readWidgets(value: unknown): WidgetSetting[] {
  if (!Array.isArray(value)) {
    throw new LayoutError('Widgets are required');
  }
  return value.flatMap(readWidget);
}

function readWidget(value: unknown): WidgetSetting[] {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean') {
    return [];
  }
  return [{
    key: value.key,
    visible: value.visible,
    x: numberOrZero(value.x),
    y: numberOrZero(value.y),
    w: numberOrZero(value.w),
    h: numberOrZero(value.h),
  }];
}

function numberOrZero(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
