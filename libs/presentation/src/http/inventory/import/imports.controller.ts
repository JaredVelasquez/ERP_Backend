import { ImportCatalogUseCase } from '@application/inventory/catalog/import/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/catalog/import/import-count.use-case';
import { ReadPriceSettingsUseCase } from '@application/inventory/catalog/pricing/price-workflow.use-cases';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { DocumentError } from '@domain/inventory/stock/document/document';
import type { ConfirmedDocument } from '@domain/inventory/stock/ledger/ledger.port';
import { catalogTemplate, countTemplate, type CountImport } from '@domain/inventory/catalog/import/spreadsheet';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { Body, Controller, ForbiddenException, Get, Header, Inject, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';

@Controller('erp/imports')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('imports')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ImportsController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly importCatalog: ImportCatalogUseCase,
    private readonly importCount: ImportCountUseCase,
    private readonly priceSettings: ReadPriceSettingsUseCase,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
  ) {}

  @Get('catalog-template')
  @Header('content-type', 'text/csv; charset=utf-8')
  catalog(): string {
    return catalogTemplate();
  }

  @Get('count-template')
  @Header('content-type', 'text/csv; charset=utf-8')
  count(): string {
    return countTemplate();
  }

  @Post('catalog')
  async uploadCatalog(
    @Req() request: Request,
    @Body() body: { companyId: string; csv: string; receivedAt: string },
  ): Promise<{ document: ConfirmedDocument | null }> {
    const session = await requireCompanySession(this.identity, request.headers);
    const settings = await this.priceSettings.execute(session.companyId);
    if (session.role !== 'owner' && settings.designatedApproverId !== session.userId) {
      throw new ForbiddenException();
    }
    const company = await this.companies.findCompany(session.companyId);
    if (company === null) {
      throw new DocumentError('Company was not found');
    }
    return { document: await this.importCatalog.execute(body.csv, session.companyId, company.costingMethod, body.receivedAt) };
  }

  @Post('count')
  async uploadCount(@Body() body: { companyId: string; csv: string }): Promise<CountImport> {
    return this.importCount.execute(body.csv, body.companyId);
  }
}
