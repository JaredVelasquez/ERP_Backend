import { CreateCompanyUseCase } from '@application/tenancy/company/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/company/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/company/create-tenant.use-case';
import { COMPANY_PORT } from '@domain/tenancy/company/company.port';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { InMemoryCompanyRepository } from '@infrastructure/tenancy/company/in-memory/in-memory-company.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { PostgresCompanyRepository } from '@infrastructure/tenancy/company/postgres/postgres-company.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@composition/identity.module';
import { TenancyController } from '@presentation/http/tenancy/company/tenancy.controller';

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

function companyRepository(): InMemoryCompanyRepository | PostgresCompanyRepository {
  if (!usePostgres(process.env)) {
    return new InMemoryCompanyRepository();
  }
  return new PostgresCompanyRepository(createTypeOrmExecutor(process.env));
}
