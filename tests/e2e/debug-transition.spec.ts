import { test, expect } from '@playwright/test';
import { bypassAuth } from './helpers';

test.describe('Debug Tab Transition', () => {
  const email = 'test-tester@example.com';
  const password = 'password123';

  test.beforeEach(async ({ context }) => {
    await bypassAuth(context, email, password, 'tester');
  });

  test('should reproduce transition error and trace log', async ({ page }) => {
    // Collect console messages
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.error('[BROWSER ERROR]', err);
    });

    console.log('Navigating to tester dashboard...');
    await page.goto('/dashboard/tester');
    await expect(page.locator('h1')).toContainText('Tester Workspace', { timeout: 25000 });

    console.log('Navigating to Earnings tab...');
    await page.click('a:has-text("Earnings")');
    await page.waitForSelector('.recharts-wrapper', { state: 'visible', timeout: 10000 });

    console.log('Hovering over chart...');
    const chart = page.locator('.recharts-wrapper').first();
    const box = await chart.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      console.log('Moved mouse to center of chart.');
    } else {
      throw new Error('Chart bounding box is null');
    }
    await page.waitForTimeout(2000);

    console.log('Clicking My Submissions sidebar link...');
    await page.click('a:has-text("My Submissions")');
    await page.waitForTimeout(3000);

    console.log('Finished transition check.');
  });
});
