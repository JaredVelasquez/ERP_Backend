import type { ImportTransactionPort } from '@domain/inventory/catalog/import/import-transaction.port';

export class InMemoryImportTransactionRepository implements ImportTransactionPort {
  private readonly completed = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();

  async run<T>(companyId: string, idempotencyKey: string, work: () => Promise<T | null>): Promise<{ executed: boolean; result: T | null }> {
    const key = `${companyId}:${idempotencyKey}`;
    const previous = this.pending.get(key) ?? Promise.resolve();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => gate);
    this.pending.set(key, queued);
    await previous;
    try {
      if (this.completed.has(key)) return { executed: false, result: null };
      const result = await work();
      this.completed.add(key);
      return { executed: true, result };
    } finally {
      release();
      if (this.pending.get(key) === queued) this.pending.delete(key);
    }
  }
}
