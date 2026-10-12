import { ConfirmVoucherUseCase, VoidVoucherUseCase } from '@application/documents/confirm-voucher.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase } from '@application/documents/save-voucher.use-case';
import type { CashVoucher } from '@domain/documents/voucher';
import type { VoucherPort } from '@domain/documents/voucher.port';
import type { ConfirmedDocument, InventoryLedgerPort, LedgerCommit } from '@domain/inventory/ledger.port';
import type { CostLayer } from '@domain/inventory/costing';

class MemoryVouchers implements VoucherPort {
  private readonly saved = new Map<string, CashVoucher>();

  async save(voucher: CashVoucher): Promise<void> {
    this.saved.set(voucher.id, voucher);
  }

  async find(_companyId: string, voucherId: string): Promise<CashVoucher | null> {
    return this.saved.get(voucherId) ?? null;
  }
}

class MemoryLedger implements InventoryLedgerPort {
  commits = 0;
  movement: ConfirmedDocument | null = transfer('company-1');

  async find(companyId: string, documentId: string): Promise<ConfirmedDocument | null> {
    if (this.movement === null || this.movement.companyId !== companyId || this.movement.id !== documentId) {
      return null;
    }
    return this.movement;
  }

  async findByIdempotency(): Promise<ConfirmedDocument | null> {
    return null;
  }

  async loadStock(): Promise<Array<{ productId: string; layers: CostLayer[] }>> {
    return [];
  }

  async listDocuments(): Promise<ConfirmedDocument[]> {
    return this.movement === null ? [] : [this.movement];
  }

  async commit(_change: LedgerCommit): Promise<void> {
    this.commits += 1;
  }
}

describe('saved voucher download', () => {
  it('confirms the link without a second journal entry and repeats the PDF', async () => {
    const vouchers = new MemoryVouchers();
    const ledger = new MemoryLedger();
    const saved = await new SaveVoucherUseCase(vouchers).execute({
      ...draftCommand(),
      moneyMovementId: 'move-1',
    });
    const confirmed = await new ConfirmVoucherUseCase(vouchers, ledger).execute('company-1', saved.id);
    const again = await new ConfirmVoucherUseCase(vouchers, ledger).execute('company-1', saved.id);
    const download = new DownloadVoucherUseCase(vouchers);
    const first = await download.execute('company-1', saved.id);
    const second = await download.execute('company-1', saved.id);
    const voided = await new VoidVoucherUseCase(vouchers).execute('company-1', saved.id);

    expect(confirmed.moneyMovementId).toBe('move-1');
    expect(again.status).toBe('confirmed');
    expect(ledger.commits).toBe(0);
    expect(ledger.movement?.type).toBe('cash-transfer');
    expect(saved.signature.startsWith('data:image/')).toBe(true);
    expect(second.equals(first)).toBe(true);
    expect(first.toString('utf8')).toContain('Referencia bancaria AUTH-9');
    expect(voided.status).toBe('voided');
    expect(voided.moneyMovementId).toBe('move-1');
  });

  it('rejects a movement from another company and does not post', async () => {
    const vouchers = new MemoryVouchers();
    const ledger = new MemoryLedger();
    ledger.movement = transfer('company-2');
    const saved = await new SaveVoucherUseCase(vouchers).execute({
      ...draftCommand(),
      moneyMovementId: 'move-1',
    });

    await expect(new ConfirmVoucherUseCase(vouchers, ledger).execute('company-1', saved.id)).rejects.toThrow(
      'another company',
    );
    expect(ledger.commits).toBe(0);
    expect((await vouchers.find('company-1', saved.id))?.status).toBe('draft');
  });

  it('stores a blank movement as empty and confirms without a journal', async () => {
    const vouchers = new MemoryVouchers();
    const ledger = new MemoryLedger();
    const saved = await new SaveVoucherUseCase(vouchers).execute({
      ...draftCommand(),
      moneyMovementId: '  ',
    });
    const confirmed = await new ConfirmVoucherUseCase(vouchers, ledger).execute('company-1', saved.id);

    expect(saved.moneyMovementId).toBeNull();
    expect(confirmed.status).toBe('confirmed');
    expect(ledger.commits).toBe(0);
  });
});

function draftCommand() {
  return {
    companyId: 'company-1',
    serviceType: 'cobro-remesa' as const,
    amount: 200,
    currency: 'USD' as const,
    reference: 'REM-1',
    holder: 'Ana',
    institution: 'Ficohsa',
    dni: '0801',
    phone: '9999',
    occurredOn: '2026-10-04',
    acceptedDeclaration: true,
    signature: 'data:image/png;base64,bbb',
    bankReference: 'AUTH-9',
  };
}

function transfer(companyId: string): ConfirmedDocument {
  return {
    id: 'move-1',
    companyId,
    type: 'cash-transfer',
    status: 'confirmed',
    idempotencyKey: 'move-1',
    occurredAt: '2026-10-04T00:00:00.000Z',
    journal: [
      { accountCode: '1.01.01.003', debit: 200, credit: 0 },
      { accountCode: '1.01.01.001', debit: 0, credit: 200 },
    ],
    effects: [],
    movements: [],
    reversalId: null,
    reversalOf: null,
  };
}
