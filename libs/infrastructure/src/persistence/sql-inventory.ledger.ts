import { randomUUID } from 'node:crypto';
import { roundMoney, type CostLayer } from '@domain/inventory/costing';
import { DocumentError, assertBalanced, type JournalLine, type LayerEffect, type StockMovement } from '@domain/inventory/document';
import type { ConfirmedDocument, InventoryLedgerPort, LedgerCommit } from '@domain/inventory/ledger.port';
import type { SqlExecutor, SqlSession } from '@infrastructure/persistence/sql-executor';

interface HeaderRow {
  id: string;
  companyId: string;
  documentType: string;
  status: string;
  idempotencyKey: string;
  occurredAt: string;
  reversalId: string | null;
  reversalOf: string | null;
}

interface LineRow {
  documentId: string;
  productId: string;
  direction: string;
  quantity: unknown;
  cost: unknown;
  revenue: unknown;
}

interface EffectRow {
  documentId: string;
  productId: string;
  layerId: string;
  quantityDelta: unknown;
  unitCost: unknown;
  receivedAt: string;
  expiresOn: string | null;
}

interface JournalRow {
  documentId: string;
  accountCode: string;
  debit: unknown;
  credit: unknown;
}

interface LayerRow {
  id: string;
  productId: string;
  receivedAt: string;
  expiresOn: string | null;
  quantity: unknown;
  unitCost: unknown;
}

const HEADER_SQL = `
SELECT id,
       company_id AS companyId,
       document_type AS documentType,
       status,
       idempotency_key AS idempotencyKey,
       CONVERT(varchar(33), COALESCE(occurred_at, created_at), 126) AS occurredAt,
       reversal_id AS reversalId,
       reversal_of AS reversalOf
FROM dbo.inventory_documents
WHERE company_id = @companyId`;

export class SqlInventoryLedger implements InventoryLedgerPort {
  constructor(private readonly sql: SqlExecutor) {}

  async findByIdempotency(companyId: string, key: string): Promise<ConfirmedDocument | null> {
    return this.sql.transaction((session) => readOne(session, `${HEADER_SQL} AND idempotency_key = @key`, { companyId, key }));
  }

  async find(companyId: string, documentId: string): Promise<ConfirmedDocument | null> {
    return this.sql.transaction((session) => readOne(session, `${HEADER_SQL} AND id = @documentId`, { companyId, documentId }));
  }

  async listDocuments(companyId: string): Promise<ConfirmedDocument[]> {
    return this.sql.transaction(async (session) => {
      const headers = await session.query<HeaderRow>(HEADER_SQL, { companyId });
      const lines = await session.query<LineRow>(LINES_SQL, { companyId });
      const effects = await session.query<EffectRow>(EFFECTS_SQL, { companyId });
      const journals = await session.query<JournalRow>(JOURNALS_SQL, { companyId });
      return assembleAll(headers, lines, effects, journals);
    });
  }

  async loadStock(companyId: string, productIds: readonly string[]): Promise<Array<{ productId: string; layers: CostLayer[] }>> {
    if (productIds.length === 0) {
      return [];
    }
    const rows = await this.sql.transaction((session) =>
      session.query<LayerRow>(
        `SELECT id,
                product_id AS productId,
                CONVERT(varchar(33), received_at, 126) AS receivedAt,
                CONVERT(varchar(10), expires_on, 23) AS expiresOn,
                quantity,
                unit_cost AS unitCost
         FROM dbo.cost_layers
         WHERE company_id = @companyId
           AND product_id IN (SELECT CAST(value AS uniqueidentifier) FROM OPENJSON(@ids))`,
        { companyId, ids: JSON.stringify(productIds) },
      ),
    );
    return stockFor(productIds, rows);
  }

  async commit(change: LedgerCommit): Promise<void> {
    assertBalanced(change.document.journal);
    await this.sql.transaction(async (session) => {
      await assertNoSecondOpening(session, change.document);
      await insertDocument(session, change.document);
      await insertLines(session, change.document);
      await insertEffects(session, change.document);
      await insertJournals(session, change.document);
      await replaceStock(session, change);
      await markVoided(session, change);
    });
  }
}

const LINES_SQL = `
SELECT line.document_id AS documentId, line.product_id AS productId, line.direction,
       line.quantity, line.cost, line.revenue
FROM dbo.inventory_document_lines AS line
INNER JOIN dbo.inventory_documents AS document ON document.id = line.document_id
WHERE document.company_id = @companyId`;

const EFFECTS_SQL = `
SELECT effect.document_id AS documentId, effect.product_id AS productId, effect.layer_id AS layerId,
       effect.quantity_delta AS quantityDelta, effect.unit_cost AS unitCost,
       CONVERT(varchar(33), effect.received_at, 126) AS receivedAt,
       CONVERT(varchar(10), effect.expires_on, 23) AS expiresOn
FROM dbo.inventory_layer_effects AS effect
INNER JOIN dbo.inventory_documents AS document ON document.id = effect.document_id
WHERE document.company_id = @companyId`;

const JOURNALS_SQL = `
SELECT entry.document_id AS documentId, line.account_code AS accountCode, line.debit, line.credit
FROM dbo.journal_lines AS line
INNER JOIN dbo.journal_entries AS entry ON entry.id = line.entry_id
INNER JOIN dbo.inventory_documents AS document ON document.id = entry.document_id
WHERE document.company_id = @companyId`;

async function readOne(session: SqlSession, statement: string, params: Record<string, unknown>): Promise<ConfirmedDocument | null> {
  const headers = await session.query<HeaderRow>(statement, params);
  const header = headers[0];
  if (header === undefined) {
    return null;
  }
  const lines = await session.query<LineRow>(`${LINES_SQL} AND document.id = @documentId`, { ...params, documentId: header.id });
  const effects = await session.query<EffectRow>(`${EFFECTS_SQL} AND document.id = @documentId`, { ...params, documentId: header.id });
  const journals = await session.query<JournalRow>(`${JOURNALS_SQL} AND document.id = @documentId`, { ...params, documentId: header.id });
  return assemble(header, lines, effects, journals);
}

async function assertNoSecondOpening(session: SqlSession, document: ConfirmedDocument): Promise<void> {
  if (document.type !== 'opening') {
    return;
  }
  const rows = await session.query<{ id: string }>(
    `SELECT TOP 1 id
     FROM dbo.inventory_documents
     WHERE company_id = @companyId AND document_type = N'opening' AND status = N'confirmed'`,
    { companyId: document.companyId },
  );
  if (rows.length === 0) {
    return;
  }
  throw new DocumentError('Opening balance was already posted');
}

async function insertDocument(session: SqlSession, document: ConfirmedDocument): Promise<void> {
  await session.query(
    `INSERT INTO dbo.inventory_documents
       (id, company_id, document_type, status, idempotency_key, reversal_of, reversal_id, occurred_at, created_at)
     VALUES
       (@id, @companyId, @documentType, @status, @idempotencyKey, @reversalOf, @reversalId, @occurredAt, @occurredAt)`,
    {
      id: document.id,
      companyId: document.companyId,
      documentType: document.type,
      status: document.status,
      idempotencyKey: document.idempotencyKey,
      reversalOf: document.reversalOf,
      reversalId: document.reversalId,
      occurredAt: document.occurredAt,
    },
  );
}

async function insertLines(session: SqlSession, document: ConfirmedDocument): Promise<void> {
  if (document.movements.length === 0) {
    return;
  }
  await session.query(
    `INSERT INTO dbo.inventory_document_lines (id, document_id, product_id, direction, quantity, cost, revenue)
     SELECT id, @documentId, productId, direction, quantity, cost, revenue
     FROM OPENJSON(@lines) WITH (
       id uniqueidentifier '$.id',
       productId uniqueidentifier '$.productId',
       direction nvarchar(8) '$.direction',
       quantity decimal(18, 4) '$.quantity',
       cost decimal(18, 2) '$.cost',
       revenue decimal(18, 2) '$.revenue'
     )`,
    { documentId: document.id, lines: JSON.stringify(linePayload(document.movements)) },
  );
}

async function insertEffects(session: SqlSession, document: ConfirmedDocument): Promise<void> {
  if (document.effects.length === 0) {
    return;
  }
  await session.query(
    `INSERT INTO dbo.inventory_layer_effects
       (id, document_id, product_id, layer_id, quantity_delta, unit_cost, received_at, expires_on)
     SELECT id, @documentId, productId, layerId, quantityDelta, unitCost, receivedAt, expiresOn
     FROM OPENJSON(@effects) WITH (
       id uniqueidentifier '$.id',
       productId uniqueidentifier '$.productId',
       layerId uniqueidentifier '$.layerId',
       quantityDelta decimal(18, 4) '$.quantityDelta',
       unitCost decimal(18, 4) '$.unitCost',
       receivedAt datetime2 '$.receivedAt',
       expiresOn date '$.expiresOn'
     )`,
    { documentId: document.id, effects: JSON.stringify(effectPayload(document.effects)) },
  );
}

async function insertJournals(session: SqlSession, document: ConfirmedDocument): Promise<void> {
  const payload = journalPayload(document);
  await session.query(
    `INSERT INTO dbo.journal_entries (id, company_id, document_id)
     SELECT id, companyId, documentId
     FROM OPENJSON(@entries) WITH (
       id uniqueidentifier '$.id',
       companyId uniqueidentifier '$.companyId',
       documentId uniqueidentifier '$.documentId'
     )`,
    { entries: JSON.stringify(payload.entries) },
  );
  await session.query(
    `INSERT INTO dbo.journal_lines (id, entry_id, account_code, debit, credit)
     SELECT id, entryId, accountCode, debit, credit
     FROM OPENJSON(@lines) WITH (
       id uniqueidentifier '$.id',
       entryId uniqueidentifier '$.entryId',
       accountCode nvarchar(32) '$.accountCode',
       debit decimal(18, 2) '$.debit',
       credit decimal(18, 2) '$.credit'
     )`,
    { lines: JSON.stringify(payload.lines) },
  );
}

async function replaceStock(session: SqlSession, change: LedgerCommit): Promise<void> {
  if (change.stock.length === 0) {
    return;
  }
  const products = change.stock.map((row) => ({ productId: row.productId }));
  await session.query(
    `DELETE FROM dbo.cost_layers
     WHERE company_id = @companyId
       AND product_id IN (SELECT productId FROM OPENJSON(@products) WITH (productId uniqueidentifier '$.productId'))`,
    { companyId: change.document.companyId, products: JSON.stringify(products) },
  );
  await session.query(
    `INSERT INTO dbo.cost_layers (id, company_id, product_id, received_at, expires_on, quantity, unit_cost)
     SELECT id, companyId, productId, receivedAt, expiresOn, quantity, unitCost
     FROM OPENJSON(@layers) WITH (
       id uniqueidentifier '$.id',
       companyId uniqueidentifier '$.companyId',
       productId uniqueidentifier '$.productId',
       receivedAt datetime2 '$.receivedAt',
       expiresOn date '$.expiresOn',
       quantity decimal(18, 4) '$.quantity',
       unitCost decimal(18, 4) '$.unitCost'
     )`,
    { layers: JSON.stringify(layerPayload(change)) },
  );
}

async function markVoided(session: SqlSession, change: LedgerCommit): Promise<void> {
  if (change.voidedDocumentId === null) {
    return;
  }
  const rows = await session.query<{ id: string }>(
    `UPDATE dbo.inventory_documents
     SET status = N'voided', reversal_id = @reversalId
     OUTPUT inserted.id AS id
     WHERE company_id = @companyId AND id = @documentId`,
    { reversalId: change.document.id, companyId: change.document.companyId, documentId: change.voidedDocumentId },
  );
  if (rows.length === 0) {
    throw new DocumentError('Document was not found');
  }
}

function assembleAll(headers: readonly HeaderRow[], lines: readonly LineRow[], effects: readonly EffectRow[], journals: readonly JournalRow[]): ConfirmedDocument[] {
  const lineMap = groupLines(lines);
  const effectMap = groupEffects(effects);
  const journalMap = groupJournals(journals);
  const documents: ConfirmedDocument[] = [];
  for (const header of headers) {
    documents.push(assemble(header, lineMap.get(header.id) ?? [], effectMap.get(header.id) ?? [], journalMap.get(header.id) ?? []));
  }
  return documents;
}

function assemble(header: HeaderRow, lines: readonly LineRow[] | readonly StockMovement[], effects: readonly EffectRow[] | readonly LayerEffect[], journals: readonly JournalRow[] | readonly JournalLine[]): ConfirmedDocument {
  return {
    id: header.id,
    companyId: header.companyId,
    type: asDocumentType(header.documentType),
    status: asStatus(header.status),
    idempotencyKey: header.idempotencyKey,
    occurredAt: header.occurredAt,
    journal: asJournal(journals),
    effects: asEffects(effects),
    movements: asMovements(lines),
    reversalId: header.reversalId,
    reversalOf: header.reversalOf,
  };
}

function asMovements(lines: readonly LineRow[] | readonly StockMovement[]): StockMovement[] {
  if (isMovementList(lines)) {
    return [...lines];
  }
  return lines.map(movementFrom);
}

function asEffects(effects: readonly EffectRow[] | readonly LayerEffect[]): LayerEffect[] {
  if (isEffectList(effects)) {
    return [...effects];
  }
  return effects.map(effectFrom);
}

function asJournal(journals: readonly JournalRow[] | readonly JournalLine[]): JournalLine[] {
  if (isJournalList(journals)) {
    return [...journals];
  }
  return journals.map(journalFrom);
}

function isMovementList(lines: readonly LineRow[] | readonly StockMovement[]): lines is readonly StockMovement[] {
  const first = lines[0];
  return first !== undefined && 'baseQuantity' in first;
}

function isEffectList(effects: readonly EffectRow[] | readonly LayerEffect[]): effects is readonly LayerEffect[] {
  const first = effects[0];
  return first !== undefined && 'quantityDelta' in first && typeof first.quantityDelta === 'number';
}

function isJournalList(journals: readonly JournalRow[] | readonly JournalLine[]): journals is readonly JournalLine[] {
  const first = journals[0];
  return first !== undefined && !('documentId' in first);
}

function movementFrom(row: LineRow): StockMovement {
  return {
    productId: row.productId,
    direction: asDirection(row.direction),
    baseQuantity: asDecimal(row.quantity),
    cost: asDecimal(row.cost),
    revenue: asDecimal(row.revenue),
  };
}

function effectFrom(row: EffectRow): LayerEffect {
  return {
    productId: row.productId,
    layerId: row.layerId,
    quantityDelta: asDecimal(row.quantityDelta),
    unitCost: asDecimal(row.unitCost),
    receivedAt: row.receivedAt,
    expiresOn: blankToNull(row.expiresOn),
  };
}

function journalFrom(row: JournalRow): JournalLine {
  return { accountCode: row.accountCode, debit: asDecimal(row.debit), credit: asDecimal(row.credit) };
}

function groupLines(rows: readonly LineRow[]): Map<string, LineRow[]> {
  const grouped = new Map<string, LineRow[]>();
  for (const row of rows) {
    pushGrouped(grouped, row.documentId, row);
  }
  return grouped;
}

function groupEffects(rows: readonly EffectRow[]): Map<string, EffectRow[]> {
  const grouped = new Map<string, EffectRow[]>();
  for (const row of rows) {
    pushGrouped(grouped, row.documentId, row);
  }
  return grouped;
}

function groupJournals(rows: readonly JournalRow[]): Map<string, JournalRow[]> {
  const grouped = new Map<string, JournalRow[]>();
  for (const row of rows) {
    pushGrouped(grouped, row.documentId, row);
  }
  return grouped;
}

function pushGrouped<T>(grouped: Map<string, T[]>, key: string, row: T): void {
  const current = grouped.get(key) ?? [];
  current.push(row);
  grouped.set(key, current);
}

function stockFor(productIds: readonly string[], rows: readonly LayerRow[]): Array<{ productId: string; layers: CostLayer[] }> {
  const grouped = groupLayers(rows);
  const stock: Array<{ productId: string; layers: CostLayer[] }> = [];
  for (const productId of productIds) {
    stock.push({ productId, layers: grouped.get(productId) ?? [] });
  }
  return stock;
}

function groupLayers(rows: readonly LayerRow[]): Map<string, CostLayer[]> {
  const grouped = new Map<string, CostLayer[]>();
  for (const row of rows) {
    const current = grouped.get(row.productId) ?? [];
    current.push({
      id: row.id,
      receivedAt: row.receivedAt,
      expiresOn: blankToNull(row.expiresOn),
      quantity: asDecimal(row.quantity),
      unitCost: asDecimal(row.unitCost),
    });
    grouped.set(row.productId, current);
  }
  return grouped;
}

function linePayload(movements: readonly StockMovement[]): Array<Record<string, unknown>> {
  return movements.map((movement) => ({
    id: randomUUID(),
    productId: movement.productId,
    direction: movement.direction,
    quantity: movement.baseQuantity,
    cost: movement.cost,
    revenue: movement.revenue,
  }));
}

function effectPayload(effects: readonly LayerEffect[]): Array<Record<string, unknown>> {
  return effects.map((effect) => ({
    id: randomUUID(),
    productId: effect.productId,
    layerId: effect.layerId,
    quantityDelta: effect.quantityDelta,
    unitCost: effect.unitCost,
    receivedAt: effect.receivedAt,
    expiresOn: effect.expiresOn,
  }));
}

function journalPayload(document: ConfirmedDocument): { entries: Array<Record<string, unknown>>; lines: Array<Record<string, unknown>> } {
  const entries: Array<Record<string, unknown>> = [];
  const lines: Array<Record<string, unknown>> = [];
  for (const group of balancedGroups(document.journal)) {
    pushJournal(entries, lines, document, group);
  }
  return { entries, lines };
}

function pushJournal(
  entries: Array<Record<string, unknown>>,
  lines: Array<Record<string, unknown>>,
  document: ConfirmedDocument,
  group: readonly JournalLine[],
): void {
  const entryId = randomUUID();
  entries.push({ id: entryId, companyId: document.companyId, documentId: document.id });
  for (const line of group) {
    lines.push({
      id: randomUUID(),
      entryId,
      accountCode: line.accountCode,
      debit: line.debit,
      credit: line.credit,
    });
  }
}

function balancedGroups(lines: readonly JournalLine[]): JournalLine[][] {
  const groups: JournalLine[][] = [];
  let current: JournalLine[] = [];
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    current = [...current, line];
    debit = roundMoney(debit + line.debit);
    credit = roundMoney(credit + line.credit);
    if (debit === credit && debit > 0) {
      groups.push(current);
      current = [];
      debit = 0;
      credit = 0;
    }
  }
  if (current.length > 0) {
    throw new DocumentError('Journal is not balanced');
  }
  return groups;
}

function layerPayload(change: LedgerCommit): Array<Record<string, unknown>> {
  const layers: Array<Record<string, unknown>> = [];
  for (const row of change.stock) {
    pushLayerRows(layers, row);
  }
  return layers;
}

function pushLayerRows(
  layers: Array<Record<string, unknown>>,
  row: { companyId: string; productId: string; layers: CostLayer[] },
): void {
  for (const layer of row.layers) {
    layers.push({
      id: layer.id,
      companyId: row.companyId,
      productId: row.productId,
      receivedAt: layer.receivedAt,
      expiresOn: layer.expiresOn,
      quantity: layer.quantity,
      unitCost: layer.unitCost,
    });
  }
}

function asDocumentType(value: string): ConfirmedDocument['type'] {
  if (value === 'purchase' || value === 'opening' || value === 'sale' || value === 'shrinkage' || value === 'adjustment' || value === 'cash-transfer' || value === 'void') {
    return value;
  }
  throw new DocumentError('Document was not found');
}

function asStatus(value: string): 'confirmed' | 'voided' {
  if (value === 'confirmed' || value === 'voided') {
    return value;
  }
  throw new DocumentError('Document was not found');
}

function asDirection(value: string): 'in' | 'out' {
  if (value === 'in' || value === 'out') {
    return value;
  }
  throw new DocumentError('Document was not found');
}

function asDecimal(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function blankToNull(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  return value;
}
