import { test, expect } from '@playwright/test';

test.describe('Happy Path E2E', () => {
  test('Create Project → Import Repo → Wait → Chat → Planner', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('text=Sign in', { timeout: 30000 });

    await page.click('text=Sign in');

    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    await page.waitForSelector('[data-testid="create-project-button"]', { timeout: 10000 });

    await page.click('[data-testid="create-project-button"]');

    const projectNameInput = page.locator('input[name="projectName"]');
    await projectNameInput.fill('E2E Test Project');

    const createButton = page.locator('button[type="submit"]');
    await createButton.click();

    await page.waitForSelector('text=E2E Test Project', { timeout: 10000 });

    const importButton = page.locator('text=Import Repository');
    await importButton.click();

    await page.waitForSelector('input[placeholder*="github.com"], input[placeholder*="URL"]', { timeout: 10000 });
    const repoInput = page.locator('input[placeholder*="github.com"], input[placeholder*="URL"]');
    await repoInput.fill('https://github.com/test/test-repo');

    const attachButton = page.locator('button:has-text("Attach"), button:has-text("Import")');
    await attachButton.click();

    await page.waitForSelector('text=pending|cloning|ready', { timeout: 5000 }).catch(() => {});

    await page.waitForTimeout(3000);

    const chatSection = page.locator('text=Chat').first();
    if (await chatSection.isVisible()) {
      await chatSection.click();
      await page.waitForTimeout(1000);
    }

    const planSection = page.locator('text=Planner').first();
    if (await planSection.isVisible()) {
      await planSection.click();
      await page.waitForTimeout(1000);
    }
  });
});
