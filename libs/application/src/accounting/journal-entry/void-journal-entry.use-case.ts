import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JournalEntryError, reverseLines } from '@domain/accounting/journal-entry/journal-entry';
import { JOURNAL_ENTRY_PORT, type JournalEntryPort } from '@domain/accounting/journal-entry/journal-entry.port';

@Injectable()
export class VoidJournalEntryUseCase {
  constructor(@Inject(JOURNAL_ENTRY_PORT) private readonly entries: JournalEntryPort) {}

  async execute(companyId: string, entryId: string, actorId: string) {
    const original = await this.entries.find(companyId, entryId);
    if (original === null) {
      throw new JournalEntryError('No se encontró el asiento en esta empresa.');
    }
    if (original.reversalOf !== null) {
      throw new JournalEntryError('Un asiento de reverso no se puede anular.');
    }
    const reversal = {
      id: randomUUID(),
      companyId,
      occurredAt: `${hondurasAccountingDate()}T12:00:00.000Z`,
      description: `Anulación: ${original.description}`.slice(0, 250),
      idempotencyKey: `reversal-${original.id}`,
      status: 'confirmed' as const,
      createdBy: actorId,
      reversalOf: original.id,
      reversalId: null,
      lines: reverseLines(original.lines),
    };
    return this.entries.appendReversal(companyId, entryId, reversal);
  }
}

function hondurasAccountingDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const fields = new Map(parts.map((part) => [part.type, part.value]));
  return `${fields.get('year')}-${fields.get('month')}-${fields.get('day')}`;
}
