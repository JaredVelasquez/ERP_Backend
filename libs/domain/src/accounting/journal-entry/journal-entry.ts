import { roundMoney } from '@domain/inventory/catalog/costing/costing';
import type { AccountSeed } from '@domain/accounting/account/chart';

export type JournalEntryStatus = 'confirmed' | 'voided';

export interface JournalEntryLine {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  occurredAt: string;
  description: string;
  idempotencyKey: string;
  status: JournalEntryStatus;
  createdBy: string;
  reversalOf: string | null;
  reversalId: string | null;
  lines: JournalEntryLine[];
}

export class JournalEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalEntryError';
  }
}

export function assertJournalEntry(input: Omit<JournalEntry, 'id' | 'status' | 'reversalOf' | 'reversalId'>, accounts: readonly AccountSeed[]): void {
  if (!input.companyId.trim() || !input.createdBy.trim() || !input.description.trim() || input.description.length > 250) {
    throw new JournalEntryError('Completa empresa, descripción y usuario; la descripción admite hasta 250 caracteres.');
  }
  if (!validTimestamp(input.occurredAt) || !input.idempotencyKey.trim() || input.idempotencyKey.length > 80) {
    throw new JournalEntryError('La fecha o clave del asiento no es válida.');
  }
  if (input.lines.length < 2) {
    throw new JournalEntryError('Un asiento requiere por lo menos dos líneas.');
  }
  const postableCodes = new Set(accounts.filter((account) => account.postable).map((account) => account.code));
  for (const line of input.lines) {
    assertLine(line, postableCodes);
  }
  assertBalanced(input.lines);
}

export function reverseLines(lines: readonly JournalEntryLine[]): JournalEntryLine[] {
  return lines.map((line) => ({ accountCode: line.accountCode, debit: line.credit, credit: line.debit }));
}

function assertLine(line: JournalEntryLine, postableCodes: ReadonlySet<string>): void {
  if (!postableCodes.has(line.accountCode)) {
    throw new JournalEntryError(`La cuenta ${line.accountCode} no acepta asientos.`);
  }
  if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit) || line.debit < 0 || line.credit < 0) {
    throw new JournalEntryError('Los débitos y créditos deben ser importes válidos y positivos.');
  }
  if ((line.debit > 0) === (line.credit > 0)) {
    throw new JournalEntryError('Cada línea debe tener débito o crédito, pero no ambos.');
  }
  if (roundMoney(line.debit) !== line.debit || roundMoney(line.credit) !== line.credit) {
    throw new JournalEntryError('Los importes deben tener como máximo dos decimales.');
  }
}

function assertBalanced(lines: readonly JournalEntryLine[]): void {
  const debit = roundMoney(lines.reduce((total, line) => total + line.debit, 0));
  const credit = roundMoney(lines.reduce((total, line) => total + line.credit, 0));
  if (debit <= 0 || Math.abs(debit - credit) >= 0.01) {
    throw new JournalEntryError('El total del debe debe ser igual al total del haber y mayor que cero.');
  }
}

function validTimestamp(value: string): boolean {
  return value.trim() !== '' && !Number.isNaN(Date.parse(value));
}
