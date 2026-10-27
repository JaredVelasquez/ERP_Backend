import {
  AccountNotPostableError,
  CHART_OF_ACCOUNTS,
  POSTING_RULES,
  TAX_CATEGORIES,
  accountLevel,
  alignAccounts,
  assertCanReceiveEntry,
  buildAccountTree,
} from '@domain/accounting/account/chart';

describe('chart of accounts', () => {
  it('rejects an entry on a parent account', () => {
    const parent = CHART_OF_ACCOUNTS.find((account) => account.code === '1');

    expect(parent?.postable).toBe(false);
    expect(() => assertCanReceiveEntry(parent!)).toThrow(AccountNotPostableError);
  });

  it('marks Caja efectivo as a collection account', () => {
    const cash = CHART_OF_ACCOUNTS.find((account) => account.code === '1.01.01.001');

    expect(cash).toMatchObject({ name: 'Caja efectivo', postable: true, collection: true });
  });

  it('lists the tree in code order with Caja efectivo under current assets', () => {
    const tree = buildAccountTree(CHART_OF_ACCOUNTS);

    expect(tree.map((node) => node.code)).toEqual(['1', '2', '3', '4', '5', '6']);
    const currentAssets = tree[0]?.children[0];
    const cashLedger = currentAssets?.children[0];
    expect(currentAssets?.code).toBe('1.01');
    expect(cashLedger).toMatchObject({ code: '1.01.01', name: 'Caja y bancos', postable: false });
    expect(cashLedger?.children[0]).toMatchObject({ code: '1.01.01.001', name: 'Caja efectivo', postable: true });
  });

  it('seeds tax categories without turning tax on', () => {
    const defaultCategory = TAX_CATEGORIES.find((category) => category.isDefault);

    expect(defaultCategory).toMatchObject({ code: 'none', ratePercent: 0 });
    expect(TAX_CATEGORIES.map((category) => category.code)).toEqual(['none', 'exempt', 'isv15', 'isv18']);
    expect(POSTING_RULES.some((rule) => rule.documentType === 'sale-revenue' && rule.creditCode === '4.01.01.001')).toBe(
      true,
    );
  });

  it('keeps a ledger account closed and remaps an old leaf once', () => {
    const ledger = CHART_OF_ACCOUNTS.find((account) => account.code === '1.01.01');
    const aligned = alignAccounts([
      { code: '1', name: 'Activo', kind: 'asset', postable: false, collection: false },
      { code: '1.01.008', name: 'Inventario de mercadería', kind: 'asset', postable: true, collection: false },
    ]);
    const inventory = aligned.find((account) => account.code === '1.01.02.001');

    expect(ledger).toMatchObject({ postable: false });
    expect(accountLevel('1.01.01')).toBe('ledger');
    expect(accountLevel('1')).toBe('class');
    expect(() => assertCanReceiveEntry(ledger!)).toThrow(AccountNotPostableError);
    expect(inventory).toMatchObject({ name: 'Inventario de mercadería', postable: true });
    expect(alignAccounts(aligned).filter((account) => account.code === '1.01.02.001')).toHaveLength(1);
    expect(aligned.some((account) => account.code === '1.01.008')).toBe(false);
  });
});
