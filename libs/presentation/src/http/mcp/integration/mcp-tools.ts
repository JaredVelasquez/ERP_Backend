import { randomUUID } from 'node:crypto';
import { ReceiveEntryUseCase } from '@application/accounting/account/receive-entry.use-case';
import { CreateJournalEntryUseCase } from '@application/accounting/journal-entry/create-journal-entry.use-case';
import { ListJournalEntriesUseCase } from '@application/accounting/journal-entry/list-journal-entries.use-case';
import { VoidJournalEntryUseCase } from '@application/accounting/journal-entry/void-journal-entry.use-case';
import { ReadReportsUseCase } from '@application/accounting/reports/read-reports.use-case';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';
import { UpdateAccountUseCase } from '@application/accounting/account/update-account.use-case';
import { ConfirmVoucherUseCase, LinkVoucherUseCase } from '@application/documents/voucher/confirm-voucher.use-case';
import { VoucherVoidApprovalUseCase } from '@application/documents/voucher/voucher-void-approval.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase } from '@application/documents/voucher/save-voucher.use-case';
import { LoginUseCase } from '@application/identity/session/login.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/membership/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import { DesignatePriceApproverUseCase, ListCommercialPricesUseCase, ListCommercialPriceHistoryUseCase, ListPriceProposalsUseCase, ProposePriceUseCase, ReadPriceSettingsUseCase, ResolvePriceProposalUseCase, SetDirectPriceUseCase } from '@application/inventory/catalog/pricing/price-workflow.use-cases';
import type { AiSettingsPort } from '@domain/mcp/assistant/ai-settings.port';
import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { CreateProductUseCase } from '@application/inventory/catalog/product/create-product.use-case';
import { DashboardUseCase } from '@application/inventory/stock/dashboard/dashboard.use-case';
import { ImportCatalogUseCase } from '@application/inventory/catalog/import/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/catalog/import/import-count.use-case';
import { IssueStockUseCase } from '@application/inventory/stock/issue/issue-stock.use-case';
import { PreviewBarcodeUseCase } from '@application/inventory/catalog/barcode-sheet/preview-barcode.use-case';
import { ReadStockCardUseCase } from '@application/inventory/stock/report/read-stock-card.use-case';
import { RenderBarcodeSheetUseCase } from '@application/inventory/catalog/barcode-sheet/render-barcode-sheet.use-case';
import { SearchProductsByNameUseCase } from '@application/inventory/catalog/product/search-products-by-name.use-case';
import { ReadProductUseCase } from '@application/inventory/catalog/product/read-product.use-case';
import { VoidDocumentUseCase } from '@application/inventory/stock/document/void-document.use-case';
import type { McpToolHandler, JsonRecord } from '@application/mcp/integration/invoke-mcp-tool.use-case';
import { analyzeMcpMedia } from '@application/mcp/integration/assistant-chat.use-case';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@domain/identity/membership/access';
import { ModulePermissionError, PermissionDeniedError, type ModuleGrant } from '@domain/identity/membership/module-access';
import { DocumentError, type DocumentKind, type DocumentLine, type DraftDocument } from '@domain/inventory/stock/document/document';
import type { IssueLineRequest } from '@domain/inventory/stock/issue/issue-draft';
import type { Presentation } from '@domain/inventory/catalog/product/product';
import { SERVICE_TYPES, type ServiceType } from '@domain/documents/voucher/voucher';
import { catalogTemplate, countTemplate } from '@domain/inventory/catalog/import/spreadsheet';
import { McpError } from '@domain/mcp/tool-catalog/tool-catalog';
import type { McpTokenPort } from '@domain/mcp/integration/mcp.port';
import type { SessionRecord } from '@domain/identity/session/session.port';
import type { CompanyPort } from '@domain/tenancy/company/company.port';
import type { CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { CreateCompanyUseCase } from '@application/tenancy/company/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/company/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/company/create-tenant.use-case';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/preferences/dashboard-layout.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase } from '@application/workspace/preferences/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase } from '@application/workspace/preferences/ui-preferences.use-case';
import { DASHBOARD_CHART_TYPES, type ColumnSetting, type DashboardChartType, type WidgetSetting } from '@domain/workspace/layout/layout';
import type { JournalEntryLine } from '@domain/accounting/journal-entry/journal-entry';

export interface McpToolDeps {
  registerUser: RegisterUserUseCase;
  loginUser: LoginUseCase;
  replaceModules: ReplaceModuleGrantsUseCase;
  createTenant: CreateTenantUseCase;
  createSociety: CreateSocietyUseCase;
  createCompany: CreateCompanyUseCase;
  seedChart: SeedChartUseCase;
  readReports: ReadReportsUseCase;
  createJournalEntry: CreateJournalEntryUseCase;
  listJournalEntries: ListJournalEntriesUseCase;
  voidJournalEntry: VoidJournalEntryUseCase;
  receiveEntry: ReceiveEntryUseCase;
  updateAccount: UpdateAccountUseCase;
  createProduct: CreateProductUseCase;
  previewBarcode: PreviewBarcodeUseCase;
  renderBarcodeSheet: RenderBarcodeSheetUseCase;
  searchProducts: SearchProductsByNameUseCase;
  readProduct: ReadProductUseCase;
  readStockCard: ReadStockCardUseCase;
  issueStock: IssueStockUseCase;
  listPrices: ListCommercialPricesUseCase;
  listPriceProposals: ListPriceProposalsUseCase;
  listCommercialPriceHistory: ListCommercialPriceHistoryUseCase;
  proposePrice: ProposePriceUseCase;
  setDirectPrice?: SetDirectPriceUseCase;
  aiSettings?: AiSettingsPort;
  resolvePriceProposal: ResolvePriceProposalUseCase;
  readPriceSettings: ReadPriceSettingsUseCase;
  designatePriceApprover: DesignatePriceApproverUseCase;
  confirmDocument: ConfirmDocumentUseCase;
  voidDocument: VoidDocumentUseCase;
  dashboard: DashboardUseCase;
  importCatalog: ImportCatalogUseCase;
  importCount: ImportCountUseCase;
  saveVoucher: SaveVoucherUseCase;
  confirmVoucher: ConfirmVoucherUseCase;
  linkVoucher: LinkVoucherUseCase;
  voucherVoidApproval: VoucherVoidApprovalUseCase;
  downloadVoucher: DownloadVoucherUseCase;
  companies: CompanyPort;
  tokens: McpTokenPort;
  readTableLayout: ReadTableLayoutUseCase;
  saveTableLayout: SaveTableLayoutUseCase;
  readDashboardLayout: ReadDashboardLayoutUseCase;
  saveDashboardLayout: SaveDashboardLayoutUseCase;
  readUiPreferences: ReadUiPreferencesUseCase;
  saveUiPreferences: SaveUiPreferencesUseCase;
}

export function buildMcpTools(deps: McpToolDeps): McpToolHandler[] {
  return [
    tool('register-user', 'session', null, 'edit', async (session, input) => {
      const actor = requireSession(session);
      if (actor.role !== 'owner' || readRole(input.role) !== 'operator') {
        throw new PermissionDeniedError();
      }
      return {
      ...(await deps.registerUser.execute({
        email: text(input, 'email'),
        password: text(input, 'password'),
        displayName: text(input, 'displayName'),
        companyId: actor.companyId,
        role: 'operator',
      })),
      companyId: actor.companyId,
    };
    }),
    tool('replace-modules', 'session', null, 'edit', async (session, input) => {
      const current = requireSession(session);
      return deps.replaceModules.execute({
        token: current.token,
        userId: text(input, 'userId'),
        companyId: current.companyId,
        grants: readGrantList(input.grants),
      });
    }),
    tool('create-tenant', 'session', 'platform', 'edit', async (_session, input) => deps.createTenant.execute(text(input, 'name'))),
    tool('create-society', 'session', 'platform', 'edit', async (_session, input) =>
      deps.createSociety.execute({ tenantId: text(input, 'tenantId'), name: text(input, 'name') }),
    ),
    tool('create-company', 'session', 'platform', 'edit', async (_session, input) => deps.createCompany.execute(readCompany(input))),
    tool('list-accounts', 'session', 'accounting', 'view', async (session) => ({
      accounts: await deps.seedChart.execute(requireSession(session).companyId),
    })),
    tool('list-journal-entries', 'session', 'accounting', 'view', async (session) => ({
      entries: await deps.listJournalEntries.execute(requireSession(session).companyId),
    })),
    tool('post-journal-entry', 'session', 'accounting', 'edit', async (session, input) => {
      const actor = requireSession(session);
      return { entry: await deps.createJournalEntry.execute({
        companyId: actor.companyId,
        createdBy: actor.userId,
        occurredAt: text(input, 'occurredAt'),
        description: text(input, 'description'),
        idempotencyKey: text(input, 'idempotencyKey'),
        lines: readJournalLines(input.lines),
      }) };
    }),
    tool('void-journal-entry', 'session', 'accounting', 'edit', async (session, input) => {
      const actor = requireSession(session);
      return deps.voidJournalEntry.execute(actor.companyId, text(input, 'entryId'), actor.userId);
    }),
    tool('sales-report', 'session', 'accounting', 'view', async (session, input) =>
      deps.readReports.sales(requireSession(session).companyId, text(input, 'from'), text(input, 'to')),
    ),
    tool('financial-report', 'session', 'accounting', 'view', async (session, input) =>
      deps.readReports.financial(requireSession(session).companyId, text(input, 'from'), text(input, 'to')),
    ),
    tool('post-entry', 'session', 'accounting', 'edit', async (session, input) =>
      deps.receiveEntry.execute(requireSession(session).companyId, text(input, 'code')),
    ),
    tool('update-account', 'session', 'accounting', 'edit', async (session, input) => ({
      account: await deps.updateAccount.execute({
        companyId: requireSession(session).companyId,
        code: text(input, 'code'),
        name: text(input, 'name'),
        collection: input.collection === true,
      }),
    })),
    tool('create-product', 'session', 'products', 'edit', async (session, input) => {
      const actor = requireSession(session);
      const product = readProduct(actor.companyId, input);
      return { product: await deps.createProduct.execute(product, actor) };
    }),
    tool('preview-barcode', 'session', 'products', 'view', async (session, input) =>
      deps.previewBarcode.execute(requireSession(session).companyId, text(input, 'productId')),
    ),
    tool('render-barcode-sheet', 'session', 'products', 'view', async (session, input) => {
      const pdf = await deps.renderBarcodeSheet.execute(requireSession(session).companyId, readIdList(input.productIds));
      return { pdfBase64: pdf.toString('base64') };
    }),
    tool('search-products-by-name', 'session', 'products', 'view', async (session, input) => ({
      products: await deps.searchProducts.execute(requireSession(session).companyId, text(input, 'query')),
    })),
    tool('read-product', 'session', 'products', 'view', async (session, input) => ({
      product: await deps.readProduct.execute(requireSession(session).companyId, text(input, 'productId')),
    })),
    tool('read-stock-card', 'session', 'inventory', 'view', async (session, input) => ({
      card: await deps.readStockCard.execute({
        companyId: requireSession(session).companyId,
        productId: optionalText(input.productId) ?? '',
        code: optionalText(input.code) ?? '',
        grants: requireSession(session).grants,
      }),
    })),
    tool('analyze-media', 'session', 'inventory', 'view', async (session, input) => {
      const current = requireSession(session);
      return analyzeMcpMedia(text(input, 'prompt'), input.images, await deps.aiSettings?.credentials(current.companyId));
    }),
    tool('issue-stock', 'session', 'inventory', 'edit', async (session, input) => issueStock(deps, requireSession(session).companyId, input)),
    tool('list-commercial-prices', 'session', 'prices', 'view', async (session, input) =>
      deps.listPrices.execute(requireSession(session).companyId, numberValue(input, 'page'), numberValue(input, 'pageSize'), optionalText(input.search) ?? ''),
    ),
    tool('list-price-proposals', 'session', 'prices', 'view', async (session) => ({
      items: await deps.listPriceProposals.execute(requireSession(session).companyId),
    })),
    tool('list-commercial-price-history', 'session', 'prices', 'view', async (session) => ({
      items: await deps.listCommercialPriceHistory.execute(requireSession(session).companyId),
    })),
    tool('propose-price', 'session', 'prices', 'view', async (session, input) => ({
      proposal: await deps.proposePrice.execute(requireSession(session), {
        productId: text(input, 'productId'), unit: text(input, 'unit'),
        proposedPrice: numberValue(input, 'proposedPrice'), reason: text(input, 'reason'),
      }),
    })),
    tool('set-direct-price', 'session', 'prices', 'view', async (session, input) => {
      if (!deps.setDirectPrice) throw new McpError('Cambio directo no disponible.');
      await deps.setDirectPrice.execute(requireSession(session), {
        productId: text(input, 'productId'), unit: text(input, 'unit'), price: numberValue(input, 'price'), reason: text(input, 'reason'),
      });
      return { changed: true };
    }),
    tool('approve-price-proposal', 'session', 'prices', 'view', async (session, input) => ({
      proposal: await deps.resolvePriceProposal.execute(requireSession(session), text(input, 'proposalId'), 'approved', optionalText(input.note) ?? ''),
    })),
    tool('reject-price-proposal', 'session', 'prices', 'view', async (session, input) => ({
      proposal: await deps.resolvePriceProposal.execute(requireSession(session), text(input, 'proposalId'), 'rejected', text(input, 'note')),
    })),
    tool('read-price-settings', 'session', 'prices', 'view', async (session) =>
      deps.readPriceSettings.execute(requireSession(session).companyId),
    ),
    tool('designate-price-approver', 'session', 'prices', 'view', async (session, input) =>
      deps.designatePriceApprover.execute(requireSession(session), optionalText(input.userId)),
    ),
    tool('confirm-document', 'session', 'inventory', 'edit', async (session, input) => confirmInventory(deps, requireSession(session).companyId, input)),
    tool('void-document', 'session', 'inventory', 'edit', async (session, input) => ({
      document: await deps.voidDocument.execute(requireSession(session).companyId, text(input, 'documentId')),
    })),
    tool('dashboard', 'session', 'dashboard', 'view', async (session, input) =>
      deps.dashboard.execute(requireSession(session).companyId, text(input, 'to'), numberValue(input, 'days')),
    ),
    tool('catalog-template', 'session', 'imports', 'view', async () => catalogTemplate()),
    tool('count-template', 'session', 'imports', 'view', async () => countTemplate()),
    tool('import-catalog', 'session', 'imports', 'edit', async (session, input) => importCatalog(deps, requireSession(session), input)),
    tool('import-count', 'session', 'imports', 'edit', async (session, input) =>
      deps.importCount.execute(text(input, 'csv'), requireSession(session).companyId),
    ),
    tool('save-voucher', 'session', 'documents', 'edit', async (session, input) => ({
      voucher: await deps.saveVoucher.execute(readVoucher(requireSession(session).companyId, input)),
    })),
    tool('confirm-voucher', 'session', 'documents', 'edit', async (session, input) => ({
      voucher: await deps.confirmVoucher.execute(requireSession(session).companyId, text(input, 'voucherId')),
    })),
    tool('link-voucher', 'session', 'documents', 'edit', async (session, input) => ({
      voucher: await deps.linkVoucher.execute(requireSession(session).companyId, text(input, 'voucherId'), text(input, 'moneyMovementId')),
    })),
    tool('void-voucher', 'session', 'documents', 'edit', async (session, input) => ({ request: await deps.voucherVoidApproval.request(requireSession(session), text(input, 'voucherId'), text(input, 'reason')) })),
    tool('list-voucher-void-requests', 'session', 'documents', 'view', async (session) => ({ requests: await deps.voucherVoidApproval.list(requireSession(session)) })),
    tool('resolve-voucher-void-request', 'session', 'documents', 'edit', async (session, input) => ({ request: await deps.voucherVoidApproval.resolve(requireSession(session), text(input, 'requestId'), text(input, 'decision') as 'approved' | 'rejected', optionalText(input.note) ?? '') })),
    tool('designate-voucher-void-approver', 'session', 'settings', 'edit', async (session, input) => ({ settings: await deps.voucherVoidApproval.designate(requireSession(session), optionalText(input.userId)) })),
    tool('download-voucher', 'session', 'documents', 'view', async (session, input) => ({
      pdfBase64: (await deps.downloadVoucher.execute(requireSession(session).companyId, text(input, 'voucherId'))).toString('base64'),
    })),
    tool('read-table-layout', 'session', null, 'view', async (session, input) => {
      const current = requireSession(session);
      return deps.readTableLayout.execute(current.companyId, current.userId, current.grants, text(input, 'tableKey'));
    }),
    tool('save-table-layout', 'session', null, 'view', async (session, input) => {
      const current = requireSession(session);
      return deps.saveTableLayout.execute({
        companyId: current.companyId,
        userId: current.userId,
        grants: current.grants,
        tableKey: text(input, 'tableKey'),
        pageSize: numberValue(input, 'pageSize'),
        columns: readColumns(input.columns),
      });
    }),
    tool('read-dashboard-layout', 'session', null, 'view', async (session) => {
      const current = requireSession(session);
      return deps.readDashboardLayout.execute(current.companyId, current.userId, current.grants);
    }),
    tool('save-dashboard-layout', 'session', 'dashboard', 'edit', async (session, input) => {
      const current = requireSession(session);
      return deps.saveDashboardLayout.execute(current.companyId, current.userId, current.role, current.grants, readWidgets(input.widgets));
    }),
    tool('read-ui-preferences', 'session', null, 'view', async (session) => {
      const current = requireSession(session);
      return deps.readUiPreferences.execute(current.companyId, current.userId, current.grants);
    }),
    tool('save-ui-preferences', 'session', null, 'view', async (session, input) => {
      const current = requireSession(session);
      return deps.saveUiPreferences.execute(current.companyId, current.userId, current.grants, readCollapsed(input.sidebarCollapsed));
    }),
  ];
}

function tool(
  name: string,
  audience: McpToolHandler['audience'],
  module: McpToolHandler['module'],
  access: McpToolHandler['access'],
  execute: McpToolHandler['execute'],
): McpToolHandler {
  return { name, audience, module, access, execute };
}

async function issueStock(deps: McpToolDeps, companyId: string, input: JsonRecord): Promise<{ document: unknown }> {
  if (input.type !== undefined || input.collectionAccountCode !== undefined || input.adjustmentDirection !== undefined) {
    throw new DocumentError('Issue does not accept a document type');
  }
  return {
    document: await deps.issueStock.execute({
      companyId,
      idempotencyKey: text(input, 'idempotencyKey'),
      receivedAt: text(input, 'receivedAt'),
      lines: readIssueLines(input.lines),
    }),
  };
}

function readIdList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new McpError('productIds are required');
  }
  return value.map((item) => requireId(item));
}

function requireId(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new McpError('product id is required');
  }
  return value;
}

function readIssueLines(value: unknown): IssueLineRequest[] {
  if (!Array.isArray(value)) {
    throw new DocumentError('Issue needs a line');
  }
  return value.map((item) => readIssueLine(readRecord(item)));
}

function readIssueLine(input: JsonRecord): IssueLineRequest {
  return {
    productId: text(input, 'productId'),
    unit: text(input, 'unit'),
    quantity: numberValue(input, 'quantity'),
  };
}

async function confirmInventory(deps: McpToolDeps, companyId: string, input: JsonRecord): Promise<{ document: unknown }> {
  const company = await deps.companies.findCompany(companyId);
  if (company === null) {
    throw new DocumentError('Company was not found');
  }
  const warehouses = await deps.companies.listWarehouses(companyId);
  const requestedWarehouseId = optionalText(input.warehouseId);
  const warehouse = requestedWarehouseId === null
    ? warehouses.find((item) => item.isDefault && item.active)
    : warehouses.find((item) => item.id === requestedWarehouseId && item.active);
  if (warehouse === undefined) throw new DocumentError('Warehouse was not found or is inactive');
  return {
    document: await deps.confirmDocument.execute({
      draft: { ...documentDraft(input, companyId), warehouseId: warehouse.id },
      companyCostingMethod: company.costingMethod,
      receivedAt: text(input, 'receivedAt'),
    }),
  };
}

async function importCatalog(deps: McpToolDeps, actor: SessionRecord, input: JsonRecord): Promise<{ document: unknown }> {
  const companyId = actor.companyId;
  const settings = await deps.readPriceSettings.execute(companyId);
  if (actor.role !== 'owner' && settings.designatedApproverId !== actor.userId) {
    throw new PermissionDeniedError();
  }
  const company = await deps.companies.findCompany(companyId);
  if (company === null) {
    throw new DocumentError('Company was not found');
  }
  return { document: await deps.importCatalog.execute(text(input, 'csv'), companyId, company.costingMethod, text(input, 'receivedAt')) };
}

function documentDraft(input: JsonRecord, companyId: string): DraftDocument {
  return {
    id: randomUUID(),
    companyId,
    type: readDocumentKind(input.type),
    idempotencyKey: text(input, 'idempotencyKey'),
    paymentAccountCode: optionalText(input.paymentAccountCode),
    collectionAccountCode: optionalText(input.collectionAccountCode),
    adjustmentDirection: readDirection(input.adjustmentDirection),
    transferAmount: typeof input.transferAmount === 'number' ? input.transferAmount : null,
    transferFromAccountCode: optionalText(input.transferFromAccountCode),
    transferToAccountCode: optionalText(input.transferToAccountCode),
    lines: readLines(input.lines),
  };
}

function readProduct(companyId: string, input: JsonRecord) {
  return {
    companyId,
    name: text(input, 'name'),
    category: text(input, 'category'),
    baseUnit: text(input, 'baseUnit'),
    tracksExpiry: input.tracksExpiry === true,
    costingMethod: readCostingMethod(input.costingMethod) ?? null,
    marginPercent: typeof input.marginPercent === 'number' ? input.marginPercent : null,
    taxCategoryCode: text(input, 'taxCategoryCode'),
    presentations: readPresentations(input.presentations),
  };
}

function readPresentations(value: unknown): Presentation[] {
  if (!Array.isArray(value)) {
    throw new McpError('presentations are required');
  }
  return value.map((item) => readPresentation(readRecord(item)));
}

function readPresentation(input: JsonRecord): Presentation {
  return {
    unit: text(input, 'unit'),
    factor: numberValue(input, 'factor'),
    purchasable: input.purchasable === true,
    sellable: input.sellable === true,
    salePrice: typeof input.salePrice === 'number' ? input.salePrice : null,
    manufacturerBarcode: optionalText(input.manufacturerBarcode),
  };
}

function readVoucher(companyId: string, input: JsonRecord) {
  return {
    companyId,
    serviceType: readService(input.serviceType),
    serviceNote: optionalText(input.serviceNote) ?? '',
    amount: numberValue(input, 'amount'),
    currency: readCurrency(input.currency),
    reference: text(input, 'reference'),
    holder: text(input, 'holder'),
    institution: text(input, 'institution'),
    dni: text(input, 'dni'),
    phone: text(input, 'phone'),
    occurredOn: text(input, 'occurredOn'),
    acceptedDeclaration: input.acceptedDeclaration === true,
    signature: text(input, 'signature'),
    bankReference: optionalText(input.bankReference) ?? '',
    moneyMovementId: optionalText(input.moneyMovementId),
  };
}

function readService(value: unknown): ServiceType {
  const service = SERVICE_TYPES.find((item) => item === value);
  if (service === undefined) {
    throw new McpError('Service type is invalid');
  }
  return service;
}

function readCurrency(value: unknown): 'HNL' | 'USD' {
  if (value === 'HNL' || value === 'USD') {
    return value;
  }
  throw new McpError('Currency is invalid');
}

function readRecord(value: unknown): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new McpError('A record is required');
  }
  return Object.fromEntries(Object.entries(value));
}

function readLines(value: unknown): DocumentLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((line) => readLine(readRecord(line)));
}

function readJournalLines(value: unknown): JournalEntryLine[] {
  if (!Array.isArray(value)) throw new McpError('lines must be an array');
  return value.map((item) => {
    const line = readRecord(item);
    return { accountCode: text(line, 'accountCode'), debit: numberValue(line, 'debit'), credit: numberValue(line, 'credit') };
  });
}

function readLine(input: JsonRecord): DocumentLine {
  return {
    productId: text(input, 'productId'),
    presentationFactor: numberValue(input, 'presentationFactor'),
    quantity: numberValue(input, 'quantity'),
    unitCost: typeof input.unitCost === 'number' ? input.unitCost : null,
    saleAmount: typeof input.saleAmount === 'number' ? input.saleAmount : null,
    selectedLayerId: optionalText(input.selectedLayerId),
    expiresOn: optionalText(input.expiresOn),
    newLayerId: randomUUID(),
  };
}

function requireSession(session: SessionRecord | null): SessionRecord {
  if (session === null) {
    throw new McpError('Session is required');
  }
  return session;
}

function text(input: JsonRecord, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new McpError(`${field} is required`);
  }
  return value;
}

function readColumns(value: unknown): ColumnSetting[] {
  if (!Array.isArray(value)) {
    throw new McpError('columns are required');
  }
  return value.flatMap(readColumnSetting);
}

function readColumnSetting(value: unknown): ColumnSetting[] {
  if (!isJsonRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean' || typeof value.sortOrder !== 'number') {
    return [];
  }
  return [{ key: value.key, visible: value.visible, sortOrder: value.sortOrder }];
}

function readWidgets(value: unknown): WidgetSetting[] {
  if (!Array.isArray(value)) {
    throw new McpError('widgets are required');
  }
  return value.flatMap(readWidgetSetting);
}

function readWidgetSetting(value: unknown): WidgetSetting[] {
  if (!isJsonRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean') {
    return [];
  }
  return [{
    key: value.key,
    visible: value.visible,
    x: widgetAxis(value.x),
    y: widgetAxis(value.y),
    w: widgetAxis(value.w),
    h: widgetAxis(value.h),
    chartType: dashboardChartType(value.chartType),
  }];
}

function dashboardChartType(value: unknown): DashboardChartType {
  return DASHBOARD_CHART_TYPES.find((chartType) => chartType === value) ?? 'bar';
}

function widgetAxis(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function readCollapsed(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new McpError('sidebarCollapsed is required');
  }
  return value;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function numberValue(input: JsonRecord, field: string): number {
  const value = input[field];
  if (typeof value !== 'number') {
    throw new McpError(`${field} is required`);
  }
  return value;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value;
}

function readRole(value: unknown): MembershipRole {
  const role = MEMBERSHIP_ROLES.find((item) => item === value);
  if (role === undefined) {
    throw new McpError('Role is invalid');
  }
  return role;
}

function readCompany(input: JsonRecord) {
  const margin = input.defaultMarginPercent;
  return {
    societyId: text(input, 'societyId'),
    legalName: text(input, 'legalName'),
    rtn: text(input, 'rtn'),
    currencyCode: text(input, 'currencyCode'),
    costingMethod: readCostingMethod(input.costingMethod),
    defaultMarginPercent: typeof margin === 'number' ? margin : null,
  };
}

function readCostingMethod(value: unknown): CostingMethod | undefined {
  if (value === 'PEPS' || value === 'UEPS' || value === 'FEFO' || value === 'AVERAGE' || value === 'SPECIFIC') {
    return value;
  }
  return undefined;
}

function readDocumentKind(value: unknown): DocumentKind {
  if (value === 'purchase' || value === 'opening' || value === 'sale' || value === 'shrinkage' || value === 'adjustment' || value === 'cash-transfer') {
    return value;
  }
  throw new DocumentError('Document type is invalid');
}

function readDirection(value: unknown): 'in' | 'out' | null {
  if (value === 'in' || value === 'out') {
    return value;
  }
  return null;
}

function readGrantList(value: unknown): ModuleGrant[] {
  if (!Array.isArray(value)) {
    throw new ModulePermissionError('Grants are required');
  }
  return value.map((item) => readGrant(item));
}

function readGrant(item: unknown): ModuleGrant {
  if (typeof item !== 'object' || item === null) {
    throw new ModulePermissionError('Grant is invalid');
  }
  const module = Reflect.get(item, 'module');
  const access = Reflect.get(item, 'access');
  if (typeof module !== 'string' || (access !== 'view' && access !== 'edit')) {
    throw new ModulePermissionError('Grant is invalid');
  }
  return { module: module as ModuleGrant['module'], access };
}
