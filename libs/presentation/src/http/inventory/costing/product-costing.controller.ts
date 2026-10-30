import { SetProductCostingMethodUseCase } from '@application/inventory/catalog/costing/set-product-costing-method.use-case';
import { COSTING_METHODS, type CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Body, Controller, Headers, Inject, Param, Put, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';

interface CostingMethodBody {
  costingMethod?: string | null;
  reason?: string;
}

@Controller('erp/products')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('inventory')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ProductCostingController {
  constructor(
    private readonly setCostingMethod: SetProductCostingMethodUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Put(':id/costing-method')
  async update(
    @Headers('authorization') authorization = '',
    @Headers('cookie') cookie = '',
    @Param('id') id: string,
    @Body() body: CostingMethodBody,
  ): Promise<{ accepted: true }> {
    const session = await requireCompanySession(this.identity, { authorization, cookie });
    await this.setCostingMethod.execute({
      companyId: session.companyId,
      productId: id,
      costingMethod: readCostingMethod(body.costingMethod),
      reason: body.reason ?? '',
      actorId: session.userId,
    });
    return { accepted: true };
  }
}

function readCostingMethod(value: string | null | undefined): CostingMethod | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if ((COSTING_METHODS as readonly string[]).includes(value)) {
    return value as CostingMethod;
  }
  throw new DocumentError('Unknown costing method');
}
