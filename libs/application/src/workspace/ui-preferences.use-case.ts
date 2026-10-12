import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { canUseModule, PermissionDeniedError, type ModuleGrant } from '@domain/identity/module-access';
import { LAYOUT_PORT, type LayoutPort } from '@domain/workspace/layout.port';

export interface UiPreferenceView {
  sidebarCollapsed: boolean;
}

@Injectable()
export class ReadUiPreferencesUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(companyId: string, userId: string, grants: readonly ModuleGrant[]): Promise<UiPreferenceView> {
    assertShell(grants);
    const stored = await this.layouts.findPreferences(companyId, userId);
    if (stored === null) {
      return { sidebarCollapsed: false };
    }
    return { sidebarCollapsed: stored.sidebarCollapsed };
  }
}

@Injectable()
export class SaveUiPreferencesUseCase {
  constructor(@Inject(LAYOUT_PORT) private readonly layouts: LayoutPort) {}

  async execute(
    companyId: string,
    userId: string,
    grants: readonly ModuleGrant[],
    sidebarCollapsed: boolean,
  ): Promise<UiPreferenceView> {
    assertShell(grants);
    const saved = await this.layouts.savePreferences({
      id: randomUUID(),
      companyId,
      userId,
      sidebarCollapsed,
    });
    return { sidebarCollapsed: saved.sidebarCollapsed };
  }
}

function assertShell(grants: readonly ModuleGrant[]): void {
  if (!canUseModule(grants, 'dashboard', 'view')) {
    throw new PermissionDeniedError();
  }
}
