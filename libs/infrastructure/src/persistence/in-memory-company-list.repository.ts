import type {
  CompanyListPort,
  CompanyUserRow,
  InventoryDocumentRow,
  VoucherListRow,
} from '@domain/workspace/company-list.port';
import { slicePage, type Page, type PageRequest } from '@domain/workspace/page';

export class InMemoryCompanyListRepository implements CompanyListPort {
  async listDocuments(_companyId: string, request: PageRequest): Promise<Page<InventoryDocumentRow>> {
    return slicePage([], request);
  }

  async listVouchers(_companyId: string, request: PageRequest): Promise<Page<VoucherListRow>> {
    return slicePage([], request);
  }

  async listUsers(_companyId: string, request: PageRequest): Promise<Page<CompanyUserRow>> {
    return slicePage([], request);
  }
}
