import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MembershipRole } from '@domain/identity/membership/access';
import { canUseModule, PermissionDeniedError, type ModuleGrant } from '@domain/identity/membership/module-access';
import { applyWidgetLayout, type WidgetSetting } from '@domain/workspace/layout/layout';
import { LAYOUT_PORT, type LayoutPort } from '@domain/workspace/layout/layout.port';

export interface DashboardLayoutView {
  widgets: WidgetSetting[];
}

@Injectable()
export class ReadDashboardLayoutUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(companyId: string, userId: string, grants: readonly ModuleGrant[]): Promise<DashboardLayoutView> {
    assertCanViewDashboard(grants);
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
    role: MembershipRole,
    grants: readonly ModuleGrant[],
    widgets: readonly WidgetSetting[],
  ): Promise<DashboardLayoutView> {
    assertCanEditDashboard(role, grants);
    const saved = await this.layouts.saveDashboard({
      id: randomUUID(),
      companyId,
      userId,
      widgets: applyWidgetLayout(widgets),
    });
    return { widgets: applyWidgetLayout(saved.widgets) };
  }
}

function assertCanViewDashboard(grants: readonly ModuleGrant[]): void {
  if (!canUseModule(grants, 'dashboard', 'view')) {
    throw new PermissionDeniedError();
  }
}

function assertCanEditDashboard(role: MembershipRole, grants: readonly ModuleGrant[]): void {
  if (role !== 'owner' && !canUseModule(grants, 'dashboard', 'edit')) {
    throw new PermissionDeniedError();
  }
}
