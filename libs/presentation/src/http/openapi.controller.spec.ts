import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenApiModule } from '@presentation/http/openapi.module';

describe('openapi gateway', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [OpenApiModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('publishes the login contract', async () => {
    const address = app.getHttpServer().address();
    if (address === null || typeof address === 'string') {
      throw new Error('Test server did not bind a port');
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/openapi.json`);
    const body = (await response.json()) as {
      paths: Record<string, { post?: { operationId?: string }; get?: { operationId?: string } }>;
    };

    expect(response.status).toBe(200);
    expect(body.paths['/identity/login']?.post?.operationId).toBe('login');
    expect(body.paths['/erp/barcode-sheets']?.post?.operationId).toBe('renderBarcodeSheet');
    expect(body.paths['/erp/products/search']?.get?.operationId).toBe('searchProductsByName');
    expect(body.paths['/erp/stock-cards']?.get?.operationId).toBe('readStockCard');
    expect(body.paths['/erp/inventory-issues']?.post?.operationId).toBe('issueStock');
  });
});