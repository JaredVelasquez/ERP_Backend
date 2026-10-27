import type { JournalEntry } from '@domain/accounting/journal-entry/journal-entry';

export interface JournalEntryPort {
  append(entry: JournalEntry): Promise<JournalEntry>;
  find(companyId: string, entryId: string): Promise<JournalEntry | null>;
  list(companyId: string, limit: number): Promise<JournalEntry[]>;
  throughDate(companyId: string, date: string): Promise<JournalEntry[]>;
  appendReversal(companyId: string, entryId: string, reversal: JournalEntry): Promise<{ original: JournalEntry; reversal: JournalEntry }>;
}

export const JOURNAL_ENTRY_PORT = Symbol('JOURNAL_ENTRY_PORT');
