import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { BusinessDocumentError } from '@domain/documents/business-document/business-document';
import type { BusinessDocumentDetails } from '@domain/documents/business-document/business-document';
import { BUSINESS_DOCUMENT_PORT, type BusinessDocumentPort } from '@domain/documents/business-document/business-document.port';
import { DOCUMENT_TEMPLATE_PORT, type DocumentTemplatePort } from '@domain/documents/document-template/document-template.port';
import { COMPANY_PORT, type CompanyPort } from '@domain/tenancy/company/company.port';
import type { TemplateDocumentType } from '@domain/documents/document-template/document-template';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { TAX_CATEGORIES } from '@domain/accounting/account/chart';
import { FISCAL_DOCUMENT_PORT, type FiscalDocumentPort } from '@domain/documents/fiscal/fiscal-document.port';

export interface CreateBusinessDocumentCommand {
  companyId: string;
  actorId: string;
  idempotencyKey: string;
  templateId: string;
  documentType: TemplateDocumentType;
  recipientName: string;
  recipientReference: string;
  details: Partial<BusinessDocumentDetails>;
  notes: string;
  lines: readonly { productId: string; presentationUnit: string; quantity: number }[];
}

@Injectable()
export class CreateBusinessDocumentUseCase {
  constructor(
    @Inject(BUSINESS_DOCUMENT_PORT) private readonly documents: BusinessDocumentPort,
    @Inject(DOCUMENT_TEMPLATE_PORT) private readonly templates: DocumentTemplatePort,
    @Inject(COMPANY_PORT) private readonly companies: CompanyPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Optional() @Inject(FISCAL_DOCUMENT_PORT) private readonly fiscalDocuments?: FiscalDocumentPort,
  ) {}

  async execute(command: CreateBusinessDocumentCommand) {
    if (command.documentType === 'invoice') throw new BusinessDocumentError('La factura se genera desde una venta confirmada en el flujo de facturación.');
    if (command.idempotencyKey.trim().length < 8 || command.idempotencyKey.length > 80) throw new BusinessDocumentError('La clave de creación no es válida.');
    if (command.recipientName.trim() === '' || command.recipientName.length > 200) throw new BusinessDocumentError('Escribe el nombre de la persona o entidad relacionada.');
    if (command.notes.length > 1000) throw new BusinessDocumentError('Las notas superan el límite permitido.');
    if (command.lines.length === 0 || command.lines.length > 100) throw new BusinessDocumentError('Agrega entre 1 y 100 líneas.');
    const details = readDetails(command.documentType, command.details);
    const template = await this.templates.find(command.companyId, command.templateId);
    if (template === null || template.status !== 'published' || template.documentType !== command.documentType) throw new BusinessDocumentError('Selecciona una plantilla publicada para este tipo de documento.');
    const linkedDetails = await validateRelatedDocument(this.documents, this.fiscalDocuments, command.companyId, command.documentType, details);
    const company = await this.companies.findCompany(command.companyId);
    if (company === null) throw new BusinessDocumentError('No se encontró la empresa de la sesión.');
    const lines = await Promise.all(command.lines.map((line) => readCatalogLine(this.products, command.companyId, command.documentType, line)));
    const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.amount, 0));
    const taxTotal = roundCurrency(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    const taxRate = subtotal === 0 ? 0 : roundRate(taxTotal * 100 / subtotal);
    const issueDate = new Date().toISOString();
    const id = randomUUID();
    return this.documents.create({
      id, companyId: command.companyId, actorId: command.actorId, idempotencyKey: command.idempotencyKey.trim(), template,
      issuedAt: issueDate, companyName: company.legalName, companyLogoUrl: template.includeLogo ? (company.logoUrl ?? null) : null,
      recipientName: command.recipientName.trim(), recipientReference: command.recipientReference.trim().slice(0, 120),
      details: linkedDetails, notes: command.notes.trim(), lines, taxRate, subtotal, taxTotal, total: roundCurrency(subtotal + taxTotal),
    });
  }
}

async function validateRelatedDocument(documents: BusinessDocumentPort, fiscalDocuments: FiscalDocumentPort | undefined, companyId: string, type: TemplateDocumentType, details: BusinessDocumentDetails): Promise<BusinessDocumentDetails> {
  if (requiresFiscalSource(type)) return validateFiscalSource(fiscalDocuments, companyId, details);
  if (type !== 'purchase_order' || details.relatedDocumentNumber === '') return details;
  const source = await documents.findByNumber(companyId, details.relatedDocumentNumber);
  if (source === null) throw new BusinessDocumentError('No se encontró el documento relacionado en esta empresa.');
  if (source.documentType !== 'purchase_request') throw new BusinessDocumentError('La orden debe relacionarse con una solicitud de compra de esta empresa.');
  return { ...details, relatedDocumentId: source.id };
}

function requiresFiscalSource(type: TemplateDocumentType): boolean {
  return type === 'credit_note' || type === 'debit_note' || type === 'withholding';
}

async function validateFiscalSource(fiscalDocuments: FiscalDocumentPort | undefined, companyId: string, details: BusinessDocumentDetails): Promise<BusinessDocumentDetails> {
  if (fiscalDocuments === undefined) throw new BusinessDocumentError('No está disponible la consulta de documentos fiscales relacionados.');
  const source = (await fiscalDocuments.list(companyId)).find((document) => document.documentNumber === details.relatedDocumentNumber && document.status === 'issued');
  if (source === undefined) throw new BusinessDocumentError('Vincula una factura fiscal de prueba vigente de esta empresa.');
  return { ...details, relatedDocumentId: source.id };
}

function readDetails(type: TemplateDocumentType, input: Partial<BusinessDocumentDetails>): BusinessDocumentDetails {
  const details: BusinessDocumentDetails = {
    department: detailText(input.department), requestedBy: detailText(input.requestedBy),
    requiredDate: detailText(input.requiredDate), deliveryDate: detailText(input.deliveryDate),
    relatedDocumentNumber: detailText(input.relatedDocumentNumber), relatedDocumentId: null, reason: detailText(input.reason),
    originWarehouse: detailText(input.originWarehouse), destinationWarehouse: detailText(input.destinationWarehouse),
    withholdingRate: input.withholdingRate ?? null,
  };
  if (type === 'requisition' || type === 'purchase_request') requireDetail(details.department, 'Indica el área solicitante.');
  if (type === 'purchase_request') requireDetail(details.reason, 'Explica el motivo de la solicitud de compra.');
  if (type === 'purchase_order') requireDetail(details.deliveryDate, 'Indica la fecha de entrega esperada de la orden de compra.');
  if (type === 'warehouse_transfer') validateTransfer(details);
  if (type === 'credit_note' || type === 'debit_note') validateAdjustment(details);
  if (type === 'withholding') validateWithholding(details);
  return details;
}

function validateTransfer(details: BusinessDocumentDetails): void {
  requireDetail(details.originWarehouse, 'Indica la bodega de origen.');
  requireDetail(details.destinationWarehouse, 'Indica la bodega de destino.');
  requireDetail(details.reason, 'Indica el motivo del traslado.');
  if (details.originWarehouse.toLocaleLowerCase() === details.destinationWarehouse.toLocaleLowerCase()) {
    throw new BusinessDocumentError('La bodega de origen y destino deben ser distintas.');
  }
}

function validateAdjustment(details: BusinessDocumentDetails): void {
  requireDetail(details.relatedDocumentNumber, 'Indica el número del documento original relacionado.');
  requireDetail(details.reason, 'Indica el motivo de la nota.');
}

function validateWithholding(details: BusinessDocumentDetails): void {
  requireDetail(details.relatedDocumentNumber, 'Indica la factura o documento relacionado.');
  if (details.withholdingRate === null || !Number.isFinite(details.withholdingRate) || details.withholdingRate <= 0 || details.withholdingRate > 100) {
    throw new BusinessDocumentError('La tasa de retención debe estar entre 0 y 100.');
  }
}

function requireDetail(value: string, message: string): void {
  if (value.trim() === '') throw new BusinessDocumentError(message);
  if (value.length > 200) throw new BusinessDocumentError('Un dato adicional supera el límite de 200 caracteres.');
}

function detailText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function readCatalogLine(
  products: ProductPort,
  companyId: string,
  documentType: TemplateDocumentType,
  line: { productId: string; presentationUnit: string; quantity: number },
) {
  if (!Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1_000_000) throw new BusinessDocumentError('Revisa la cantidad del artículo.');
  const product = await products.find(companyId, line.productId);
  if (product === null || !product.active) throw new BusinessDocumentError('El producto o servicio ya no está disponible en esta empresa.');
  const presentation = product.presentations.find((item) => item.unit === line.presentationUnit);
  if (!presentation) throw new BusinessDocumentError('Selecciona una presentación vigente del catálogo.');
  const purchaseDocument = documentType === 'requisition' || documentType === 'purchase_request' || documentType === 'purchase_order';
  if (purchaseDocument && (product.itemType === 'service' || !presentation.purchasable)) throw new BusinessDocumentError('Este documento requiere un producto comprable del catálogo.');
  if (!purchaseDocument && !presentation.sellable) throw new BusinessDocumentError('Este documento requiere un producto o servicio habilitado para venta.');
  const price = purchaseDocument ? presentation.referenceUnitCost : presentation.salePrice;
  if (price === null || price === undefined || price < 0) throw new BusinessDocumentError('El artículo seleccionado no tiene un precio o costo vigente para este documento.');
  const tax = TAX_CATEGORIES.find((item) => item.code === product.taxCategoryCode);
  if (!tax) throw new BusinessDocumentError('El artículo tiene una categoría de impuesto no reconocida.');
  const amount = roundCurrency(line.quantity * price);
  return {
    productId: product.id, itemType: product.itemType ?? 'product', description: product.name,
    presentationUnit: presentation.unit, quantity: line.quantity, unitPrice: roundPrice(price), amount,
    taxCategoryCode: tax.code, taxRate: tax.ratePercent, taxAmount: roundCurrency(amount * tax.ratePercent / 100),
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPrice(value: number): number { return Math.round((value + Number.EPSILON) * 10_000) / 10_000; }
function roundRate(value: number): number { return Math.round((value + Number.EPSILON) * 10_000) / 10_000; }
