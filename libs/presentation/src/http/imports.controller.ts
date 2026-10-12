import { ImportCatalogUseCase } from '@application/inventory/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/import-count.use-case';
import { DocumentError } from '@domain/inventory/document';
import type { ConfirmedDocument } from '@domain/inventory/ledger.port';
import { catalogTemplate, countTemplate, type CountImport } from '@domain/inventory/spreadsheet';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company.port';
import { Body, Controller, Get, Header, Inject, Post, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

@Controller('erp/imports')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('imports')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ImportsController {
  constructor(
    private readonly importCatalog: ImportCatalogUseCase,
    private readonly importCount: ImportCountUseCase,
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
    @Body() body: { companyId: string; csv: string; receivedAt: string },
  ): Promise<{ document: ConfirmedDocument | null }> {
    const company = await this.companies.findCompany(body.companyId);
    if (company === null) {
      throw new DocumentError('Company was not found');
    }
    return { document: await this.importCatalog.execute(body.csv, body.companyId, company.costingMethod, body.receivedAt) };
  }

  @Post('count')
  async uploadCount(@Body() body: { companyId: string; csv: string }): Promise<CountImport> {
    return this.importCount.execute(body.csv, body.companyId);
  }
}
