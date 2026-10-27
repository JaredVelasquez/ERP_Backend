import { ReadStockCardUseCase } from '@application/inventory/stock/report/read-stock-card.use-case';
import type { StockCardView } from '@domain/inventory/stock/report/stock-card';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Controller, Get, Headers, Inject, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { assertSameCompany, requireCompanySession } from '@presentation/http/workspace/session/company-session';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';

@Controller('erp/stock-cards')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('inventory')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class StockCardsController {
  constructor(
    private readonly readStockCard: ReadStockCardUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Get()
  async read(
    @Headers('authorization') authorization = '',
    @Headers('cookie') cookie = '',
    @Query('companyId') companyId = '',
    @Query('productId') productId = '',
    @Query('code') code = '',
  ): Promise<{ card: StockCardView }> {
    const session = await requireCompanySession(this.identity, { authorization, cookie });
    assertSameCompany(session, companyId);
    return {
      card: await this.readStockCard.execute({
        companyId: session.companyId,
        productId,
        code,
        grants: session.grants,
      }),
    };
  }
}
