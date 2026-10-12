import { join } from 'node:path';
import { loadEnvFile, missingDatabaseKeys } from '@infrastructure/persistence/database-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

loadEnvFile(join(process.cwd(), '.env'));
if (missingDatabaseKeys(process.env).length === 0) {
  process.env.IDENTITY_STORE = 'sql';
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(readPort(process.env.ERP_PORT, 3002));
}

function readPort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const portNumber = Number(raw);
  if (!Number.isInteger(portNumber) || portNumber <= 0) {
    throw new Error('ERP_PORT must be a positive integer');
  }
  return portNumber;
}

void bootstrap();
