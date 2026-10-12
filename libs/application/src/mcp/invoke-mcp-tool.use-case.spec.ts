import { InvokeMcpToolUseCase, type McpToolHandler } from '@application/mcp/invoke-mcp-tool.use-case';
import { defaultGrants } from '@domain/identity/module-access';
import type { McpAuditEntry, McpAuditPort } from '@domain/mcp/mcp.port';
import type { IdentityPort, Membership, SessionRecord, UserAccount } from '@domain/identity/session.port';

describe('invoke mcp tool', () => {
  it('does not call a tool the operator cannot use and omits the signature from the audit', async () => {
    const identity = new MemoryIdentity();
    const audit = new MemoryAudit();
    const calls = { product: 0, entry: 0 };
    await identity.insertSession(operatorSession());
    const invoke = new InvokeMcpToolUseCase(identity, audit, [
      countingTool('post-entry', 'accounting', 'edit', calls, 'entry'),
      countingTool('create-product', 'products', 'edit', calls, 'product'),
    ]);

    await expect(
      invoke.execute('operator-token', 'post-entry', {
        companyId: 'company-1',
        code: '1',
        signature: 'data:image/png;base64,SECRET',
        bankReference: 'SUPER-REF',
      }),
    ).rejects.toThrow('Permission denied');
    await expect(invoke.execute('operator-token', 'create-product', { companyId: 'company-2', name: 'Otro' })).rejects.toThrow(
      'Permission denied',
    );

    expect(calls).toEqual({ product: 0, entry: 0 });
    const stored = JSON.stringify(await audit.list('company-1'));
    expect(stored).not.toContain('SECRET');
    expect(stored).not.toContain('SUPER-REF');
    expect(stored).not.toContain('data:image');
    expect(stored).toContain('denied');
  });
});

function countingTool(
  name: string,
  module: McpToolHandler['module'],
  access: McpToolHandler['access'],
  calls: { product: number; entry: number },
  key: 'product' | 'entry',
): McpToolHandler {
  return {
    name,
    audience: 'session',
    module,
    access,
    execute: async () => {
      calls[key] += 1;
      return { userId: 'user-1' };
    },
  };
}

function operatorSession(): SessionRecord {
  return {
    token: 'operator-token',
    userId: 'user-1',
    companyId: 'company-1',
    role: 'operator',
    grants: defaultGrants('operator'),
  };
}

class MemoryAudit implements McpAuditPort {
  private readonly entries: McpAuditEntry[] = [];

  async record(entry: McpAuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  async list(companyId: string): Promise<McpAuditEntry[]> {
    return this.entries.filter((entry) => entry.companyId === companyId);
  }
}

class MemoryIdentity implements IdentityPort {
  private readonly sessions: SessionRecord[] = [];

  async insertUserWithMembership(_user: UserAccount, _membership: Membership): Promise<void> {
    return undefined;
  }

  async findUserByEmail(): Promise<UserAccount | null> {
    return null;
  }

  async findMembership(): Promise<Membership | null> {
    return null;
  }

  async listMemberships(): Promise<Membership[]> {
    return [];
  }

  async insertSession(session: SessionRecord): Promise<void> {
    this.sessions.push(session);
  }

  async findSession(token: string): Promise<SessionRecord | null> {
    return this.sessions.find((session) => session.token === token) ?? null;
  }

  async replaceGrants(): Promise<void> {
    return undefined;
  }
}
