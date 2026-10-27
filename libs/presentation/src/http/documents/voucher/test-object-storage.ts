import type { ObjectStoragePort } from '@domain/documents/voucher/object-storage.port';

export const testObjectStorage: ObjectStoragePort = {
  async put(): Promise<void> {
    return undefined;
  },
  async get(): Promise<null> {
    return null;
  },
  async delete(): Promise<void> {
    return undefined;
  },
};
