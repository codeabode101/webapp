const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', m => console.log('CON:', m.type(), m.text()));
  page.on('pageerror', e => console.log('ERR:', e.message));
  page.on('requestfailed', r => console.log('FAIL:', r.url(), r.failure().errorText));
  
  await page.goto('https://api.codeabode.co/static/projects/15/build/web/index.html', { timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('Clicking start...');
  await page.click('#start');
  await page.waitForTimeout(15000);
  console.log('Done');
  await browser.close();
})();