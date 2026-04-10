const https = require('https');

// Simulate browser cookie jar with proper domain handling
class BrowserCookieJar {
  constructor() {
    this.cookies = [];
  }
  
  parseSetCookie(setCookieHeader) {
    if (!setCookieHeader) return [];
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    return headers.map(cookie => {
      const parts = cookie.split(';');
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=').map(s => s.trim());
      
      const attrs = {};
      parts.slice(1).forEach(p => {
        const [key, val] = p.split('=').map(s => s.trim().toLowerCase());
        attrs[key] = val || true;
      });
      
      return {
        name,
        value,
        domain: attrs.domain || '.webapp.rahejaom.workers.dev',
        path: attrs.path || '/',
        secure: attrs.secure === true,
        httpOnly: attrs.httponly === true,
        sameSite: attrs.samesite || 'Lax',
        expires: attrs.expires
      };
    });
  }
  
  addCookies(setCookieHeaders) {
    const cookies = this.parseSetCookie(setCookieHeaders);
    cookies.forEach(cookie => {
      const existing = this.cookies.findIndex(c => c.name === cookie.name && c.domain === cookie.domain);
      if (existing >= 0) {
        this.cookies[existing] = cookie;
      } else {
        this.cookies.push(cookie);
      }
    });
  }
  
  getCookies(url) {
    const urlObj = new URL(url);
    const isSecure = urlObj.protocol === 'https:';
    
    return this.cookies
      .filter(c => {
        // Check domain
        const cookieDomain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
        const matchesDomain = urlObj.hostname === cookieDomain || urlObj.hostname.endsWith(cookieDomain);
        
        // Check secure
        if (c.secure && !isSecure) return false;
        
        return matchesDomain;
      })
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
  }
}

async function request(options, body = null, cookieJar, origin = null) {
  return new Promise((resolve, reject) => {
    // Add cookies if we have a jar and URL
    if (cookieJar && options.hostname) {
      const url = `https://${options.hostname}${options.path}`;
      const cookies = cookieJar.getCookies(url);
      if (cookies) {
        options.headers = { ...options.headers, 'Cookie': cookies };
      }
    }
    
    const req = https.request(options, res => {
      // Add cookies from response
      if (cookieJar) {
        cookieJar.addCookies(res.headers['set-cookie']);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ 
        status: res.statusCode, 
        headers: res.headers, 
        body: data 
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function browserTest() {
  const jar = new BrowserCookieJar();
  
  console.log('=== Browser Simulation Test ===\n');
  
  // Simulate browser visiting app.codeabode.co
  console.log('1. GET https://app.codeabode.co (static page)');
  console.log('   (Just HTML/CSS/JS download - no cookies needed)\n');
  
  // Browser makes login request to workers.dev
  console.log('2. POST https://webapp.rahejaom.workers.dev/api/login');
  console.log('   Headers: { Content-Type: application/json, Origin: https://app.codeabode.co }');
  console.log('   Body: { username: "om", password: "..." }\n');
  
  const loginRes = await request({
    hostname: 'webapp.rahejaom.workers.dev',
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://app.codeabode.co'
    }
  }, JSON.stringify({ username: 'om', password: 'October32018!' }), jar);
  
  console.log('   Response Status:', loginRes.status);
  console.log('   Response Body:', loginRes.body);
  console.log('   Set-Cookie headers:', loginRes.headers['set-cookie']);
  console.log('   Cookies in jar:', jar.cookies.map(c => c.name).join(', '));
  
  // Check CORS headers
  console.log('\n   CORS check:');
  console.log('   - Access-Control-Allow-Origin:', loginRes.headers['access-control-allow-origin']);
  console.log('   - Access-Control-Allow-Credentials:', loginRes.headers['access-control-allow-credentials']);
  
  // Browser makes subsequent request to list students
  console.log('\n3. POST https://webapp.rahejaom.workers.dev/api/list_students');
  console.log('   Headers: { Origin: https://app.codeabode.co, Cookie: <from jar> }\n');
  
  const listRes = await request({
    hostname: 'webapp.rahejaom.workers.dev',
    path: '/api/list_students',
    method: 'POST',
    headers: {
      'Origin': 'https://app.codeabode.co'
    }
  }, null, jar);
  
  console.log('   Response Status:', listRes.status);
  console.log('   Response Body:', listRes.body);
  console.log('   Cookies sent:', jar.getCookies('https://webapp.rahejaom.workers.dev'));
  
  // Parse result
  try {
    const data = JSON.parse(listRes.body);
    if (Array.isArray(data) && data.length > 0) {
      console.log('\n=== BROWSER TEST: PASSED ===');
      console.log('Students visible in browser:', data.map(s => s.name).join(', '));
    } else if (data.error) {
      console.log('\n=== BROWSER TEST: FAILED ===');
      console.log('Error:', data.error);
    }
  } catch (e) {
    console.log('\n=== BROWSER TEST: PARSE ERROR ===');
  }
}

browserTest().catch(console.error);
