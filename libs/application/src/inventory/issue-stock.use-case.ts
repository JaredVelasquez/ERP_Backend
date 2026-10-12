import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfirmDocumentUseCase } from '@application/inventory/confirm-document.use-case';
import { DocumentError, type DocumentLine } from '@domain/inventory/document';
import { buildOutboundAdjustment, assertIssueRequests, type IssueLineRequest } from '@domain/inventory/issue-draft';
import type { ConfirmedDocument } from '@domain/inventory/ledger.port';
import type { Product } from '@domain/inventory/product';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company.port';

export interface IssueStockCommand {
  companyId: string;
  idempotencyKey: string;
  receivedAt: string;
  lines: IssueLineRequest[];
}

@Injectable()
export class IssueStockUseCase {
  constructor(
    private readonly confirmDocument: ConfirmDocumentUseCase,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
  ) {}

  async execute(command: IssueStockCommand): Promise<ConfirmedDocument> {
    assertIssueRequests(command.lines);
    if (command.companyId.trim() === '' || command.idempotencyKey.trim() === '' || command.receivedAt.trim() === '') {
      throw new DocumentError('Company, idempotency key, and date are required');
    }
    const company = await this.companies.findCompany(command.companyId);
    if (company === null) {
      throw new DocumentError('Company was not found');
    }
    const draft = buildOutboundAdjustment({
      id: randomUUID(),
      companyId: command.companyId,
      idempotencyKey: command.idempotencyKey,
      lines: await this.documentLines(command.companyId, command.lines),
    });
    return this.confirmDocument.execute({
      draft,
      companyCostingMethod: company.costingMethod,
      receivedAt: command.receivedAt,
    });
  }

  private async documentLines(companyId: string, lines: readonly IssueLineRequest[]): Promise<DocumentLine[]> {
    const documentLines: DocumentLine[] = [];
    for (const line of lines) {
      documentLines.push(await this.documentLine(companyId, line));
    }
    return documentLines;
  }

  private async documentLine(companyId: string, line: IssueLineRequest): Promise<DocumentLine> {
    const product = await this.requireProduct(companyId, line.productId);
    const presentation = product.presentations.find((item) => item.unit === line.unit);
    if (presentation === undefined) {
      throw new DocumentError('Presentation was not found');
    }
    return {
      productId: product.id,
      presentationFactor: presentation.factor,
      quantity: line.quantity,
      unitCost: null,
      saleAmount: null,
      selectedLayerId: null,
      expiresOn: null,
      newLayerId: randomUUID(),
    };
  }

  private async requireProduct(companyId: string, productId: string): Promise<Product> {
    const product = await this.products.find(companyId, productId);
    if (product === null) {
      throw new DocumentError('Product was not found');
    }
    if (!product.active) {
      throw new DocumentError('Product is inactive');
    }
    return product;
  }
}
