import { ReceiveEntryUseCase } from '@application/accounting/account/receive-entry.use-case';
import { SeedChartUseCase } from '@application/accounting/account/seed-chart.use-case';
import { UpdateAccountUseCase } from '@application/accounting/account/update-account.use-case';
import { LoginUseCase } from '@application/identity/session/login.use-case';
import { RefreshSessionUseCase } from '@application/identity/session/refresh-session.use-case';
import { ReplaceModuleGrantsUseCase } from '@application/identity/membership/replace-module-grants.use-case';
import { RegisterUserUseCase } from '@application/identity/session/register-user.use-case';
import { ACCOUNTING_PORT } from '@domain/accounting/account/accounting.port';
import { PASSWORD_HASHER } from '@domain/identity/session/password-hasher.port';
import { IDENTITY_PORT } from '@domain/identity/session/session.port';
import { InMemoryIdentityRepository } from '@infrastructure/identity/session/in-memory/in-memory-identity.repository';
import { PostgresIdentityRepository } from '@infrastructure/identity/session/postgres/postgres-identity.repository';
import { ScryptPasswordHasher } from '@infrastructure/identity/session/security/scrypt-password.hasher';
import { usePostgres } from '@infrastructure/shared/postgres/database-env';
import { InMemoryAccountingRepository } from '@infrastructure/accounting/account/in-memory/in-memory-accounting.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import { Module } from '@nestjs/common';
import { AccountsController } from '@presentation/http/accounting/account/accounts.controller';
import { AreaGuard } from '@presentation/http/identity/session/area.guard';
import { IdentityController } from '@presentation/http/identity/session/identity.controller';
import { LoginAttemptLimiter } from '@presentation/http/identity/session/login-attempt-limiter';

@Module({
  controllers: [IdentityController, AccountsController],
  providers: [
    RegisterUserUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LoginAttemptLimiter,
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

function identityRepository(): InMemoryIdentityRepository | PostgresIdentityRepository {
  if (!usePostgres(process.env)) {
    return new InMemoryIdentityRepository();
  }
  return new PostgresIdentityRepository(createTypeOrmExecutor(process.env));
}
