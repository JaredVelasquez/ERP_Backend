import { ConfirmDocumentUseCase } from '@application/inventory/confirm-document.use-case';
import { DashboardUseCase } from '@application/inventory/dashboard.use-case';
import { ImportCatalogUseCase } from '@application/inventory/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/import-count.use-case';
import { IssueStockUseCase } from '@application/inventory/issue-stock.use-case';
import { ReadStockCardUseCase } from '@application/inventory/read-stock-card.use-case';
import { VoidDocumentUseCase } from '@application/inventory/void-document.use-case';
import { LEDGER_PORT } from '@domain/inventory/ledger.port';
import { useSqlIdentity } from '@infrastructure/persistence/database-env';
import { InMemoryInventoryLedger } from '@infrastructure/persistence/in-memory-inventory.ledger';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import { SqlInventoryLedger } from '@infrastructure/persistence/sql-inventory.ledger';
import { Module } from '@nestjs/common';
import { CatalogModule } from '@presentation/http/catalog.module';
import { IdentityModule } from '@presentation/http/identity.module';
import { ImportsController } from '@presentation/http/imports.controller';
import { InventoryDocumentsController } from '@presentation/http/inventory-documents.controller';
import { InventoryIssuesController } from '@presentation/http/inventory-issues.controller';
import { ReportsController } from '@presentation/http/reports.controller';
import { StockCardsController } from '@presentation/http/stock-cards.controller';
import { TenancyModule } from '@presentation/http/tenancy.module';

@Module({
  imports: [IdentityModule, CatalogModule, TenancyModule],
  controllers: [InventoryDocumentsController, InventoryIssuesController, StockCardsController, ReportsController, ImportsController],
  providers: [
    ConfirmDocumentUseCase,
    VoidDocumentUseCase,
    IssueStockUseCase,
    ReadStockCardUseCase,
    DashboardUseCase,
    ImportCatalogUseCase,
    ImportCountUseCase,
    { provide: LEDGER_PORT, useFactory: ledgerRepository },
  ],
  exports: [
    LEDGER_PORT,
    ConfirmDocumentUseCase,
    VoidDocumentUseCase,
    IssueStockUseCase,
    ReadStockCardUseCase,
    DashboardUseCase,
    ImportCatalogUseCase,
    ImportCountUseCase,
  ],
})
export class InventoryModule {}

function ledgerRepository(): InMemoryInventoryLedger | SqlInventoryLedger {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryInventoryLedger();
  }
  return new SqlInventoryLedger(createMssqlExecutor(process.env));
}
