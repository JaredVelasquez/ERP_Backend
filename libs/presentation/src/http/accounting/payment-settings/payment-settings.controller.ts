import { ReadPaymentSettingsUseCase } from '@application/accounting/payment-settings/read-payment-settings.use-case';
import { SavePaymentSettingsUseCase } from '@application/accounting/payment-settings/save-payment-settings.use-case';
import { BadRequestException, Body, Controller, Get, Put, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { parsePaymentSettings } from '@presentation/http/accounting/payment-settings/payment-settings.request';

@Controller('erp/payment-settings')
@ProtectedModuleMeta('inventory')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class PaymentSettingsController {
  constructor(
    private readonly readSettings: ReadPaymentSettingsUseCase,
    private readonly saveSettings: SavePaymentSettingsUseCase,
  ) {}

  @Get()
  async read(@Query('companyId') companyId = '') {
    if (companyId.trim() === '') throw new BadRequestException('companyId is required');
    return this.readSettings.execute(companyId);
  }

  @Put()
  @ProtectedModuleMeta('settings')
  async save(@Query('companyId') companyId = '', @Body() input: unknown) {
    if (companyId.trim() === '') throw new BadRequestException('companyId is required');
    await this.saveSettings.execute(companyId, parsePaymentSettings(input));
    return { accepted: true };
  }
}
