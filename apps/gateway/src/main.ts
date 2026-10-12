import { join } from 'node:path';
import { requireGatewayUpstreams } from '@domain/gateway/gateway-routes';
import { loadEnvFile } from '@infrastructure/persistence/database-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createGatewayProxy } from './gateway-proxy';

loadEnvFile(join(process.cwd(), '.env'));

async function bootstrap(): Promise<void> {
  requireGatewayUpstreams(process.env);
  const app = await NestFactory.create(AppModule);
  app.use(createGatewayProxy());
  await app.listen(readPort(process.env.GATEWAY_PORT, 3000));
}

function readPort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const portNumber = Number(raw);
  if (!Number.isInteger(portNumber) || portNumber <= 0) {
    throw new Error('GATEWAY_PORT must be a positive integer');
  }
  return portNumber;
}

void bootstrap();
