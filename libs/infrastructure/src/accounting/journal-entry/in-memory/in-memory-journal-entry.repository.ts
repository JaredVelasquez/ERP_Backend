import { JournalEntryError, type JournalEntry } from '@domain/accounting/journal-entry/journal-entry';
import type { JournalEntryPort } from '@domain/accounting/journal-entry/journal-entry.port';

export class InMemoryJournalEntryRepository implements JournalEntryPort {
  private readonly entries: JournalEntry[] = [];

  async append(entry: JournalEntry): Promise<JournalEntry> {
    const existing = this.entries.find((item) => item.companyId === entry.companyId && item.idempotencyKey === entry.idempotencyKey);
    if (existing !== undefined) return existing;
    this.entries.push(entry);
    return entry;
  }

  async find(companyId: string, entryId: string): Promise<JournalEntry | null> {
    return this.entries.find((entry) => entry.companyId === companyId && entry.id === entryId) ?? null;
  }

  async list(companyId: string, limit: number): Promise<JournalEntry[]> {
    return this.entries.filter((entry) => entry.companyId === companyId)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, limit);
  }

  async throughDate(companyId: string, date: string): Promise<JournalEntry[]> {
    return this.entries.filter((entry) => entry.companyId === companyId && entry.occurredAt.slice(0, 10) <= date);
  }

  async appendReversal(companyId: string, entryId: string, reversal: JournalEntry): Promise<{ original: JournalEntry; reversal: JournalEntry }> {
    const original = await this.find(companyId, entryId);
    if (original === null) throw new JournalEntryError('No se encontró el asiento en esta empresa.');
    if (original.reversalId !== null) return this.findExistingReversal(companyId, original);
    const confirmedReversal = await this.append(reversal);
    const voidedOriginal = { ...original, status: 'voided' as const, reversalId: confirmedReversal.id };
    this.entries[this.entries.indexOf(original)] = voidedOriginal;
    return { original: voidedOriginal, reversal: confirmedReversal };
  }
  private async findExistingReversal(companyId: string, original: JournalEntry): Promise<{ original: JournalEntry; reversal: JournalEntry }> {
    const existingReversal = await this.find(companyId, original.reversalId ?? '');
    if (existingReversal === null) throw new JournalEntryError('Reversal entry was not found.');
    return { original, reversal: existingReversal };
  }
}