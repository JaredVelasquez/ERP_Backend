import { Inject, Injectable } from '@nestjs/common';
import {
  CHART_OF_ACCOUNTS,
  POSTING_RULES,
  TAX_CATEGORIES,
  alignAccounts,
  alignRule,
  buildAccountTree,
  type AccountSeed,
  type AccountTreeNode,
  type PostingRuleSeed,
} from '@domain/accounting/chart';
import { ACCOUNTING_PORT, type AccountingPort, type CompanyChart } from '@domain/accounting/accounting.port';

@Injectable()
export class SeedChartUseCase {
  constructor(@Inject(ACCOUNTING_PORT) private readonly accounting: AccountingPort) {}

  async execute(companyId: string): Promise<AccountTreeNode[]> {
    const existing = await this.accounting.findChart(companyId);
    if (existing === null) {
      const chart = freshChart();
      await this.accounting.saveChart(companyId, chart);
      return buildAccountTree(chart.accounts);
    }
    const accounts = alignAccounts(existing.accounts);
    const rules = existing.rules.map(alignRule);
    if (sameAccounts(existing.accounts, accounts) && sameRules(existing.rules, rules)) {
      return buildAccountTree(existing.accounts);
    }
    await this.accounting.saveChart(companyId, { ...existing, accounts, rules });
    return buildAccountTree(accounts);
  }
}

function freshChart(): CompanyChart {
  return {
    accounts: CHART_OF_ACCOUNTS.map((account) => ({ ...account })),
    rules: POSTING_RULES.map((rule) => ({ ...rule })),
    taxes: TAX_CATEGORIES.map((tax) => ({ ...tax })),
  };
}

function sameAccounts(left: readonly AccountSeed[], right: readonly AccountSeed[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const orderedRight = [...right].sort(byCode);
  return [...left].sort(byCode).every((account, index) => sameAccount(account, orderedRight[index]));
}

function sameRules(left: readonly PostingRuleSeed[], right: readonly PostingRuleSeed[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((rule, index) => sameRule(rule, right[index]));
}

function sameAccount(left: AccountSeed | undefined, right: AccountSeed | undefined): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  return left.code === right.code && left.name === right.name && left.postable === right.postable && left.collection === right.collection && left.kind === right.kind;
}

function sameRule(left: PostingRuleSeed | undefined, right: PostingRuleSeed | undefined): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  return left.documentType === right.documentType && left.debitCode === right.debitCode && left.creditCode === right.creditCode;
}

function byCode(left: AccountSeed, right: AccountSeed): number {
  if (left.code < right.code) {
    return -1;
  }
  if (left.code > right.code) {
    return 1;
  }
  return 0;
}
