import { CreateProductUseCase, type CreateProductInput } from '@application/inventory/catalog/product/create-product.use-case';
import { ListPriceHistoryUseCase } from '@application/inventory/catalog/pricing/list-price-history.use-case';
import { ListProductsUseCase } from '@application/inventory/catalog/product/list-products.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/catalog/barcode-sheet/preview-barcode.use-case';
import type { BarcodePreview } from '@domain/inventory/catalog/product/product.port';
import type { PriceChange } from '@domain/inventory/catalog/product/price';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { Page } from '@domain/workspace/company-list/page';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { Controller, Get, Param, Post, Body, Query, Req, Inject, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { assertSameCompany, requireCompanySession } from '@presentation/http/workspace/session/company-session';

@Controller('erp/products')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('products')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ProductsController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly createProduct: CreateProductUseCase,
    private readonly listProducts: ListProductsUseCase,
    private readonly listPriceHistory: ListPriceHistoryUseCase,
    private readonly previewBarcode: PreviewBarcodeUseCase,
  ) {}

  @Get()
  async list(
    @Req() request: Request,
    @Query('companyId') companyId = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('search') search = '',
    @Query('sort') sort = '',
  ): Promise<Page<Product>> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    return this.listProducts.execute(session.companyId, page, pageSize, search, sort);
  }

  @Get('price-history')
  @ProtectedModuleMeta('prices')
  async prices(@Req() request: Request, @Query('companyId') companyId = ''): Promise<{ changes: PriceChange[] }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    return { changes: await this.listPriceHistory.execute(session.companyId) };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: CreateProductInput): Promise<{ product: Product }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, body.companyId);
    return { product: await this.createProduct.execute({ ...body, companyId: session.companyId }, session) };
  }

  @Get(':id/barcode')
  async barcode(@Req() request: Request, @Query('companyId') companyId = '', @Param('id') id: string): Promise<BarcodePreview> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    return this.previewBarcode.execute(session.companyId, id);
  }

}
