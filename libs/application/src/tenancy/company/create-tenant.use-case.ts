import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { CompanyIdentityError, type Tenant } from '@domain/tenancy/company/company';

@Injectable()
export class CreateTenantUseCase {
  constructor(@Inject(COMPANY_PORT) private readonly companies: CompanyPort) {}

  async execute(name: string): Promise<Tenant> {
    if (name.trim() === '') {
      throw new CompanyIdentityError('Tenant name is required');
    }
    const tenant: Tenant = { id: randomUUID(), name: name.trim() };
    await this.companies.insertTenant(tenant);
    return tenant;
  }
}
