import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'table_layouts' })
export class TableLayoutEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('varchar', { name: 'table_key', length: 80 })
  declare tableKey: string;

  @Column('integer', { name: 'page_size' })
  declare pageSize: number;

  @Column('text', { name: 'columns_json' })
  declare columnsJson: string;
}

@Entity({ name: 'dashboard_layouts' })
export class DashboardLayoutEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('text', { name: 'widgets_json' })
  declare widgetsJson: string;
}

@Entity({ name: 'ui_preferences' })
export class UiPreferenceEntity {
  @PrimaryColumn('uuid')
  declare id: string;

  @Column('uuid', { name: 'company_id' })
  declare companyId: string;

  @Column('uuid', { name: 'user_id' })
  declare userId: string;

  @Column('boolean', { name: 'sidebar_collapsed' })
  declare sidebarCollapsed: boolean;
}
