const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', m => console.log('CON:', m.type(), m.text()));
  page.on('pageerror', e => console.log('ERR:', e.message));
  
  await page.goto('http://localhost:8888/', { timeout: 15000 });
  await page.waitForTimeout(2000);
  
  console.log('Clicking start...');
  await page.click('#start');
  await page.waitForTimeout(15000);
  
  console.log('Done');
  await browser.close();
})();