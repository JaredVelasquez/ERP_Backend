import type { Company, Warehouse } from '@domain/tenancy/company/company';
import { CompanyEntity, WarehouseEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import { PostgresCompanyRepository } from '@infrastructure/tenancy/company/postgres/postgres-company.repository';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import type { EntityManager } from 'typeorm';

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

describe('TypeORM company repository queries', () => {
  it('writes the company and warehouse through QueryBuilder inside one transaction', async () => {
    const orm = new RecordingExecutor();
    await new PostgresCompanyRepository(orm).insertCompanyWithWarehouse(company, warehouse);

    expect(orm.transactionCount).toBe(1);
    expect(orm.insertedEntities).toEqual([CompanyEntity, WarehouseEntity]);
  });

  it('inserts a new warehouse for an existing company without opening a transaction', async () => {
    const orm = new RecordingExecutor();
    await new PostgresCompanyRepository(orm).createWarehouse({ id: 'warehouse-2', companyId: company.id, name: 'Bodega 2', code: 'BOD-002', active: true, isDefault: false });

    expect(orm.transactionCount).toBe(0);
    expect(orm.insertedEntities).toEqual([WarehouseEntity]);
  });

  it('does not insert a warehouse when the company insert fails', async () => {
    const orm = new RecordingExecutor(CompanyEntity);
    await expect(new PostgresCompanyRepository(orm).insertCompanyWithWarehouse(company, warehouse)).rejects.toThrow('insert failed');
    expect(orm.insertedEntities).toEqual([]);
    expect(orm.transactionCount).toBe(1);
  });
});

class RecordingExecutor implements TypeOrmExecutor {
  readonly insertedEntities: Function[] = [];
  transactionCount = 0;

  constructor(private readonly failingEntity?: Function) {}

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return work();
  }

  async withManager<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return work({
      createQueryBuilder: () => new RecordingBuilder(this.insertedEntities, this.failingEntity),
    } as never);
  }
}

class RecordingBuilder {
  private target?: Function;

  constructor(private readonly inserts: Function[], private readonly failingEntity?: Function) {}

  insert(): this {
    return this;
  }

  into(target: Function): this {
    this.target = target;
    return this;
  }

  values(): this {
    return this;
  }

  async execute(): Promise<void> {
    if (this.target === this.failingEntity) throw new Error('insert failed');
    if (this.target) this.inserts.push(this.target);
  }
}
