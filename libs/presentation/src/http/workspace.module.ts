import {
  ListCompanyUsersUseCase,
  ListImportHistoryUseCase,
  ListInventoryDocumentsUseCase,
  ListVouchersUseCase,
} from '@application/workspace/company-lists.use-case';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/dashboard-layout.use-case';
import { ReadCurrentSessionUseCase } from '@application/workspace/read-current-session.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase } from '@application/workspace/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase } from '@application/workspace/ui-preferences.use-case';
import { COMPANY_LIST_PORT } from '@domain/workspace/company-list.port';
import { LAYOUT_PORT } from '@domain/workspace/layout.port';
import { InMemoryCompanyListRepository } from '@infrastructure/persistence/in-memory-company-list.repository';
import { InMemoryLayoutRepository } from '@infrastructure/persistence/in-memory-layout.repository';
import { useSqlIdentity } from '@infrastructure/persistence/database-env';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import { SqlCompanyListRepository } from '@infrastructure/persistence/sql-company-list.repository';
import { SqlLayoutRepository } from '@infrastructure/persistence/sql-layout.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@presentation/http/identity.module';
import { TenancyModule } from '@presentation/http/tenancy.module';
import { WorkspaceController } from '@presentation/http/workspace.controller';

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

function layoutRepository(): InMemoryLayoutRepository | SqlLayoutRepository {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryLayoutRepository();
  }
  return new SqlLayoutRepository(createMssqlExecutor(process.env));
}

function companyLists(): InMemoryCompanyListRepository | SqlCompanyListRepository {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryCompanyListRepository();
  }
  return new SqlCompanyListRepository(createMssqlExecutor(process.env));
}
