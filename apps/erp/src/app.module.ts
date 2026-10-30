import { Module } from '@nestjs/common';
import { CatalogModule } from '@composition/catalog.module';
import { DocumentsModule } from '@composition/documents.module';
import { FiscalModule } from '@composition/fiscal.module';
import { HealthModule } from '@composition/health.module';
import { InventoryModule } from '@composition/inventory.module';
import { TenancyModule } from '@composition/tenancy.module';
import { WorkspaceModule } from '@composition/workspace.module';
import { BusinessDocumentsModule } from '@composition/business-documents.module';
import { PaymentSettingsModule } from '@composition/payment-settings.module';
import { CompanyControlsModule } from '@composition/company-controls.module';

@Module({
  imports: [HealthModule.forService('erp'), TenancyModule, CatalogModule, InventoryModule, DocumentsModule, BusinessDocumentsModule, FiscalModule, WorkspaceModule, PaymentSettingsModule, CompanyControlsModule],
})
export class AppModule {}
