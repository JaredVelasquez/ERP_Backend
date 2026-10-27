/* global Blob, FormData, Response */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PostgresIdentityRepository } from '../libs/infrastructure/src/identity/session/postgres/postgres-identity.repository';
import { ScryptPasswordHasher } from '../libs/infrastructure/src/identity/session/security/scrypt-password.hasher';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));
const gatewayUrl = `http://127.0.0.1:${process.env.GATEWAY_PORT ?? '3000'}`;
const origin = process.env.SMOKE_FRONTEND_ORIGIN ?? 'http://localhost:5174';

interface VoucherResponse { voucher: { id: string; voucherFileKey: string | null; bankReceiptFileKey: string | null } }

async function main(): Promise<void> {
  const database = new Client({
    host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER, password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await database.connect();
  const executor = createTypeOrmExecutor(process.env);
  const storage = storageClient();
  const userId = randomUUID();
  const ownerId = randomUUID();
  const email = `voucher-storage-smoke-${userId}@invalid.test`;
  const ownerEmail = `voucher-storage-owner-smoke-${ownerId}@invalid.test`;
  const password = `ErpSmoke-${randomUUID()}!`;
  const ownerPassword = `ErpSmoke-${randomUUID()}!`;
  let voucherId = '';
  let previousApproverId: string | null = null;
  let companyIdForCleanup = '';
  const objectKeys: string[] = [];
  try {
    const companies = await database.query<{ id: string }>('SELECT id FROM companies ORDER BY id LIMIT 1');
    const companyId = companies.rows[0]?.id;
    if (!companyId) throw new Error('No company available for voucher storage smoke check');
    companyIdForCleanup = companyId;
    const previousApprover = await database.query<{ designated_voucher_void_approver_id: string | null }>(
      'SELECT designated_voucher_void_approver_id FROM companies WHERE id = $1', [companyId],
    );
    previousApproverId = previousApprover.rows[0]?.designated_voucher_void_approver_id ?? null;
    const identity = new PostgresIdentityRepository(executor);
    await identity.insertUserWithMembership(
      { id: userId, email, displayName: 'Temporary voucher storage smoke', passwordHash: new ScryptPasswordHasher().hash(password) },
      { id: randomUUID(), userId, companyId, role: 'operator', grants: [{ module: 'documents', access: 'edit' }] },
    );
    await identity.insertUserWithMembership(
      { id: ownerId, email: ownerEmail, displayName: 'Temporary voucher approval owner', passwordHash: new ScryptPasswordHasher().hash(ownerPassword) },
      { id: randomUUID(), userId: ownerId, companyId, role: 'owner', grants: [{ module: 'documents', access: 'edit' }, { module: 'settings', access: 'edit' }] },
    );

    const accessToken = await login(email, password, companyId);
    const headers = { authorization: `Bearer ${accessToken}` };
    const ownerHeaders = { authorization: `Bearer ${await login(ownerEmail, ownerPassword, companyId)}` };
    const designated = await fetch(`${gatewayUrl}/erp/vouchers/void-approval-settings`, {
      method: 'POST', headers: { ...ownerHeaders, origin, 'content-type': 'application/json' }, body: JSON.stringify({ userId: ownerId }),
    });
    assertStatus(designated, 201);
    const created = await fetch(`${gatewayUrl}/erp/vouchers`, {
      method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        companyId, serviceType: 'otro', serviceNote: 'Prueba temporal de almacenamiento', amount: 1,
        currency: 'HNL', reference: 'SMOKE-REFERENCE', holder: 'Prueba temporal', institution: 'Smoke',
        dni: '0000000000000', phone: '00000000', occurredOn: new Date().toISOString().slice(0, 10),
        acceptedDeclaration: true, signature: 'data:image/png;base64,aGVsbG8=', bankReference: 'SMOKE-BANK-REFERENCE',
      }),
    });
    assertStatus(created, 201);
    const createdVoucher = await created.json() as VoucherResponse;
    voucherId = createdVoucher.voucher.id;

    const confirmed = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/confirm?companyId=${companyId}`, {
      method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' }, body: '{}',
    });
    assertStatus(confirmed, 201);
    const pdfReference = await database.query<{ voucher_file_key: string | null }>(
      'SELECT voucher_file_key FROM document_submissions WHERE id = $1 AND company_id = $2', [voucherId, companyId],
    );
    const pdfKey = pdfReference.rows[0]?.voucher_file_key;
    if (!pdfKey) throw new Error('Confirmed voucher did not persist its R2 object key');
    objectKeys.push(pdfKey);
    assertVoucherKey(pdfKey, voucherId, 'comprobante.pdf');

    const receipt = new FormData();
    receipt.set('file', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], { type: 'image/png' }), 'pos-smoke.png');
    const attached = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/bank-receipt?companyId=${companyId}`, {
      method: 'POST', headers: { ...headers, origin }, body: receipt,
    });
    assertStatus(attached, 201);
    const attachedVoucher = (await attached.json() as VoucherResponse).voucher;
    if (!attachedVoucher.bankReceiptFileKey) throw new Error('Bank receipt did not persist its R2 object key');
    objectKeys.push(attachedVoucher.bankReceiptFileKey);
    assertVoucherKey(attachedVoucher.bankReceiptFileKey, voucherId, '.png');

    await assertFile(headers, companyId, voucherId, 'voucher', 'application/pdf', '%PDF-');
    await assertFile(headers, companyId, voucherId, 'bank-receipt', 'image/png', 'PNG');
    await assertIsolation(headers, voucherId);

    const previousReceiptKey = attachedVoucher.bankReceiptFileKey;
    const replacement = new FormData();
    replacement.set('file', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 8, 7])], { type: 'image/png' }), 'pos-replacement.png');
    const replaced = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/bank-receipt?companyId=${companyId}`, {
      method: 'POST', headers: { ...headers, origin }, body: replacement,
    });
    assertStatus(replaced, 201);
    const replacementVoucher = (await replaced.json() as VoucherResponse).voucher;
    if (!replacementVoucher.bankReceiptFileKey || replacementVoucher.bankReceiptFileKey === previousReceiptKey) {
      throw new Error('Replacing a bank receipt did not create and persist a new object reference');
    }
    objectKeys.push(replacementVoucher.bankReceiptFileKey);
    await assertFile(headers, companyId, voucherId, 'bank-receipt', 'image/png', 'PNG');

    const voidRequest = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/void-request`, {
      method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Prueba automatizada temporal' }),
    });
    assertStatus(voidRequest, 201);
    const requestBody = await voidRequest.json() as { request: { id: string; status: string } };
    if (requestBody.request.status !== 'pending') throw new Error('Voucher void request was not left pending for approval');
    const selfApproval = await resolveVoidRequest(headers, requestBody.request.id);
    if (selfApproval.status !== 403) throw new Error(`Requester approval should return 403, received ${selfApproval.status}`);
    const approved = await resolveVoidRequest(ownerHeaders, requestBody.request.id);
    assertStatus(approved, 201);
    const voided = await database.query<{ status: string }>('SELECT status FROM document_submissions WHERE id = $1', [voucherId]);
    if (voided.rows[0]?.status !== 'voided') throw new Error('Approved request did not void the voucher');
    process.stdout.write('Authenticated voucher PDF and receipt upload, replacement, company isolation, database references, single-folder R2 keys, and reads passed.\n');
    process.stdout.write('Voucher void request, self-approval rejection, designated owner approval, and persisted void status passed.\n');
  } finally {
    if (voucherId) {
      const rows = await database.query<{ voucher_file_key: string | null; bank_receipt_file_key: string | null }>(
        'SELECT voucher_file_key, bank_receipt_file_key FROM document_submissions WHERE id = $1', [voucherId],
      );
      for (const row of rows.rows) {
        if (row.voucher_file_key) objectKeys.push(row.voucher_file_key);
        if (row.bank_receipt_file_key) objectKeys.push(row.bank_receipt_file_key);
      }
      await database.query('DELETE FROM voucher_void_requests WHERE voucher_id = $1', [voucherId]);
      await database.query('DELETE FROM document_signatures WHERE submission_id = $1', [voucherId]);
      await database.query('DELETE FROM document_submissions WHERE id = $1', [voucherId]);
    }
    for (const key of new Set(objectKeys)) await storage.send(new DeleteObjectCommand({ Bucket: required('S3_BUCKET'), Key: key })).catch(() => undefined);
    storage.destroy();
    if (companyIdForCleanup) {
      await database.query('UPDATE companies SET designated_voucher_void_approver_id = $1 WHERE id = $2', [previousApproverId, companyIdForCleanup]);
    }
    await database.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)', [userId]);
    await database.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await database.query('DELETE FROM auth_session_families WHERE user_id = $1', [userId]);
    await database.query('DELETE FROM refresh_sessions WHERE family_id IN (SELECT id FROM auth_session_families WHERE user_id = $1)', [ownerId]);
    await database.query('DELETE FROM sessions WHERE user_id = $1', [ownerId]);
    await database.query('DELETE FROM auth_session_families WHERE user_id = $1', [ownerId]);
    await database.query('DELETE FROM module_grants WHERE membership_id IN (SELECT id FROM memberships WHERE user_id = $1)', [userId]);
    await database.query('DELETE FROM module_grants WHERE membership_id IN (SELECT id FROM memberships WHERE user_id = $1)', [ownerId]);
    await database.query('DELETE FROM memberships WHERE user_id = $1', [userId]);
    await database.query('DELETE FROM memberships WHERE user_id = $1', [ownerId]);
    await database.query('DELETE FROM users WHERE id = $1', [userId]);
    await database.query('DELETE FROM users WHERE id = $1', [ownerId]);
    await executor.close?.();
    await database.end();
  }
}

async function assertFile(headers: Record<string, string>, companyId: string, voucherId: string, kind: string, contentType: string, prefix: string): Promise<void> {
  const response = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/files/${kind}?companyId=${companyId}`, { headers: { ...headers, origin } });
  assertStatus(response, 200);
  if (!response.headers.get('content-type')?.startsWith(contentType)) throw new Error(`${kind} returned an unexpected content type`);
  const body = Buffer.from(await response.arrayBuffer());
  const signature = prefix === 'PNG' ? Buffer.from([137, 80, 78, 71]) : Buffer.from(prefix, 'ascii');
  if (!body.subarray(0, signature.length).equals(signature)) {
    throw new Error(`${kind} returned an unexpected file signature`);
  }
}

async function assertIsolation(headers: Record<string, string>, voucherId: string): Promise<void> {
  const otherCompanyId = randomUUID();
  const read = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/files/voucher?companyId=${otherCompanyId}`, { headers: { ...headers, origin } });
  if (read.status !== 403) throw new Error(`Cross-company voucher read should return 403, received ${read.status}`);
  const upload = new FormData();
  upload.set('file', new Blob(['%PDF-smoke'], { type: 'application/pdf' }), 'isolated.pdf');
  const attach = await fetch(`${gatewayUrl}/erp/vouchers/${voucherId}/bank-receipt?companyId=${otherCompanyId}`, {
    method: 'POST', headers: { ...headers, origin }, body: upload,
  });
  if (attach.status !== 403) throw new Error(`Cross-company receipt upload should return 403, received ${attach.status}`);
}

function assertVoucherKey(key: string, voucherId: string, suffix: string): void {
  const normalizedPrefix = process.env.S3_VOUCHER_PREFIX?.trim().replace(/^\/+|\/+$/g, '') || 'comprobantes';
  if (!key.startsWith(`${normalizedPrefix}/${voucherId}/`) || key.slice(normalizedPrefix.length + 1).split('/').length !== 2 || !key.endsWith(suffix)) {
    throw new Error('Voucher object key must be stored directly inside its single voucher folder');
  }
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${gatewayUrl}${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function login(email: string, password: string, companyId: string): Promise<string> {
  const response = await post('/identity/login', { email, password, companyId, clientPlatform: 'web' });
  assertStatus(response, 200);
  const accessToken = textField(await response.json() as Record<string, unknown>, 'accessToken');
  if (!accessToken) throw new Error('Login did not return an access token');
  return accessToken;
}

async function resolveVoidRequest(headers: Record<string, string>, requestId: string): Promise<Response> {
  return fetch(`${gatewayUrl}/erp/vouchers/void-requests/${requestId}/resolve`, {
    method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approved', note: 'Smoke de aprobación temporal' }),
  });
}

function storageClient(): S3Client {
  return new S3Client({
    endpoint: required('S3_ENDPOINT'), region: process.env.S3_REGION?.trim() || 'auto', forcePathStyle: true,
    credentials: { accessKeyId: required('S3_ACCESS_KEY_ID'), secretAccessKey: required('S3_SECRET_ACCESS_KEY') },
  });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function textField(body: Record<string, unknown>, name: string): string {
  return typeof body[name] === 'string' ? body[name] as string : '';
}

function assertStatus(response: Response, expected: number): void {
  if (response.status !== expected) throw new Error(`Expected HTTP ${expected}, received ${response.status}`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Voucher storage smoke check failed.'}\n`);
  process.exitCode = 1;
});
