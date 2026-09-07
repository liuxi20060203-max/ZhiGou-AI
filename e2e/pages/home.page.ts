import type { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly logo: Locator;
  readonly textarea: Locator;
  readonly enterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // These test IDs are the stable UI-redesign contract. The page structure,
    // copy and accessible name may change, but these three user capabilities
    // must survive every layout pass.
    this.logo = page.getByTestId('home-brand-logo');
    this.textarea = page.getByTestId('course-requirement-input');
    this.enterButton = page.getByTestId('course-generate-submit');
  }

  async goto() {
    await this.page.goto('/');
  }

  async fillRequirement(text: string) {
    await this.textarea.fill(text);
  }

  async submit() {
    await this.enterButton.click();
  }
}
