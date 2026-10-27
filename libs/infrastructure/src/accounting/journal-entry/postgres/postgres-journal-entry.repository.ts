import type { JournalEntry } from '@domain/accounting/journal-entry/journal-entry';
import type { JournalEntryPort } from '@domain/accounting/journal-entry/journal-entry.port';
import { appendEntry, appendReversal, entriesThroughDate, listEntries, readEntry } from '@infrastructure/accounting/journal-entry/postgres/journal-entry.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresJournalEntryRepository implements JournalEntryPort {
  constructor(private readonly database: TypeOrmExecutor) {}

  async append(entry: JournalEntry): Promise<JournalEntry> {
    return this.database.transaction(() => this.database.withManager((manager) => appendEntry(manager, entry)));
  }

  async find(companyId: string, entryId: string): Promise<JournalEntry | null> {
    return this.database.withManager((manager) => readEntry(manager, companyId, entryId));
  }

  async list(companyId: string, limit: number): Promise<JournalEntry[]> {
    return this.database.withManager((manager) => listEntries(manager, companyId, limit));
  }

  async throughDate(companyId: string, date: string): Promise<JournalEntry[]> {
    return this.database.withManager((manager) => entriesThroughDate(manager, companyId, date));
  }

  async appendReversal(companyId: string, entryId: string, reversal: JournalEntry): Promise<{ original: JournalEntry; reversal: JournalEntry }> {
    return this.database.transaction(() => this.database.withManager((manager) => appendReversal(manager, companyId, entryId, reversal)));
  }
}
