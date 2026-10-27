import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

async function smokeStorage(): Promise<void> {
  const client = new S3Client({
    endpoint: required('S3_ENDPOINT'), region: process.env.S3_REGION?.trim() || 'auto', forcePathStyle: true,
    credentials: { accessKeyId: required('S3_ACCESS_KEY_ID'), secretAccessKey: required('S3_SECRET_ACCESS_KEY') },
  });
  const bucket = required('S3_BUCKET');
  const prefix = process.env.S3_VOUCHER_PREFIX?.trim().replace(/^\/+|\/+$/g, '') || 'comprobantes';
  const key = `${prefix}/_healthchecks/${randomUUID()}.txt`;
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'erp-storage-check', ContentType: 'text/plain' }));
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    process.stdout.write('S3 private object upload and read check succeeded.\n');
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    client.destroy();
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

void smokeStorage().catch(() => {
  process.stderr.write('S3 storage smoke check failed.\n');
  process.exitCode = 1;
});
