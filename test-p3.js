const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({headless:true});
  const p = await b.newPage();
  p.on('console', m => console.log('CON:', m.type(), m.text()));
  p.on('pageerror', e => console.log('ERR:', e.message));
  
  // Load project 3's full setup
  await p.goto('https://api.codeabode.co/static/projects/3/build/web/index.html');
  await p.waitForTimeout(3000);
  
  console.log('P3 - clicking start...');
  await p.click('#start');
  await p.waitForTimeout(15000);
  console.log('P3 done');
  
  await b.close();
})();