import { test, expect } from '@playwright/test';
import { bypassAuth, createMockListing } from './helpers';

test.describe('Tester Flow & Milestone 4 Features E2E', () => {
  const email = 'test-tester@example.com';
  const password = 'password123';

  test.beforeEach(async ({ context }) => {
    // Log in programmatically as tester
    await bypassAuth(context, email, password, 'tester');
  });

  test('should open notification center drawer and interact with actions', async ({ page }) => {
    await page.goto('/dashboard/tester');

    // Click Notification Bell button in header
    const bellButton = page.locator('button[aria-label="Open notifications"]');
    await expect(bellButton).toBeVisible({ timeout: 25000 });
    await bellButton.click();

    // Verify Notification Drawer opened
    await expect(page.locator('h3:has-text("Notifications")')).toBeVisible();
    await expect(page.locator('text=Payout Approved')).toBeVisible();

    // Click "Mark all read"
    const markAllReadBtn = page.locator('button:has-text("Mark all read")');
    if (await markAllReadBtn.isVisible()) {
      await markAllReadBtn.click();
    }

    // Close drawer
    await page.keyboard.press('Escape');
  });

  test('should navigate tester dashboard tabs and open profile & dispute modals', async ({ page }) => {
    await page.goto('/dashboard/tester');

    // Assert page loaded
    await expect(page.locator('h1')).toContainText('Tester Workspace', { timeout: 25000 });

    // 1. Test Tab Switching: "My Submissions"
    await page.click('a:has-text("My Submissions")');
    await expect(page.locator('h2:has-text("Your Submission History")')).toBeVisible();

    // Verify rejected submission presents "Submit Rejection Dispute" button
    const disputeTrigger = page.locator('button:has-text("Submit Rejection Dispute")').first();
    if (await disputeTrigger.isVisible()) {
      await disputeTrigger.click();

      // Verify Dispute Modal opened
      await expect(page.locator('h3:has-text("Submit Rejection Dispute")')).toBeVisible();

      // Fill in dispute explanation
      const explanationInput = page.locator('textarea[placeholder*="Explain why the rejection was unfair"]');
      await expect(explanationInput).toBeVisible();
      await explanationInput.fill('I executed all steps accurately as requested in the testing scenario.');

      // Click Submit Dispute
      await page.click('button:has-text("Submit Dispute")');

      // Verify success message
      await expect(page.locator('h4:has-text("Dispute Submitted!")')).toBeVisible({ timeout: 5000 });
    }

    // 2. Test Tab Switching: "Earnings & Payout History"
    await page.click('a:has-text("Earnings")');
    await expect(page.locator('h3:has-text("GCash Payout History")')).toBeVisible();
    await expect(page.locator('text=Total Earnings').first()).toBeVisible();

    // 3. Test Profile Modal
    await page.click('button:has-text("Profile & Notifications")');
    await expect(page.locator('h3:has-text("Tester Profile Settings")')).toBeVisible();

    // Switch to Notification Settings tab in modal
    await page.click('button:has-text("Notification Settings")');
    await expect(page.locator('text=Payout Approval Alerts')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h3:has-text("Tester Profile Settings")')).not.toBeVisible();
  });

  test('should complete the 5-second Quick Impression task page', async ({ page }) => {
    // Create a mock listing with is_quick_impression: true
    const uniqueTitle = `E2E Tester Job ${Date.now()}`;
    const listing = await createMockListing(uniqueTitle, true);

    // Navigate to /dashboard/tester/tasks/five-second/[id]
    await page.goto(`/dashboard/tester/tasks/five-second/${listing.id}`);

    // Wait for the agreement modal to be visible
    await expect(page.locator('text=Acknowledge Testing Guidelines')).toBeVisible();

    // Scroll to bottom of the Agreement modal to enable the Accept button
    const ndaScroll = page.locator('[data-testid="agreement-modal-content"]');
    await ndaScroll.evaluate(async (el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
      await new Promise(resolve => setTimeout(resolve, 50));
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // Accept the agreement
    await page.click('button:has-text("Accept")');

    // Assert the cover page loaded with correct title
    await expect(page.locator('h1')).toContainText(uniqueTitle);

    // Verify the "Start 5-Second Test" button is visible and click it
    const startButton = page.locator('button:has-text("Start 5-Second Test")');
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Verify the impression countdown timer loads and displays
    await expect(page.locator('text=Viewing:')).toBeVisible();

    // Click on the design image to register a click (first-click heatmap coordinates)
    const designImg = page.locator('img[alt*="Design screenshot"]');
    await expect(designImg).toBeVisible();
    await designImg.click();

    // Wait for it to expire and transition to the questionnaire step (takes 5 seconds)
    await expect(page.locator('text=What do you remember about the design?')).toBeVisible({ timeout: 10000 });

    // Verify the questionnaire step enables the response form
    const responseTextArea = page.locator('textarea');
    await expect(responseTextArea).toBeEnabled();

    // Fill in the questionnaire response
    await responseTextArea.fill('The design looked extremely clean and well structured, focusing on banking styles.');

    // Select visual clarity rating (e.g. 5)
    await page.click('button:has-text("5")');

    // Click submit button
    await page.click('button:has-text("Submit Test Output")');

    // Verify successful submission UI loading
    await expect(page.locator('h2:has-text("Submission Under Review")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Post-Test Debrief Thread')).toBeVisible();

    // Type a comment and hit Send
    const commentInput = page.locator('input[placeholder*="Type your comment"]');
    await expect(commentInput).toBeVisible();
    await commentInput.fill('This is an E2E test comment.');
    await page.click('button:has-text("Send")');

    // Assert that the comment appears on the screen
    await expect(page.locator('text=This is an E2E test comment.')).toBeVisible();
  });
});
