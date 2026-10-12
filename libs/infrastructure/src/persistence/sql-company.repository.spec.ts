import type { Company, Warehouse } from '@domain/tenancy/company';
import { SqlCompanyRepository } from '@infrastructure/persistence/sql-company.repository';
import type { SqlExecutor, SqlSession } from '@infrastructure/persistence/sql-executor';

class RecordingSql implements SqlExecutor {
  readonly statements: string[] = [];
  failOn = '';

  async transaction<T>(work: (session: SqlSession) => Promise<T>): Promise<T> {
    const session: SqlSession = {
      query: async <Row>(statement: string) => {
        if (statement.includes(this.failOn) && this.failOn !== '') {
          throw new Error('statement failed');
        }
        this.statements.push(statement);
        return [] as Row[];
      },
    };
    return work(session);
  }
}

const company: Company = {
  id: 'company-1',
  societyId: 'society-1',
  legalName: 'Michelle Market',
  rtn: '08010000000001',
  currencyCode: 'HNL',
  costingMethod: 'PEPS',
  defaultMarginPercent: null,
  taxEnabled: false,
};

const warehouse: Warehouse = { id: 'warehouse-1', companyId: company.id, name: 'Principal' };

describe('sql company repository', () => {
  it('writes the company and its warehouse in one transaction', async () => {
    const sql = new RecordingSql();
    await new SqlCompanyRepository(sql).insertCompanyWithWarehouse(company, warehouse);

    expect(sql.statements).toHaveLength(2);
    expect(sql.statements[0]).toContain('dbo.companies');
    expect(sql.statements[1]).toContain('dbo.warehouses');
  });

  it('does not write the warehouse when the company insert fails', async () => {
    const sql = new RecordingSql();
    sql.failOn = 'dbo.companies';

    await expect(new SqlCompanyRepository(sql).insertCompanyWithWarehouse(company, warehouse)).rejects.toThrow(
      'statement failed',
    );
    expect(sql.statements.some((statement) => statement.includes('dbo.warehouses'))).toBe(false);
  });
});
