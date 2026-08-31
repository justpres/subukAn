const { chromium } = require('@playwright/test');

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error('[BROWSER ERROR]', err);
  });

  try {
    console.log('Navigating to landing...');
    await page.goto('http://localhost:3000');
    
    console.log('Logging in as tester...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'test-tester@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    
    await page.waitForURL('**/dashboard/tester**', { timeout: 15000 });
    console.log('Successfully logged in.');

    console.log('Clicking Earnings sidebar link...');
    await page.click('a:has-text("Earnings")');
    await page.waitForTimeout(1000);

    console.log('Hovering over chart...');
    const chart = page.locator('.recharts-wrapper').first();
    if (await chart.isVisible()) {
      const box = await chart.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        console.log('Moved mouse to center of chart.');
      }
    } else {
      console.log('Chart wrapper not found.');
    }
    await page.waitForTimeout(1000);

    console.log('Clicking My Submissions sidebar link...');
    await page.click('a:has-text("My Submissions")');
    await page.waitForTimeout(3000);

    console.log('Navigation completed without crash.');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

run();
