import { CreateBusinessDocumentUseCase, type CreateBusinessDocumentCommand } from '@application/documents/business-document/create-business-document.use-case';
import { SaveDocumentTemplateUseCase } from '@application/documents/document-template/save-document-template.use-case';
import { PublishDocumentTemplateUseCase } from '@application/documents/document-template/publish-document-template.use-case';
import { InMemoryDocumentTemplateRepository } from '@infrastructure/documents/document-template/in-memory/in-memory-document-template.repository';
import { InMemoryBusinessDocumentRepository } from '@infrastructure/documents/business-document/in-memory/in-memory-business-document.repository';
import type { CompanyPort } from '@domain/tenancy/company/company.port';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';
import type { FiscalDocumentPort } from '@domain/documents/fiscal/fiscal-document.port';

describe('document center use cases', () => {
  it('requires a published template and keeps a development snapshot after creating a document', async () => {
    const templates = new InMemoryDocumentTemplateRepository();
    const documents = new InMemoryBusinessDocumentRepository();
    const products = new InMemoryProductRepository();
    await products.save({
      id: 'product-1', companyId: 'company-1', name: 'Producto ficticio', itemType: 'product', category: 'Prueba', supplier: null,
      baseUnit: 'unidad', tracksExpiry: false, costingMethod: null, marginPercent: null, taxCategoryCode: 'none',
      active: true, internalBarcode: '00000001', presentations: [{ unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 75, referenceUnitCost: 50, manufacturerBarcode: null }],
    });
    const companies = { findCompany: async () => ({ legalName: 'Michelle Market', logoUrl: 'https://example.test/logo.png' }) } as unknown as CompanyPort;
    const saveTemplate = new SaveDocumentTemplateUseCase(templates);
    const publishTemplate = new PublishDocumentTemplateUseCase(templates);
    const fiscalDocuments = { list: async () => [{ id: 'fiscal-1', documentNumber: '001-001-01-00000001', status: 'issued' }] } as unknown as FiscalDocumentPort;
    const createDocument = new CreateBusinessDocumentUseCase(documents, templates, companies, products, fiscalDocuments);
    const draft = await saveTemplate.execute({
      companyId: 'company-1', actorId: 'user-1', documentType: 'proforma', templateKey: 'proforma', name: 'Proforma de prueba',
      pageSize: 'A4', orientation: 'portrait', marginMm: 14, accentColor: '#147d91', includeLogo: true,
      headerText: '', footerText: 'Solo desarrollo',
    });
    await expect(createDocument.execute(command(draft.id))).rejects.toThrow('plantilla publicada');
    await publishTemplate.execute('company-1', draft.id);
    const document = await createDocument.execute(command(draft.id));
    expect(document.snapshot.legallyValid).toBe(false);
    expect(document.snapshot.environment).toBe('sandbox');
    expect(document.snapshot.companyLogoUrl).toBe('https://example.test/logo.png');
    expect(document.snapshot.total).toBe(225);
    expect(document.snapshotHash).toHaveLength(64);
    const noteDraft = await saveTemplate.execute({
      companyId: 'company-1', actorId: 'user-1', documentType: 'credit_note', templateKey: 'credit_note', name: 'Nota de crédito de prueba',
      pageSize: 'A4', orientation: 'portrait', marginMm: 14, accentColor: '#147d91', includeLogo: true,
      headerText: '', footerText: 'Solo desarrollo',
    });
    await publishTemplate.execute('company-1', noteDraft.id);
    const creditNote = await createDocument.execute({
      ...command(noteDraft.id), idempotencyKey: 'credit-note-test-001', documentType: 'credit_note',
      details: { relatedDocumentNumber: '001-001-01-00000001', reason: 'Ajuste ficticio' },
    });
    expect(creditNote.snapshot.details.relatedDocumentNumber).toBe('001-001-01-00000001');
    expect(creditNote.snapshot.details.relatedDocumentId).toBe('fiscal-1');
  });

  it('requires a source document and reason for credit and debit notes', async () => {
    const createDocument = new CreateBusinessDocumentUseCase(
      new InMemoryBusinessDocumentRepository(), new InMemoryDocumentTemplateRepository(),
      { findCompany: async () => null } as unknown as CompanyPort,
      new InMemoryProductRepository(),
    );
    await expect(createDocument.execute({
      ...command('template-1'), documentType: 'credit_note', details: {},
    })).rejects.toThrow('documento original relacionado');
  });
});

function command(templateId: string): CreateBusinessDocumentCommand {
  return {
    companyId: 'company-1', actorId: 'user-1', idempotencyKey: 'document-test-0001', templateId,
    documentType: 'proforma', recipientName: 'Cliente de prueba', recipientReference: '', details: {}, notes: 'Ficticio',
    lines: [{ productId: 'product-1', presentationUnit: 'unidad', quantity: 3 }],
  };
}
