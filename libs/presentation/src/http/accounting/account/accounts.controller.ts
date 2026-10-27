import { ReceiveEntryUseCase } from '@application/accounting/account/receive-entry.use-case';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';
import { UpdateAccountUseCase } from '@application/accounting/account/update-account.use-case';
import type { AccountTreeNode } from '@domain/accounting/account/chart';
import { BadRequestException, Body, Controller, Get, Put, Post, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';

@Controller('erp/accounts')
@ProtectedAreaMeta('accounting')
@ProtectedModuleMeta('accounting')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class AccountsController {
  constructor(
    private readonly seedChart: SeedChartUseCase,
    private readonly receiveEntry: ReceiveEntryUseCase,
    private readonly updateAccount: UpdateAccountUseCase,
  ) {}

  @Get()
  async list(@Query('companyId') companyId = ''): Promise<{ accounts: AccountTreeNode[] }> {
    if (companyId.trim() === '') {
      throw new BadRequestException('companyId is required');
    }
    return { accounts: await this.seedChart.execute(companyId) };
  }

  @Post('entries')
  async receive(
    @Query('companyId') companyId = '',
    @Body() body: { code?: string },
  ): Promise<{ accepted: true }> {
    const code = body.code ?? '';
    if (companyId.trim() === '' || code.trim() === '') {
      throw new BadRequestException('companyId and code are required');
    }
    return this.receiveEntry.execute(companyId, code);
  }

  @Put()
  async update(
    @Query('companyId') companyId = '',
    @Body() body: { code?: string; name?: string; collection?: boolean },
  ) {
    const code = body.code ?? '';
    if (companyId.trim() === '' || code.trim() === '' || typeof body.name !== 'string') {
      throw new BadRequestException('companyId, code, and name are required');
    }
    return {
      account: await this.updateAccount.execute({
        companyId,
        code,
        name: body.name,
        collection: body.collection === true,
      }),
    };
  }
}
