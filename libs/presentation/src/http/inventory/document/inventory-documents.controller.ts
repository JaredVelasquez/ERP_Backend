import { randomUUID } from 'node:crypto';
import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { VoidDocumentUseCase } from '@application/inventory/stock/document/void-document.use-case';
import { DocumentError, type DocumentKind, type DocumentLine, type DraftDocument } from '@domain/inventory/stock/document/document';
import type { ConfirmedDocument } from '@domain/inventory/stock/ledger/ledger.port';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { Body, Controller, Inject, Param, Post, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';

interface ConfirmBody {
  companyId: string;
  type: DocumentKind;
  idempotencyKey: string;
  receivedAt: string;
  paymentAccountCode?: string | null;
  collectionAccountCode?: string | null;
  adjustmentDirection?: 'in' | 'out' | null;
  transferAmount?: number | null;
  transferFromAccountCode?: string | null;
  transferToAccountCode?: string | null;
  lines?: Array<Omit<DocumentLine, 'newLayerId'>>;
}

@Controller('erp/inventory-documents')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('inventory')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class InventoryDocumentsController {
  constructor(
    private readonly confirmDocument: ConfirmDocumentUseCase,
    private readonly voidDocument: VoidDocumentUseCase,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
  ) {}

  @Post('confirm')
  async confirm(@Body() body: ConfirmBody): Promise<{ document: ConfirmedDocument }> {
    const company = await this.companies.findCompany(body.companyId);
    if (company === null) {
      throw new DocumentError('Company was not found');
    }
    const document = await this.confirmDocument.execute({
      draft: toDraft(body),
      companyCostingMethod: company.costingMethod,
      receivedAt: body.receivedAt,
    });
    return { document };
  }

  @Post(':id/void')
  async void(@Param('id') id: string, @Query('companyId') companyId = ''): Promise<{ document: ConfirmedDocument }> {
    if (companyId.trim() === '') {
      throw new DocumentError('companyId is required');
    }
    return { document: await this.voidDocument.execute(companyId, id) };
  }
}

function toDraft(body: ConfirmBody): DraftDocument {
  return {
    id: randomUUID(),
    companyId: body.companyId,
    type: body.type,
    idempotencyKey: body.idempotencyKey,
    paymentAccountCode: body.paymentAccountCode ?? null,
    collectionAccountCode: body.collectionAccountCode ?? null,
    adjustmentDirection: body.adjustmentDirection ?? null,
    transferAmount: body.transferAmount ?? null,
    transferFromAccountCode: body.transferFromAccountCode ?? null,
    transferToAccountCode: body.transferToAccountCode ?? null,
    lines: (body.lines ?? []).map((line) => ({ ...line, newLayerId: randomUUID() })),
  };
}
