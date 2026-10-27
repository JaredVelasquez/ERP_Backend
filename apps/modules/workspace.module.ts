import {
  ListCompanyUsersUseCase,
  ListImportHistoryUseCase,
  ListInventoryDocumentsUseCase,
  ListVouchersUseCase,
} from '@application/workspace/company-list/company-lists.use-case';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/preferences/dashboard-layout.use-case';
import { ReadCurrentSessionUseCase } from '@application/workspace/session/read-current-session.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase } from '@application/workspace/preferences/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase } from '@application/workspace/preferences/ui-preferences.use-case';
import { COMPANY_LIST_PORT } from '@domain/workspace/company-list/company-list.port';
import { LAYOUT_PORT } from '@domain/workspace/layout/layout.port';
import { InMemoryCompanyListRepository } from '@infrastructure/workspace/company-list/in-memory/in-memory-company-list.repository';
import { InMemoryLayoutRepository } from '@infrastructure/workspace/layout/in-memory/in-memory-layout.repository';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { PostgresCompanyListRepository } from '@infrastructure/workspace/company-list/postgres/postgres-company-list.repository';
import { PostgresLayoutRepository } from '@infrastructure/workspace/layout/postgres/postgres-layout.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@composition/identity.module';
import { TenancyModule } from '@composition/tenancy.module';
import { WorkspaceController } from '@presentation/http/workspace/session/workspace.controller';

@Module({
  imports: [IdentityModule, TenancyModule],
  controllers: [WorkspaceController],
  providers: [
    ReadCurrentSessionUseCase,
    ReadTableLayoutUseCase,
    SaveTableLayoutUseCase,
    ReadDashboardLayoutUseCase,
    SaveDashboardLayoutUseCase,
    ReadUiPreferencesUseCase,
    SaveUiPreferencesUseCase,
    ListInventoryDocumentsUseCase,
    ListVouchersUseCase,
    ListCompanyUsersUseCase,
    ListImportHistoryUseCase,
    { provide: LAYOUT_PORT, useFactory: layoutRepository },
    { provide: COMPANY_LIST_PORT, useFactory: companyLists },
  ],
  exports: [
    ReadTableLayoutUseCase,
    SaveTableLayoutUseCase,
    ReadDashboardLayoutUseCase,
    SaveDashboardLayoutUseCase,
    ReadUiPreferencesUseCase,
    SaveUiPreferencesUseCase,
  ],
})
export class WorkspaceModule {}

function layoutRepository(): InMemoryLayoutRepository | PostgresLayoutRepository {
  if (!usePostgres(process.env)) {
    return new InMemoryLayoutRepository();
  }
  return new PostgresLayoutRepository(createTypeOrmExecutor(process.env));
}

function companyLists(): InMemoryCompanyListRepository | PostgresCompanyListRepository {
  if (!usePostgres(process.env)) {
    return new InMemoryCompanyListRepository();
  }
  return new PostgresCompanyListRepository(createTypeOrmExecutor(process.env));
}
