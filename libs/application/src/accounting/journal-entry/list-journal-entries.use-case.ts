import { Inject, Injectable } from '@nestjs/common';
import { JOURNAL_ENTRY_PORT, type JournalEntryPort } from '@domain/accounting/journal-entry/journal-entry.port';

@Injectable()
export class ListJournalEntriesUseCase {
  constructor(@Inject(JOURNAL_ENTRY_PORT) private readonly entries: JournalEntryPort) {}

  execute(companyId: string) {
    return this.entries.list(companyId, 100);
  }
}
