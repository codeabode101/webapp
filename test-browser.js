const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Intercept network requests
  const requests = [];
  page.on('request', req => {
    requests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      postData: req.postData()
    });
  });
  
  page.on('response', async res => {
    console.log('Response:', res.status(), res.url());
    const headers = res.headers();
    if (headers['set-cookie']) {
      console.log('Set-Cookie:', headers['set-cookie']);
    }
  });

  console.log('Navigating to app.codeabode.co...');
  await page.goto('https://app.codeabode.co', { waitUntil: 'networkidle0' });
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Check if login form is visible
  const loginForm = await page.$('form');
  if (loginForm) {
    console.log('Login form found');
    
    // Fill in credentials
    await page.type('input[type="text"]', 'om');
    await page.type('input[type="password"]', 'October32018!');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Check cookies
    const cookies = await page.cookies(['https://webapp.rahejaom.workers.dev', 'https://app.codeabode.co']);
    console.log('Cookies after login:', JSON.stringify(cookies, null, 2));
    
    // Check page content
    const content = await page.content();
    if (content.includes('Seyon') || content.includes('Mithran')) {
      console.log('SUCCESS: Students list loaded!');
    } else if (content.includes('Login successful')) {
      console.log('Page shows "Login successful" - checking if redirect happened');
    } else {
      console.log('Students not found in page content');
    }
    
    // Check for any API calls to workers.dev
    const apiCalls = requests.filter(r => r.url.includes('workers.dev'));
    console.log('API calls to workers.dev:', apiCalls.length);
  } else {
    console.log('Login form NOT found');
  }
  
  await browser.close();
})();
