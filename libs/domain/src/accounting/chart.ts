export type AccountKind = 'asset' | 'liability' | 'equity' | 'income' | 'cost' | 'expense';

export type AccountLevel = 'class' | 'group' | 'ledger' | 'subaccount';

export interface AccountSeed {
  code: string;
  name: string;
  kind: AccountKind;
  postable: boolean;
  collection: boolean;
}

export interface AccountTreeNode extends AccountSeed {
  children: AccountTreeNode[];
}

export interface TaxCategorySeed {
  code: string;
  name: string;
  ratePercent: number;
  isDefault: boolean;
}

export interface PostingRuleSeed {
  documentType: string;
  debitCode: string | null;
  creditCode: string | null;
  debitUsesCollectionAccount: boolean;
  creditUsesPaymentAccount: boolean;
}

export class AccountNotPostableError extends Error {
  constructor(code: string) {
    super(`Account ${code} cannot receive entries`);
    this.name = 'AccountNotPostableError';
  }
}

export class AccountEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountEditError';
  }
}

export const CHART_OF_ACCOUNTS: readonly AccountSeed[] = [
  { code: '1', name: 'Activo', kind: 'asset', postable: false, collection: false },
  { code: '1.01', name: 'Activo corriente', kind: 'asset', postable: false, collection: false },
  { code: '1.01.01', name: 'Caja y bancos', kind: 'asset', postable: false, collection: false },
  { code: '1.01.01.001', name: 'Caja efectivo', kind: 'asset', postable: true, collection: true },
  { code: '1.01.01.002', name: 'POS BAC Credomatic', kind: 'asset', postable: true, collection: true },
  { code: '1.01.01.003', name: 'POS Ficohsa', kind: 'asset', postable: true, collection: true },
  { code: '1.01.01.004', name: 'Transferencias BAC', kind: 'asset', postable: true, collection: true },
  { code: '1.01.01.005', name: 'Transferencias Ficohsa', kind: 'asset', postable: true, collection: true },
  { code: '1.01.01.006', name: 'Banco BAC', kind: 'asset', postable: true, collection: false },
  { code: '1.01.01.007', name: 'Banco Ficohsa', kind: 'asset', postable: true, collection: false },
  { code: '1.01.02', name: 'Inventarios', kind: 'asset', postable: false, collection: false },
  { code: '1.01.02.001', name: 'Inventario de mercancías', kind: 'asset', postable: true, collection: false },
  { code: '1.01.03', name: 'Impuestos por cobrar', kind: 'asset', postable: false, collection: false },
  { code: '1.01.03.001', name: 'ISV crédito fiscal', kind: 'asset', postable: true, collection: false },
  { code: '2', name: 'Pasivo', kind: 'liability', postable: false, collection: false },
  { code: '2.01', name: 'Pasivo corriente', kind: 'liability', postable: false, collection: false },
  { code: '2.01.01', name: 'Cuentas por pagar', kind: 'liability', postable: false, collection: false },
  { code: '2.01.01.001', name: 'Proveedores', kind: 'liability', postable: true, collection: false },
  { code: '2.01.02', name: 'Impuestos por pagar', kind: 'liability', postable: false, collection: false },
  { code: '2.01.02.001', name: 'ISV por pagar', kind: 'liability', postable: true, collection: false },
  { code: '3', name: 'Patrimonio', kind: 'equity', postable: false, collection: false },
  { code: '3.01', name: 'Capital', kind: 'equity', postable: false, collection: false },
  { code: '3.01.01', name: 'Capital social', kind: 'equity', postable: false, collection: false },
  { code: '3.01.01.001', name: 'Capital', kind: 'equity', postable: true, collection: false },
  { code: '3.01.02', name: 'Resultados', kind: 'equity', postable: false, collection: false },
  { code: '3.01.02.001', name: 'Saldos iniciales', kind: 'equity', postable: true, collection: false },
  { code: '4', name: 'Ingresos', kind: 'income', postable: false, collection: false },
  { code: '4.01', name: 'Ingresos operacionales', kind: 'income', postable: false, collection: false },
  { code: '4.01.01', name: 'Ventas', kind: 'income', postable: false, collection: false },
  { code: '4.01.01.001', name: 'Ventas', kind: 'income', postable: true, collection: false },
  { code: '5', name: 'Costos', kind: 'cost', postable: false, collection: false },
  { code: '5.01', name: 'Costo de ventas', kind: 'cost', postable: false, collection: false },
  { code: '5.01.01', name: 'Costo de mercancía', kind: 'cost', postable: false, collection: false },
  { code: '5.01.01.001', name: 'Costo de ventas', kind: 'cost', postable: true, collection: false },
  { code: '6', name: 'Gastos', kind: 'expense', postable: false, collection: false },
  { code: '6.01', name: 'Gastos operativos', kind: 'expense', postable: false, collection: false },
  { code: '6.01.01', name: 'Gastos de inventario', kind: 'expense', postable: false, collection: false },
  { code: '6.01.01.001', name: 'Merma', kind: 'expense', postable: true, collection: false },
  { code: '6.01.01.002', name: 'Ajuste de inventario', kind: 'expense', postable: true, collection: false },
];

export const TAX_CATEGORIES: readonly TaxCategorySeed[] = [
  { code: 'none', name: 'Sin impuesto', ratePercent: 0, isDefault: true },
  { code: 'exempt', name: 'Exento', ratePercent: 0, isDefault: false },
  { code: 'isv15', name: 'ISV 15', ratePercent: 15, isDefault: false },
  { code: 'isv18', name: 'ISV 18', ratePercent: 18, isDefault: false },
];

export const POSTING_RULES: readonly PostingRuleSeed[] = [
  { documentType: 'sale-revenue', debitCode: null, creditCode: '4.01.01.001', debitUsesCollectionAccount: true, creditUsesPaymentAccount: false },
  { documentType: 'sale-cost', debitCode: '5.01.01.001', creditCode: '1.01.02.001', debitUsesCollectionAccount: false, creditUsesPaymentAccount: false },
  { documentType: 'purchase-cash', debitCode: '1.01.02.001', creditCode: null, debitUsesCollectionAccount: false, creditUsesPaymentAccount: true },
  { documentType: 'purchase-credit', debitCode: '1.01.02.001', creditCode: '2.01.01.001', debitUsesCollectionAccount: false, creditUsesPaymentAccount: false },
  { documentType: 'opening', debitCode: '1.01.02.001', creditCode: '3.01.02.001', debitUsesCollectionAccount: false, creditUsesPaymentAccount: false },
  { documentType: 'shrinkage', debitCode: '6.01.01.001', creditCode: '1.01.02.001', debitUsesCollectionAccount: false, creditUsesPaymentAccount: false },
  { documentType: 'adjustment', debitCode: '6.01.01.002', creditCode: '1.01.02.001', debitUsesCollectionAccount: false, creditUsesPaymentAccount: false },
  { documentType: 'cash-transfer', debitCode: null, creditCode: null, debitUsesCollectionAccount: true, creditUsesPaymentAccount: true },
];

export const ACCOUNT_CODE_REMAP: readonly { previous: string; next: string }[] = [
  { previous: '1.01.001', next: '1.01.01.001' },
  { previous: '1.01.002', next: '1.01.01.002' },
  { previous: '1.01.003', next: '1.01.01.003' },
  { previous: '1.01.004', next: '1.01.01.004' },
  { previous: '1.01.005', next: '1.01.01.005' },
  { previous: '1.01.006', next: '1.01.01.006' },
  { previous: '1.01.007', next: '1.01.01.007' },
  { previous: '1.01.008', next: '1.01.02.001' },
  { previous: '1.01.009', next: '1.01.03.001' },
  { previous: '2.01.001', next: '2.01.01.001' },
  { previous: '2.01.002', next: '2.01.02.001' },
  { previous: '3.01.001', next: '3.01.01.001' },
  { previous: '3.01.002', next: '3.01.02.001' },
  { previous: '4.01.001', next: '4.01.01.001' },
  { previous: '5.01.001', next: '5.01.01.001' },
  { previous: '6.01.001', next: '6.01.01.001' },
  { previous: '6.01.002', next: '6.01.01.002' },
];

export function accountLevel(code: string): AccountLevel {
  const depth = code.split('.').filter((part) => part !== '').length;
  if (depth <= 1) {
    return 'class';
  }
  if (depth === 2) {
    return 'group';
  }
  if (depth === 3) {
    return 'ledger';
  }
  return 'subaccount';
}

export function remapAccountCode(code: string): string {
  const pair = ACCOUNT_CODE_REMAP.find((item) => item.previous === code);
  if (pair === undefined) {
    return code;
  }
  return pair.next;
}

export function alignAccounts(accounts: readonly AccountSeed[]): AccountSeed[] {
  const next = new Map<string, AccountSeed>();
  for (const account of accounts) {
    pushAligned(next, account);
  }
  for (const seed of CHART_OF_ACCOUNTS) {
    ensureSeed(next, seed);
  }
  return [...next.values()];
}

export function alignRule(rule: PostingRuleSeed): PostingRuleSeed {
  return {
    ...rule,
    debitCode: remapNullable(rule.debitCode),
    creditCode: remapNullable(rule.creditCode),
  };
}

export function editAccount(
  accounts: readonly AccountSeed[],
  code: string,
  name: string,
  collection: boolean,
): AccountSeed[] {
  const account = accounts.find((item) => item.code === code);
  if (account === undefined) {
    throw new AccountEditError('Account was not found');
  }
  const trimmed = name.trim();
  if (trimmed === '') {
    throw new AccountEditError('Name is required');
  }
  assertSubaccountCollection(account, collection);
  return accounts.map((item) => replaceEdited(item, account.code, trimmed, collection));
}

export function assertCanReceiveEntry(account: AccountSeed): void {
  if (accountLevel(account.code) !== 'subaccount' || !account.postable) {
    throw new AccountNotPostableError(account.code);
  }
}

export function buildAccountTree(accounts: readonly AccountSeed[]): AccountTreeNode[] {
  const nodes = [...accounts]
    .sort((left, right) => compareCode(left.code, right.code))
    .map((account) => ({ ...account, children: [] as AccountTreeNode[] }));
  const roots: AccountTreeNode[] = [];
  for (const node of nodes) {
    const parent = findParent(node.code, nodes);
    if (parent === undefined) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }
  return roots;
}

function findParent(code: string, nodes: readonly AccountTreeNode[]): AccountTreeNode | undefined {
  const matches = nodes.filter((node) => node.code !== code && code.startsWith(`${node.code}.`));
  return matches.sort((left, right) => right.code.length - left.code.length)[0];
}

function compareCode(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function pushAligned(next: Map<string, AccountSeed>, account: AccountSeed): void {
  const code = remapAccountCode(account.code);
  if (next.has(code)) {
    return;
  }
  const postable = accountLevel(code) === 'subaccount';
  next.set(code, {
    ...account,
    code,
    postable,
    collection: postable && account.collection,
  });
}

function ensureSeed(next: Map<string, AccountSeed>, seed: AccountSeed): void {
  if (next.has(seed.code)) {
    return;
  }
  next.set(seed.code, { ...seed });
}

function remapNullable(code: string | null): string | null {
  if (code === null) {
    return null;
  }
  return remapAccountCode(code);
}

function assertSubaccountCollection(account: AccountSeed, collection: boolean): void {
  if (accountLevel(account.code) === 'subaccount' || !collection) {
    return;
  }
  throw new AccountEditError('Only a subaccount can be a collection account');
}

function replaceEdited(item: AccountSeed, code: string, name: string, collection: boolean): AccountSeed {
  if (item.code !== code) {
    return item;
  }
  if (accountLevel(item.code) !== 'subaccount') {
    return { ...item, name, postable: false, collection: false };
  }
  return { ...item, name, postable: true, collection };
}
