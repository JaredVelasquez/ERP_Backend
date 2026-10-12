import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { phase1Contract, renderZodClient } from '@domain/gateway/openapi-contract';

describe('phase 1 openapi contract', () => {
  it('publishes login and renders a zod client without dropping grants', () => {
    const source = renderZodClient(phase1Contract);

    expect(phase1Contract.paths['/identity/login']?.post?.operationId).toBe('login');
    expect(source).toContain("import { z } from 'zod'");
    expect(source).toContain('loginResponseSchema');
    expect(source).toContain('grants: z.array(z.object({');
    expect(source).toContain('companyId: z.string().optional()');
    expect(readFileSync(join(process.cwd(), '..', 'ERP_FRONTEND', 'src', 'shared', 'api', 'erp-client.ts'), 'utf8')).toBe(source);
  });
});
