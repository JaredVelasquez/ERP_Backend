import { DocumentError, type DocumentLine, type DraftDocument } from '@domain/inventory/stock/document/document';

export interface IssueLineRequest {
  productId: string;
  unit: string;
  quantity: number;
}

export function assertIssueRequests(lines: readonly IssueLineRequest[]): void {
  if (lines.length === 0) {
    throw new DocumentError('Issue needs a line');
  }
  for (const line of lines) {
    assertIssueRequest(line);
  }
}

export function buildOutboundAdjustment(input: {
  id: string;
  companyId: string;
  idempotencyKey: string;
  lines: DocumentLine[];
}): DraftDocument {
  const draft: DraftDocument = {
    id: input.id,
    companyId: input.companyId,
    type: 'adjustment',
    idempotencyKey: input.idempotencyKey,
    paymentAccountCode: null,
    collectionAccountCode: null,
    adjustmentDirection: 'out',
    transferAmount: null,
    transferFromAccountCode: null,
    transferToAccountCode: null,
    lines: input.lines,
  };
  assertOutboundAdjustment(draft);
  return draft;
}

export function assertOutboundAdjustment(draft: DraftDocument): void {
  if (draft.type !== 'adjustment') {
    throw new DocumentError('Issue must be an outbound adjustment');
  }
  if (draft.adjustmentDirection !== 'out') {
    throw new DocumentError('Issue must be an outbound adjustment');
  }
  if (draft.collectionAccountCode !== null || draft.paymentAccountCode !== null) {
    throw new DocumentError('Issue does not accept a collection account');
  }
  if (draft.lines.length === 0) {
    throw new DocumentError('Issue needs a line');
  }
  for (const line of draft.lines) {
    assertIssueLine(line);
  }
}

function assertIssueRequest(line: IssueLineRequest): void {
  if (line.productId.trim() === '' || line.unit.trim() === '') {
    throw new DocumentError('Product and presentation are required');
  }
  if (line.quantity <= 0) {
    throw new DocumentError('Quantity must be greater than zero');
  }
}

function assertIssueLine(line: DocumentLine): void {
  if (line.quantity <= 0 || line.presentationFactor <= 0) {
    throw new DocumentError('Quantity and factor must be greater than zero');
  }
  if (line.saleAmount !== null) {
    throw new DocumentError('Issue must not post a sale');
  }
}
