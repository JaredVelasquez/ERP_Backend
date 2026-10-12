import { CreateCompanyUseCase } from '@application/tenancy/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/create-tenant.use-case';
import { COMPANY_PORT } from '@domain/tenancy/company.port';
import { useSqlIdentity } from '@infrastructure/persistence/database-env';
import { InMemoryCompanyRepository } from '@infrastructure/persistence/in-memory-company.repository';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import { SqlCompanyRepository } from '@infrastructure/persistence/sql-company.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@presentation/http/identity.module';
import { TenancyController } from '@presentation/http/tenancy.controller';

@Module({
  imports: [IdentityModule],
  controllers: [TenancyController],
  providers: [
    CreateTenantUseCase,
    CreateSocietyUseCase,
    CreateCompanyUseCase,
    { provide: COMPANY_PORT, useFactory: companyRepository },
  ],
  exports: [COMPANY_PORT, CreateTenantUseCase, CreateSocietyUseCase, CreateCompanyUseCase],
})
export class TenancyModule {}

function companyRepository(): InMemoryCompanyRepository | SqlCompanyRepository {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryCompanyRepository();
  }
  return new SqlCompanyRepository(createMssqlExecutor(process.env));
}
