import { ReceiveEntryUseCase } from '@application/accounting/receive-entry.use-case';
import { SeedChartUseCase } from '@application/accounting/seed-chart.use-case';
import { UpdateAccountUseCase } from '@application/accounting/update-account.use-case';
import { ConfirmVoucherUseCase, LinkVoucherUseCase, VoidVoucherUseCase } from '@application/documents/confirm-voucher.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase } from '@application/documents/save-voucher.use-case';
import { LoginUseCase } from '@application/identity/login.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/register-user.use-case';
import { ApplyMarginUseCase } from '@application/inventory/apply-margin.use-case';
import { ChangePriceUseCase } from '@application/inventory/change-price.use-case';
import { ConfirmDocumentUseCase } from '@application/inventory/confirm-document.use-case';
import { CreateProductUseCase } from '@application/inventory/create-product.use-case';
import { DashboardUseCase } from '@application/inventory/dashboard.use-case';
import { ImportCatalogUseCase } from '@application/inventory/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/import-count.use-case';
import { IssueStockUseCase } from '@application/inventory/issue-stock.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/preview-barcode.use-case';
import { ReadStockCardUseCase } from '@application/inventory/read-stock-card.use-case';
import { RenderBarcodeSheetUseCase } from '@application/inventory/render-barcode-sheet.use-case';
import { SearchProductsByNameUseCase } from '@application/inventory/search-products-by-name.use-case';
import { VoidDocumentUseCase } from '@application/inventory/void-document.use-case';
import { InvokeMcpToolUseCase } from '@application/mcp/invoke-mcp-tool.use-case';
import { CreateCompanyUseCase } from '@application/tenancy/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/create-tenant.use-case';
import { MCP_AUDIT_PORT, MCP_TOKEN_PORT, MCP_TOOL_HANDLERS, type McpTokenPort } from '@domain/mcp/mcp.port';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company.port';
import { InMemoryMcpRepository } from '@infrastructure/mcp/in-memory-mcp.repository';
import { Module } from '@nestjs/common';
import { buildMcpTools } from '@presentation/http/mcp-tools';
import { McpController } from '@presentation/http/mcp.controller';
import { CatalogModule } from '@presentation/http/catalog.module';
import { DocumentsModule } from '@presentation/http/documents.module';
import { IdentityModule } from '@presentation/http/identity.module';
import { InventoryModule } from '@presentation/http/inventory.module';
import { TenancyModule } from '@presentation/http/tenancy.module';
import { WorkspaceModule } from '@presentation/http/workspace.module';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/dashboard-layout.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase } from '@application/workspace/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase } from '@application/workspace/ui-preferences.use-case';

@Module({
  imports: [IdentityModule, TenancyModule, CatalogModule, InventoryModule, DocumentsModule, WorkspaceModule],
  controllers: [McpController],
  providers: [
    InvokeMcpToolUseCase,
    { provide: MCP_AUDIT_PORT, useClass: InMemoryMcpRepository },
    { provide: MCP_TOKEN_PORT, useExisting: MCP_AUDIT_PORT },
    {
      provide: MCP_TOOL_HANDLERS,
      useFactory: (
        registerUser: RegisterUserUseCase,
        loginUser: LoginUseCase,
        replaceModules: ReplaceModuleGrantsUseCase,
        createTenant: CreateTenantUseCase,
        createSociety: CreateSocietyUseCase,
        createCompany: CreateCompanyUseCase,
        seedChart: SeedChartUseCase,
        receiveEntry: ReceiveEntryUseCase,
        updateAccount: UpdateAccountUseCase,
        createProduct: CreateProductUseCase,
        previewBarcode: PreviewBarcodeUseCase,
        renderBarcodeSheet: RenderBarcodeSheetUseCase,
        searchProducts: SearchProductsByNameUseCase,
        readStockCard: ReadStockCardUseCase,
        issueStock: IssueStockUseCase,
        changePrice: ChangePriceUseCase,
        applyMargin: ApplyMarginUseCase,
        confirmDocument: ConfirmDocumentUseCase,
        voidDocument: VoidDocumentUseCase,
        dashboard: DashboardUseCase,
        importCatalog: ImportCatalogUseCase,
        importCount: ImportCountUseCase,
        saveVoucher: SaveVoucherUseCase,
        confirmVoucher: ConfirmVoucherUseCase,
        linkVoucher: LinkVoucherUseCase,
        voidVoucher: VoidVoucherUseCase,
        downloadVoucher: DownloadVoucherUseCase,
        companies: CompanyPort,
        tokens: McpTokenPort,
        readTableLayout: ReadTableLayoutUseCase,
        saveTableLayout: SaveTableLayoutUseCase,
        readDashboardLayout: ReadDashboardLayoutUseCase,
        saveDashboardLayout: SaveDashboardLayoutUseCase,
        readUiPreferences: ReadUiPreferencesUseCase,
        saveUiPreferences: SaveUiPreferencesUseCase,
      ) =>
        buildMcpTools({
          registerUser,
          loginUser,
          replaceModules,
          createTenant,
          createSociety,
          createCompany,
          seedChart,
          receiveEntry,
          updateAccount,
          createProduct,
          previewBarcode,
          renderBarcodeSheet,
          searchProducts,
          readStockCard,
          issueStock,
          changePrice,
          applyMargin,
          confirmDocument,
          voidDocument,
          dashboard,
          importCatalog,
          importCount,
          saveVoucher,
          confirmVoucher,
          linkVoucher,
          voidVoucher,
          downloadVoucher,
          companies,
          tokens,
          readTableLayout,
          saveTableLayout,
          readDashboardLayout,
          saveDashboardLayout,
          readUiPreferences,
          saveUiPreferences,
        }),
      inject: [
        RegisterUserUseCase,
        LoginUseCase,
        ReplaceModuleGrantsUseCase,
        CreateTenantUseCase,
        CreateSocietyUseCase,
        CreateCompanyUseCase,
        SeedChartUseCase,
        ReceiveEntryUseCase,
        UpdateAccountUseCase,
        CreateProductUseCase,
        PreviewBarcodeUseCase,
        RenderBarcodeSheetUseCase,
        SearchProductsByNameUseCase,
        ReadStockCardUseCase,
        IssueStockUseCase,
        ChangePriceUseCase,
        ApplyMarginUseCase,
        ConfirmDocumentUseCase,
        VoidDocumentUseCase,
        DashboardUseCase,
        ImportCatalogUseCase,
        ImportCountUseCase,
        SaveVoucherUseCase,
        ConfirmVoucherUseCase,
        LinkVoucherUseCase,
        VoidVoucherUseCase,
        DownloadVoucherUseCase,
        COMPANY_PORT,
        MCP_TOKEN_PORT,
        ReadTableLayoutUseCase,
        SaveTableLayoutUseCase,
        ReadDashboardLayoutUseCase,
        SaveDashboardLayoutUseCase,
        ReadUiPreferencesUseCase,
        SaveUiPreferencesUseCase,
      ],
    },
  ],
  exports: [MCP_AUDIT_PORT, MCP_TOKEN_PORT],
})
export class McpModule {}
