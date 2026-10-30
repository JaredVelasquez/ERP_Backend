import { findMcpTool, MCP_TOOL_CATALOG } from '@domain/mcp/tool-catalog/tool-catalog';
import { hashMcpToken, type McpAuditEntry } from '@domain/mcp/integration/mcp.port';

describe('mcp tool catalog', () => {
  it('hides the token hash from the raw token and keeps the bank reference out of the audit', () => {
    const token = 'session-token-value';
    const audit: McpAuditEntry = {
      userId: 'user-1',
      companyId: 'company-1',
      tool: 'link-voucher',
      result: 'ok',
      movementId: 'move-1',
      documentId: null,
      productIds: [],
    };
    const stored = JSON.stringify(audit);

    expect(findMcpTool('post-entry')?.module).toBe('accounting');
    expect(findMcpTool('missing')).toBeNull();
    expect(MCP_TOOL_CATALOG).toHaveLength(55);
    expect(findMcpTool('issue-stock')?.access).toBe('edit');
    expect(findMcpTool('render-barcode-sheet')?.access).toBe('view');
    expect(hashMcpToken(token)).not.toContain(token);
    expect(stored).not.toContain('bankReference');
    expect(stored).not.toContain('data:image');
    expect(stored).toContain('move-1');
  });
});
