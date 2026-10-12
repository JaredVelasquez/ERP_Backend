import { ConfirmVoucherUseCase, LinkVoucherUseCase, VoidVoucherUseCase } from '@application/documents/confirm-voucher.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase } from '@application/documents/save-voucher.use-case';
import { VOUCHER_PORT } from '@domain/documents/voucher.port';
import { InMemoryVoucherRepository } from '@infrastructure/documents/in-memory-voucher.repository';
import { useSqlIdentity } from '@infrastructure/persistence/database-env';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import { SqlVoucherRepository } from '@infrastructure/persistence/sql-voucher.repository';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@presentation/http/identity.module';
import { InventoryModule } from '@presentation/http/inventory.module';
import { VouchersController } from '@presentation/http/vouchers.controller';

@Module({
  imports: [IdentityModule, InventoryModule],
  controllers: [VouchersController],
  providers: [
    SaveVoucherUseCase,
    ConfirmVoucherUseCase,
    LinkVoucherUseCase,
    VoidVoucherUseCase,
    DownloadVoucherUseCase,
    { provide: VOUCHER_PORT, useFactory: voucherRepository },
  ],
  exports: [SaveVoucherUseCase, ConfirmVoucherUseCase, LinkVoucherUseCase, VoidVoucherUseCase, DownloadVoucherUseCase],
})
export class DocumentsModule {}

function voucherRepository(): InMemoryVoucherRepository | SqlVoucherRepository {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryVoucherRepository();
  }
  return new SqlVoucherRepository(createMssqlExecutor(process.env));
}
