import { join } from 'node:path';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

loadEnvFile(join(process.cwd(), '.env'));
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(readPort(process.env.IDENTITY_PORT, 3001));
}

function readPort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const portNumber = Number(raw);
  if (!Number.isInteger(portNumber) || portNumber <= 0) {
    throw new Error('IDENTITY_PORT must be a positive integer');
  }
  return portNumber;
}

void bootstrap();
