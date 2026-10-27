import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStoragePort } from '@domain/documents/voucher/object-storage.port';

export class S3ObjectStorage implements ObjectStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: Readonly<Record<string, string | undefined>>) {
    const endpoint = required(env.S3_ENDPOINT, 'S3_ENDPOINT');
    this.bucket = required(env.S3_BUCKET, 'S3_BUCKET');
    this.client = new S3Client({
      endpoint,
      region: env.S3_REGION?.trim() || 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: required(env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
        secretAccessKey: required(env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async put(input: { key: string; body: Buffer; contentType: string }): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }));
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (result.Body === undefined) return null;
      const body = Buffer.from(await result.Body.transformToByteArray());
      return { body, contentType: result.ContentType ?? 'application/octet-stream' };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function isMissingObject(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error &&
    ((error as { name: string }).name === 'NoSuchKey' || (error as { name: string }).name === 'NotFound');
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required for object storage`);
  return normalized;
}
