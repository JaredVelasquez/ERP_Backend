import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionRecord } from '@domain/identity/session/session.port';
import { PRICE_WORKFLOW_PORT, PriceWorkflowError, type PriceWorkflowPort } from '@domain/inventory/catalog/pricing/price-workflow.port';

@Injectable()
export class ListCommercialPricesUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(companyId: string, page: number, pageSize: number, search: string) {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new PriceWorkflowError('Invalid page');
    }
    return this.prices.catalog(companyId, page, pageSize, search.trim());
  }
}

@Injectable()
export class ListPriceProposalsUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(companyId: string, page = 1, pageSize = 100, status = '') {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 101 || !['', 'pending', 'approved', 'rejected'].includes(status)) {
      throw new PriceWorkflowError('Invalid proposal query');
    }
    return this.prices.proposals(companyId, page, pageSize, status);
  }
}

@Injectable()
export class ListCommercialPriceHistoryUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(companyId: string, page = 1, pageSize = 100) {
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 101) {
      throw new PriceWorkflowError('Invalid page');
    }
    return this.prices.history(companyId, page, pageSize);
  }
}

@Injectable()
export class ProposePriceUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(session: SessionRecord, input: { productId: string; unit: string; proposedPrice: number; reason: string }) {
    if (!Number.isFinite(input.proposedPrice) || input.proposedPrice < 0 || input.reason.trim() === '') {
      throw new PriceWorkflowError('Price and reason are required');
    }
    return this.prices.propose({
      id: randomUUID(), companyId: session.companyId, productId: input.productId,
      unit: input.unit.trim(), proposedPrice: input.proposedPrice,
      reason: input.reason.trim(), actorId: session.userId,
    });
  }
}

@Injectable()
export class ResolvePriceProposalUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(session: SessionRecord, proposalId: string, decision: 'approved' | 'rejected', note: string) {
    if (decision === 'rejected' && note.trim() === '') {
      throw new PriceWorkflowError('A rejection needs a reason');
    }
    return this.prices.resolve({
      companyId: session.companyId, proposalId, actorId: session.userId,
      owner: session.role === 'owner', decision, note: note.trim(),
      historyId: randomUUID(), changeId: randomUUID(),
    });
  }
}

@Injectable()
export class SetDirectPriceUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(session: SessionRecord, input: { productId: string; unit: string; price: number; reason: string }) {
    if (!Number.isFinite(input?.price) || input.price < 0 || !input.productId?.trim() || !input.unit?.trim() || !input.reason?.trim()) {
      throw new PriceWorkflowError('Producto, precio y motivo son obligatorios.');
    }
    return this.prices.setDirect({
      companyId: session.companyId, productId: input.productId, unit: input.unit.trim(),
      price: input.price, reason: input.reason.trim(), actorId: session.userId,
      owner: session.role === 'owner', historyId: randomUUID(), changeId: randomUUID(),
    });
  }
}

@Injectable()
export class ReadPriceSettingsUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  async execute(companyId: string) {
    const [settings, approvers] = await Promise.all([
      this.prices.settings(companyId), this.prices.approvers(companyId),
    ]);
    return { ...settings, approvers };
  }
}

@Injectable()
export class DesignatePriceApproverUseCase {
  constructor(@Inject(PRICE_WORKFLOW_PORT) private readonly prices: PriceWorkflowPort) {}

  execute(session: SessionRecord, userId: string | null) {
    if (session.role !== 'owner') {
      throw new PriceWorkflowError('Only the company owner can designate the price approver', 'forbidden');
    }
    return this.prices.designate(session.companyId, userId?.trim() || null);
  }
}
