import type { PaymentSettingsPort } from '@domain/accounting/payment-settings/payment-settings.port';
import type { CompanyPaymentSettings } from '@domain/accounting/payment-settings/payment-settings';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { readPaymentSettings, replacePaymentSettings } from './payment-settings.queries';

export class PostgresPaymentSettingsRepository implements PaymentSettingsPort {
  constructor(private readonly executor: TypeOrmExecutor) {}

  read(companyId: string): Promise<CompanyPaymentSettings | null> {
    return this.executor.withManager((manager) => readPaymentSettings(manager, companyId));
  }

  save(companyId: string, settings: CompanyPaymentSettings): Promise<void> {
    return this.executor.transaction(() => this.executor.withManager((manager) => replacePaymentSettings(manager, companyId, settings)));
  }
}
