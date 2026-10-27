import {
  DesignatePriceApproverUseCase, ListCommercialPricesUseCase, ListCommercialPriceHistoryUseCase, ListPriceProposalsUseCase,
  ProposePriceUseCase, ReadPriceSettingsUseCase, ResolvePriceProposalUseCase, SetDirectPriceUseCase,
} from '@application/inventory/catalog/pricing/price-workflow.use-cases';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { PriceWorkflowError } from '@domain/inventory/catalog/pricing/price-workflow.port';
import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AreaGuard, ProtectedAccessMeta, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';

@Controller('erp/prices')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('prices')
@ProtectedAccessMeta('view')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class PriceWorkflowController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly listPrices: ListCommercialPricesUseCase,
    private readonly listProposals: ListPriceProposalsUseCase,
    private readonly listHistory: ListCommercialPriceHistoryUseCase,
    private readonly proposePrice: ProposePriceUseCase,
    private readonly resolveProposal: ResolvePriceProposalUseCase,
    private readonly setDirectPrice: SetDirectPriceUseCase,
    private readonly readSettings: ReadPriceSettingsUseCase,
    private readonly designateApprover: DesignatePriceApproverUseCase,
  ) {}

  @Get('catalog')
  async catalog(@Req() request: Request, @Query('page') page = '1', @Query('pageSize') pageSize = '25', @Query('search') search = '') {
    const session = await this.session(request);
    const result = await this.listPrices.execute(session.companyId, Number(page), Number(pageSize), search);
    return { ...result, page: Number(page), pageSize: Number(pageSize) };
  }

  @Get('proposals')
  async proposals(@Req() request: Request, @Query('page') page = '1', @Query('pageSize') pageSize = '25', @Query('status') status = '') {
    const session = await this.session(request);
    const size = Number(pageSize);
    if (!Number.isInteger(size) || size < 1 || size > 100) throw new PriceWorkflowError('Invalid page');
    const items = await this.listProposals.execute(session.companyId, Number(page), size + 1, status);
    return { items: items.slice(0, size), page: Number(page), pageSize: size, hasMore: items.length > size };
  }

  @Get('history')
  async history(@Req() request: Request, @Query('page') page = '1', @Query('pageSize') pageSize = '25') {
    const session = await this.session(request);
    const size = Number(pageSize);
    if (!Number.isInteger(size) || size < 1 || size > 100) throw new PriceWorkflowError('Invalid page');
    const items = await this.listHistory.execute(session.companyId, Number(page), size + 1);
    return { items: items.slice(0, size), page: Number(page), pageSize: size, hasMore: items.length > size };
  }

  @Post('proposals')
  async propose(@Req() request: Request, @Body() body: { productId: string; unit: string; proposedPrice: number; reason: string }) {
    const session = await this.session(request);
    return { proposal: await this.proposePrice.execute(session, body) };
  }

  @Post('direct')
  @ProtectedAccessMeta('edit')
  async direct(@Req() request: Request, @Body() body: { productId: string; unit: string; price: number; reason: string }) {
    const session = await this.session(request);
    await this.setDirectPrice.execute(session, body);
    return { changed: true };
  }

  @Post('proposals/:id/approve')
  async approve(@Req() request: Request, @Param('id') id: string, @Body() body: { note?: string }) {
    const session = await this.session(request);
    return { proposal: await this.resolveProposal.execute(session, id, 'approved', body?.note ?? '') };
  }

  @Post('proposals/:id/reject')
  async reject(@Req() request: Request, @Param('id') id: string, @Body() body: { note: string }) {
    const session = await this.session(request);
    return { proposal: await this.resolveProposal.execute(session, id, 'rejected', body?.note ?? '') };
  }

  @Get('settings')
  async settings(@Req() request: Request) {
    const session = await this.session(request);
    const settings = await this.readSettings.execute(session.companyId);
    return {
      ...settings,
      canApprove: session.role === 'owner' || settings.designatedApproverId === session.userId,
      canConfigure: session.role === 'owner',
    };
  }

  @Put('settings')
  async updateSettings(@Req() request: Request, @Body() body: { designatedApproverId?: string | null }) {
    const session = await this.session(request);
    return this.designateApprover.execute(session, body?.designatedApproverId ?? null);
  }

  private session(request: Request) {
    return requireCompanySession(this.identity, {
      cookie: request.headers.cookie,
      authorization: request.headers.authorization,
    });
  }
}
