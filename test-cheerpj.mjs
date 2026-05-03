import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const logs = [];
  page.on('pageerror', (error) => logs.push('PageError: ' + error.message));
  page.on('console', (msg) => logs.push(msg.type() + ': ' + msg.text()));
  page.on('request', (req) => {
    if (req.url().includes('jar') || req.url().includes('projects/21') || req.url().includes('projects?id')) {
      logs.push('Request: ' + req.url());
    }
  });
  page.on('response', async (resp) => {
    if (resp.url().includes('jar') || resp.url().includes('projects/21') || resp.url().includes('projects?id') || resp.status() >= 400) {
      logs.push('Response: ' + resp.url() + ' -> ' + resp.status());
    }
  });

  await page.goto('https://app.codeabode.co/projects/view/?id=21&status=ready', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(45000);

  console.log('Relevant logs:');
  logs.forEach(l => console.log('  ', l));

  await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
  await browser.close();
})();
