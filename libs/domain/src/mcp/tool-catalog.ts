import type { AppModule, ModuleAccess } from '@domain/identity/module-access';

export type McpAudience = 'public' | 'session';

export interface McpToolDefinition {
  name: string;
  audience: McpAudience;
  module: AppModule | null;
  access: ModuleAccess;
}

export const MCP_TOOL_CATALOG: readonly McpToolDefinition[] = [
  { name: 'register-user', audience: 'public', module: null, access: 'edit' },
  { name: 'login', audience: 'public', module: null, access: 'view' },
  { name: 'replace-modules', audience: 'session', module: null, access: 'edit' },
  { name: 'create-tenant', audience: 'session', module: 'platform', access: 'edit' },
  { name: 'create-society', audience: 'session', module: 'platform', access: 'edit' },
  { name: 'create-company', audience: 'session', module: 'platform', access: 'edit' },
  { name: 'list-accounts', audience: 'session', module: 'accounting', access: 'view' },
  { name: 'post-entry', audience: 'session', module: 'accounting', access: 'edit' },
  { name: 'update-account', audience: 'session', module: 'accounting', access: 'edit' },
  { name: 'create-product', audience: 'session', module: 'products', access: 'edit' },
  { name: 'preview-barcode', audience: 'session', module: 'products', access: 'view' },
  { name: 'render-barcode-sheet', audience: 'session', module: 'products', access: 'view' },
  { name: 'search-products-by-name', audience: 'session', module: 'products', access: 'view' },
  { name: 'read-stock-card', audience: 'session', module: 'inventory', access: 'view' },
  { name: 'issue-stock', audience: 'session', module: 'inventory', access: 'edit' },
  { name: 'change-price', audience: 'session', module: 'prices', access: 'edit' },
  { name: 'apply-margin', audience: 'session', module: 'prices', access: 'edit' },
  { name: 'confirm-document', audience: 'session', module: 'inventory', access: 'edit' },
  { name: 'void-document', audience: 'session', module: 'inventory', access: 'edit' },
  { name: 'dashboard', audience: 'session', module: 'dashboard', access: 'view' },
  { name: 'catalog-template', audience: 'session', module: 'imports', access: 'view' },
  { name: 'count-template', audience: 'session', module: 'imports', access: 'view' },
  { name: 'import-catalog', audience: 'session', module: 'imports', access: 'edit' },
  { name: 'import-count', audience: 'session', module: 'imports', access: 'edit' },
  { name: 'save-voucher', audience: 'session', module: 'documents', access: 'edit' },
  { name: 'confirm-voucher', audience: 'session', module: 'documents', access: 'edit' },
  { name: 'link-voucher', audience: 'session', module: 'documents', access: 'edit' },
  { name: 'void-voucher', audience: 'session', module: 'documents', access: 'edit' },
  { name: 'download-voucher', audience: 'session', module: 'documents', access: 'view' },
  { name: 'read-table-layout', audience: 'session', module: null, access: 'view' },
  { name: 'save-table-layout', audience: 'session', module: null, access: 'view' },
  { name: 'read-dashboard-layout', audience: 'session', module: null, access: 'view' },
  { name: 'save-dashboard-layout', audience: 'session', module: null, access: 'view' },
  { name: 'read-ui-preferences', audience: 'session', module: null, access: 'view' },
  { name: 'save-ui-preferences', audience: 'session', module: null, access: 'view' },
];

export function findMcpTool(name: string): McpToolDefinition | null {
  return MCP_TOOL_CATALOG.find((tool) => tool.name === name) ?? null;
}

export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpError';
  }
}
