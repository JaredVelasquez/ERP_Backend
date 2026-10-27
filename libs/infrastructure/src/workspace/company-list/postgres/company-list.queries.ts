import type { EntityManager } from 'typeorm';
import type { PageRequest } from '@domain/workspace/company-list/page';
import { pageOffset } from '@domain/workspace/company-list/page';
import {
  DocumentSubmissionEntity,
} from '@infrastructure/workspace/company-list/postgres/entities/company-list.entity';
import { InventoryDocumentEntity } from '@infrastructure/inventory/ledger/postgres/entities/inventory-ledger.entity';
import { MembershipEntity, UserEntity } from '@infrastructure/identity/session/postgres/entities/identity.entity';

export function findInventoryDocuments(manager: EntityManager, companyId: string, request: PageRequest) {
  const query = manager.createQueryBuilder(InventoryDocumentEntity, 'document')
    .where('document.companyId = :companyId', { companyId });
  if (request.search.trim() !== '') {
    query.andWhere("(document.documentType ILIKE :like ESCAPE '!' OR document.status ILIKE :like ESCAPE '!')", {
      like: postgresLikeTerm(request.search),
    });
  }
  return query.orderBy('document.createdAt', 'DESC')
    .addOrderBy('document.id', 'ASC')
    .skip(pageOffset(request))
    .take(request.pageSize)
    .getManyAndCount();
}

export function findVouchers(manager: EntityManager, companyId: string, request: PageRequest) {
  const query = manager.createQueryBuilder(DocumentSubmissionEntity, 'voucher')
    .where('voucher.companyId = :companyId', { companyId });
  if (request.search.trim() !== '') {
    query.andWhere("(voucher.reference ILIKE :like ESCAPE '!' OR voucher.holder ILIKE :like ESCAPE '!')", {
      like: postgresLikeTerm(request.search),
    });
  }
  return query.orderBy('voucher.occurredOn', 'DESC')
    .addOrderBy('voucher.id', 'ASC')
    .skip(pageOffset(request))
    .take(request.pageSize)
    .getManyAndCount();
}

export function findCompanyUsers(manager: EntityManager, companyId: string, request: PageRequest) {
  const query = manager.createQueryBuilder(UserEntity, 'user')
    .innerJoin(MembershipEntity, 'membership', 'membership.userId = user.id')
    .where('membership.companyId = :companyId', { companyId })
    .distinct(true);
  if (request.search.trim() !== '') {
    query.andWhere("(user.email ILIKE :like ESCAPE '!' OR user.displayName ILIKE :like ESCAPE '!')", {
      like: postgresLikeTerm(request.search),
    });
  }
  return query.orderBy('user.email', 'ASC')
    .addOrderBy('user.id', 'ASC')
    .skip(pageOffset(request))
    .take(request.pageSize)
    .getManyAndCount();
}

function postgresLikeTerm(search: string): string {
  const escaped = search.trim().replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_');
  return '%' + escaped + '%';
}
