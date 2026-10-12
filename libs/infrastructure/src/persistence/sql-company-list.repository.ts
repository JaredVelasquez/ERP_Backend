import { roundMoney } from '@domain/inventory/costing';
import type {
  CompanyListPort,
  CompanyUserRow,
  InventoryDocumentRow,
  VoucherListRow,
} from '@domain/workspace/company-list.port';
import { likeTerm, pageOffset, type Page, type PageRequest } from '@domain/workspace/page';
import type { SqlExecutor } from '@infrastructure/persistence/sql-executor';

interface CountRow {
  total: number | string | null;
  id: string | null;
}

interface DocumentPageRow extends CountRow {
  documentType: string | null;
  status: string | null;
  createdAt: Date | string | null;
}

interface VoucherPageRow extends CountRow {
  reference: string | null;
  holder: string | null;
  amount: number | string | null;
  occurredOn: Date | string | null;
}

interface UserPageRow extends CountRow {
  email: string | null;
  displayName: string | null;
}

const DOCUMENT_PAGE = `
WITH filtered AS (
  SELECT id, document_type, status, created_at
  FROM dbo.inventory_documents
  WHERE company_id = @companyId
    AND (
      @search = N''
      OR document_type LIKE @like
      OR status LIKE @like
    )
),
counted AS (
  SELECT COUNT(*) AS total FROM filtered
),
page AS (
  SELECT id, COUNT(*) OVER() AS windowTotal
  FROM filtered
  ORDER BY created_at DESC, id
  OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
)
SELECT
  COALESCE(page.windowTotal, counted.total) AS total,
  filtered.id,
  filtered.document_type AS documentType,
  filtered.status,
  filtered.created_at AS createdAt
FROM counted
LEFT JOIN page ON 1 = 1
LEFT JOIN filtered ON filtered.id = page.id
ORDER BY filtered.created_at DESC, filtered.id`;

const VOUCHER_PAGE = `
WITH filtered AS (
  SELECT id, reference, holder, amount, occurred_on
  FROM dbo.document_submissions
  WHERE company_id = @companyId
    AND (
      @search = N''
      OR reference LIKE @like
      OR holder LIKE @like
    )
),
counted AS (
  SELECT COUNT(*) AS total FROM filtered
),
page AS (
  SELECT id, COUNT(*) OVER() AS windowTotal
  FROM filtered
  ORDER BY occurred_on DESC, id
  OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
)
SELECT
  COALESCE(page.windowTotal, counted.total) AS total,
  filtered.id,
  filtered.reference,
  filtered.holder,
  filtered.amount,
  filtered.occurred_on AS occurredOn
FROM counted
LEFT JOIN page ON 1 = 1
LEFT JOIN filtered ON filtered.id = page.id
ORDER BY filtered.occurred_on DESC, filtered.id`;

const USER_PAGE = `
WITH filtered AS (
  SELECT u.id, u.email, u.display_name
  FROM dbo.users AS u
  INNER JOIN dbo.memberships AS m ON m.user_id = u.id
  WHERE m.company_id = @companyId
    AND (
      @search = N''
      OR u.email LIKE @like
      OR u.display_name LIKE @like
    )
),
counted AS (
  SELECT COUNT(*) AS total FROM filtered
),
page AS (
  SELECT id, COUNT(*) OVER() AS windowTotal
  FROM filtered
  ORDER BY email, id
  OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
)
SELECT
  COALESCE(page.windowTotal, counted.total) AS total,
  filtered.id,
  filtered.email,
  filtered.display_name AS displayName
FROM counted
LEFT JOIN page ON 1 = 1
LEFT JOIN filtered ON filtered.id = page.id
ORDER BY filtered.email, filtered.id`;

export class SqlCompanyListRepository implements CompanyListPort {
  constructor(private readonly sql: SqlExecutor) {}

  async listDocuments(companyId: string, request: PageRequest): Promise<Page<InventoryDocumentRow>> {
    const rows = await this.read<DocumentPageRow>(DOCUMENT_PAGE, companyId, request);
    return {
      items: documentItems(rows),
      page: request.page,
      pageSize: request.pageSize,
      total: totalFrom(rows),
    };
  }

  async listVouchers(companyId: string, request: PageRequest): Promise<Page<VoucherListRow>> {
    const rows = await this.read<VoucherPageRow>(VOUCHER_PAGE, companyId, request);
    return {
      items: voucherItems(rows),
      page: request.page,
      pageSize: request.pageSize,
      total: totalFrom(rows),
    };
  }

  async listUsers(companyId: string, request: PageRequest): Promise<Page<CompanyUserRow>> {
    const rows = await this.read<UserPageRow>(USER_PAGE, companyId, request);
    return {
      items: userItems(rows),
      page: request.page,
      pageSize: request.pageSize,
      total: totalFrom(rows),
    };
  }

  private read<T>(statement: string, companyId: string, request: PageRequest): Promise<T[]> {
    return this.sql.transaction((session) =>
      session.query<T>(statement, {
        companyId,
        search: request.search,
        like: likeTerm(request.search),
        offset: pageOffset(request),
        pageSize: request.pageSize,
      }),
    );
  }
}

function documentItems(rows: readonly DocumentPageRow[]): InventoryDocumentRow[] {
  const items: InventoryDocumentRow[] = [];
  for (const row of rows) {
    pushDocument(items, row);
  }
  return items;
}

function pushDocument(items: InventoryDocumentRow[], row: DocumentPageRow): void {
  if (row.id === null || row.documentType === null || row.status === null) {
    return;
  }
  items.push({
    id: row.id,
    documentType: row.documentType,
    status: row.status,
    createdAt: timeText(row.createdAt),
  });
}

function voucherItems(rows: readonly VoucherPageRow[]): VoucherListRow[] {
  const items: VoucherListRow[] = [];
  for (const row of rows) {
    pushVoucher(items, row);
  }
  return items;
}

function pushVoucher(items: VoucherListRow[], row: VoucherPageRow): void {
  if (row.id === null || row.reference === null || row.holder === null) {
    return;
  }
  items.push({
    id: row.id,
    reference: row.reference,
    holder: row.holder,
    amount: moneyText(row.amount),
    occurredOn: timeText(row.occurredOn),
  });
}

function userItems(rows: readonly UserPageRow[]): CompanyUserRow[] {
  const items: CompanyUserRow[] = [];
  for (const row of rows) {
    pushUser(items, row);
  }
  return items;
}

function pushUser(items: CompanyUserRow[], row: UserPageRow): void {
  if (row.id === null || row.email === null || row.displayName === null) {
    return;
  }
  items.push({ id: row.id, email: row.email, displayName: row.displayName });
}

function totalFrom(rows: readonly CountRow[]): number {
  const parsed = Number(rows[0]?.total ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function moneyText(value: number | string | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return '0.00';
  }
  return roundMoney(amount).toFixed(2);
}

function timeText(value: Date | string | null): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}
