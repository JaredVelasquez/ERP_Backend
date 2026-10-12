import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DocumentError, planVoid, type StockSnapshot } from '@domain/inventory/document';
import { LEDGER_PORT, type ConfirmedDocument, type InventoryLedgerPort } from '@domain/inventory/ledger.port';

@Injectable()
export class VoidDocumentUseCase {
  constructor(@Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort) {}

  async execute(companyId: string, documentId: string): Promise<ConfirmedDocument> {
    const original = await this.ledger.find(companyId, documentId);
    if (original === null) {
      throw new DocumentError('Document was not found');
    }
    if (original.status === 'voided') {
      return this.existingReversal(original);
    }
    const reversalId = randomUUID();
    const plan = planVoid({
      status: original.status,
      effects: original.effects,
      journal: original.journal,
      stock: await this.currentStock(original),
      reversalId,
    });
    const reversal: ConfirmedDocument = {
      id: reversalId,
      companyId,
      type: 'void',
      status: 'confirmed',
      idempotencyKey: `void:${original.id}`,
      occurredAt: original.occurredAt,
      journal: plan.journal,
      effects: [],
      movements: [],
      reversalId: null,
      reversalOf: original.id,
    };
    await this.ledger.commit({
      document: reversal,
      voidedDocumentId: original.id,
      stock: plan.stockChanges.map((change) => ({ ...change, companyId })),
    });
    return reversal;
  }

  private async existingReversal(original: ConfirmedDocument): Promise<ConfirmedDocument> {
    const reversal = await this.ledger.find(original.companyId, original.reversalId ?? '');
    if (reversal === null) {
      throw new DocumentError('Reversal is missing');
    }
    return reversal;
  }

  private async currentStock(original: ConfirmedDocument): Promise<StockSnapshot[]> {
    const ids = uniqueIds(original.effects.map((effect) => effect.productId));
    const stored = await this.ledger.loadStock(original.companyId, ids);
    return stored.map((row) => ({ productId: row.productId, method: 'PEPS' as const, layers: row.layers }));
  }
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    pushUnique(seen, unique, id);
  }
  return unique;
}

function pushUnique(seen: Set<string>, unique: string[], id: string): void {
  if (seen.has(id)) {
    return;
  }
  seen.add(id);
  unique.push(id);
}
