import type { EntityManager } from 'typeorm';
import type { DashboardLayoutRecord, TableLayoutRecord, UiPreferenceRecord } from '@domain/workspace/layout/layout.port';
import { DashboardLayoutEntity, TableLayoutEntity, UiPreferenceEntity } from '@infrastructure/workspace/layout/postgres/entities/layout.entity';

export async function readTableLayout(manager: EntityManager, companyId: string, userId: string, tableKey: string): Promise<TableLayoutEntity | null> {
  return manager.getRepository(TableLayoutEntity).createQueryBuilder('layout')
    .where('layout.companyId = :companyId AND layout.userId = :userId AND layout.tableKey = :tableKey', { companyId, userId, tableKey })
    .getOne();
}

export async function saveTableLayout(manager: EntityManager, record: TableLayoutRecord): Promise<string> {
  const repository = manager.getRepository(TableLayoutEntity);
  const existing = await repository.createQueryBuilder('layout')
    .select('layout.id', 'id')
    .where('layout.companyId = :companyId AND layout.userId = :userId AND layout.tableKey = :tableKey', {
      companyId: record.companyId, userId: record.userId, tableKey: record.tableKey,
    }).getRawOne<{ id: string }>();
  const columnsJson = JSON.stringify(record.columns);
  if (existing) {
    await repository.createQueryBuilder().update(TableLayoutEntity).set({ pageSize: record.pageSize, columnsJson })
      .where('id = :id AND companyId = :companyId AND userId = :userId', { id: existing.id, companyId: record.companyId, userId: record.userId }).execute();
    return existing.id;
  }
  await repository.createQueryBuilder().insert().into(TableLayoutEntity).values({
    id: record.id, companyId: record.companyId, userId: record.userId, tableKey: record.tableKey, pageSize: record.pageSize, columnsJson,
  }).execute();
  return record.id;
}

export async function readDashboardLayout(manager: EntityManager, companyId: string, userId: string): Promise<DashboardLayoutEntity | null> {
  return manager.getRepository(DashboardLayoutEntity).createQueryBuilder('layout')
    .where('layout.companyId = :companyId AND layout.userId = :userId', { companyId, userId })
    .getOne();
}

export async function saveDashboardLayout(manager: EntityManager, record: DashboardLayoutRecord): Promise<string> {
  const repository = manager.getRepository(DashboardLayoutEntity);
  const existing = await repository.createQueryBuilder('layout').select('layout.id', 'id')
    .where('layout.companyId = :companyId AND layout.userId = :userId', { companyId: record.companyId, userId: record.userId })
    .getRawOne<{ id: string }>();
  const widgetsJson = JSON.stringify(record.widgets);
  if (existing) {
    await repository.createQueryBuilder().update(DashboardLayoutEntity).set({ widgetsJson })
      .where('id = :id AND companyId = :companyId AND userId = :userId', { id: existing.id, companyId: record.companyId, userId: record.userId }).execute();
    return existing.id;
  }
  await repository.createQueryBuilder().insert().into(DashboardLayoutEntity).values({
    id: record.id, companyId: record.companyId, userId: record.userId, widgetsJson,
  }).execute();
  return record.id;
}

export async function readUiPreference(manager: EntityManager, companyId: string, userId: string): Promise<UiPreferenceEntity | null> {
  return manager.getRepository(UiPreferenceEntity).createQueryBuilder('preference')
    .where('preference.companyId = :companyId AND preference.userId = :userId', { companyId, userId })
    .getOne();
}

export async function saveUiPreference(manager: EntityManager, record: UiPreferenceRecord): Promise<string> {
  const repository = manager.getRepository(UiPreferenceEntity);
  const existing = await repository.createQueryBuilder('preference').select('preference.id', 'id')
    .where('preference.companyId = :companyId AND preference.userId = :userId', { companyId: record.companyId, userId: record.userId })
    .getRawOne<{ id: string }>();
  if (existing) {
    await repository.createQueryBuilder().update(UiPreferenceEntity).set({ sidebarCollapsed: record.sidebarCollapsed })
      .where('id = :id AND companyId = :companyId AND userId = :userId', { id: existing.id, companyId: record.companyId, userId: record.userId }).execute();
    return existing.id;
  }
  await repository.createQueryBuilder().insert().into(UiPreferenceEntity).values(record).execute();
  return record.id;
}
