import type { Page, Locator } from '@playwright/test';

export class ClassroomPage {
  readonly page: Page;
  readonly loadingText: Locator;
  readonly sidebarScenes: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loadingText = page.getByText('Loading classroom...');
    this.sidebarScenes = page.locator('[data-testid="scene-item"]');
  }

  async goto(stageId: string) {
    await this.page.goto(`/classroom/${stageId}`);
  }

  async waitForLoaded() {
    // Waiting only for loading text to be hidden can resolve before React mounts:
    // a not-yet-rendered locator is already "hidden". A real scene is the stable
    // signal that the classroom load pipeline and Stage surface are both ready.
    await this.sidebarScenes.first().waitFor({ state: 'visible', timeout: 15_000 });
  }

  async clickScene(index: number) {
    await this.sidebarScenes.nth(index).click();
  }

  /** Get scene title — it's the second span (first is the number badge) */
  getSceneTitle(index: number) {
    return this.sidebarScenes.nth(index).locator('[data-testid="scene-title"]');
  }
}
