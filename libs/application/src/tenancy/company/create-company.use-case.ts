import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { createCompany, createDefaultWarehouse, type Company, type Warehouse } from '@domain/tenancy/company/company';
import type { CostingMethod } from '@domain/inventory/catalog/costing/costing';

export interface CreateCompanyCommand {
  societyId: string;
  legalName: string;
  rtn: string;
  currencyCode: string;
  costingMethod?: CostingMethod;
  defaultMarginPercent?: number | null;
}

@Injectable()
export class CreateCompanyUseCase {
  constructor(@Inject(COMPANY_PORT) private readonly companies: CompanyPort) {}

  async execute(command: CreateCompanyCommand): Promise<{ company: Company; warehouse: Warehouse }> {
    const company = createCompany({
      id: randomUUID(),
      societyId: command.societyId,
      legalName: command.legalName,
      rtn: command.rtn,
      currencyCode: command.currencyCode,
      costingMethod: command.costingMethod ?? 'PEPS',
      defaultMarginPercent: command.defaultMarginPercent ?? null,
    });
    const warehouse = createDefaultWarehouse(company.id, randomUUID());
    await this.companies.insertCompanyWithWarehouse(company, warehouse);
    return { company, warehouse };
  }
}
