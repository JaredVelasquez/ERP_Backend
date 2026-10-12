export interface SqlSession {
  query<T>(statement: string, params: Record<string, unknown>): Promise<T[]>;
}

export interface SqlExecutor {
  transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T>;
}
