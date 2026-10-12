import { ApplyMarginUseCase } from '@application/inventory/apply-margin.use-case';
import { ChangePriceUseCase } from '@application/inventory/change-price.use-case';
import { CreateProductUseCase, type CreateProductInput } from '@application/inventory/create-product.use-case';
import { ListPriceHistoryUseCase } from '@application/inventory/list-price-history.use-case';
import { ListProductsUseCase } from '@application/inventory/list-products.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/preview-barcode.use-case';
import { ProductError } from '@domain/inventory/product';
import type { BarcodePreview } from '@domain/inventory/product.port';
import type { PriceChange } from '@domain/inventory/price';
import type { Product } from '@domain/inventory/product';
import type { Page } from '@domain/workspace/page';
import { Controller, Get, Param, Post, Body, Query, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

@Controller('erp/products')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('products')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly listProducts: ListProductsUseCase,
    private readonly listPriceHistory: ListPriceHistoryUseCase,
    private readonly previewBarcode: PreviewBarcodeUseCase,
    private readonly changePrice: ChangePriceUseCase,
    private readonly applyMargin: ApplyMarginUseCase,
  ) {}

  @Get()
  async list(
    @Query('companyId') companyId = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('search') search = '',
    @Query('sort') sort = '',
  ): Promise<Page<Product>> {
    return this.listProducts.execute(companyId, page, pageSize, search, sort);
  }

  @Get('price-history')
  @ProtectedModuleMeta('prices')
  async prices(@Query('companyId') companyId = ''): Promise<{ changes: PriceChange[] }> {
    return { changes: await this.listPriceHistory.execute(companyId) };
  }

  @Post()
  async create(@Body() body: CreateProductInput): Promise<{ product: Product }> {
    return { product: await this.createProduct.execute(body) };
  }

  @Get(':id/barcode')
  async barcode(@Query('companyId') companyId = '', @Param('id') id: string): Promise<BarcodePreview> {
    if (companyId.trim() === '') {
      throw new ProductError('companyId is required');
    }
    return this.previewBarcode.execute(companyId, id);
  }

  @Post(':id/prices')
  @ProtectedModuleMeta('prices')
  async price(
    @Param('id') id: string,
    @Body() body: { companyId: string; unit: string; nextPrice: number; reason: string; actorId: string; at: string },
  ): Promise<{ change: PriceChange }> {
    return { change: await this.changePrice.execute({ ...body, productId: id }) };
  }

  @Post(':id/margin')
  @ProtectedModuleMeta('prices')
  async margin(
    @Param('id') id: string,
    @Body() body: { companyId: string; unit: string; cost: number; actorId: string; at: string },
  ): Promise<{ change: PriceChange }> {
    return { change: await this.applyMargin.execute({ ...body, productId: id }) };
  }
}
