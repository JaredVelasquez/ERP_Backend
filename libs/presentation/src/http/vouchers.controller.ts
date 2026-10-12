import { ConfirmVoucherUseCase, LinkVoucherUseCase, VoidVoucherUseCase } from '@application/documents/confirm-voucher.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase, type SaveVoucherCommand } from '@application/documents/save-voucher.use-case';
import type { CashVoucher } from '@domain/documents/voucher';
import { Controller, Get, Param, Post, Body, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';
import { VoucherError } from '@domain/documents/voucher';

@Controller('erp/vouchers')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('documents')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class VouchersController {
  constructor(
    private readonly saveVoucher: SaveVoucherUseCase,
    private readonly confirmVoucher: ConfirmVoucherUseCase,
    private readonly linkVoucher: LinkVoucherUseCase,
    private readonly voidVoucher: VoidVoucherUseCase,
    private readonly downloadVoucher: DownloadVoucherUseCase,
  ) {}

  @Post()
  async create(@Body() body: SaveVoucherCommand): Promise<{ voucher: CashVoucher }> {
    return { voucher: await this.saveVoucher.execute(body) };
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @Query('companyId') companyId = ''): Promise<{ voucher: CashVoucher }> {
    return { voucher: await this.confirmVoucher.execute(requireCompany(companyId), id) };
  }

  @Post(':id/link')
  async link(
    @Param('id') id: string,
    @Query('companyId') companyId = '',
    @Body() body: { moneyMovementId?: string },
  ): Promise<{ voucher: CashVoucher }> {
    return { voucher: await this.linkVoucher.execute(requireCompany(companyId), id, body.moneyMovementId ?? '') };
  }

  @Post(':id/void')
  async void(@Param('id') id: string, @Query('companyId') companyId = ''): Promise<{ voucher: CashVoucher }> {
    return { voucher: await this.voidVoucher.execute(requireCompany(companyId), id) };
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Query('companyId') companyId = ''): Promise<{ pdfBase64: string }> {
    if (companyId.trim() === '') {
      throw new VoucherError('companyId is required');
    }
    const pdf = await this.downloadVoucher.execute(companyId, id);
    return { pdfBase64: pdf.toString('base64') };
  }
}

function requireCompany(companyId: string): string {
  if (companyId.trim() === '') {
    throw new VoucherError('companyId is required');
  }
  return companyId;
}
