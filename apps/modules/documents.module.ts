import { ConfirmVoucherUseCase, LinkVoucherUseCase } from '@application/documents/voucher/confirm-voucher.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase } from '@application/documents/voucher/save-voucher.use-case';
import { VOUCHER_PORT } from '@domain/documents/voucher/voucher.port';
import { OBJECT_STORAGE_PORT } from '@domain/documents/voucher/object-storage.port';
import { InMemoryVoucherRepository } from '@infrastructure/documents/voucher/in-memory/in-memory-voucher.repository';
import { InMemoryVoucherVoidApprovalRepository } from '@infrastructure/documents/voucher-void/in-memory/in-memory-voucher-void-approval.repository';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { PostgresVoucherRepository } from '@infrastructure/documents/voucher/postgres/postgres-voucher.repository';
import { PostgresVoucherVoidApprovalRepository } from '@infrastructure/documents/voucher-void/postgres/postgres-voucher-void-approval.repository';
import { VOUCHER_VOID_APPROVAL_PORT } from '@domain/documents/voucher/voucher-void-approval.port';
import { VoucherVoidApprovalUseCase } from '@application/documents/voucher/voucher-void-approval.use-case';
import { S3ObjectStorage } from '@infrastructure/documents/object-storage/s3/s3-object-storage';
import { Module } from '@nestjs/common';
import { IdentityModule } from '@composition/identity.module';
import { InventoryModule } from '@composition/inventory.module';
import { VouchersController } from '@presentation/http/documents/voucher/vouchers.controller';

@Module({
  imports: [IdentityModule, InventoryModule],
  controllers: [VouchersController],
  providers: [
    SaveVoucherUseCase,
    ConfirmVoucherUseCase,
    LinkVoucherUseCase,
    VoucherVoidApprovalUseCase,
    DownloadVoucherUseCase,
    { provide: VOUCHER_PORT, useFactory: voucherRepository },
    { provide: VOUCHER_VOID_APPROVAL_PORT, useFactory: voucherVoidApprovalRepository, inject: [VOUCHER_PORT] },
    { provide: OBJECT_STORAGE_PORT, useFactory: () => new S3ObjectStorage(process.env) },
  ],
  exports: [SaveVoucherUseCase, ConfirmVoucherUseCase, LinkVoucherUseCase, VoucherVoidApprovalUseCase, DownloadVoucherUseCase],
})
export class DocumentsModule {}

function voucherRepository(): InMemoryVoucherRepository | PostgresVoucherRepository {
  if (!usePostgres(process.env)) {
    return new InMemoryVoucherRepository();
  }
  return new PostgresVoucherRepository(createTypeOrmExecutor(process.env));
}

function voucherVoidApprovalRepository(vouchers: import('@domain/documents/voucher/voucher.port').VoucherPort): InMemoryVoucherVoidApprovalRepository | PostgresVoucherVoidApprovalRepository {
  if (!usePostgres(process.env)) return new InMemoryVoucherVoidApprovalRepository(vouchers);
  return new PostgresVoucherVoidApprovalRepository(createTypeOrmExecutor(process.env));
}
