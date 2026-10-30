import { IssueSandboxFiscalDocumentUseCase } from '@application/documents/fiscal/issue-sandbox-fiscal-document.use-case';
import { ListFiscalDocumentsUseCase } from '@application/documents/fiscal/list-fiscal-documents.use-case';
import { ListEligibleSandboxSalesUseCase } from '@application/documents/fiscal/list-eligible-sandbox-sales.use-case';
import { ReadFiscalDocumentUseCase } from '@application/documents/fiscal/read-fiscal-document.use-case';
import { FISCAL_DOCUMENT_PORT } from '@domain/documents/fiscal/fiscal-document.port';
import { InMemoryFiscalDocumentRepository } from '@infrastructure/documents/fiscal/in-memory/in-memory-fiscal-document.repository';
import { PostgresFiscalDocumentRepository } from '@infrastructure/documents/fiscal/postgres/postgres-fiscal-document.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { Module } from '@nestjs/common';
import { CatalogModule } from '@composition/catalog.module';
import { IdentityModule } from '@composition/identity.module';
import { InventoryModule } from '@composition/inventory.module';
import { FiscalDocumentsController } from '@presentation/http/documents/fiscal/fiscal-documents.controller';

@Module({
  imports: [IdentityModule, InventoryModule, CatalogModule],
  controllers: [FiscalDocumentsController],
  providers: [
    IssueSandboxFiscalDocumentUseCase,
    ListFiscalDocumentsUseCase,
    ListEligibleSandboxSalesUseCase,
    ReadFiscalDocumentUseCase,
    { provide: FISCAL_DOCUMENT_PORT, useFactory: fiscalDocumentRepository },
  ],
  exports: [FISCAL_DOCUMENT_PORT],
})
export class FiscalModule {}

function fiscalDocumentRepository(): InMemoryFiscalDocumentRepository | PostgresFiscalDocumentRepository {
  if (!usePostgres(process.env)) return new InMemoryFiscalDocumentRepository();
  return new PostgresFiscalDocumentRepository(createTypeOrmExecutor(process.env));
}
