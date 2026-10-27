import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { join } from 'node:path';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

async function ensureBucket(): Promise<void> {
  const client = new S3Client({
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION?.trim() || 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: required('S3_ACCESS_KEY_ID'), secretAccessKey: required('S3_SECRET_ACCESS_KEY') },
  });
  const bucket = required('S3_BUCKET');
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    process.stdout.write(`Bucket ${bucket} ya está disponible.\n`);
    return;
  } catch (error) {
    if (!isMissingBucket(error)) throw new Error('No se pudo verificar el bucket S3 configurado.');
  }
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  process.stdout.write(`Bucket ${bucket} creado.\n`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es requerido en .env.`);
  return value;
}

function isMissingBucket(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === 'NotFound' || candidate.name === 'NoSuchBucket' || candidate.$metadata?.httpStatusCode === 404;
}

void ensureBucket().catch(() => {
  process.stderr.write('No se pudo preparar el bucket S3. Revisa endpoint, bucket y permisos de las credenciales.\n');
  process.exitCode = 1;
});
