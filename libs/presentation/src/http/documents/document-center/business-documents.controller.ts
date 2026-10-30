import { CreateBusinessDocumentUseCase, type CreateBusinessDocumentCommand } from '@application/documents/business-document/create-business-document.use-case';
import { ListBusinessDocumentsUseCase } from '@application/documents/business-document/list-business-documents.use-case';
import { BusinessDocumentError } from '@domain/documents/business-document/business-document';
import { TEMPLATE_DOCUMENT_TYPES, type TemplateDocumentType } from '@domain/documents/document-template/document-template';
import { Body, Controller, Get, Inject, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';

interface DocumentBody { idempotencyKey?: unknown; templateId?: unknown; documentType?: unknown; recipientName?: unknown; recipientReference?: unknown; details?: unknown; notes?: unknown; lines?: unknown }

@Controller('erp/business-documents')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('documents')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class BusinessDocumentsController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly create: CreateBusinessDocumentUseCase,
    private readonly list: ListBusinessDocumentsUseCase,
  ) {}

  @Get()
  async listForCompany(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { documents: await this.list.execute(session.companyId) };
  }

  @Post()
  async createDraft(@Req() request: Request, @Body() body: DocumentBody) {
    const session = await requireCompanySession(this.identity, request.headers);
    const command: CreateBusinessDocumentCommand = {
      companyId: session.companyId, actorId: session.userId, idempotencyKey: requiredText(body.idempotencyKey),
      templateId: requiredText(body.templateId), documentType: documentType(body.documentType),
      recipientName: requiredText(body.recipientName), recipientReference: optionalText(body.recipientReference),
      details: readDetails(body.details), notes: optionalText(body.notes), lines: readLines(body.lines),
    };
    return { document: await this.create.execute(command) };
  }
}

function documentType(value: unknown): TemplateDocumentType {
  if (typeof value === 'string' && TEMPLATE_DOCUMENT_TYPES.includes(value as TemplateDocumentType)) return value as TemplateDocumentType;
  throw new BusinessDocumentError('Tipo de documento inválido.');
}
function requiredText(value: unknown): string {
  if (typeof value !== 'string') throw new BusinessDocumentError('Falta un campo obligatorio.');
  return value;
}
function optionalText(value: unknown): string { return typeof value === 'string' ? value : ''; }
function readLines(value: unknown): CreateBusinessDocumentCommand['lines'] {
  if (!Array.isArray(value)) throw new BusinessDocumentError('Las líneas del documento son obligatorias.');
  return value.map((line) => {
    if (!isRecord(line)) throw new BusinessDocumentError('Una línea del documento no es válida.');
    return { productId: requiredText(line.productId), presentationUnit: requiredText(line.presentationUnit), quantity: numberField(line.quantity) };
  });
}
function readDetails(value: unknown): CreateBusinessDocumentCommand['details'] {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new BusinessDocumentError('Los datos adicionales del documento no son válidos.');
  return {
    department: optionalText(value.department), requestedBy: optionalText(value.requestedBy),
    requiredDate: optionalText(value.requiredDate), deliveryDate: optionalText(value.deliveryDate),
    relatedDocumentNumber: optionalText(value.relatedDocumentNumber), relatedDocumentId: null, reason: optionalText(value.reason),
    originWarehouse: optionalText(value.originWarehouse), destinationWarehouse: optionalText(value.destinationWarehouse),
    withholdingRate: value.withholdingRate === undefined || value.withholdingRate === null ? null : numberField(value.withholdingRate),
  };
}
function numberField(value: unknown): number {
  if (typeof value !== 'number') throw new BusinessDocumentError('Cantidad y precio deben ser numéricos.');
  return value;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
