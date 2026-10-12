import { Module } from '@nestjs/common';
import { CatalogModule } from '@presentation/http/catalog.module';
import { DocumentsModule } from '@presentation/http/documents.module';
import { HealthModule } from '@presentation/http/health.module';
import { InventoryModule } from '@presentation/http/inventory.module';
import { TenancyModule } from '@presentation/http/tenancy.module';
import { WorkspaceModule } from '@presentation/http/workspace.module';

@Module({
  imports: [HealthModule.forService('erp'), TenancyModule, CatalogModule, InventoryModule, DocumentsModule, WorkspaceModule],
})
export class AppModule {}
