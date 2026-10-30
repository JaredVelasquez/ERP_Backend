import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { DashboardUseCase } from '@application/inventory/stock/dashboard/dashboard.use-case';
import { ImportCatalogUseCase } from '@application/inventory/catalog/import/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/catalog/import/import-count.use-case';
import { IssueStockUseCase } from '@application/inventory/stock/issue/issue-stock.use-case';
import { ReadStockCardUseCase } from '@application/inventory/stock/report/read-stock-card.use-case';
import { TransferStockUseCase } from '@application/inventory/stock/transfer/transfer-stock.use-case';
import { VoidDocumentUseCase } from '@application/inventory/stock/document/void-document.use-case';
import { CreateJournalEntryUseCase } from '@application/accounting/journal-entry/create-journal-entry.use-case';
import { ListJournalEntriesUseCase } from '@application/accounting/journal-entry/list-journal-entries.use-case';
import { ReadReportsUseCase } from '@application/accounting/reports/read-reports.use-case';
import { VoidJournalEntryUseCase } from '@application/accounting/journal-entry/void-journal-entry.use-case';
import { JOURNAL_ENTRY_PORT } from '@domain/accounting/journal-entry/journal-entry.port';
import { IMPORT_TRANSACTION_PORT, type ImportTransactionPort } from '@domain/inventory/catalog/import/import-transaction.port';
import { LEDGER_PORT } from '@domain/inventory/stock/ledger/ledger.port';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { InMemoryImportTransactionRepository } from '@infrastructure/catalog/import/in-memory/in-memory-import-transaction.repository';
import { PostgresImportTransactionRepository } from '@infrastructure/catalog/import/postgres/postgres-import-transaction.repository';
import { InMemoryInventoryLedger } from '@infrastructure/inventory/ledger/in-memory/in-memory-inventory.ledger';
import { InMemoryJournalEntryRepository } from '@infrastructure/accounting/journal-entry/in-memory/in-memory-journal-entry.repository';
import { PostgresInventoryLedgerRepository } from '@infrastructure/inventory/ledger/postgres/postgres-inventory-ledger.repository';
import { PostgresJournalEntryRepository } from '@infrastructure/accounting/journal-entry/postgres/postgres-journal-entry.repository';
import { Module } from '@nestjs/common';
import { CatalogModule } from '@composition/catalog.module';
import { IdentityModule } from '@composition/identity.module';
import { ImportsController } from '@presentation/http/inventory/import/imports.controller';
import { InventoryDocumentsController } from '@presentation/http/inventory/document/inventory-documents.controller';
import { InventoryIssuesController } from '@presentation/http/inventory/issue/inventory-issues.controller';
import { InventoryTransfersController } from '@presentation/http/inventory/transfer/inventory-transfers.controller';
import { JournalEntriesController } from '@presentation/http/accounting/journal-entry/journal-entries.controller';
import { ReportsController } from '@presentation/http/accounting/reports/reports.controller';
import { StockCardsController } from '@presentation/http/inventory/report/stock-cards.controller';
import { TenancyModule } from '@composition/tenancy.module';

@Module({
  imports: [IdentityModule, CatalogModule, TenancyModule],
  controllers: [InventoryDocumentsController, InventoryIssuesController, InventoryTransfersController, StockCardsController, ReportsController, ImportsController, JournalEntriesController],
  providers: [
    ConfirmDocumentUseCase,
    VoidDocumentUseCase,
    IssueStockUseCase,
    TransferStockUseCase,
    ReadStockCardUseCase,
    DashboardUseCase,
    ReadReportsUseCase,
    CreateJournalEntryUseCase,
    ListJournalEntriesUseCase,
    VoidJournalEntryUseCase,
    ImportCatalogUseCase,
    ImportCountUseCase,
    { provide: LEDGER_PORT, useFactory: ledgerRepository },
    { provide: JOURNAL_ENTRY_PORT, useFactory: journalEntryRepository },
    { provide: IMPORT_TRANSACTION_PORT, useFactory: importTransaction },
  ],
  exports: [
    LEDGER_PORT,
    ConfirmDocumentUseCase,
    VoidDocumentUseCase,
    IssueStockUseCase,
    TransferStockUseCase,
    ReadStockCardUseCase,
    DashboardUseCase,
    ReadReportsUseCase,
    CreateJournalEntryUseCase,
    ListJournalEntriesUseCase,
    VoidJournalEntryUseCase,
    ImportCatalogUseCase,
    ImportCountUseCase,
  ],
})
export class InventoryModule {}

function ledgerRepository(): InMemoryInventoryLedger | PostgresInventoryLedgerRepository {
  if (!usePostgres(process.env)) return new InMemoryInventoryLedger();
  return new PostgresInventoryLedgerRepository(createTypeOrmExecutor(process.env));
}

function journalEntryRepository(): InMemoryJournalEntryRepository | PostgresJournalEntryRepository {
  if (!usePostgres(process.env)) return new InMemoryJournalEntryRepository();
  return new PostgresJournalEntryRepository(createTypeOrmExecutor(process.env));
}

function importTransaction(): ImportTransactionPort {
  if (!usePostgres(process.env)) return new InMemoryImportTransactionRepository();
  return new PostgresImportTransactionRepository(createTypeOrmExecutor(process.env));
}
