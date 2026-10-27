export const IMPORT_TRANSACTION_PORT = Symbol('IMPORT_TRANSACTION_PORT');

export interface ImportTransactionPort {
  run<T>(companyId: string, idempotencyKey: string, work: () => Promise<T | null>): Promise<{ executed: boolean; result: T | null }>;
}
