import { Inject, Injectable } from '@nestjs/common';
import { readSessionToken, type MembershipRole } from '@domain/identity/access';
import { PermissionDeniedError, type ModuleGrant } from '@domain/identity/module-access';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session.port';
import type { Company } from '@domain/tenancy/company';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company.port';

export interface CurrentSessionView {
  role: MembershipRole;
  grants: ModuleGrant[];
  companyId: string;
  companyName: string;
  logoUrl: string | null;
}

@Injectable()
export class ReadCurrentSessionUseCase {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
  ) {}

  async execute(headers: { authorization?: string; cookie?: string }): Promise<CurrentSessionView> {
    const token = readSessionToken(headers);
    if (token === null) {
      throw new PermissionDeniedError();
    }
    const session = await this.identity.findSession(token);
    if (session === null) {
      throw new PermissionDeniedError();
    }
    const company = await this.companies.findCompany(session.companyId);
    return {
      role: session.role,
      grants: session.grants,
      companyId: session.companyId,
      companyName: session.companyName ?? '',
      logoUrl: companyLogo(company),
    };
  }
}

function companyLogo(company: Company | null): string | null {
  if (company === null || company.logoUrl === undefined || company.logoUrl === null || company.logoUrl.trim() === '') {
    return null;
  }
  return company.logoUrl;
}
