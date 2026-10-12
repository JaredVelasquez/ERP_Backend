import { IssueStockUseCase } from '@application/inventory/issue-stock.use-case';
import { DocumentError } from '@domain/inventory/document';
import type { IssueLineRequest } from '@domain/inventory/issue-draft';
import type { ConfirmedDocument } from '@domain/inventory/ledger.port';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session.port';
import { Body, Controller, Headers, Inject, Post, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { assertSameCompany, requireCompanySession } from '@presentation/http/company-session';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

interface IssueBody {
  companyId?: string;
  idempotencyKey?: string;
  receivedAt?: string;
  lines?: IssueLineRequest[];
  type?: unknown;
  collectionAccountCode?: unknown;
  adjustmentDirection?: unknown;
}

@Controller('erp/inventory-issues')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('inventory')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class InventoryIssuesController {
  constructor(
    private readonly issueStock: IssueStockUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Post()
  async create(
    @Headers('authorization') authorization = '',
    @Headers('cookie') cookie = '',
    @Body() body: IssueBody,
  ): Promise<{ document: ConfirmedDocument }> {
    const session = await requireCompanySession(this.identity, { authorization, cookie });
    assertSameCompany(session, body.companyId ?? '');
    rejectClientPosting(body);
    return {
      document: await this.issueStock.execute({
        companyId: session.companyId,
        idempotencyKey: body.idempotencyKey ?? '',
        receivedAt: body.receivedAt ?? '',
        lines: body.lines ?? [],
      }),
    };
  }
}

function rejectClientPosting(body: IssueBody): void {
  if (body.type !== undefined || body.collectionAccountCode !== undefined || body.adjustmentDirection !== undefined) {
    throw new DocumentError('Issue does not accept a document type');
  }
}
