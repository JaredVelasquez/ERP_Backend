import { Module } from '@nestjs/common';
import { ManageCompanyControlsUseCase } from '@application/operations/company-controls/manage-company-controls.use-case';
import { ReadCompanyControlsUseCase } from '@application/operations/company-controls/read-company-controls.use-case';
import { COMPANY_CONTROLS_PORT } from '@domain/operations/company-controls/company-controls.port';
import { PostgresCompanyControlsRepository } from '@infrastructure/operations/company-controls/postgres/postgres-company-controls.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { IdentityModule } from '@composition/identity.module';
import { CompanyControlsController } from '@presentation/http/operations/company-controls/company-controls.controller';

@Module({
  imports: [IdentityModule],
  controllers: [CompanyControlsController],
  providers: [ReadCompanyControlsUseCase, ManageCompanyControlsUseCase, { provide: COMPANY_CONTROLS_PORT, useFactory: () => new PostgresCompanyControlsRepository(createTypeOrmExecutor(process.env)) }],
})
export class CompanyControlsModule {}
