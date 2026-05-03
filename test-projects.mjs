import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console and network errors
  const errors = [];
  page.on('pageerror', (error) => errors.push('PageError: ' + error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('Console: ' + msg.text()); });

  await page.goto('https://app.codeabode.co/projects/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check for button
  const button = await page.$('a[href*="new"]');
  if (button) {
    console.log('✅ Found button:', await button.textContent());
  } else {
    console.log('❌ No + New Project button found');
  }

  // Get visible content
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Visible content:', bodyText.substring(0, 200));

  // Check errors
  if (errors.length > 0) {
    console.log('Errors captured:');
    errors.forEach(e => console.log('  -', e));
  }

  await page.screenshot({ path: 'test-screenshot.png' });
  await browser.close();
})();
