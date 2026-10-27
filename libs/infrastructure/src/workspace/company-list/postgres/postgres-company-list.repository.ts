import { roundMoney } from '@domain/inventory/catalog/costing/costing';
import type {
  CompanyListPort,
  CompanyUserRow,
  InventoryDocumentRow,
  VoucherListRow,
} from '@domain/workspace/company-list/company-list.port';
import type { Page, PageRequest } from '@domain/workspace/company-list/page';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import {
  findCompanyUsers,
  findInventoryDocuments,
  findVouchers,
} from '@infrastructure/workspace/company-list/postgres/company-list.queries';

export class PostgresCompanyListRepository implements CompanyListPort {
  constructor(private readonly orm: TypeOrmExecutor) {}

  async listDocuments(companyId: string, request: PageRequest): Promise<Page<InventoryDocumentRow>> {
    const [rows, total] = await this.orm.withManager((manager) => findInventoryDocuments(manager, companyId, request));
    return {
      items: rows.map((row) => ({
        id: row.id,
        documentType: row.documentType,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      page: request.page,
      pageSize: request.pageSize,
      total,
    };
  }

  async listVouchers(companyId: string, request: PageRequest): Promise<Page<VoucherListRow>> {
    const [rows, total] = await this.orm.withManager((manager) => findVouchers(manager, companyId, request));
    return {
      items: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        holder: row.holder,
        amount: formatMoney(row.amount),
        occurredOn: row.occurredOn,
        status: row.status,
        hasVoucherFile: row.voucherFileKey !== null,
        hasBankReceipt: row.bankReceiptFileKey !== null,
      })),
      page: request.page,
      pageSize: request.pageSize,
      total,
    };
  }

  async listUsers(companyId: string, request: PageRequest): Promise<Page<CompanyUserRow>> {
    const [rows, total] = await this.orm.withManager((manager) => findCompanyUsers(manager, companyId, request));
    return {
      items: rows.map((row) => ({ id: row.id, email: row.email, displayName: row.displayName })),
      page: request.page,
      pageSize: request.pageSize,
      total,
    };
  }
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0.00';
  return roundMoney(amount).toFixed(2);
}
