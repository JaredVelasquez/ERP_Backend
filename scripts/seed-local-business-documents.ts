import { join } from 'node:path';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import type { TemplateDocumentType } from '@domain/documents/document-template/document-template';
import { TEMPLATE_DOCUMENT_TYPES } from '@domain/documents/document-template/document-template';
import { SaveDocumentTemplateUseCase } from '@application/documents/document-template/save-document-template.use-case';
import { PublishDocumentTemplateUseCase } from '@application/documents/document-template/publish-document-template.use-case';
import { CreateBusinessDocumentUseCase } from '@application/documents/business-document/create-business-document.use-case';
import { PostgresDocumentTemplateRepository } from '@infrastructure/documents/document-template/postgres/postgres-document-template.repository';
import { PostgresBusinessDocumentRepository } from '@infrastructure/documents/business-document/postgres/postgres-business-document.repository';
import { PostgresCompanyRepository } from '@infrastructure/tenancy/company/postgres/postgres-company.repository';
import { PostgresProductRepository } from '@infrastructure/catalog/product/postgres/product.repository';
import { PostgresFiscalDocumentRepository } from '@infrastructure/documents/fiscal/postgres/postgres-fiscal-document.repository';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

loadEnvFile(join(__dirname, '..', '.env'));

const SAMPLE_KEY_VERSION = '20261027-v5';
const SAMPLE_TEMPLATES: Readonly<Record<TemplateDocumentType, { label: string; recipient: string; quantity: number }>> = {
  invoice: { label: 'Factura de prueba (no fiscal)', recipient: 'Cliente ficticio de demostración', quantity: 2 },
  proforma: { label: 'Proforma', recipient: 'Cliente ficticio de demostración', quantity: 3 },
  quotation: { label: 'Cotización', recipient: 'Cliente ficticio de demostración', quantity: 4 },
  requisition: { label: 'Requisición', recipient: 'Bodega · documento de prueba', quantity: 5 },
  purchase_request: { label: 'Solicitud de compra', recipient: 'Proveedor ficticio de demostración', quantity: 8 },
  purchase_order: { label: 'Orden de compra', recipient: 'Proveedor ficticio de demostración', quantity: 8 },
  warehouse_transfer: { label: 'Traslado entre bodegas', recipient: 'Movimiento interno · solo documento', quantity: 2 },
  credit_note: { label: 'Nota de crédito', recipient: 'Cliente ficticio de demostración', quantity: 1 },
  debit_note: { label: 'Nota de débito', recipient: 'Cliente ficticio de demostración', quantity: 1 },
  withholding: { label: 'Retención', recipient: 'Proveedor ficticio de demostración', quantity: 1 },
};

async function main(): Promise<void> {
  if (process.env.PG_NAME !== 'erp_dev') throw new Error('Sample seed only runs against the local erp_dev database.');
  const database = createTypeOrmExecutor(process.env);
  try {
    const companyRows = await database.withManager((manager) => manager.query(
      `SELECT id, legal_name AS "legalName", logo_url AS "logoUrl"
       FROM companies WHERE legal_name ILIKE '%(desarrollo)%' ORDER BY created_at LIMIT 1`,
    )) as { id: string; legalName: string; logoUrl: string | null }[];
    const company = companyRows[0];
    if (!company) throw new Error('No development company is available in erp_dev.');
    const ownerRows = await database.withManager((manager) => manager.query(
      `SELECT users.id FROM users
       INNER JOIN memberships ON memberships.user_id = users.id
       INNER JOIN roles ON roles.id = memberships.role_id
       WHERE memberships.company_id = $1 AND roles.code = 'owner'
       ORDER BY users.created_at LIMIT 1`, [company.id],
    )) as { id: string }[];
    const actorId = ownerRows[0]?.id;
    if (!actorId) throw new Error('The development company has no owner to attribute sample documents to.');

    const templates = new PostgresDocumentTemplateRepository(database);
    const documents = new PostgresBusinessDocumentRepository(database);
    const fiscalDocuments = new PostgresFiscalDocumentRepository(database);
    const saveTemplate = new SaveDocumentTemplateUseCase(templates);
    const publishTemplate = new PublishDocumentTemplateUseCase(templates);
    const productRepository = new PostgresProductRepository(database);
    const createDocument = new CreateBusinessDocumentUseCase(documents, templates, new PostgresCompanyRepository(database), productRepository, fiscalDocuments);
    const catalog = await productRepository.list(company.id);
    const activeTemplates = new Map<TemplateDocumentType, string>();
    let templatesCreated = 0;
    for (const type of TEMPLATE_DOCUMENT_TYPES) {
      const existing = (await templates.list(company.id)).find((item) => item.documentType === type && item.status === 'published');
      if (existing) {
        if (hasCurrentHtmlTemplate(existing.layoutDefinition)) {
          activeTemplates.set(type, existing.id);
          continue;
        }
      }
      const sample = SAMPLE_TEMPLATES[type];
      const draft = await saveTemplate.execute({
        companyId: company.id, actorId, documentType: type, templateKey: existing?.templateKey ?? type,
        name: `${sample.label} · Formato empresarial`, pageSize: 'A4', orientation: 'portrait', marginMm: 14,
        accentColor: '#0157d2', includeLogo: company.logoUrl !== null || company.legalName.toLocaleLowerCase().includes('michelle market'),
        headerText: 'Documento preparado por la empresa', footerText: 'Documento ficticio de desarrollo. No válido para uso fiscal.',
        layoutDefinition: formalLayout(type, sample.label),
      });
      await publishTemplate.execute(company.id, draft.id);
      activeTemplates.set(type, draft.id);
      templatesCreated += 1;
    }

    const sampleNumbers = new Map<TemplateDocumentType, string>();
    const sourceInvoice = (await fiscalDocuments.list(company.id)).find((document) => document.status === 'issued');
    if (sourceInvoice) sampleNumbers.set('invoice', sourceInvoice.documentNumber);
    const documentTypesToSeed = TEMPLATE_DOCUMENT_TYPES.filter((type) => type !== 'invoice'
      && (type !== 'credit_note' && type !== 'debit_note' && type !== 'withholding' || sourceInvoice !== undefined));
    let documentsCreated = 0;
    for (const type of documentTypesToSeed) {
      const key = `local-sample-${type}-${SAMPLE_KEY_VERSION}`;
      const existingRows = await database.withManager((manager) => manager.query(
        'SELECT document_number AS "documentNumber" FROM business_documents WHERE company_id = $1 AND idempotency_key = $2 LIMIT 1',
        [company.id, key],
      )) as { documentNumber: string }[];
      const existing = existingRows[0];
      if (existing) {
        sampleNumbers.set(type, existing.documentNumber);
        continue;
      }
      const sample = SAMPLE_TEMPLATES[type];
      const details = sampleDetails(type, sampleNumbers);
      const document = await createDocument.execute({
        companyId: company.id, actorId, idempotencyKey: key, templateId: requiredTemplate(activeTemplates, type),
        documentType: type, recipientName: sample.recipient, recipientReference: 'DEMO-LOCAL', details,
        notes: 'Dato ficticio para revisar el formato. Sin efectos fiscales, contables ni de inventario.',
        lines: sampleCatalogLines(catalog, type, sample.quantity),
      });
      sampleNumbers.set(type, document.documentNumber);
      documentsCreated += 1;
    }
    process.stdout.write(JSON.stringify({ database: process.env.PG_NAME, company: company.legalName, templatesCreated, templatesTotal: TEMPLATE_DOCUMENT_TYPES.length, documentsCreated, documentsTotal: documentTypesToSeed.length, linkedFiscalInvoice: sourceInvoice?.documentNumber ?? null, sampleNumbers: Object.fromEntries(sampleNumbers) }, null, 2) + '\n');
  } finally {
    await database.close?.();
  }
}

function sampleCatalogLines(products: Awaited<ReturnType<PostgresProductRepository['list']>>, type: TemplateDocumentType, quantity: number) {
  const purchaseDocument = type === 'requisition' || type === 'purchase_request' || type === 'purchase_order';
  const product = products.find((item) => item.active && item.itemType !== 'service' && item.presentations.some((presentation) =>
    purchaseDocument ? presentation.purchasable && presentation.referenceUnitCost !== null && presentation.referenceUnitCost !== undefined
      : presentation.sellable && presentation.salePrice !== null,
  ));
  if (!product) throw new Error('The development catalog needs a priced product to create document samples.');
  const presentation = product.presentations.find((item) => purchaseDocument
    ? item.purchasable && item.referenceUnitCost !== null && item.referenceUnitCost !== undefined
    : item.sellable && item.salePrice !== null);
  if (!presentation) throw new Error('The selected sample product has no priced presentation.');
  return [{ productId: product.id, presentationUnit: presentation.unit, quantity }];
}

function formalLayout(type: TemplateDocumentType, title: string) {
  const disclaimer = type === 'invoice' ? 'Muestra de desarrollo. No válida como factura fiscal.' : 'Documento de prueba de desarrollo. No genera efectos fiscales, contables ni de inventario.';
  const totalLabel = type === 'withholding' ? 'Total retenido' : type === 'proforma' ? 'Total estimado' : 'Total a pagar';
  const html = referenceHtml(type, title, disclaimer)
    .replace('erp-template-revision: 20261027-v3', 'erp-template-revision: 20261027-v5')
    .replace('</style>', '.bottom{grid-template-columns:minmax(0,1fr) minmax(220px,270px)}.totals{border:1px solid #e1e9f0;border-radius:3px;overflow:hidden}.totals h2{margin:0;padding:7px 9px;background:var(--tint);color:var(--accent);font-size:8px;text-transform:uppercase;letter-spacing:.05em}.totals p{padding:6px 9px}.totals .grand{margin:0;padding:10px;background:var(--accent)}.words{margin:0}@media(max-width:560px){.bottom{grid-template-columns:1fr}}</style>')
    .replace(/<section class="bottom">[\s\S]*?<\/section>(?=<section class="signature">)/, `<section class="bottom"><div class="words"><small>Condiciones / observaciones</small><strong>{{notes}}</strong></div><div class="totals"><h2>Resumen de importes</h2><p><span>Subtotal</span><strong>{{subtotal}}</strong></p><p><span>Impuestos</span><strong>{{taxTotal}}</strong></p><p class="grand"><span>${totalLabel}</span><strong>{{total}}</strong></p></div></section>`);
  return {
    content: [{ type: 'HtmlTemplate', props: { id: 'html-template', html } }],
    root: {},
  };
}

function hasCurrentHtmlTemplate(layout: unknown): boolean {
  if (typeof layout !== 'object' || layout === null || !('content' in layout) || !Array.isArray(layout.content)) return false;
  return layout.content.some((block) => typeof block === 'object' && block !== null && 'type' in block && block.type === 'HtmlTemplate' && 'props' in block && typeof block.props === 'object' && block.props !== null && 'html' in block.props && typeof block.props.html === 'string' && block.props.html.includes('erp-template-revision: 20261027-v5'));
}

function referenceHtml(type: TemplateDocumentType, title: string, disclaimer: string): string {
  const titleText = type === 'withholding' ? 'Comprobante de retención' : title;
  const totalLabel = type === 'withholding' ? 'Total retenido' : type === 'proforma' ? 'Total estimado' : 'Total a pagar';
  const subtitle = type === 'proforma' ? 'Cotización comercial · No válida como factura' : disclaimer;
  return `<!-- erp-template-revision: 20261027-v3 -->
<style>
:root{color-scheme:light;--accent:{{accentColor}};--tint:color-mix(in srgb,var(--accent) 9%,white);--ink:#153552;--muted:#536b81;--line:#cbd8e3;--soft:#f5f8fb}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:var(--ink);font:12px/1.42 Arial,Helvetica,sans-serif}.sheet{width:100%;max-width:190mm;margin:0 auto;padding:2mm 1mm 0}.topline{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.topline strong{color:var(--ink);font-size:11px;letter-spacing:.1em;white-space:nowrap}.topline span:last-child{text-align:right;letter-spacing:.04em;font-weight:500}.brand{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px 0 12px;border-bottom:1px solid var(--line)}.brand img{width:60px;height:52px;object-fit:contain}.issuer{display:grid;gap:2px}.label{color:var(--muted);font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.issuer strong{font-size:15px;letter-spacing:.01em}.issuer small{color:var(--muted);font-size:10px}.authority{text-align:right}.authority strong{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.authority small{display:block;margin-top:3px;color:var(--muted);font-size:8px;text-transform:uppercase}.heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:12px 0 10px}.heading h1{margin:0;color:var(--accent);font-size:30px;line-height:1;text-transform:uppercase;letter-spacing:-.035em}.heading p{margin:5px 0 0;color:var(--accent);font-size:11px;font-weight:700}.number{display:grid;gap:2px;text-align:right}.number span{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.number strong{font-size:12px}.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:8px;margin:4px 0 10px}.panel{min-width:0;padding:8px 10px;background:var(--soft);border:1px solid #e1e9f0;border-radius:3px}.panel h2{margin:0 0 6px;color:var(--accent);font-size:9px;letter-spacing:.06em;text-transform:uppercase}.panel dl{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;margin:0}.panel dl div{min-width:0;display:grid;gap:1px}.panel dt{color:var(--muted);font-size:9px}.panel dd{margin:0;font-weight:700;overflow-wrap:anywhere}.details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 10px}.details div{padding:6px 8px;background:#fff;border:1px solid #e1e9f0;border-radius:3px}.details small{display:block;color:var(--muted);font-size:8px;text-transform:uppercase}.details strong{display:block;margin-top:2px;font-size:10px;overflow-wrap:anywhere}.section-title{margin:12px 0 5px;color:var(--accent);font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.items{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}.items th{padding:6px 5px;background:var(--tint);color:var(--ink);text-align:left;font-size:8px;line-height:1.25;font-weight:700}.items td{padding:6px 5px;border-bottom:1px solid #e5ebf0;overflow-wrap:anywhere}.items tbody tr:nth-child(even){background:var(--soft)}.items th:not(:first-child),.items td:not(:first-child){text-align:right}.items th:first-child,.items td:first-child{width:7%}.items th:nth-child(2){width:43%}.items th:nth-child(3){width:14%}.items th:nth-child(4),.items th:nth-child(5){width:18%}.bottom{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:14px;margin-top:12px;align-items:start}.taxbox{border:1px solid #e1e9f0;border-radius:3px;overflow:hidden}.taxbox h2{margin:0;padding:6px 8px;background:var(--tint);font-size:8px;text-transform:uppercase;letter-spacing:.04em}.taxrow{display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:4px 8px;border-top:1px solid #e8edf2;font-size:8px}.totals{display:grid;gap:0}.totals p{display:flex;justify-content:space-between;gap:12px;margin:0;padding:5px 7px;border-bottom:1px solid #e2e8ee}.totals .grand{margin-top:4px;padding:9px 10px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;border:0;border-radius:3px}.words{margin-top:9px;padding:7px 8px;background:var(--soft);border:1px solid #e1e9f0;border-radius:3px}.words small{display:block;color:var(--muted);font-size:8px;text-transform:uppercase}.words strong{display:block;margin-top:3px;font-size:9px}.signature{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin:28px 6px 16px}.signature span{padding-top:5px;border-top:1px solid #8192a2;text-align:center;color:var(--muted);font-size:8px}.foot{display:flex;justify-content:space-between;gap:10px;padding-top:7px;border-top:1px solid var(--line);color:var(--muted);font-size:8px}.foot span:last-child{text-align:right}@media print{@page{size:A4 portrait;margin:12mm}.sheet{max-width:none;padding:0}.brand,.heading,.grid,.details,.items,.bottom,.words,.signature,.foot{break-inside:avoid}}
</style><main class="sheet"><div class="topline"><span>Plantilla referencial</span><strong>Honduras / SAR</strong><span>Factura · Proforma · Comprobante de retención</span></div><header class="brand">{{companyLogoMarkup}}<div class="issuer"><span class="label">Emisor</span><strong>{{companyName}}</strong><small>{{headerText}}</small></div><div class="authority"><strong>Documento comercial</strong><small>Formato de desarrollo</small></div></header><section class="heading"><div><h1>${titleText}</h1><p>${subtitle}</p></div><div class="number"><span>N.º de documento</span><strong>{{documentNumber}}</strong></div></section><section class="grid"><div class="panel"><h2>Cliente / destinatario</h2><dl><div><dt>Nombre</dt><dd>{{recipientName}}</dd></div><div><dt>RTN / referencia</dt><dd>{{recipientReference}}</dd></div></dl></div><div class="panel"><h2>Datos del documento</h2><dl><div><dt>Fecha de emisión</dt><dd>{{issuedAt}}</dd></div><div><dt>Tipo</dt><dd>{{documentType}}</dd></div></dl></div></section><div class="details">{{documentDetails}}</div><h2 class="section-title">Detalle de bienes o servicios</h2>{{itemsTable}}<section class="bottom"><div><div class="taxbox"><h2>Resumen de importes</h2><div class="taxrow"><span>Base / subtotal</span><strong>{{subtotal}}</strong><strong></strong></div><div class="taxrow"><span>Impuestos</span><strong>{{taxTotal}}</strong><strong></strong></div><div class="taxrow"><span>Moneda</span><strong>HNL</strong><strong></strong></div></div><div class="words"><small>Condiciones / observaciones</small><strong>{{notes}}</strong></div></div><div class="totals"><p><span>Subtotal</span><strong>{{subtotal}}</strong></p><p><span>Impuestos</span><strong>{{taxTotal}}</strong></p><p class="grand"><span>${totalLabel}</span><strong>{{total}}</strong></p></div></section><section class="signature"><span>Nombre y firma de quien entrega</span><span>Nombre y firma de quien recibe</span></section><footer class="foot"><span>{{footerText}}</span><span>Documento ficticio · No válido para uso fiscal</span></footer></main>`;
}
function requiredTemplate(templates: ReadonlyMap<TemplateDocumentType, string>, type: TemplateDocumentType): string {
  const id = templates.get(type);
  if (!id) throw new Error(`No published template for ${type}.`);
  return id;
}

function sampleDetails(type: TemplateDocumentType, numbers: ReadonlyMap<TemplateDocumentType, string>) {
  if (type === 'requisition') return { department: 'Operaciones · prueba', requestedBy: 'Usuario de demostración', reason: 'Revisión del flujo en desarrollo', requiredDate: '2026-11-15' };
  if (type === 'purchase_request') return { department: 'Operaciones · prueba', requestedBy: 'Usuario de demostración', reason: 'Reposición ficticia para revisar el formato', requiredDate: '2026-11-20' };
  if (type === 'purchase_order') return { deliveryDate: '2026-11-25', relatedDocumentNumber: numbers.get('purchase_request') ?? '' };
  if (type === 'warehouse_transfer') return { originWarehouse: 'Bodega Principal · muestra', destinationWarehouse: 'Bodega Secundaria · muestra', reason: 'Ejemplo impreso; no se mueve inventario' };
  if (type === 'credit_note' || type === 'debit_note') return { relatedDocumentNumber: numbers.get('invoice') ?? '', reason: 'Ajuste ficticio para probar el documento' };
  if (type === 'withholding') return { relatedDocumentNumber: numbers.get('invoice') ?? '', withholdingRate: 1.5 };
  return {};
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Could not create development document samples.'}\n`);
  process.exitCode = 1;
});

