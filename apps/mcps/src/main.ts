import { join } from 'node:path';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';

loadEnvFile(join(process.cwd(), '.env'));
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '8mb' }));
  await app.listen(readPort(process.env.MCPS_PORT, 3003));
}

function readPort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const portNumber = Number(raw);
  if (!Number.isInteger(portNumber) || portNumber <= 0) {
    throw new Error('MCPS_PORT must be a positive integer');
  }
  return portNumber;
}

void bootstrap();
