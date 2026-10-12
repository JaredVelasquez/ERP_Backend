import { CreateCompanyUseCase, type CreateCompanyCommand } from '@application/tenancy/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/create-tenant.use-case';
import { CompanyIdentityError } from '@domain/tenancy/company';
import type { CostingMethod } from '@domain/inventory/costing';
import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/company-identity.filter';

interface JsonBody {
  [key: string]: unknown;
}

@Controller('admin')
@ProtectedAreaMeta('platform')
@ProtectedModuleMeta('platform')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class TenancyController {
  constructor(
    private readonly createTenant: CreateTenantUseCase,
    private readonly createSociety: CreateSocietyUseCase,
    private readonly createCompany: CreateCompanyUseCase,
  ) {}

  @Post('tenants')
  createTenantRoute(@Body() body: JsonBody) {
    return this.createTenant.execute(readText(body, 'name'));
  }

  @Post('societies')
  createSocietyRoute(@Body() body: JsonBody) {
    return this.createSociety.execute({
      tenantId: readText(body, 'tenantId'),
      name: readText(body, 'name'),
    });
  }

  @Post('companies')
  createCompanyRoute(@Body() body: JsonBody) {
    return this.createCompany.execute(readCompany(body));
  }
}

function readCompany(body: JsonBody): CreateCompanyCommand {
  const margin = body.defaultMarginPercent;
  return {
    societyId: readText(body, 'societyId'),
    legalName: readText(body, 'legalName'),
    rtn: readText(body, 'rtn'),
    currencyCode: readText(body, 'currencyCode'),
    costingMethod: readCostingMethod(body.costingMethod),
    defaultMarginPercent: typeof margin === 'number' ? margin : null,
  };
}

function readText(body: JsonBody, field: string): string {
  const value = body[field];
  if (typeof value !== 'string') {
    throw new CompanyIdentityError(`${field} is required`);
  }
  return value;
}

function readCostingMethod(value: unknown): CostingMethod | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'PEPS' || value === 'UEPS' || value === 'FEFO' || value === 'AVERAGE' || value === 'SPECIFIC') {
    return value;
  }
  throw new CompanyIdentityError('costingMethod is invalid');
}
