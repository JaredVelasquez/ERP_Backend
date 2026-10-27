import { DashboardUseCase } from '@application/inventory/stock/dashboard/dashboard.use-case';
import { ReadReportsUseCase } from '@application/accounting/reports/read-reports.use-case';
import type { FinancialReport, SalesReport } from '@domain/accounting/reports/financial-report';
import type { Dashboard } from '@domain/inventory/stock/report/report';
import { Controller, Get, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { DocumentError } from '@domain/inventory/stock/document/document';

@Controller('erp/reports')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('dashboard')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ReportsController {
  constructor(private readonly dashboard: DashboardUseCase, private readonly reports: ReadReportsUseCase) {}

  @Get('sales')
  @ProtectedModuleMeta('accounting')
  sales(@Query('companyId') companyId = '', @Query('from') from = '', @Query('to') to = ''): Promise<SalesReport> {
    return this.reports.sales(companyId, from, to);
  }

  @Get('financial')
  @ProtectedModuleMeta('accounting')
  financial(@Query('companyId') companyId = '', @Query('from') from = '', @Query('to') to = ''): Promise<FinancialReport> {
    return this.reports.financial(companyId, from, to);
  }

  @Get('dashboard')
  async show(
    @Query('companyId') companyId = '',
    @Query('to') to = '',
    @Query('days') days = '30',
  ): Promise<Dashboard & { inventory: { quantity: number; value: number } }> {
    if (companyId.trim() === '' || to.trim() === '') {
      throw new DocumentError('companyId and to are required');
    }
    return this.dashboard.execute(companyId, to, Number(days));
  }
}
