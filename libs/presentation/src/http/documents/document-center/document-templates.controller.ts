import { ListDocumentTemplatesUseCase } from '@application/documents/document-template/list-document-templates.use-case';
import { PublishDocumentTemplateUseCase } from '@application/documents/document-template/publish-document-template.use-case';
import { SaveDocumentTemplateUseCase } from '@application/documents/document-template/save-document-template.use-case';
import { TEMPLATE_DOCUMENT_TYPES, DocumentTemplateError, type TemplateDocumentType } from '@domain/documents/document-template/document-template';
import type { SaveDocumentTemplateCommand } from '@domain/documents/document-template/document-template.port';
import { Body, Controller, Get, Inject, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';

interface TemplateBody { documentType?: unknown; templateKey?: unknown; name?: unknown; pageSize?: unknown; orientation?: unknown; marginMm?: unknown; accentColor?: unknown; includeLogo?: unknown; headerText?: unknown; footerText?: unknown; layoutDefinition?: unknown }

@Controller('erp/document-templates')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('settings')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class DocumentTemplatesController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly list: ListDocumentTemplatesUseCase,
    private readonly save: SaveDocumentTemplateUseCase,
    private readonly publish: PublishDocumentTemplateUseCase,
  ) {}

  @Get()
  async listForCompany(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { templates: await this.list.execute(session.companyId) };
  }

  @Post()
  async saveDraft(@Req() request: Request, @Body() body: TemplateBody) {
    const session = await requireCompanySession(this.identity, request.headers);
    const command: SaveDocumentTemplateCommand = {
      companyId: session.companyId, actorId: session.userId, documentType: documentType(body.documentType),
      templateKey: stringValue(body.templateKey, 'templateKey'), name: stringValue(body.name, 'name'),
      pageSize: body.pageSize === 'LETTER' ? 'LETTER' : 'A4',
      orientation: body.orientation === 'landscape' ? 'landscape' : 'portrait',
      marginMm: numberValue(body.marginMm, 14), accentColor: stringValue(body.accentColor, 'accentColor'),
      includeLogo: body.includeLogo === true, headerText: optionalText(body.headerText), footerText: optionalText(body.footerText),
      layoutDefinition: readLayout(body.layoutDefinition),
    };
    return { template: await this.save.execute(command) };
  }

  @Post(':id/publish')
  async publishDraft(@Req() request: Request, @Param('id') id: string) {
    const session = await requireCompanySession(this.identity, request.headers);
    await this.publish.execute(session.companyId, id);
    return { published: true, id };
  }
}

function documentType(value: unknown): TemplateDocumentType {
  if (typeof value === 'string' && TEMPLATE_DOCUMENT_TYPES.includes(value as TemplateDocumentType)) return value as TemplateDocumentType;
  throw new DocumentTemplateError('Tipo de documento inválido.');
}
function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new DocumentTemplateError(`${field} es obligatorio.`);
  return value;
}
function optionalText(value: unknown): string { return typeof value === 'string' ? value : ''; }
function numberValue(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function readLayout(value: unknown): SaveDocumentTemplateCommand['layoutDefinition'] {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new DocumentTemplateError('El diseño visual de la plantilla no tiene un formato válido.');
  const layout = value as { content?: unknown; root?: unknown; zones?: unknown };
  if (!Array.isArray(layout.content) || typeof layout.root !== 'object' || layout.root === null || Array.isArray(layout.root)) {
    throw new DocumentTemplateError('El diseño visual de la plantilla no tiene un formato válido.');
  }
  return value as NonNullable<SaveDocumentTemplateCommand['layoutDefinition']>;
}
