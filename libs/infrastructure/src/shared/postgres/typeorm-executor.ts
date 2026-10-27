import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityManager, QueryRunner } from 'typeorm';
import { destroyTypeOrmDataSource, getTypeOrmDataSource, typeOrmSourceKey } from '@infrastructure/shared/postgres/typeorm-data-source';

const transactionContext = new AsyncLocalStorage<{ key: string; runner: QueryRunner }>();

export interface TypeOrmExecutor {
  close?(): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
  withManager<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;
}

export function createTypeOrmExecutor(env: Readonly<Record<string, string | undefined>>): TypeOrmExecutor {
  const key = typeOrmSourceKey(env);
  return {
    async close(): Promise<void> {
      await destroyTypeOrmDataSource(env);
    },
    async transaction<T>(work: () => Promise<T>): Promise<T> {
      const parent = transactionContext.getStore();
      if (parent?.key === key) return work();
      const dataSource = await getTypeOrmDataSource(env);
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const result = await transactionContext.run({ key, runner }, work);
        await runner.commitTransaction();
        return result;
      } catch (error) {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        throw error;
      } finally {
        await runner.release();
      }
    },
    async withManager<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
      const current = transactionContext.getStore();
      if (current?.key === key) return work(current.runner.manager);
      const source = await getTypeOrmDataSource(env);
      return work(source.manager);
    },
  };
}
