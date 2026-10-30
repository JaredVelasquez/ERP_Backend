import { ApplyMarginUseCase } from '@application/inventory/catalog/pricing/apply-margin.use-case';
import { ChangePriceUseCase } from '@application/inventory/catalog/pricing/change-price.use-case';
import { CreateProductUseCase } from '@application/inventory/catalog/product/create-product.use-case';
import { ListPriceHistoryUseCase } from '@application/inventory/catalog/pricing/list-price-history.use-case';
import { ListProductsUseCase } from '@application/inventory/catalog/product/list-products.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/catalog/barcode-sheet/preview-barcode.use-case';
import { RenderBarcodeSheetUseCase } from '@application/inventory/catalog/barcode-sheet/render-barcode-sheet.use-case';
import { SearchProductsByNameUseCase } from '@application/inventory/catalog/product/search-products-by-name.use-case';
import { ReadProductUseCase } from '@application/inventory/catalog/product/read-product.use-case';
import {
  DesignatePriceApproverUseCase, ListCommercialPricesUseCase, ListCommercialPriceHistoryUseCase, ListPriceProposalsUseCase,
  ProposePriceUseCase, ReadPriceSettingsUseCase, ResolvePriceProposalUseCase, SetDirectPriceUseCase,
} from '@application/inventory/catalog/pricing/price-workflow.use-cases';
import { PRICE_WORKFLOW_PORT } from '@domain/inventory/catalog/pricing/price-workflow.port';
import { PRICE_PORT } from '@domain/inventory/catalog/product/price.port';
import { COSTING_POLICY_PORT } from '@domain/inventory/catalog/costing/costing-policy.port';
import { PDF_PORT } from '@domain/inventory/catalog/barcode-sheet/pdf.port';
import { BARCODE_PORT, PRODUCT_PORT } from '@domain/inventory/catalog/product/product.port';
import { Code128BarcodeAdapter } from '@infrastructure/catalog/barcode-sheet/barcode/code128-barcode.adapter';
import { SheetPdfAdapter } from '@infrastructure/catalog/barcode-sheet/barcode/sheet-pdf.adapter';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { PostgresProductRepository } from '@infrastructure/catalog/product/postgres/product.repository';
import { PostgresPriceWorkflowRepository } from '@infrastructure/catalog/pricing/postgres/postgres-price-workflow.repository';
import { InMemoryPriceWorkflowRepository } from '@infrastructure/catalog/pricing/in-memory/in-memory-price-workflow.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@composition/identity.module';
import { BarcodeSheetsController } from '@presentation/http/catalog/barcode-sheet/barcode-sheets.controller';
import { ProductSearchController } from '@presentation/http/catalog/product/product-search.controller';
import { ProductsController } from '@presentation/http/catalog/product/products.controller';
import { PriceWorkflowController } from '@presentation/http/catalog/pricing/price-workflow.controller';
import { TenancyModule } from '@composition/tenancy.module';

@Module({
  imports: [IdentityModule, TenancyModule],
  controllers: [ProductsController, ProductSearchController, BarcodeSheetsController, PriceWorkflowController],
  providers: [
    CreateProductUseCase,
    ListProductsUseCase,
    ListPriceHistoryUseCase,
    PreviewBarcodeUseCase,
    RenderBarcodeSheetUseCase,
    SearchProductsByNameUseCase,
    ReadProductUseCase,
    ChangePriceUseCase,
    ApplyMarginUseCase,
    ListCommercialPricesUseCase,
    ListPriceProposalsUseCase,
    ListCommercialPriceHistoryUseCase,
    ProposePriceUseCase,
    ResolvePriceProposalUseCase,
    SetDirectPriceUseCase,
    ReadPriceSettingsUseCase,
    DesignatePriceApproverUseCase,
    { provide: PRODUCT_PORT, useFactory: catalogRepository },
    {
      provide: PRICE_WORKFLOW_PORT,
      useFactory: (products: import('@domain/inventory/catalog/product/product.port').ProductPort) => usePostgres(process.env)
        ? new PostgresPriceWorkflowRepository(createTypeOrmExecutor(process.env))
        : new InMemoryPriceWorkflowRepository(products),
      inject: [PRODUCT_PORT],
    },
    { provide: PRICE_PORT, useExisting: PRODUCT_PORT },
    { provide: COSTING_POLICY_PORT, useExisting: PRODUCT_PORT },
    { provide: BARCODE_PORT, useClass: Code128BarcodeAdapter },
    { provide: PDF_PORT, useClass: SheetPdfAdapter },
  ],
  exports: [
    PRODUCT_PORT,
    PRICE_PORT,
    COSTING_POLICY_PORT,
    CreateProductUseCase,
    ListProductsUseCase,
    ListPriceHistoryUseCase,
    PreviewBarcodeUseCase,
    RenderBarcodeSheetUseCase,
    SearchProductsByNameUseCase,
    ReadProductUseCase,
    ChangePriceUseCase,
    ApplyMarginUseCase,
    ListCommercialPricesUseCase,
    ListPriceProposalsUseCase,
    ListCommercialPriceHistoryUseCase,
    ProposePriceUseCase,
    ResolvePriceProposalUseCase,
    SetDirectPriceUseCase,
    ReadPriceSettingsUseCase,
    DesignatePriceApproverUseCase,
  ],
})
export class CatalogModule {}

function catalogRepository(): InMemoryProductRepository | PostgresProductRepository {
  if (!usePostgres(process.env)) {
    return new InMemoryProductRepository();
  }
  return new PostgresProductRepository(createTypeOrmExecutor(process.env));
}
