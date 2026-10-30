import { CreateBusinessDocumentUseCase } from '@application/documents/business-document/create-business-document.use-case';
import { ListBusinessDocumentsUseCase } from '@application/documents/business-document/list-business-documents.use-case';
import { ListDocumentTemplatesUseCase } from '@application/documents/document-template/list-document-templates.use-case';
import { PublishDocumentTemplateUseCase } from '@application/documents/document-template/publish-document-template.use-case';
import { SaveDocumentTemplateUseCase } from '@application/documents/document-template/save-document-template.use-case';
import { BUSINESS_DOCUMENT_PORT } from '@domain/documents/business-document/business-document.port';
import { DOCUMENT_TEMPLATE_PORT } from '@domain/documents/document-template/document-template.port';
import { InMemoryBusinessDocumentRepository } from '@infrastructure/documents/business-document/in-memory/in-memory-business-document.repository';
import { PostgresBusinessDocumentRepository } from '@infrastructure/documents/business-document/postgres/postgres-business-document.repository';
import { InMemoryDocumentTemplateRepository } from '@infrastructure/documents/document-template/in-memory/in-memory-document-template.repository';
import { PostgresDocumentTemplateRepository } from '@infrastructure/documents/document-template/postgres/postgres-document-template.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@composition/identity.module';
import { TenancyModule } from '@composition/tenancy.module';
import { CatalogModule } from '@composition/catalog.module';
import { FiscalModule } from '@composition/fiscal.module';
import { BusinessDocumentsController } from '@presentation/http/documents/document-center/business-documents.controller';
import { DocumentTemplatesController } from '@presentation/http/documents/document-center/document-templates.controller';

@Module({
  imports: [IdentityModule, TenancyModule, CatalogModule, FiscalModule],
  controllers: [BusinessDocumentsController, DocumentTemplatesController],
  providers: [
    CreateBusinessDocumentUseCase,
    ListBusinessDocumentsUseCase,
    ListDocumentTemplatesUseCase,
    PublishDocumentTemplateUseCase,
    SaveDocumentTemplateUseCase,
    { provide: BUSINESS_DOCUMENT_PORT, useFactory: businessDocumentRepository },
    { provide: DOCUMENT_TEMPLATE_PORT, useFactory: documentTemplateRepository },
  ],
})
export class BusinessDocumentsModule {}

function businessDocumentRepository(): InMemoryBusinessDocumentRepository | PostgresBusinessDocumentRepository {
  if (!usePostgres(process.env)) return new InMemoryBusinessDocumentRepository();
  return new PostgresBusinessDocumentRepository(createTypeOrmExecutor(process.env));
}

function documentTemplateRepository(): InMemoryDocumentTemplateRepository | PostgresDocumentTemplateRepository {
  if (!usePostgres(process.env)) return new InMemoryDocumentTemplateRepository();
  return new PostgresDocumentTemplateRepository(createTypeOrmExecutor(process.env));
}
