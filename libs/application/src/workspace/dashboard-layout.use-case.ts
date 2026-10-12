import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { canUseModule, PermissionDeniedError, type ModuleGrant } from '@domain/identity/module-access';
import { applyWidgetLayout, type WidgetSetting } from '@domain/workspace/layout';
import { LAYOUT_PORT, type LayoutPort } from '@domain/workspace/layout.port';

export interface DashboardLayoutView {
  widgets: WidgetSetting[];
}

@Injectable()
export class ReadDashboardLayoutUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(companyId: string, userId: string, grants: readonly ModuleGrant[]): Promise<DashboardLayoutView> {
    assertDashboard(grants);
    const stored = await this.layouts.findDashboard(companyId, userId);
    return { widgets: applyWidgetLayout(stored === null ? null : stored.widgets) };
  }
}

@Injectable()
export class SaveDashboardLayoutUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(
    companyId: string,
    userId: string,
    grants: readonly ModuleGrant[],
    widgets: readonly WidgetSetting[],
  ): Promise<DashboardLayoutView> {
    assertDashboard(grants);
    const saved = await this.layouts.saveDashboard({
      id: randomUUID(),
      companyId,
      userId,
      widgets: applyWidgetLayout(widgets),
    });
    return { widgets: applyWidgetLayout(saved.widgets) };
  }
}

function assertDashboard(grants: readonly ModuleGrant[]): void {
  if (!canUseModule(grants, 'dashboard', 'view')) {
    throw new PermissionDeniedError();
  }
}
