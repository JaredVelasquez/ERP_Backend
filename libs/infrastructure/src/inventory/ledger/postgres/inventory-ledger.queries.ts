import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { roundMoney, type CostLayer } from '@domain/inventory/catalog/costing/costing';
import { DocumentError, assertBalanced, type JournalLine, type StockMovement } from '@domain/inventory/stock/document/document';
import type { ConfirmedDocument, LedgerCommit } from '@domain/inventory/stock/ledger/ledger.port';
import { CompanyEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import {
  CostLayerEntity, InventoryDocumentEntity, InventoryDocumentLineEntity, InventoryJournalEntryEntity,
  InventoryJournalLineEntity, InventoryLayerEffectEntity,
} from '@infrastructure/inventory/ledger/postgres/entities/inventory-ledger.entity';

interface HeaderRow {
  id: string; companyId: string; documentType: string; status: string; idempotencyKey: string;
  occurredAt: Date | string | null; createdAt: Date | string; reversalId: string | null; reversalOf: string | null;
}
interface LineRow { documentId: string; productId: string; direction: string; quantity: unknown; cost: unknown; revenue: unknown }
interface EffectRow {
  documentId: string; productId: string; layerId: string; quantityDelta: unknown; unitCost: unknown;
  receivedAt: Date | string; expiresOn: string | null;
}
interface JournalRow { documentId: string; accountCode: string; debit: unknown; credit: unknown }
interface LayerRow {
  id: string; productId: string; receivedAt: Date | string; expiresOn: string | null; quantity: unknown; unitCost: unknown;
}

export async function findByIdempotency(manager: EntityManager, companyId: string, key: string): Promise<ConfirmedDocument | null> {
  const header = await manager.getRepository(InventoryDocumentEntity).createQueryBuilder('document')
    .where('document.companyId = :companyId AND document.idempotencyKey = :key', { companyId, key })
    .getOne();
  return header ? readDocument(manager, header.id, companyId) : null;
}

export async function findDocument(manager: EntityManager, companyId: string, documentId: string): Promise<ConfirmedDocument | null> {
  return readDocument(manager, documentId, companyId);
}

export async function listDocuments(manager: EntityManager, companyId: string): Promise<ConfirmedDocument[]> {
  const headers = await manager.getRepository(InventoryDocumentEntity).createQueryBuilder('document')
    .select('document.id', 'id').addSelect('document.companyId', 'companyId').addSelect('document.documentType', 'documentType')
    .addSelect('document.status', 'status').addSelect('document.idempotencyKey', 'idempotencyKey')
    .addSelect('COALESCE(document.occurredAt, document.createdAt)', 'occurredAt')
    .addSelect('document.createdAt', 'createdAt').addSelect('document.reversalId', 'reversalId').addSelect('document.reversalOf', 'reversalOf')
    .where('document.companyId = :companyId', { companyId }).orderBy('COALESCE(document.occurredAt, document.createdAt)', 'DESC')
    .getRawMany<HeaderRow>();
  if (headers.length === 0) return [];
  const documentIds = headers.map((header) => header.id);
  const [lines, effects, journals] = await Promise.all([
    readLines(manager, companyId, documentIds), readEffects(manager, companyId, documentIds), readJournals(manager, companyId, documentIds),
  ]);
  const lineMap = groupByDocument(lines);
  const effectMap = groupByDocument(effects);
  const journalMap = groupByDocument(journals);
  return headers.map((header) => assemble(header, lineMap.get(header.id) ?? [], effectMap.get(header.id) ?? [], journalMap.get(header.id) ?? []));
}

export async function loadStock(manager: EntityManager, companyId: string, productIds: readonly string[]): Promise<Array<{ productId: string; layers: CostLayer[] }>> {
  if (productIds.length === 0) return [];
  const rows = await manager.getRepository(CostLayerEntity).createQueryBuilder('layer')
    .select('layer.id', 'id').addSelect('layer.productId', 'productId').addSelect('layer.receivedAt', 'receivedAt')
    .addSelect('layer.expiresOn', 'expiresOn').addSelect('layer.quantity', 'quantity').addSelect('layer.unitCost', 'unitCost')
    .where('layer.companyId = :companyId', { companyId }).andWhere('layer.productId IN (:...productIds)', { productIds })
    .orderBy('layer.receivedAt', 'ASC').addOrderBy('layer.id', 'ASC').getRawMany<LayerRow>();
  const grouped = new Map<string, CostLayer[]>();
  for (const row of rows) {
    const layers = grouped.get(row.productId) ?? [];
    layers.push({ id: row.id, receivedAt: dateText(row.receivedAt), expiresOn: blankToNull(row.expiresOn), quantity: decimal(row.quantity), unitCost: decimal(row.unitCost) });
    grouped.set(row.productId, layers);
  }
  return productIds.map((productId) => ({ productId, layers: grouped.get(productId) ?? [] }));
}

export async function commitLedger(manager: EntityManager, change: LedgerCommit): Promise<void> {
  assertBalanced(change.document.journal);
  await lockCompany(manager, change.document.companyId);
  await assertNoSecondOpening(manager, change.document);
  await insertDocument(manager, change.document);
  await insertLines(manager, change.document);
  await insertEffects(manager, change.document);
  await insertJournals(manager, change.document);
  await replaceStock(manager, change);
  await markVoided(manager, change);
}

async function readDocument(manager: EntityManager, documentId: string, companyId: string): Promise<ConfirmedDocument | null> {
  const header = await manager.getRepository(InventoryDocumentEntity).createQueryBuilder('document')
    .select('document.id', 'id').addSelect('document.companyId', 'companyId').addSelect('document.documentType', 'documentType')
    .addSelect('document.status', 'status').addSelect('document.idempotencyKey', 'idempotencyKey')
    .addSelect('COALESCE(document.occurredAt, document.createdAt)', 'occurredAt')
    .addSelect('document.createdAt', 'createdAt').addSelect('document.reversalId', 'reversalId').addSelect('document.reversalOf', 'reversalOf')
    .where('document.id = :documentId AND document.companyId = :companyId', { documentId, companyId }).getRawOne<HeaderRow>();
  if (!header) return null;
  const [lines, effects, journals] = await Promise.all([
    readLines(manager, companyId, [documentId]), readEffects(manager, companyId, [documentId]), readJournals(manager, companyId, [documentId]),
  ]);
  return assemble(header, lines, effects, journals);
}

async function readLines(manager: EntityManager, companyId: string, documentIds: string[]): Promise<LineRow[]> {
  return manager.getRepository(InventoryDocumentLineEntity).createQueryBuilder('line')
    .innerJoin(InventoryDocumentEntity, 'document', 'document.id = line.documentId')
    .select('line.documentId', 'documentId').addSelect('line.productId', 'productId').addSelect('line.direction', 'direction')
    .addSelect('line.quantity', 'quantity').addSelect('line.cost', 'cost').addSelect('line.revenue', 'revenue')
    .where('document.companyId = :companyId', { companyId }).andWhere('line.documentId IN (:...documentIds)', { documentIds })
    .getRawMany<LineRow>();
}

async function readEffects(manager: EntityManager, companyId: string, documentIds: string[]): Promise<EffectRow[]> {
  return manager.getRepository(InventoryLayerEffectEntity).createQueryBuilder('effect')
    .innerJoin(InventoryDocumentEntity, 'document', 'document.id = effect.documentId')
    .select('effect.documentId', 'documentId').addSelect('effect.productId', 'productId').addSelect('effect.layerId', 'layerId')
    .addSelect('effect.quantityDelta', 'quantityDelta').addSelect('effect.unitCost', 'unitCost')
    .addSelect('effect.receivedAt', 'receivedAt').addSelect('effect.expiresOn', 'expiresOn')
    .where('document.companyId = :companyId', { companyId }).andWhere('effect.documentId IN (:...documentIds)', { documentIds })
    .getRawMany<EffectRow>();
}

async function readJournals(manager: EntityManager, companyId: string, documentIds: string[]): Promise<JournalRow[]> {
  return manager.getRepository(InventoryJournalLineEntity).createQueryBuilder('line')
    .innerJoin(InventoryJournalEntryEntity, 'entry', 'entry.id = line.entryId')
    .innerJoin(InventoryDocumentEntity, 'document', 'document.id = entry.documentId')
    .select('entry.documentId', 'documentId').addSelect('line.accountCode', 'accountCode')
    .addSelect('line.debit', 'debit').addSelect('line.credit', 'credit')
    .where('document.companyId = :companyId', { companyId }).andWhere('entry.documentId IN (:...documentIds)', { documentIds })
    .getRawMany<JournalRow>();
}

async function lockCompany(manager: EntityManager, companyId: string): Promise<void> {
  const company = await manager.getRepository(CompanyEntity).createQueryBuilder('company').select('company.id', 'id')
    .where('company.id = :companyId', { companyId }).setLock('pessimistic_write').getRawOne<{ id: string }>();
  if (!company) throw new DocumentError('Company was not found');
}

async function assertNoSecondOpening(manager: EntityManager, document: ConfirmedDocument): Promise<void> {
  if (document.type !== 'opening') return;
  const existing = await manager.getRepository(InventoryDocumentEntity).createQueryBuilder('document').select('document.id', 'id')
    .where('document.companyId = :companyId AND document.documentType = :type AND document.status = :status', {
      companyId: document.companyId, type: 'opening', status: 'confirmed',
    }).getRawOne<{ id: string }>();
  if (existing) throw new DocumentError('Opening balance was already posted');
}

async function insertDocument(manager: EntityManager, document: ConfirmedDocument): Promise<void> {
  const occurredAt = new Date(document.occurredAt);
  await manager.getRepository(InventoryDocumentEntity).createQueryBuilder().insert().values({
    id: document.id, companyId: document.companyId, documentType: document.type, status: document.status,
    idempotencyKey: document.idempotencyKey, reversalOf: document.reversalOf, reversalId: document.reversalId,
    occurredAt, createdAt: occurredAt,
  }).execute();
}

async function insertLines(manager: EntityManager, document: ConfirmedDocument): Promise<void> {
  if (document.movements.length === 0) return;
  const values = document.movements.map((movement) => ({
    id: randomUUID(), documentId: document.id, productId: movement.productId, direction: movement.direction,
    quantity: String(movement.baseQuantity), cost: String(movement.cost), revenue: String(movement.revenue),
  }));
  await manager.getRepository(InventoryDocumentLineEntity).createQueryBuilder().insert().values(values).execute();
}

async function insertEffects(manager: EntityManager, document: ConfirmedDocument): Promise<void> {
  if (document.effects.length === 0) return;
  const values = document.effects.map((effect) => ({
    id: randomUUID(), documentId: document.id, productId: effect.productId, layerId: effect.layerId,
    quantityDelta: String(effect.quantityDelta), unitCost: String(effect.unitCost), receivedAt: new Date(effect.receivedAt), expiresOn: effect.expiresOn,
  }));
  await manager.getRepository(InventoryLayerEffectEntity).createQueryBuilder().insert().values(values).execute();
}

async function insertJournals(manager: EntityManager, document: ConfirmedDocument): Promise<void> {
  const lines = journalGroups(document.journal);
  if (lines.length === 0) return;
  const entries: InventoryJournalEntryEntity[] = [];
  const journalLines: InventoryJournalLineEntity[] = [];
  for (const group of lines) {
    const entryId = randomUUID();
    entries.push(Object.assign(new InventoryJournalEntryEntity(), { id: entryId, companyId: document.companyId, documentId: document.id, createdAt: new Date(document.occurredAt) }));
    for (const line of group) journalLines.push(Object.assign(new InventoryJournalLineEntity(), {
      id: randomUUID(), entryId, accountCode: line.accountCode, debit: line.debit, credit: line.credit,
    }));
  }
  await manager.getRepository(InventoryJournalEntryEntity).createQueryBuilder().insert().values(entries).execute();
  await manager.getRepository(InventoryJournalLineEntity).createQueryBuilder().insert().values(journalLines).execute();
}

async function replaceStock(manager: EntityManager, change: LedgerCommit): Promise<void> {
  if (change.stock.length === 0) return;
  const productIds = change.stock.map((row) => row.productId);
  await manager.getRepository(CostLayerEntity).createQueryBuilder().delete()
    .where('companyId = :companyId AND productId IN (:...productIds)', { companyId: change.document.companyId, productIds }).execute();
  const layers: CostLayerEntity[] = [];
  for (const row of change.stock) {
    for (const layer of row.layers) layers.push(Object.assign(new CostLayerEntity(), {
      id: layer.id, companyId: row.companyId, productId: row.productId, receivedAt: new Date(layer.receivedAt),
      expiresOn: layer.expiresOn, quantity: String(layer.quantity), unitCost: String(layer.unitCost),
    }));
  }
  if (layers.length > 0) await manager.getRepository(CostLayerEntity).createQueryBuilder().insert().values(layers).execute();
}

async function markVoided(manager: EntityManager, change: LedgerCommit): Promise<void> {
  if (!change.voidedDocumentId) return;
  const result = await manager.getRepository(InventoryDocumentEntity).createQueryBuilder().update(InventoryDocumentEntity)
    .set({ status: 'voided', reversalId: change.document.id })
    .where('companyId = :companyId AND id = :documentId AND status = :status', {
      companyId: change.document.companyId, documentId: change.voidedDocumentId, status: 'confirmed',
    }).execute();
  if (!result.affected) throw new DocumentError('Document was not found');
}

function assemble(header: HeaderRow, lines: readonly LineRow[], effects: readonly EffectRow[], journals: readonly JournalRow[]): ConfirmedDocument {
  return {
    id: header.id, companyId: header.companyId, type: asDocumentType(header.documentType), status: asStatus(header.status),
    idempotencyKey: header.idempotencyKey, occurredAt: dateText(header.occurredAt ?? header.createdAt),
    journal: journals.map((row) => ({ accountCode: row.accountCode, debit: decimal(row.debit), credit: decimal(row.credit) })),
    effects: effects.map((row) => ({
      productId: row.productId, layerId: row.layerId, quantityDelta: decimal(row.quantityDelta), unitCost: decimal(row.unitCost),
      receivedAt: dateText(row.receivedAt), expiresOn: blankToNull(row.expiresOn),
    })),
    movements: lines.map((row) => ({
      productId: row.productId, direction: asDirection(row.direction), baseQuantity: decimal(row.quantity),
      cost: decimal(row.cost), revenue: decimal(row.revenue),
    })),
    reversalId: header.reversalId, reversalOf: header.reversalOf,
  };
}

function groupByDocument<T extends { documentId: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.documentId) ?? [];
    bucket.push(row);
    grouped.set(row.documentId, bucket);
  }
  return grouped;
}

function journalGroups(lines: readonly JournalLine[]): JournalLine[][] {
  const groups: JournalLine[][] = [];
  let current: JournalLine[] = [];
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    current.push(line);
    debit = roundMoney(debit + line.debit);
    credit = roundMoney(credit + line.credit);
    if (debit === credit && debit > 0) {
      groups.push(current);
      current = [];
      debit = 0;
      credit = 0;
    }
  }
  if (current.length > 0) throw new DocumentError('Journal is not balanced');
  return groups;
}

function decimal(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function blankToNull(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value;
}

function asDocumentType(value: string): ConfirmedDocument['type'] {
  if (value === 'purchase' || value === 'opening' || value === 'sale' || value === 'shrinkage' || value === 'adjustment' || value === 'cash-transfer' || value === 'void') return value;
  throw new DocumentError('Document was not found');
}

function asStatus(value: string): ConfirmedDocument['status'] {
  if (value === 'confirmed' || value === 'voided') return value;
  throw new DocumentError('Document was not found');
}

function asDirection(value: string): StockMovement['direction'] {
  if (value === 'in' || value === 'out') return value;
  throw new DocumentError('Document was not found');
}
