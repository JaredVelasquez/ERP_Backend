import { IssueSandboxFiscalDocumentUseCase } from '@application/documents/fiscal/issue-sandbox-fiscal-document.use-case';
import { ListEligibleSandboxSalesUseCase } from '@application/documents/fiscal/list-eligible-sandbox-sales.use-case';
import { ListFiscalDocumentsUseCase } from '@application/documents/fiscal/list-fiscal-documents.use-case';
import { ReadFiscalDocumentUseCase } from '@application/documents/fiscal/read-fiscal-document.use-case';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Body, Controller, Get, Inject, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { assertSameCompany, requireCompanySession } from '@presentation/http/workspace/session/company-session';

interface IssueSandboxFiscalDocumentBody {
  companyId?: string;
  sourceSaleDocumentId: string;
  idempotencyKey: string;
}

@Controller('erp/fiscal/sandbox/documents')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('accounting')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class FiscalDocumentsController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly issue: IssueSandboxFiscalDocumentUseCase,
    private readonly list: ListFiscalDocumentsUseCase,
    private readonly eligibleSales: ListEligibleSandboxSalesUseCase,
    private readonly read: ReadFiscalDocumentUseCase,
  ) {}

  @Post()
  async issueForSale(@Req() request: Request, @Body() body: IssueSandboxFiscalDocumentBody) {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, body.companyId ?? session.companyId);
    return {
      document: await this.issue.execute({
        companyId: session.companyId,
        actorId: session.userId,
        sourceSaleDocumentId: body.sourceSaleDocumentId,
        idempotencyKey: body.idempotencyKey,
      }),
    };
  }

  @Get()
  async listForCompany(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { documents: await this.list.execute(session.companyId) };
  }

  @Get('eligible-sales')
  async listEligibleSales(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { sales: await this.eligibleSales.execute(session.companyId) };
  }

  @Get(':id')
  async findForCompany(@Req() request: Request, @Param('id') id: string) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { document: await this.read.execute(session.companyId, id) };
  }
}
