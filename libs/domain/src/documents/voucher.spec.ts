import { VoucherError, confirmVoucher, renderVoucherHtml, renderVoucherPdf, voidVoucher, VOUCHER_DECLARATION, VOUCHER_FORM_TITLE, type CashVoucher } from '@domain/documents/voucher';

const SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQERH5DwABuAE8a9JwDAAAAABJRU5ErkJggg==';

describe('Ficohsa voucher', () => {
  it('stores one copy and repeats the same PDF from the saved form', () => {
    const html = renderVoucherHtml(sample());
    const first = renderVoucherPdf(sample());
    const second = renderVoucherPdf(sample());
    const pdf = first.toString('utf8');

    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toContain('data:image/png');
    expect(html).toContain(VOUCHER_FORM_TITLE);
    expect(html).toContain(VOUCHER_DECLARATION);
    expect(html).not.toContain('La persona confirma que la información es correcta.');
    expect(html).not.toContain('drive.google.com');
    expect(pdf).toContain('/Count 1');
    expect(pdf.match(/FORMULARIO GENERAL DE TRANSACCIONES/g)).toHaveLength(1);
    expect(pdf).toContain('Depósito a cuenta');
    expect(pdf).toContain('Michelle');
    expect(pdf).toContain('Referencia bancaria AUTH-9');
    expect(pdf).toContain('/Subtype /Image');
    expect(second.equals(first)).toBe(true);
  });

  it('rejects a download without the bank reference', () => {
    expect(() => renderVoucherPdf({ ...sample(), bankReference: '  ' })).toThrow(VoucherError);
  });

  it('keeps the money-movement link when the voucher is voided', () => {
    const voided = voidVoucher({ ...sample(), status: 'confirmed', moneyMovementId: 'move-1' });
    const again = voidVoucher(voided);

    expect(voided.status).toBe('voided');
    expect(voided.moneyMovementId).toBe('move-1');
    expect(again).toEqual(voided);
  });

  it('rejects a transfer from another company and a movement that touches inventory', () => {
    const draft = { ...sample(), status: 'draft' as const };

    expect(() =>
      confirmVoucher(
        { ...draft, moneyMovementId: 'move-1' },
        { id: 'move-1', companyId: 'company-2', type: 'cash-transfer', effectsCount: 0 },
      ),
    ).toThrow('another company');
    expect(() =>
      confirmVoucher(
        { ...draft, moneyMovementId: 'move-1' },
        { id: 'move-1', companyId: 'company-1', type: 'sale', effectsCount: 1 },
      ),
    ).toThrow('money transfer');
  });

  it('refuses a voucher without a drawn signature', () => {
    expect(() => renderVoucherPdf({ ...sample(), signature: '' })).toThrow(VoucherError);
  });

  it('requires a short text when the service is Otro', () => {
    expect(() => renderVoucherHtml({ ...sample(), serviceType: 'otro', serviceNote: '  ' })).toThrow(
      'short description',
    );
  });
});

function sample(): CashVoucher {
  return {
    id: 'voucher-1',
    companyId: 'company-1',
    serviceType: 'deposito-cuenta',
    serviceNote: '',
    amount: 1500,
    currency: 'HNL',
    reference: '001-123',
    holder: 'Michelle',
    institution: 'Ficohsa',
    dni: '0801199012345',
    phone: '99990000',
    occurredOn: '2026-10-04',
    acceptedDeclaration: true,
    signature: SIGNATURE_PNG,
    bankReference: 'AUTH-9',
    moneyMovementId: null,
    status: 'confirmed',
  };
}
