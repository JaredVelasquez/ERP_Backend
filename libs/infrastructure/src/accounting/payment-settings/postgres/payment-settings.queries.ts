import type { EntityManager } from 'typeorm';
import { BankAccountEntity, PaymentMethodEntity } from './entities/payment-setting.entity';
import type { CompanyPaymentSettings } from '@domain/accounting/payment-settings/payment-settings';

export async function readPaymentSettings(manager: EntityManager, companyId: string): Promise<CompanyPaymentSettings | null> {
  const paymentMethods = await manager.getRepository(PaymentMethodEntity).createQueryBuilder('method')
    .where('method.companyId = :companyId', { companyId }).orderBy('method.name', 'ASC').getMany();
  const bankAccounts = await manager.getRepository(BankAccountEntity).createQueryBuilder('bank')
    .where('bank.companyId = :companyId', { companyId }).orderBy('bank.bankName', 'ASC').getMany();
  if (paymentMethods.length === 0 && bankAccounts.length === 0) return null;
  return { paymentMethods: paymentMethods.map(toPaymentMethod), bankAccounts: bankAccounts.map(toBankAccount) };
}

export async function replacePaymentSettings(manager: EntityManager, companyId: string, settings: CompanyPaymentSettings): Promise<void> {
  await manager.getRepository(PaymentMethodEntity).createQueryBuilder().delete().where('company_id = :companyId', { companyId }).execute();
  await manager.getRepository(BankAccountEntity).createQueryBuilder().delete().where('company_id = :companyId', { companyId }).execute();
  await manager.getRepository(PaymentMethodEntity).createQueryBuilder().insert().values(settings.paymentMethods.map((method) => ({ ...method, companyId }))).execute();
  if (settings.bankAccounts.length === 0) return;
  await manager.getRepository(BankAccountEntity).createQueryBuilder().insert().values(settings.bankAccounts.map((account) => ({ ...account, companyId }))).execute();
}

function toPaymentMethod(entity: PaymentMethodEntity): CompanyPaymentSettings['paymentMethods'][number] {
  return { id: entity.id, name: entity.name, kind: entity.kind as CompanyPaymentSettings['paymentMethods'][number]['kind'],
    collectionAccountCode: entity.collectionAccountCode, paymentAccountCode: entity.paymentAccountCode, active: entity.active };
}

function toBankAccount(entity: BankAccountEntity): CompanyPaymentSettings['bankAccounts'][number] {
  return { id: entity.id, bankName: entity.bankName, accountName: entity.accountName, maskedNumber: entity.maskedNumber,
    currency: 'HNL', accountCode: entity.accountCode, active: entity.active };
}
