import { Module } from '@nestjs/common';
import { CatalogModule } from '@composition/catalog.module';
import { DocumentsModule } from '@composition/documents.module';
import { HealthModule } from '@composition/health.module';
import { InventoryModule } from '@composition/inventory.module';
import { TenancyModule } from '@composition/tenancy.module';
import { WorkspaceModule } from '@composition/workspace.module';

@Module({
  imports: [HealthModule.forService('erp'), TenancyModule, CatalogModule, InventoryModule, DocumentsModule, WorkspaceModule],
})
export class AppModule {}
