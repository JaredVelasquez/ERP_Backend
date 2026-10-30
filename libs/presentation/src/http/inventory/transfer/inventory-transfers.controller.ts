import { TransferStockUseCase } from '@application/inventory/stock/transfer/transfer-stock.use-case';
import type { ConfirmedDocument } from '@domain/inventory/stock/ledger/ledger.port';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Body, Controller, Headers, Inject, Post, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { assertSameCompany, requireCompanySession } from '@presentation/http/workspace/session/company-session';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';

interface TransferBody {
  companyId?: string;
  idempotencyKey?: string;
  occurredAt?: string;
  productId?: string;
  unit?: string;
  quantity?: number;
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  selectedLayerId?: string | null;
}

@Controller('erp/inventory-transfers')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('inventory')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class InventoryTransfersController {
  constructor(
    private readonly transferStock: TransferStockUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Post()
  async create(
    @Headers('authorization') authorization = '',
    @Headers('cookie') cookie = '',
    @Body() body: TransferBody,
  ): Promise<{ document: ConfirmedDocument }> {
    const session = await requireCompanySession(this.identity, { authorization, cookie });
    assertSameCompany(session, body.companyId ?? '');
    return {
      document: await this.transferStock.execute({
        companyId: session.companyId,
        idempotencyKey: body.idempotencyKey ?? '',
        occurredAt: body.occurredAt ?? '',
        productId: body.productId ?? '',
        unit: body.unit ?? '',
        quantity: body.quantity ?? 0,
        originWarehouseId: body.originWarehouseId ?? '',
        destinationWarehouseId: body.destinationWarehouseId ?? '',
        selectedLayerId: body.selectedLayerId ?? null,
      }),
    };
  }
}
