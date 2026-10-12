import { SearchProductsByNameUseCase } from '@application/inventory/search-products-by-name.use-case';
import { ProductError } from '@domain/inventory/product';
import type { ProductNameHit } from '@domain/inventory/name-search';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session.port';
import { Controller, Get, Headers, Inject, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { assertSameCompany, requireCompanySession } from '@presentation/http/company-session';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

@Controller('erp/products')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('products')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ProductSearchController {
  constructor(
    private readonly searchProducts: SearchProductsByNameUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Get('search')
  async search(
    @Headers('authorization') authorization = '',
    @Headers('cookie') cookie = '',
    @Query('companyId') companyId = '',
    @Query('q') query = '',
  ): Promise<{ products: ProductNameHit[] }> {
    const session = await requireCompanySession(this.identity, { authorization, cookie });
    assertSameCompany(session, companyId);
    if (query.trim() === '') {
      throw new ProductError('Search text is required');
    }
    return { products: await this.searchProducts.execute(session.companyId, query) };
  }
}
