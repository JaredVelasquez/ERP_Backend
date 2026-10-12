import { ReceiveEntryUseCase } from '@application/accounting/receive-entry.use-case';
import { SeedChartUseCase } from '@application/accounting/seed-chart.use-case';
import { UpdateAccountUseCase } from '@application/accounting/update-account.use-case';
import { LoginUseCase } from '@application/identity/login.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/register-user.use-case';
import { ACCOUNTING_PORT } from '@domain/accounting/accounting.port';
import { PASSWORD_HASHER } from '@domain/identity/password-hasher.port';
import { IDENTITY_PORT } from '@domain/identity/session.port';
import { InMemoryIdentityRepository } from '@infrastructure/identity/in-memory-identity.repository';
import { SqlIdentityRepository } from '@infrastructure/identity/sql-identity.repository';
import { ScryptPasswordHasher } from '@infrastructure/identity/scrypt-password.hasher';
import { useSqlIdentity } from '@infrastructure/persistence/database-env';
import { InMemoryAccountingRepository } from '@infrastructure/persistence/in-memory-accounting.repository';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';
import { Module } from '@nestjs/common';
import { AccountsController } from '@presentation/http/accounts.controller';
import { AreaGuard } from '@presentation/http/area.guard';
import { IdentityController } from '@presentation/http/identity.controller';

@Module({
  controllers: [IdentityController, AccountsController],
  providers: [
    RegisterUserUseCase,
    LoginUseCase,
    ReplaceModuleGrantsUseCase,
    SeedChartUseCase,
    ReceiveEntryUseCase,
    UpdateAccountUseCase,
    AreaGuard,
    { provide: IDENTITY_PORT, useFactory: identityRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: ACCOUNTING_PORT, useClass: InMemoryAccountingRepository },
  ],
  exports: [
    AreaGuard,
    IDENTITY_PORT,
    ACCOUNTING_PORT,
    RegisterUserUseCase,
    LoginUseCase,
    ReplaceModuleGrantsUseCase,
    SeedChartUseCase,
    ReceiveEntryUseCase,
    UpdateAccountUseCase,
  ],
})
export class IdentityModule {}

function identityRepository(): InMemoryIdentityRepository | SqlIdentityRepository {
  if (!useSqlIdentity(process.env)) {
    return new InMemoryIdentityRepository();
  }
  return new SqlIdentityRepository(createMssqlExecutor(process.env));
}
