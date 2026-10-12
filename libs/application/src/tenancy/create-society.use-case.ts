import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company.port';
import { CompanyIdentityError, type Society } from '@domain/tenancy/company';

export interface CreateSocietyCommand {
  tenantId: string;
  name: string;
}

@Injectable()
export class CreateSocietyUseCase {
  constructor(@Inject(COMPANY_PORT) private readonly companies: CompanyPort) {}

  async execute(command: CreateSocietyCommand): Promise<Society> {
    if (command.name.trim() === '') {
      throw new CompanyIdentityError('Society name is required');
    }
    const society: Society = {
      id: randomUUID(),
      tenantId: command.tenantId,
      name: command.name.trim(),
    };
    await this.companies.insertSociety(society);
    return society;
  }
}
