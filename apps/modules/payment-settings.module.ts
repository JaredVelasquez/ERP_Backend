import { Module } from '@nestjs/common';
import { ReadPaymentSettingsUseCase } from '@application/accounting/payment-settings/read-payment-settings.use-case';
import { SavePaymentSettingsUseCase } from '@application/accounting/payment-settings/save-payment-settings.use-case';
import { PAYMENT_SETTINGS_PORT } from '@domain/accounting/payment-settings/payment-settings.port';
import { InMemoryPaymentSettingsRepository } from '@infrastructure/accounting/payment-settings/in-memory/in-memory-payment-settings.repository';
import { PostgresPaymentSettingsRepository } from '@infrastructure/accounting/payment-settings/postgres/postgres-payment-settings.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { IdentityModule } from '@composition/identity.module';
import { PaymentSettingsController } from '@presentation/http/accounting/payment-settings/payment-settings.controller';

@Module({
  imports: [IdentityModule],
  controllers: [PaymentSettingsController],
  providers: [
    ReadPaymentSettingsUseCase,
    SavePaymentSettingsUseCase,
    { provide: PAYMENT_SETTINGS_PORT, useFactory: paymentSettingsRepository },
  ],
})
export class PaymentSettingsModule {}

function paymentSettingsRepository(): InMemoryPaymentSettingsRepository | PostgresPaymentSettingsRepository {
  if (!usePostgres(process.env)) return new InMemoryPaymentSettingsRepository();
  return new PostgresPaymentSettingsRepository(createTypeOrmExecutor(process.env));
}
