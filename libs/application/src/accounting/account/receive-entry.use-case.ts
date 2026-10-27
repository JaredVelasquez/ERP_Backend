import { Injectable } from '@nestjs/common';
import { AccountNotPostableError, assertCanReceiveEntry, type AccountTreeNode } from '@domain/accounting/account/chart';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';

@Injectable()
export class ReceiveEntryUseCase {
  constructor(private readonly seedChart: SeedChartUseCase) {}

  async execute(companyId: string, code: string): Promise<{ accepted: true }> {
    const account = flatten(await this.seedChart.execute(companyId)).find((item) => item.code === code);
    if (account === undefined) {
      throw new AccountNotPostableError(code);
    }
    assertCanReceiveEntry(account);
    return { accepted: true };
  }
}

function flatten(nodes: readonly AccountTreeNode[]): AccountTreeNode[] {
  const pending = [...nodes];
  const flat: AccountTreeNode[] = [];
  while (pending.length > 0) {
    const node = pending.shift();
    if (node === undefined) {
      continue;
    }
    flat.push(node);
    pending.unshift(...node.children);
  }
  return flat;
}
