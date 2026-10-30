import { Body, Controller, Get, Param, Post, Put, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ManageCompanyControlsUseCase } from '@application/operations/company-controls/manage-company-controls.use-case';
import { ReadCompanyControlsUseCase } from '@application/operations/company-controls/read-company-controls.use-case';
import type { BankStatementLine, SaveCompanyControls } from '@domain/operations/company-controls/company-controls';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Inject } from '@nestjs/common';
import { AreaGuard, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';

@Controller('erp/company-controls')
@ProtectedModuleMeta('settings')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class CompanyControlsController {
  constructor(
    private readonly readControls: ReadCompanyControlsUseCase,
    private readonly manageControls: ManageCompanyControlsUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Get()
  async read(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return this.readControls.execute(session.companyId);
  }

  @Get('warehouses')
  @ProtectedModuleMeta('inventory')
  async warehouses(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    const controls = await this.readControls.execute(session.companyId);
    return { warehouses: controls.warehouses };
  }

  @Put()
  async save(@Req() request: Request, @Body() body: SaveCompanyControls) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.save(session.companyId, session.userId, body);
    return { accepted: true };
  }

  @Post('warehouses')
  async createWarehouse(@Req() request: Request, @Body() body: { code: string; name: string }) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.createWarehouse(session.companyId, body);
    return { accepted: true };
  }

  @Put('warehouses/:id/default')
  async defaultWarehouse(@Req() request: Request, @Param('id') id: string) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.setDefaultWarehouse(session.companyId, id);
    return { accepted: true };
  }

  @Post('periods')
  async createPeriod(@Req() request: Request, @Body() body: { name: string; startsOn: string; endsOn: string }) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.createPeriod(session.companyId, body);
    return { accepted: true };
  }

  @Put('periods/:id/status')
  async periodStatus(@Req() request: Request, @Param('id') id: string, @Body() body: { status: 'open' | 'closed'; reason?: string | null }) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.setPeriodStatus(session.companyId, id, body.status, session.userId, body.reason ?? null);
    return { accepted: true };
  }

  @Post('bank-lines')
  async importBankLine(@Req() request: Request, @Body() body: Omit<BankStatementLine, 'id' | 'status' | 'matchedJournalEntryId'>) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.importBankLine(session.companyId, session.userId, body);
    return { accepted: true };
  }

  @Put('bank-lines/:id/status')
  async bankLineStatus(@Req() request: Request, @Param('id') id: string, @Body() body: { status: BankStatementLine['status']; journalEntryId?: string | null }) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.manageControls.setBankLineStatus(session.companyId, id, body.status, body.journalEntryId ?? null);
    return { accepted: true };
  }
}
