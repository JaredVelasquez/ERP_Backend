import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { JournalEntryError, type JournalEntry } from '@domain/accounting/journal-entry/journal-entry';
import { JournalEntryEntity, JournalEntryLineEntity } from '@infrastructure/accounting/journal-entry/postgres/entities/journal-entry.entity';

export async function appendEntry(manager: EntityManager, entry: JournalEntry): Promise<JournalEntry> {
  await assertOpenPeriod(manager, entry.companyId, entry.occurredAt);
  const inserted = await manager.getRepository(JournalEntryEntity).createQueryBuilder().insert().values(entryValues(entry))
    .orIgnore().returning('id').execute();
  if (inserted.raw.length === 0) return requireEntry(await readEntryByKey(manager, entry.companyId, entry.idempotencyKey));
  await insertLines(manager, entry);
  return requireEntry(await readEntry(manager, entry.companyId, entry.id));
}

async function assertOpenPeriod(manager: EntityManager, companyId: string, occurredAt: string): Promise<void> {
  const date = occurredAt.slice(0, 10);
  const period = await manager.createQueryBuilder().select('period.status', 'status').from('accounting_periods', 'period')
    .where('period.company_id = :companyId AND :date BETWEEN period.starts_on AND period.ends_on', { companyId, date })
    .orderBy('period.starts_on', 'DESC').getRawOne<{ status: string }>();
  if (period?.status === 'closed') throw new JournalEntryError('El periodo contable de esta fecha está cerrado.');
}

export async function readEntry(manager: EntityManager, companyId: string, id: string): Promise<JournalEntry | null> {
  const entity = await manager.getRepository(JournalEntryEntity).createQueryBuilder('entry')
    .where('entry.companyId = :companyId AND entry.id = :id', { companyId, id }).getOne();
  if (!entity) return null;
  const lines = await manager.getRepository(JournalEntryLineEntity).createQueryBuilder('line')
    .where('line.entryId = :entryId', { entryId: id }).orderBy('line.id', 'ASC').getMany();
  return { ...entryRecord(entity), lines: lines.map(lineRecord) };
}

export async function listEntries(manager: EntityManager, companyId: string, limit: number): Promise<JournalEntry[]> {
  const headers = await manager.getRepository(JournalEntryEntity).createQueryBuilder('entry')
    .where('entry.companyId = :companyId', { companyId }).orderBy('entry.occurredAt', 'DESC')
    .addOrderBy('entry.id', 'ASC').take(limit).getMany();
  return readLines(manager, headers);
}

export async function entriesThroughDate(manager: EntityManager, companyId: string, date: string): Promise<JournalEntry[]> {
  const end = new Date(`${date}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const headers = await manager.getRepository(JournalEntryEntity).createQueryBuilder('entry')
    .where('entry.companyId = :companyId AND entry.occurredAt < :end', { companyId, end })
    .orderBy('entry.occurredAt', 'ASC').addOrderBy('entry.id', 'ASC').getMany();
  return readLines(manager, headers);
}

export async function appendReversal(
  manager: EntityManager,
  companyId: string,
  entryId: string,
  reversal: JournalEntry,
): Promise<{ original: JournalEntry; reversal: JournalEntry }> {
  const original = await manager.getRepository(JournalEntryEntity).createQueryBuilder('entry')
    .setLock('pessimistic_write')
    .where('entry.companyId = :companyId AND entry.id = :entryId', { companyId, entryId }).getOne();
  if (!original) throw new JournalEntryError('No se encontró el asiento en esta empresa.');
  if (original.status === 'voided' && original.reversalId !== null) {
    return {
      original: requireEntry(await readEntry(manager, companyId, original.id)),
      reversal: requireEntry(await readEntry(manager, companyId, original.reversalId)),
    };
  }
  await manager.getRepository(JournalEntryEntity).createQueryBuilder().insert().values(entryValues(reversal)).execute();
  await insertLines(manager, reversal);
  await manager.getRepository(JournalEntryEntity).createQueryBuilder().update(JournalEntryEntity)
    .set({ status: 'voided', reversalId: reversal.id }).where('companyId = :companyId AND id = :entryId', { companyId, entryId }).execute();
  return {
    original: requireEntry(await readEntry(manager, companyId, entryId)),
    reversal: requireEntry(await readEntry(manager, companyId, reversal.id)),
  };
}

async function readEntryByKey(manager: EntityManager, companyId: string, idempotencyKey: string): Promise<JournalEntry | null> {
  const entity = await manager.getRepository(JournalEntryEntity).createQueryBuilder('entry')
    .where('entry.companyId = :companyId AND entry.idempotencyKey = :idempotencyKey', { companyId, idempotencyKey }).getOne();
  if (!entity) return null;
  return readEntry(manager, companyId, entity.id);
}

async function readLines(manager: EntityManager, headers: readonly JournalEntryEntity[]): Promise<JournalEntry[]> {
  if (headers.length === 0) return [];
  const entryIds = headers.map((header) => header.id);
  const lines = await manager.getRepository(JournalEntryLineEntity).createQueryBuilder('line')
    .where('line.entryId IN (:...entryIds)', { entryIds }).orderBy('line.entryId', 'ASC').addOrderBy('line.id', 'ASC').getMany();
  const byEntry = new Map<string, JournalEntryLineEntity[]>();
  for (const line of lines) byEntry.set(line.entryId, [...(byEntry.get(line.entryId) ?? []), line]);
  return headers.map((header) => ({ ...entryRecord(header), lines: (byEntry.get(header.id) ?? []).map(lineRecord) }));
}

async function insertLines(manager: EntityManager, entry: JournalEntry): Promise<void> {
  const lines = entry.lines.map((line) => Object.assign(new JournalEntryLineEntity(), {
    id: randomUUID(), entryId: entry.id, accountCode: line.accountCode, debit: String(line.debit), credit: String(line.credit),
  }));
  await manager.getRepository(JournalEntryLineEntity).createQueryBuilder().insert().values(lines).execute();
}

function entryValues(entry: JournalEntry): JournalEntryEntity {
  return Object.assign(new JournalEntryEntity(), {
    id: entry.id, companyId: entry.companyId, occurredAt: new Date(entry.occurredAt), description: entry.description,
    idempotencyKey: entry.idempotencyKey, status: entry.status, createdBy: entry.createdBy,
    reversalOf: entry.reversalOf, reversalId: entry.reversalId,
  });
}

function entryRecord(entity: JournalEntryEntity): Omit<JournalEntry, 'lines'> {
  return {
    id: entity.id, companyId: entity.companyId, occurredAt: entity.occurredAt.toISOString(), description: entity.description,
    idempotencyKey: entity.idempotencyKey, status: entity.status, createdBy: entity.createdBy,
    reversalOf: entity.reversalOf, reversalId: entity.reversalId,
  };
}

function lineRecord(entity: JournalEntryLineEntity): JournalEntry['lines'][number] {
  return { accountCode: entity.accountCode, debit: Number(entity.debit), credit: Number(entity.credit) };
}

function requireEntry(entry: JournalEntry | null): JournalEntry {
  if (!entry) throw new JournalEntryError('No se pudo recuperar el asiento contable.');
  return entry;
}
