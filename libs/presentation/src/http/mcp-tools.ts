import { randomUUID } from 'node:crypto';
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
import type { McpToolHandler, JsonRecord } from '@application/mcp/invoke-mcp-tool.use-case';
import { MEMBERSHIP_ROLES, type MembershipRole } from '@domain/identity/access';
import { ModulePermissionError, type ModuleGrant } from '@domain/identity/module-access';
import { DocumentError, type DocumentKind, type DocumentLine, type DraftDocument } from '@domain/inventory/document';
import type { IssueLineRequest } from '@domain/inventory/issue-draft';
import type { Presentation } from '@domain/inventory/product';
import { SERVICE_TYPES, type ServiceType } from '@domain/documents/voucher';
import { catalogTemplate, countTemplate } from '@domain/inventory/spreadsheet';
import { McpError } from '@domain/mcp/tool-catalog';
import { hashMcpToken, type McpTokenPort } from '@domain/mcp/mcp.port';
import type { SessionRecord } from '@domain/identity/session.port';
import type { CompanyPort } from '@domain/tenancy/company.port';
import type { CostingMethod } from '@domain/inventory/costing';
import { CreateCompanyUseCase } from '@application/tenancy/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/create-tenant.use-case';
import { ReadDashboardLayoutUseCase, SaveDashboardLayoutUseCase } from '@application/workspace/dashboard-layout.use-case';
import { ReadTableLayoutUseCase, SaveTableLayoutUseCase } from '@application/workspace/table-layout.use-case';
import { ReadUiPreferencesUseCase, SaveUiPreferencesUseCase } from '@application/workspace/ui-preferences.use-case';
import type { ColumnSetting, WidgetSetting } from '@domain/workspace/layout';

export interface McpToolDeps {
  registerUser: RegisterUserUseCase;
  loginUser: LoginUseCase;
  replaceModules: ReplaceModuleGrantsUseCase;
  createTenant: CreateTenantUseCase;
  createSociety: CreateSocietyUseCase;
  createCompany: CreateCompanyUseCase;
  seedChart: SeedChartUseCase;
  receiveEntry: ReceiveEntryUseCase;
  updateAccount: UpdateAccountUseCase;
  createProduct: CreateProductUseCase;
  previewBarcode: PreviewBarcodeUseCase;
  renderBarcodeSheet: RenderBarcodeSheetUseCase;
  searchProducts: SearchProductsByNameUseCase;
  readStockCard: ReadStockCardUseCase;
  issueStock: IssueStockUseCase;
  changePrice: ChangePriceUseCase;
  applyMargin: ApplyMarginUseCase;
  confirmDocument: ConfirmDocumentUseCase;
  voidDocument: VoidDocumentUseCase;
  dashboard: DashboardUseCase;
  importCatalog: ImportCatalogUseCase;
  importCount: ImportCountUseCase;
  saveVoucher: SaveVoucherUseCase;
  confirmVoucher: ConfirmVoucherUseCase;
  linkVoucher: LinkVoucherUseCase;
  voidVoucher: VoidVoucherUseCase;
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
    tool('register-user', 'public', null, 'edit', async (_session, input) => ({
      ...(await deps.registerUser.execute({
        email: text(input, 'email'),
        password: text(input, 'password'),
        displayName: text(input, 'displayName'),
        companyId: text(input, 'companyId'),
        role: readRole(input.role),
      })),
      companyId: text(input, 'companyId'),
    })),
    tool('login', 'public', null, 'view', async (_session, input) => {
      const session = await deps.loginUser.execute({
        email: text(input, 'email'),
        password: text(input, 'password'),
        companyId: text(input, 'companyId'),
      });
      await deps.tokens.issue({
        userId: session.userId,
        companyId: session.companyId,
        tokenHash: hashMcpToken(session.token),
      });
      return {
        token: session.token,
        role: session.role,
        grants: session.grants,
        userId: session.userId,
        companyId: session.companyId,
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
    tool('create-product', 'session', 'products', 'edit', async (session, input) => ({
      product: await deps.createProduct.execute(readProduct(requireSession(session).companyId, input)),
    })),
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
    tool('read-stock-card', 'session', 'inventory', 'view', async (session, input) => ({
      card: await deps.readStockCard.execute({
        companyId: requireSession(session).companyId,
        productId: optionalText(input.productId) ?? '',
        code: optionalText(input.code) ?? '',
        grants: requireSession(session).grants,
      }),
    })),
    tool('issue-stock', 'session', 'inventory', 'edit', async (session, input) => issueStock(deps, requireSession(session).companyId, input)),
    tool('change-price', 'session', 'prices', 'edit', async (session, input) => ({
      change: await deps.changePrice.execute({
        companyId: requireSession(session).companyId,
        productId: text(input, 'productId'),
        unit: text(input, 'unit'),
        nextPrice: numberValue(input, 'nextPrice'),
        reason: text(input, 'reason'),
        actorId: text(input, 'actorId'),
        at: text(input, 'at'),
      }),
    })),
    tool('apply-margin', 'session', 'prices', 'edit', async (session, input) => ({
      change: await deps.applyMargin.execute({
        companyId: requireSession(session).companyId,
        productId: text(input, 'productId'),
        unit: text(input, 'unit'),
        cost: numberValue(input, 'cost'),
        actorId: text(input, 'actorId'),
        at: text(input, 'at'),
      }),
    })),
    tool('confirm-document', 'session', 'inventory', 'edit', async (session, input) => confirmInventory(deps, requireSession(session).companyId, input)),
    tool('void-document', 'session', 'inventory', 'edit', async (session, input) => ({
      document: await deps.voidDocument.execute(requireSession(session).companyId, text(input, 'documentId')),
    })),
    tool('dashboard', 'session', 'dashboard', 'view', async (session, input) =>
      deps.dashboard.execute(requireSession(session).companyId, text(input, 'to'), numberValue(input, 'days')),
    ),
    tool('catalog-template', 'session', 'imports', 'view', async () => catalogTemplate()),
    tool('count-template', 'session', 'imports', 'view', async () => countTemplate()),
    tool('import-catalog', 'session', 'imports', 'edit', async (session, input) => importCatalog(deps, requireSession(session).companyId, input)),
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
    tool('void-voucher', 'session', 'documents', 'edit', async (session, input) => ({
      voucher: await deps.voidVoucher.execute(requireSession(session).companyId, text(input, 'voucherId')),
    })),
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
    tool('save-dashboard-layout', 'session', null, 'view', async (session, input) => {
      const current = requireSession(session);
      return deps.saveDashboardLayout.execute(current.companyId, current.userId, current.grants, readWidgets(input.widgets));
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
  return {
    document: await deps.confirmDocument.execute({
      draft: documentDraft(input, companyId),
      companyCostingMethod: company.costingMethod,
      receivedAt: text(input, 'receivedAt'),
    }),
  };
}

async function importCatalog(deps: McpToolDeps, companyId: string, input: JsonRecord): Promise<{ document: unknown }> {
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
  }];
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
