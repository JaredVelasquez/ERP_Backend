import { Inject, Injectable } from '@nestjs/common';
import { resolveCostingMethod } from '@domain/inventory/catalog/costing/costing';
import { resolveCompanyCode, type ResolvedCode } from '@domain/inventory/catalog/product-search/code-lookup';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { canUseModule, PermissionDeniedError, type ModuleGrant } from '@domain/identity/membership/module-access';
import { ProductError } from '@domain/inventory/catalog/product/product';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { buildStockCard, type StockCardView } from '@domain/inventory/stock/report/stock-card';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';

export interface ReadStockCardCommand {
  companyId: string;
  productId: string;
  code: string;
  grants: readonly ModuleGrant[];
}

@Injectable()
export class ReadStockCardUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
  ) {}

  async execute(command: ReadStockCardCommand): Promise<StockCardView> {
    assertStockCardAccess(command.grants);
    if (command.companyId.trim() === '') {
      throw new ProductError('companyId is required');
    }
    const resolved = await this.resolve(command);
    const company = await this.companies.findCompany(command.companyId);
    if (company === null) {
      throw new DocumentError('Company was not found');
    }
    const stock = await this.ledger.loadStock(command.companyId, [resolved.product.id]);
    return buildStockCard({
      product: resolved.product,
      layers: stock[0]?.layers ?? [],
      method: resolveCostingMethod(resolved.product.costingMethod, company.costingMethod),
      manufacturerBarcode: resolved.manufacturerBarcode,
      resolvedUnit: resolved.presentation?.unit ?? null,
    });
  }

  private async resolve(command: ReadStockCardCommand): Promise<ResolvedCode> {
    if (command.productId.trim() !== '') {
      return this.byId(command.companyId, command.productId);
    }
    if (command.code.trim() !== '') {
      return resolveCompanyCode(await this.products.list(command.companyId), command.code);
    }
    throw new ProductError('Product or code is required');
  }

  private async byId(companyId: string, productId: string): Promise<ResolvedCode> {
    const product = await this.products.find(companyId, productId);
    if (product === null) {
      throw new ProductError('Product was not found');
    }
    if (!product.active) {
      throw new ProductError('Product is inactive');
    }
    return { product, presentation: null, manufacturerBarcode: null };
  }
}

function assertStockCardAccess(grants: readonly ModuleGrant[]): void {
  if (!canUseModule(grants, 'inventory', 'view')) {
    throw new PermissionDeniedError();
  }
  if (!canUseModule(grants, 'products', 'view')) {
    throw new PermissionDeniedError();
  }
  if (!canUseModule(grants, 'prices', 'view')) {
    throw new PermissionDeniedError();
  }
}
