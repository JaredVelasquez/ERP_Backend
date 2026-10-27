import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';
import { assertJournalEntry, JournalEntryError, type JournalEntry, type JournalEntryLine } from '@domain/accounting/journal-entry/journal-entry';
import { JOURNAL_ENTRY_PORT, type JournalEntryPort } from '@domain/accounting/journal-entry/journal-entry.port';
import type { AccountTreeNode } from '@domain/accounting/account/chart';

export interface CreateJournalEntryInput {
  companyId: string;
  createdBy: string;
  occurredAt: string;
  description: string;
  idempotencyKey: string;
  lines: JournalEntryLine[];
}

@Injectable()
export class CreateJournalEntryUseCase {
  constructor(
    @Inject(JOURNAL_ENTRY_PORT) private readonly entries: JournalEntryPort,
    private readonly chart: SeedChartUseCase,
  ) {}

  async execute(input: CreateJournalEntryInput) {
    const accounts = (await this.chart.execute(input.companyId)).flatMap((root) => flatten(root));
    assertJournalEntry(input, accounts);
    const entry: JournalEntry = {
      ...input,
      id: randomUUID(),
      status: 'confirmed',
      reversalOf: null,
      reversalId: null,
    };
    const saved = await this.entries.append(entry);
    if (!sameRequest(entry, saved)) throw new JournalEntryError('La clave de idempotencia ya se usó con otro asiento.');
    return saved;
  }
}

function sameRequest(requested: JournalEntry, saved: JournalEntry): boolean {
  return requested.companyId === saved.companyId && requested.idempotencyKey === saved.idempotencyKey
    && sameInstant(requested.occurredAt, saved.occurredAt) && requested.description === saved.description
    && requested.createdBy === saved.createdBy && sameLines(requested.lines, saved.lines);
}

function sameInstant(left: string, right: string): boolean {
  return Date.parse(left) === Date.parse(right);
}

function sameLines(left: readonly JournalEntryLine[], right: readonly JournalEntryLine[]): boolean {
  return JSON.stringify(canonicalLines(left)) === JSON.stringify(canonicalLines(right));
}

function canonicalLines(lines: readonly JournalEntryLine[]): JournalEntryLine[] {
  return [...lines].sort((left, right) => left.accountCode.localeCompare(right.accountCode)
    || left.debit - right.debit || left.credit - right.credit);
}

function flatten(node: AccountTreeNode): AccountTreeNode[] {
  return [node, ...node.children.flatMap((child) => flatten(child))];
}
