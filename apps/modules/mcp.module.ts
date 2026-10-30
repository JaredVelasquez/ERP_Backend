import { ReceiveEntryUseCase } from '@application/accounting/account/receive-entry.use-case';
import { ReadReportsUseCase } from '@application/accounting/reports/read-reports.use-case';
import { CreateJournalEntryUseCase } from '@application/accounting/journal-entry/create-journal-entry.use-case';
import { ListJournalEntriesUseCase } from '@application/accounting/journal-entry/list-journal-entries.use-case';
import { VoidJournalEntryUseCase } from '@application/accounting/journal-entry/void-journal-entry.use-case';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';
import { UpdateAccountUseCase } from '@application/accounting/account/update-account.use-case';
import { ConfirmVoucherUseCase, LinkVoucherUseCase } from '@application/documents/voucher/confirm-voucher.use-case';
import { VoucherVoidApprovalUseCase } from '@application/documents/voucher/voucher-void-approval.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase } from '@application/documents/voucher/save-voucher.use-case';
import { LoginUseCase } from '@application/identity/session/login.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/membership/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import { DesignatePriceApproverUseCase, ListCommercialPricesUseCase, ListCommercialPriceHistoryUseCase, ListPriceProposalsUseCase, ProposePriceUseCase, ReadPriceSettingsUseCase, ResolvePriceProposalUseCase, SetDirectPriceUseCase } from '@application/inventory/catalog/pricing/price-workflow.use-cases';
import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { CreateProductUseCase } from '@application/inventory/catalog/product/create-product.use-case';
import { DashboardUseCase } from '@application/inventory/stock/dashboard/dashboard.use-case';
import { ImportCatalogUseCase } from '@application/inventory/catalog/import/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/catalog/import/import-count.use-case';
import { IssueStockUseCase } from '@application/inventory/stock/issue/issue-stock.use-case';
import { TransferStockUseCase } from '@application/inventory/stock/transfer/transfer-stock.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/catalog/barcode-sheet/preview-barcode.use-case';
import { ReadStockCardUseCase } from '@application/inventory/stock/report/read-stock-card.use-case';
import { RenderBarcodeSheetUseCase } from '@application/inventory/catalog/barcode-sheet/render-barcode-sheet.use-case';
import { SearchProductsByNameUseCase } from '@application/inventory/catalog/product/search-products-by-name.use-case';
import { ReadProductUseCase } from '@application/inventory/catalog/product/read-product.use-case';
import { VoidDocumentUseCase } from '@application/inventory/stock/document/void-document.use-case';
import { InvokeMcpToolUseCase } from '@application/mcp/integration/invoke-mcp-tool.use-case';
import { AssistantChatUseCase } from '@application/mcp/integration/assistant-chat.use-case';
import { ListAssistantConversationsUseCase } from '@application/mcp/conversation/list-assistant-conversations.use-case';
import { ReadAssistantConversationUseCase } from '@application/mcp/conversation/read-assistant-conversation.use-case';
import { ManageMcpTokensUseCase } from '@application/mcp/integration/manage-mcp-tokens.use-case';
import { CreateCompanyUseCase } from '@application/tenancy/company/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/company/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/company/create-tenant.use-case';
import { MCP_AUDIT_PORT, MCP_TOKEN_PORT, MCP_TOOL_HANDLERS, type McpTokenPort } from '@domain/mcp/integration/mcp.port';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import { InMemoryMcpRepository } from '@infrastructure/integration/mcp/in-memory/in-memory-mcp.repository';
import { PostgresMcpRepository } from '@infrastructure/integration/mcp/postgres/postgres-mcp.repository';
import { CompanyAiSettings } from '@infrastructure/assistant/settings/postgres/company-ai-settings';
import { AssistantConversationRepository } from '@infrastructure/assistant/conversation/postgres/assistant-conversation.repository';
import { InMemoryAssistantConversationRepository } from '@infrastructure/assistant/conversation/in-memory/in-memory-assistant-conversation.repository';
import { ASSISTANT_CONVERSATION_PORT } from '@domain/mcp/assistant/conversation.port';
import { AI_SETTINGS_PORT } from '@domain/mcp/assistant/ai-settings.port';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { Module } from '@nestjs/common';
import { buildMcpTools } from '@presentation/http/mcp/integration/mcp-tools';
import { McpController } from '@presentation/http/mcp/integration/mcp.controller';
import { CatalogModule } from '@composition/catalog.module';
import { DocumentsModule } from '@composition/documents.module';
import { IdentityModule } from '@composition/identity.module';
import { InventoryModule } from '@composition/inventory.module';
import { TenancyModule } from '@composition/tenancy.module';
import { WorkspaceModule } from '@composition/workspace.module';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/preferences/dashboard-layout.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase } from '@application/workspace/preferences/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase } from '@application/workspace/preferences/ui-preferences.use-case';

@Module({
  imports: [IdentityModule, TenancyModule, CatalogModule, InventoryModule, DocumentsModule, WorkspaceModule],
  controllers: [McpController],
  providers: [
    InvokeMcpToolUseCase,
    AssistantChatUseCase,
    ListAssistantConversationsUseCase,
    ReadAssistantConversationUseCase,
    { provide: ASSISTANT_CONVERSATION_PORT, useFactory: () => usePostgres(process.env)
      ? new AssistantConversationRepository(createTypeOrmExecutor(process.env)) : new InMemoryAssistantConversationRepository() },
    { provide: AI_SETTINGS_PORT, useClass: CompanyAiSettings },
    ManageMcpTokensUseCase,
    { provide: MCP_AUDIT_PORT, useFactory: () => usePostgres(process.env)
      ? new PostgresMcpRepository(createTypeOrmExecutor(process.env)) : new InMemoryMcpRepository() },
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
        readReports: ReadReportsUseCase,
        createJournalEntry: CreateJournalEntryUseCase,
        listJournalEntries: ListJournalEntriesUseCase,
        voidJournalEntry: VoidJournalEntryUseCase,
        receiveEntry: ReceiveEntryUseCase,
        updateAccount: UpdateAccountUseCase,
        createProduct: CreateProductUseCase,
        previewBarcode: PreviewBarcodeUseCase,
        renderBarcodeSheet: RenderBarcodeSheetUseCase,
        searchProducts: SearchProductsByNameUseCase,
        readProduct: ReadProductUseCase,
        readStockCard: ReadStockCardUseCase,
        issueStock: IssueStockUseCase,
        transferStock: TransferStockUseCase,
        listPrices: ListCommercialPricesUseCase,
        listPriceProposals: ListPriceProposalsUseCase,
        listCommercialPriceHistory: ListCommercialPriceHistoryUseCase,
        proposePrice: ProposePriceUseCase,
        setDirectPrice: SetDirectPriceUseCase,
        aiSettings: import('@domain/mcp/assistant/ai-settings.port').AiSettingsPort,
        resolvePriceProposal: ResolvePriceProposalUseCase,
        readPriceSettings: ReadPriceSettingsUseCase,
        designatePriceApprover: DesignatePriceApproverUseCase,
        confirmDocument: ConfirmDocumentUseCase,
        voidDocument: VoidDocumentUseCase,
        dashboard: DashboardUseCase,
        importCatalog: ImportCatalogUseCase,
        importCount: ImportCountUseCase,
        saveVoucher: SaveVoucherUseCase,
        confirmVoucher: ConfirmVoucherUseCase,
        linkVoucher: LinkVoucherUseCase,
        voucherVoidApproval: VoucherVoidApprovalUseCase,
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
          readReports,
          createJournalEntry,
          listJournalEntries,
          voidJournalEntry,
          receiveEntry,
          updateAccount,
          createProduct,
          previewBarcode,
          renderBarcodeSheet,
          searchProducts,
          readProduct,
          readStockCard,
          issueStock,
          transferStock,
          listPrices,
          listPriceProposals,
          listCommercialPriceHistory,
          proposePrice,
          setDirectPrice,
          aiSettings,
          resolvePriceProposal,
          readPriceSettings,
          designatePriceApprover,
          confirmDocument,
          voidDocument,
          dashboard,
          importCatalog,
          importCount,
          saveVoucher,
          confirmVoucher,
          linkVoucher,
          voucherVoidApproval,
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
        ReadReportsUseCase,
        CreateJournalEntryUseCase,
        ListJournalEntriesUseCase,
        VoidJournalEntryUseCase,
        ReceiveEntryUseCase,
        UpdateAccountUseCase,
        CreateProductUseCase,
        PreviewBarcodeUseCase,
        RenderBarcodeSheetUseCase,
        SearchProductsByNameUseCase,
        ReadProductUseCase,
        ReadStockCardUseCase,
        IssueStockUseCase,
        TransferStockUseCase,
        ListCommercialPricesUseCase,
        ListPriceProposalsUseCase,
        ListCommercialPriceHistoryUseCase,
        ProposePriceUseCase,
        SetDirectPriceUseCase,
        AI_SETTINGS_PORT,
        ResolvePriceProposalUseCase,
        ReadPriceSettingsUseCase,
        DesignatePriceApproverUseCase,
        ConfirmDocumentUseCase,
        VoidDocumentUseCase,
        DashboardUseCase,
        ImportCatalogUseCase,
        ImportCountUseCase,
        SaveVoucherUseCase,
        ConfirmVoucherUseCase,
        LinkVoucherUseCase,
        VoucherVoidApprovalUseCase,
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
