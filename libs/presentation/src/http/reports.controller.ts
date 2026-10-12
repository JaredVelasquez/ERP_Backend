import { DashboardUseCase } from '@application/inventory/dashboard.use-case';
import type { Dashboard } from '@domain/inventory/report';
import { Controller, Get, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';
import { DocumentError } from '@domain/inventory/document';

@Controller('erp/reports')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('dashboard')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ReportsController {
  constructor(private readonly dashboard: DashboardUseCase) {}

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
