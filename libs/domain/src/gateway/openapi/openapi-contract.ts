export interface JsonSchema {
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  enum?: readonly string[];
  items?: JsonSchema;
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
}

export interface ApiOperation {
  operationId: string;
  requestSchema?: string;
  responseSchema: string;
}

export interface ApiContract {
  openapi: '3.0.3';
  info: { title: string; version: string };
  paths: Readonly<Record<string, Readonly<Record<string, ApiOperation>>>>;
  components: { schemas: Readonly<Record<string, JsonSchema>> };
}

const grant: JsonSchema = {
  type: 'object',
  required: ['module', 'access'],
  properties: {
    module: { type: 'string' },
    access: { enum: ['view', 'edit'] },
  },
};

const loginRequest: JsonSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string' },
    password: { type: 'string' },
    companyId: { type: 'string' },
  },
};

const loginResponse: JsonSchema = {
  type: 'object',
  required: ['token', 'role', 'grants'],
  properties: {
    token: { type: 'string' },
    role: { enum: ['platform-admin', 'owner', 'operator'] },
    grants: { type: 'array', items: grant },
  },
};

const barcodeSheetRequest: JsonSchema = {
  type: 'object',
  required: ['companyId', 'productIds'],
  properties: {
    companyId: { type: 'string' },
    productIds: { type: 'array', items: { type: 'string' } },
  },
};

const barcodeSheetResponse: JsonSchema = {
  type: 'object',
  required: ['pdfBase64'],
  properties: { pdfBase64: { type: 'string' } },
};

const productSearchResponse: JsonSchema = {
  type: 'object',
  required: ['products'],
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'internalBarcode'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          internalBarcode: { type: 'string' },
        },
      },
    },
  },
};

const stockCardResponse: JsonSchema = {
  type: 'object',
  required: ['card'],
  properties: {
    card: {
      type: 'object',
      required: ['productId', 'name', 'internalBarcode', 'baseQuantity'],
      properties: {
        productId: { type: 'string' },
        name: { type: 'string' },
        internalBarcode: { type: 'string' },
        baseQuantity: { type: 'number' },
        unitCost: { type: 'number' },
      },
    },
  },
};

const inventoryIssueRequest: JsonSchema = {
  type: 'object',
  required: ['companyId', 'idempotencyKey', 'receivedAt', 'lines'],
  properties: {
    companyId: { type: 'string' },
    idempotencyKey: { type: 'string' },
    receivedAt: { type: 'string' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        required: ['productId', 'unit', 'quantity'],
        properties: {
          productId: { type: 'string' },
          unit: { type: 'string' },
          quantity: { type: 'number' },
        },
      },
    },
  },
};

const inventoryIssueResponse: JsonSchema = {
  type: 'object',
  required: ['document'],
  properties: {
    document: {
      type: 'object',
      required: ['id', 'type'],
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
      },
    },
  },
};

export const phase1Contract: ApiContract = {
  openapi: '3.0.3',
  info: { title: 'Michelle Market ERP', version: '0.1.0' },
  paths: {
    '/identity/login': {
      post: { operationId: 'login', requestSchema: 'LoginRequest', responseSchema: 'LoginResponse' },
    },
    '/erp/barcode-sheets': {
      post: { operationId: 'renderBarcodeSheet', requestSchema: 'BarcodeSheetRequest', responseSchema: 'BarcodeSheetResponse' },
    },
    '/erp/products/search': {
      get: { operationId: 'searchProductsByName', responseSchema: 'ProductSearchResponse' },
    },
    '/erp/stock-cards': {
      get: { operationId: 'readStockCard', responseSchema: 'StockCardResponse' },
    },
    '/erp/inventory-issues': {
      post: { operationId: 'issueStock', requestSchema: 'InventoryIssueRequest', responseSchema: 'InventoryIssueResponse' },
    },
  },
  components: {
    schemas: {
      ModuleGrant: grant,
      LoginRequest: loginRequest,
      LoginResponse: loginResponse,
      BarcodeSheetRequest: barcodeSheetRequest,
      BarcodeSheetResponse: barcodeSheetResponse,
      ProductSearchResponse: productSearchResponse,
      StockCardResponse: stockCardResponse,
      InventoryIssueRequest: inventoryIssueRequest,
      InventoryIssueResponse: inventoryIssueResponse,
    },
  },
};

export function renderZodClient(contract: ApiContract): string {
  const lines = Object.entries(contract.components.schemas).map(([name, schema]) => schemaLine(name, schema));
  return `import { z } from 'zod'\n\n${lines.join('\n\n')}\n`;
}

function schemaLine(name: string, schema: JsonSchema): string {
  return `export const ${camel(name)}Schema = ${zod(schema)}`;
}

function zod(schema: JsonSchema): string {
  if (schema.enum !== undefined) {
    return `z.enum([${schema.enum.map((item) => `'${item}'`).join(', ')}])`;
  }
  if (schema.type === 'string') {
    return 'z.string()';
  }
  if (schema.type === 'number') {
    return 'z.number()';
  }
  if (schema.type === 'boolean') {
    return 'z.boolean()';
  }
  if (schema.type === 'array' && schema.items !== undefined) {
    return `z.array(${zod(schema.items)})`;
  }
  if (schema.type === 'object' && schema.properties !== undefined) {
    return objectZod(schema.properties, schema.required ?? []);
  }
  return 'z.unknown()';
}

function objectZod(properties: Readonly<Record<string, JsonSchema>>, required: readonly string[]): string {
  const fields = Object.entries(properties).map(([key, value]) => fieldLine(key, value, required.includes(key)));
  return `z.object({\n${fields.join('\n')}\n})`;
}

function fieldLine(key: string, schema: JsonSchema, isRequired: boolean): string {
  if (isRequired) {
    return `  ${key}: ${zod(schema)},`;
  }
  return `  ${key}: ${zod(schema)}.optional(),`;
}

function camel(name: string): string {
  return name.slice(0, 1).toLowerCase() + name.slice(1);
}
