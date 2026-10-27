import { ConfirmVoucherUseCase, LinkVoucherUseCase } from '@application/documents/voucher/confirm-voucher.use-case';
import { VoucherVoidApprovalUseCase } from '@application/documents/voucher/voucher-void-approval.use-case';
import { DownloadVoucherUseCase, SaveVoucherUseCase, type SaveVoucherCommand } from '@application/documents/voucher/save-voucher.use-case';
import type { CashVoucher } from '@domain/documents/voucher/voucher';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { BadRequestException, Controller, Get, Param, Post, Body, Query, Req, Inject, UseFilters, UseGuards, UploadedFile, UseInterceptors, NotFoundException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AreaGuard, ProtectedAccessMeta, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { assertSameCompany, requireCompanySession } from '@presentation/http/workspace/session/company-session';

@Controller('erp/vouchers')
@ProtectedAreaMeta('operations')
@ProtectedModuleMeta('documents')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class VouchersController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly saveVoucher: SaveVoucherUseCase,
    private readonly confirmVoucher: ConfirmVoucherUseCase,
    private readonly linkVoucher: LinkVoucherUseCase,
    private readonly voucherVoidApproval: VoucherVoidApprovalUseCase,
    private readonly downloadVoucher: DownloadVoucherUseCase,
  ) {}

  @Post()
  async create(@Req() request: Request, @Body() body: SaveVoucherCommand): Promise<{ voucher: CashVoucher }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, body.companyId);
    return { voucher: await this.saveVoucher.execute({ ...body, companyId: session.companyId }) };
  }

  @Post(':id/confirm')
  async confirm(@Req() request: Request, @Param('id') id: string, @Query('companyId') companyId = ''): Promise<{ voucher: CashVoucher }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    const voucher = await this.confirmVoucher.execute(session.companyId, id);
    await this.downloadVoucher.execute(session.companyId, id);
    return { voucher };
  }

  @Post(':id/link')
  async link(
    @Req() request: Request,
    @Param('id') id: string,
    @Query('companyId') companyId = '',
    @Body() body: { moneyMovementId?: string },
  ): Promise<{ voucher: CashVoucher }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    return { voucher: await this.linkVoucher.execute(session.companyId, id, body.moneyMovementId ?? '') };
  }

  @Post(':id/void-request')
  async requestVoid(@Req() request: Request, @Param('id') id: string, @Body() body: { reason?: string }): Promise<{ request: unknown }> {
    const session = await requireCompanySession(this.identity, request.headers);
    return { request: await this.voucherVoidApproval.request(session, id, body.reason ?? '') };
  }

  @Get('void-requests')
  async listVoidRequests(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { requests: await this.voucherVoidApproval.list(session) };
  }

  @Post('void-requests/:requestId/resolve')
  async resolveVoidRequest(@Req() request: Request, @Param('requestId') requestId: string,
    @Body() body: { decision?: 'approved' | 'rejected'; note?: string }) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { request: await this.voucherVoidApproval.resolve(session, requestId, body.decision ?? 'rejected', body.note ?? '') };
  }

  @Get('void-approval-settings')
  @ProtectedModuleMeta('settings')
  @ProtectedAccessMeta('view')
  async voidApprovalSettings(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return this.voucherVoidApproval.settings(session);
  }

  @Post('void-approval-settings')
  @ProtectedModuleMeta('settings')
  @ProtectedAccessMeta('edit')
  async designateVoidApprover(@Req() request: Request, @Body() body: { userId?: string | null }) {
    const session = await requireCompanySession(this.identity, request.headers);
    return this.voucherVoidApproval.designate(session, body.userId ?? null);
  }

  @Get(':id/pdf')
  async pdf(@Req() request: Request, @Param('id') id: string, @Query('companyId') companyId = ''): Promise<{ pdfBase64: string }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    const pdf = await this.downloadVoucher.execute(session.companyId, id);
    return { pdfBase64: pdf.toString('base64') };
  }

  @Post(':id/bank-receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  async attachBankReceipt(
    @Req() request: Request,
    @Param('id') id: string,
    @Query('companyId') companyId = '',
    @UploadedFile() file?: UploadedVoucherFile,
  ): Promise<{ voucher: CashVoucher }> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    if (file === undefined || file.buffer.length === 0) throw new BadRequestException('Selecciona una imagen o PDF.');
    const contentType = validatedReceiptType(file);
    const voucher = await this.downloadVoucher.attachBankReceipt(session.companyId, id, {
      body: file.buffer,
      fileName: file.originalname,
      contentType,
    });
    return { voucher };
  }

  @Get(':id/files/:kind')
  async file(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Query('companyId') companyId = '',
    @Res() response: Response,
  ): Promise<void> {
    const session = await requireCompanySession(this.identity, request.headers);
    assertSameCompany(session, companyId);
    if (kind !== 'voucher' && kind !== 'bank-receipt') throw new NotFoundException('Archivo no encontrado.');
    const file = await this.downloadVoucher.readFile(session.companyId, id, kind);
    if (file === null) throw new NotFoundException('El archivo todavía no está disponible.');
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }
}

interface UploadedVoucherFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function validatedReceiptType(file: UploadedVoucherFile): 'application/pdf' | 'image/jpeg' | 'image/png' {
  const type = file.mimetype.toLowerCase();
  const bytes = file.buffer;
  if (type === 'application/pdf' && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return type;
  if (type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return type;
  if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return type;
  throw new BadRequestException('El archivo debe ser una imagen PNG/JPG válida o un PDF válido.');
}
