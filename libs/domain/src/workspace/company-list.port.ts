import type { Page, PageRequest } from '@domain/workspace/page';

export interface InventoryDocumentRow {
  id: string;
  documentType: string;
  status: string;
  createdAt: string;
}

export interface VoucherListRow {
  id: string;
  reference: string;
  holder: string;
  amount: string;
  occurredOn: string;
}

export interface CompanyUserRow {
  id: string;
  email: string;
  displayName: string;
}

export interface CompanyListPort {
  listDocuments(companyId: string, request: PageRequest): Promise<Page<InventoryDocumentRow>>;
  listVouchers(companyId: string, request: PageRequest): Promise<Page<VoucherListRow>>;
  listUsers(companyId: string, request: PageRequest): Promise<Page<CompanyUserRow>>;
}

export const COMPANY_LIST_PORT = Symbol('COMPANY_LIST_PORT');
