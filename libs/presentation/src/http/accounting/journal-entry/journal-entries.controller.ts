import { CreateJournalEntryUseCase } from '@application/accounting/journal-entry/create-journal-entry.use-case';
import { ListJournalEntriesUseCase } from '@application/accounting/journal-entry/list-journal-entries.use-case';
import { VoidJournalEntryUseCase } from '@application/accounting/journal-entry/void-journal-entry.use-case';
import type { JournalEntryLine } from '@domain/accounting/journal-entry/journal-entry';
import { IDENTITY_PORT, type IdentityPort } from '@domain/identity/session/session.port';
import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AreaGuard, ProtectedAreaMeta, ProtectedModuleMeta } from '@presentation/http/identity/session/area.guard';
import { CompanyIdentityFilter } from '@presentation/http/identity/session/company-identity.filter';
import { requireCompanySession } from '@presentation/http/workspace/session/company-session';

interface JournalEntryBody {
  occurredAt?: unknown;
  description?: unknown;
  idempotencyKey?: unknown;
  lines?: unknown;
}

@Controller('erp/accounting/journal-entries')
@ProtectedAreaMeta('accounting')
@ProtectedModuleMeta('accounting')
@UseGuards(AreaGuard)
@UseFilters(CompanyIdentityFilter)
export class JournalEntriesController {
  constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly createEntry: CreateJournalEntryUseCase,
    private readonly listEntries: ListJournalEntriesUseCase,
    private readonly voidEntry: VoidJournalEntryUseCase,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { entries: await this.listEntries.execute(session.companyId) };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: JournalEntryBody) {
    const session = await requireCompanySession(this.identity, request.headers);
    return { entry: await this.createEntry.execute({
      companyId: session.companyId,
      createdBy: session.userId,
      occurredAt: timestamp(body.occurredAt),
      description: text(body.description, 'description'),
      idempotencyKey: text(body.idempotencyKey, 'idempotencyKey'),
      lines: lines(body.lines),
    }) };
  }

  @Post(':entryId/void')
  async void(@Req() request: Request, @Param('entryId') entryId: string) {
    const session = await requireCompanySession(this.identity, request.headers);
    return this.voidEntry.execute(session.companyId, entryId, session.userId);
  }
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new BadRequestException(`${field} is required`);
  return value.trim();
}

function timestamp(value: unknown): string {
  const raw = text(value, 'occurredAt');
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00.000Z` : raw;
}

function lines(value: unknown): JournalEntryLine[] {
  if (!Array.isArray(value)) throw new BadRequestException('lines must be an array');
  return value.map(readLine);
}

function readLine(value: unknown): JournalEntryLine {
  if (!isRecord(value) || typeof value.accountCode !== 'string' || typeof value.debit !== 'number' || typeof value.credit !== 'number') {
    throw new BadRequestException('Each line needs accountCode, debit, and credit');
  }
  return { accountCode: value.accountCode, debit: value.debit, credit: value.credit };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
