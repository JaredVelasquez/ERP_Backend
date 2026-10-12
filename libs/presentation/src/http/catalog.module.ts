import { ApplyMarginUseCase } from '@application/inventory/apply-margin.use-case';
import { ChangePriceUseCase } from '@application/inventory/change-price.use-case';
import { CreateProductUseCase } from '@application/inventory/create-product.use-case';
import { ListPriceHistoryUseCase } from '@application/inventory/list-price-history.use-case';
import { ListProductsUseCase } from '@application/inventory/list-products.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/preview-barcode.use-case';
import { RenderBarcodeSheetUseCase } from '@application/inventory/render-barcode-sheet.use-case';
import { SearchProductsByNameUseCase } from '@application/inventory/search-products-by-name.use-case';
import { PRICE_PORT } from '@domain/inventory/price.port';
import { PDF_PORT } from '@domain/inventory/pdf.port';
import { BARCODE_PORT, PRODUCT_PORT } from '@domain/inventory/product.port';
import { Code128BarcodeAdapter } from '@infrastructure/barcode/code128-barcode.adapter';
import { SheetPdfAdapter } from '@infrastructure/barcode/sheet-pdf.adapter';
import { useSqlIdentity } from '@infrastructure/persistence/database-env';
import { InMemoryProductRepository } from '@infrastructure/persistence/in-memory-product.repository';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import { SqlProductRepository } from '@infrastructure/persistence/sql-product.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@presentation/http/identity.module';
import { BarcodeSheetsController } from '@presentation/http/barcode-sheets.controller';
import { ProductSearchController } from '@presentation/http/product-search.controller';
import { ProductsController } from '@presentation/http/products.controller';
import { TenancyModule } from '@presentation/http/tenancy.module';

@Module({
  imports: [IdentityModule, TenancyModule],
  controllers: [ProductsController, ProductSearchController, BarcodeSheetsController],
  providers: [
    CreateProductUseCase,
    ListProductsUseCase,
    ListPriceHistoryUseCase,
    PreviewBarcodeUseCase,
    RenderBarcodeSheetUseCase,
    SearchProductsByNameUseCase,
    ChangePriceUseCase,
    ApplyMarginUseCase,
    { provide: PRODUCT_PORT, useFactory: catalogRepository },
    { provide: PRICE_PORT, useExisting: PRODUCT_PORT },
    { provide: BARCODE_PORT, useClass: Code128BarcodeAdapter },
    { provide: PDF_PORT, useClass: SheetPdfAdapter },
  ],
  exports: [
    PRODUCT_PORT,
    PRICE_PORT,
    CreateProductUseCase,
    ListProductsUseCase,
    ListPriceHistoryUseCase,
    PreviewBarcodeUseCase,
    RenderBarcodeSheetUseCase,
    SearchProductsByNameUseCase,
    ChangePriceUseCase,
    ApplyMarginUseCase,
  ],
})
export class CatalogModule {}

function catalogRepository(): InMemoryProductRepository | SqlProductRepository {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryProductRepository();
  }
  return new SqlProductRepository(createMssqlExecutor(process.env));
}
