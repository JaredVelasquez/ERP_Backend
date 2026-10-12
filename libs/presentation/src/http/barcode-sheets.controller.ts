import { RenderBarcodeSheetUseCase } from '@application/inventory/render-barcode-sheet.use-case';
import { BarcodeError } from '@domain/inventory/barcode';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session.port';
import { Body, Controller, Headers, Inject, Post, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAccessMeta, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { assertSameCompany, requireCompanySession } from '@presentation/http/company-session';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

interface SheetBody {
  companyId?: string;
  productIds?: string[];
}

@Controller('erp/barcode-sheets')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('products')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class BarcodeSheetsController {
  constructor(
    private readonly renderSheet: RenderBarcodeSheetUseCase,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Post()
  @ProtectedAccessMeta('view')
  async create(
    @Headers('authorization') authorization = '',
    @Headers('cookie') cookie = '',
    @Body() body: SheetBody,
  ): Promise<{ pdfBase64: string }> {
    const session = await requireCompanySession(this.identity, { authorization, cookie });
    assertSameCompany(session, body.companyId ?? '');
    const productIds = body.productIds ?? [];
    if (!Array.isArray(productIds)) {
      throw new BarcodeError('Product ids are required');
    }
    const pdf = await this.renderSheet.execute(session.companyId, productIds);
    return { pdfBase64: pdf.toString('base64') };
  }
}
