import { Inject, Injectable } from '@nestjs/common';
import { ProductError } from '@domain/inventory/product';
import { COMPANY_LIST_PORT, type CompanyListPort } from '@domain/workspace/company-list.port';
import { readPageRequest, type Page } from '@domain/workspace/page';

interface ListQuery {
  companyId: string;
  page: string;
  pageSize: string;
  search: string;
}

@Injectable()
export class ListInventoryDocumentsUseCase {
  constructor(@Inject(COMPANY_LIST_PORT) private readonly lists: CompanyListPort) {}

  execute(query: ListQuery): Promise<Page<{ id: string; documentType: string; status: string; createdAt: string }>> {
    return this.lists.listDocuments(requiredCompany(query.companyId), readPageRequest(query.page, query.pageSize, query.search));
  }
}

@Injectable()
export class ListVouchersUseCase {
  constructor(@Inject(COMPANY_LIST_PORT) private readonly lists: CompanyListPort) {}

  execute(query: ListQuery): Promise<Page<{ id: string; reference: string; holder: string; amount: string; occurredOn: string }>> {
    return this.lists.listVouchers(requiredCompany(query.companyId), readPageRequest(query.page, query.pageSize, query.search));
  }
}

@Injectable()
export class ListCompanyUsersUseCase {
  constructor(@Inject(COMPANY_LIST_PORT) private readonly lists: CompanyListPort) {}

  execute(query: ListQuery): Promise<Page<{ id: string; email: string; displayName: string }>> {
    return this.lists.listUsers(requiredCompany(query.companyId), readPageRequest(query.page, query.pageSize, query.search));
  }
}

@Injectable()
export class ListImportHistoryUseCase {
  execute(query: ListQuery): Page<{ id: string; file: string; status: string; rows: string }> {
    const request = readPageRequest(query.page, query.pageSize, query.search);
    requiredCompany(query.companyId);
    return { items: [], page: request.page, pageSize: request.pageSize, total: 0 };
  }
}

function requiredCompany(companyId: string): string {
  if (companyId.trim() === '') {
    throw new ProductError('companyId is required');
  }
  return companyId;
}
