import { Inject, Injectable } from '@nestjs/common';
import { PriceError, priceFromMargin, resolveMarginPercent } from '@domain/inventory/price';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company.port';
import { ChangePriceUseCase } from '@application/inventory/change-price.use-case';
import type { PriceChange } from '@domain/inventory/price';

export interface ApplyMarginCommand {
  companyId: string;
  productId: string;
  unit: string;
  cost: number;
  actorId: string;
  at: string;
}

@Injectable()
export class ApplyMarginUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
    private readonly changePrice: ChangePriceUseCase,
  ) {}

  async execute(command: ApplyMarginCommand): Promise<PriceChange> {
    const product = await this.products.find(command.companyId, command.productId);
    const company = await this.companies.findCompany(command.companyId);
    if (product === null || company === null) {
      throw new PriceError('Product was not found');
    }
    const percent = resolveMarginPercent(product.marginPercent, company.defaultMarginPercent);
    const nextPrice = priceFromMargin(command.cost, percent);
    if (nextPrice === null) {
      throw new PriceError('A margin percent is required');
    }
    return this.changePrice.execute({
      ...command,
      nextPrice,
      reason: 'Aplicar margen',
    });
  }
}
