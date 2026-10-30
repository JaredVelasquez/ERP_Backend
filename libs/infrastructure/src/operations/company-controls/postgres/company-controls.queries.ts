import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { CostingMethodChangeError } from '@domain/inventory/catalog/costing/costing';
import { CompanyControlsError, type AccountingPeriod, type BankStatementLine, type CompanyControls, type FiscalEstablishment, type FiscalProfile, type PrecisionPolicy, type SaveCompanyControls, type WarehouseControl } from '@domain/operations/company-controls/company-controls';
import { CompanyEntity, WarehouseEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';
import { AccountingPeriodEntity, BankStatementLineEntity, CompanyFiscalProfileEntity, FiscalEstablishmentEntity, PrecisionPolicyEntity } from './entities/company-controls.entity';
import { BankAccountEntity } from '@infrastructure/accounting/payment-settings/postgres/entities/payment-setting.entity';

export async function readControls(manager: EntityManager, companyId: string): Promise<CompanyControls> {
  const company = await manager.createQueryBuilder(CompanyEntity, 'company').where('company.id = :companyId', { companyId }).getOneOrFail();
  const [profile, precision, establishments, warehouses, periods, bankLines, bankAccounts, reconciliation] = await Promise.all([
    manager.createQueryBuilder(CompanyFiscalProfileEntity, 'profile').where('profile.companyId = :companyId', { companyId }).getOneOrFail(),
    manager.createQueryBuilder(PrecisionPolicyEntity, 'precision').where('precision.companyId = :companyId', { companyId }).getOneOrFail(),
    readEstablishments(manager, companyId), readWarehouses(manager, companyId), readPeriods(manager, companyId), readBankLines(manager, companyId), readBankAccounts(manager, companyId), readReconciliation(manager, companyId),
  ]);
  return {
    fiscalProfile: mapProfile(profile), precision: mapPrecision(precision), establishments,
    costingMethod: company.costingMethod as CompanyControls['costingMethod'], warehouses, periods, bankStatementLines: bankLines, bankAccounts, reconciliation,
  };
}

export async function saveControls(manager: EntityManager, companyId: string, actorId: string, input: SaveCompanyControls): Promise<void> {
  const company = await manager.createQueryBuilder(CompanyEntity, 'company').setLock('pessimistic_write').where('company.id = :companyId', { companyId }).getOneOrFail();
  if (company.costingMethod !== input.costingMethod) {
    await assertNoDefaultCostedStock(manager, companyId);
    await manager.createQueryBuilder().insert().into('company_costing_policy_history').values({ id: randomUUID(), company_id: companyId, previous_method: company.costingMethod, new_method: input.costingMethod, changed_by: actorId, reason: input.costingChangeReason }).execute();
    await manager.createQueryBuilder().update(CompanyEntity).set({ costingMethod: input.costingMethod }).where('id = :companyId', { companyId }).execute();
  }
  await manager.createQueryBuilder().insert().into(CompanyFiscalProfileEntity).values({ companyId, ...input.fiscalProfile, updatedBy: actorId, updatedAt: new Date() }).orUpdate(['environment', 'tax_regime', 'legal_name', 'rtn', 'address', 'phone', 'email', 'emission_mode', 'require_fiscal_document', 'updated_by', 'updated_at'], ['company_id']).execute();
  await manager.createQueryBuilder().insert().into(PrecisionPolicyEntity).values({ companyId, ...input.precision, updatedAt: new Date() }).orUpdate(['quantity_digits', 'unit_cost_digits', 'calculation_digits', 'report_digits', 'document_digits', 'rounding_mode', 'updated_at'], ['company_id']).execute();
}

export async function insertWarehouse(manager: EntityManager, companyId: string, warehouse: WarehouseControl): Promise<void> {
  await manager.createQueryBuilder().insert().into(WarehouseEntity).values({ id: warehouse.id, companyId, code: warehouse.code, name: warehouse.name, active: warehouse.active, isDefault: warehouse.isDefault }).execute();
}

export async function chooseDefaultWarehouse(manager: EntityManager, companyId: string, warehouseId: string): Promise<void> {
  await manager.createQueryBuilder().update(WarehouseEntity).set({ isDefault: false }).where('companyId = :companyId', { companyId }).execute();
  const result = await manager.createQueryBuilder().update(WarehouseEntity).set({ isDefault: true, active: true }).where('companyId = :companyId AND id = :warehouseId', { companyId, warehouseId }).execute();
  if (!result.affected) throw new CompanyControlsError('Warehouse was not found');
}

export async function renameWarehouse(manager: EntityManager, companyId: string, warehouseId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed === '') throw new CompanyControlsError('Warehouse name is required');
  const result = await manager.createQueryBuilder().update(WarehouseEntity).set({ name: trimmed })
    .where('companyId = :companyId AND id = :warehouseId', { companyId, warehouseId }).execute();
  if (!result.affected) throw new CompanyControlsError('Warehouse was not found');
}

export async function setWarehouseActive(manager: EntityManager, companyId: string, warehouseId: string, active: boolean): Promise<void> {
  await assertCanDeactivate(manager, companyId, warehouseId, active);
  const result = await manager.createQueryBuilder().update(WarehouseEntity).set({ active })
    .where('companyId = :companyId AND id = :warehouseId', { companyId, warehouseId }).execute();
  if (!result.affected) throw new CompanyControlsError('Warehouse was not found');
}

async function assertCanDeactivate(manager: EntityManager, companyId: string, warehouseId: string, active: boolean): Promise<void> {
  if (active) return;
  const warehouse = await manager.createQueryBuilder(WarehouseEntity, 'warehouse')
    .where('warehouse.companyId = :companyId AND warehouse.id = :warehouseId', { companyId, warehouseId }).getOne();
  if (warehouse?.isDefault) throw new CompanyControlsError('Cannot deactivate the default warehouse');
}

async function assertNoDefaultCostedStock(manager: EntityManager, companyId: string): Promise<void> {
  const found = await manager.createQueryBuilder()
    .select('1', 'found')
    .from('cost_layers', 'layer')
    .innerJoin('products', 'product', 'product.id = layer.product_id')
    .where('layer.company_id = :companyId', { companyId })
    .andWhere('product.costing_method IS NULL')
    .andWhere('layer.quantity > 0')
    .limit(1)
    .getRawOne<{ found: number }>();
  if (found) throw new CostingMethodChangeError();
}

export async function insertPeriod(manager: EntityManager, companyId: string, period: AccountingPeriod): Promise<void> {
  await manager.createQueryBuilder().insert().into(AccountingPeriodEntity).values({ ...period, companyId, closedBy: null, reopenedBy: null }).execute();
}

export async function updatePeriodStatus(manager: EntityManager, companyId: string, periodId: string, status: 'open' | 'closed', actorId: string, reason: string | null): Promise<void> {
  const patch = status === 'closed'
    ? { status, closedBy: actorId, closedAt: new Date(), reopenedBy: null, reopenedAt: null, reopenReason: null }
    : { status, closedBy: null, closedAt: null, reopenedBy: actorId, reopenedAt: new Date(), reopenReason: reason };
  const result = await manager.createQueryBuilder().update(AccountingPeriodEntity).set(patch).where('companyId = :companyId AND id = :periodId', { companyId, periodId }).execute();
  if (!result.affected) throw new CompanyControlsError('Accounting period was not found');
}

export async function insertBankLine(manager: EntityManager, companyId: string, actorId: string, line: BankStatementLine): Promise<void> {
  await manager.createQueryBuilder().insert().into(BankStatementLineEntity).values({ ...line, companyId, amount: String(line.amount), importedBy: actorId }).execute();
}

export async function updateBankLineStatus(manager: EntityManager, companyId: string, lineId: string, status: BankStatementLine['status'], journalEntryId: string | null): Promise<void> {
  const result = await manager.createQueryBuilder().update(BankStatementLineEntity).set({ status, matchedJournalEntryId: status === 'matched' ? journalEntryId : null }).where('companyId = :companyId AND id = :lineId', { companyId, lineId }).execute();
  if (!result.affected) throw new CompanyControlsError('Bank statement line was not found');
}

function readEstablishments(manager: EntityManager, companyId: string): Promise<FiscalEstablishment[]> {
  return manager.createQueryBuilder(FiscalEstablishmentEntity, 'item').select(['item.id AS id', 'item.code AS code', 'item.emissionPointCode AS "emissionPointCode"', 'item.name AS name', 'item.address AS address', 'item.active AS active']).where('item.companyId = :companyId', { companyId }).orderBy('item.code', 'ASC').getRawMany<FiscalEstablishment>();
}

function readWarehouses(manager: EntityManager, companyId: string): Promise<WarehouseControl[]> {
  return manager.createQueryBuilder(WarehouseEntity, 'item').select(['item.id AS id', 'item.code AS code', 'item.name AS name', 'item.active AS active', 'item.isDefault AS "isDefault"']).where('item.companyId = :companyId', { companyId }).orderBy('item.code', 'ASC').getRawMany<WarehouseControl>();
}

function readBankAccounts(manager: EntityManager, companyId: string): Promise<Array<{ id: string; label: string }>> {
  return manager.createQueryBuilder(BankAccountEntity, 'item').select('item.id', 'id')
    .addSelect("concat(item.bankName, ' · ', item.accountName, ' · ', item.maskedNumber)", 'label')
    .where('item.companyId = :companyId AND item.active = true', { companyId }).orderBy('item.bankName', 'ASC').getRawMany();
}

async function readReconciliation(manager: EntityManager, companyId: string): Promise<CompanyControls['reconciliation']> {
  const row = await manager.createQueryBuilder().select('coalesce((SELECT sum(total) FROM fiscal_documents WHERE company_id = :companyId AND status = :issued), 0)', 'fiscalTotal')
    .addSelect('coalesce((SELECT sum(line.revenue) FROM inventory_document_lines line JOIN inventory_documents document ON document.id = line.document_id WHERE document.company_id = :companyId AND document.document_type = :sale AND document.status = :confirmed), 0)', 'salesTotal')
    .addSelect('coalesce((SELECT sum(amount) FROM bank_statement_lines WHERE company_id = :companyId AND status = :open), 0)', 'openBankTotal')
    .from('companies', 'company').where('company.id = :companyId', { companyId, issued: 'issued', sale: 'sale', confirmed: 'confirmed', open: 'open' })
    .getRawOne<{ fiscalTotal: string; salesTotal: string; openBankTotal: string }>();
  const fiscalTotal = Number(row?.fiscalTotal ?? 0);
  const salesTotal = Number(row?.salesTotal ?? 0);
  return { fiscalTotal, salesTotal, fiscalDifference: Math.round((salesTotal - fiscalTotal) * 100) / 100, openBankTotal: Number(row?.openBankTotal ?? 0) };
}

async function readPeriods(manager: EntityManager, companyId: string): Promise<AccountingPeriod[]> {
  const rows = await manager.createQueryBuilder(AccountingPeriodEntity, 'item').where('item.companyId = :companyId', { companyId }).orderBy('item.startsOn', 'DESC').getMany();
  return rows.map((item) => ({ id: item.id, name: item.name, startsOn: item.startsOn, endsOn: item.endsOn, status: item.status as AccountingPeriod['status'], closedAt: item.closedAt?.toISOString() ?? null, reopenedAt: item.reopenedAt?.toISOString() ?? null, reopenReason: item.reopenReason }));
}

async function readBankLines(manager: EntityManager, companyId: string): Promise<BankStatementLine[]> {
  const rows = await manager.createQueryBuilder(BankStatementLineEntity, 'item').where('item.companyId = :companyId', { companyId }).orderBy('item.transactionDate', 'DESC').limit(200).getMany();
  return rows.map((item) => ({ id: item.id, bankAccountId: item.bankAccountId, transactionDate: item.transactionDate, reference: item.reference, description: item.description, amount: Number(item.amount), status: item.status as BankStatementLine['status'], matchedJournalEntryId: item.matchedJournalEntryId }));
}

function mapProfile(item: CompanyFiscalProfileEntity): FiscalProfile {
  return { environment: item.environment as FiscalProfile['environment'], taxRegime: item.taxRegime as FiscalProfile['taxRegime'], legalName: item.legalName, rtn: item.rtn, address: item.address, phone: item.phone, email: item.email, emissionMode: item.emissionMode as FiscalProfile['emissionMode'], requireFiscalDocument: item.requireFiscalDocument };
}

function mapPrecision(item: PrecisionPolicyEntity): PrecisionPolicy {
  return { quantityDigits: item.quantityDigits, unitCostDigits: item.unitCostDigits, calculationDigits: item.calculationDigits, reportDigits: item.reportDigits, documentDigits: item.documentDigits, roundingMode: item.roundingMode as PrecisionPolicy['roundingMode'] };
}
