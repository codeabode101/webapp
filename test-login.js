const https = require('https');

// Simple cookie jar
const cookieJar = [];

function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return [];
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return headers.map(cookie => {
    const parts = cookie.split(';')[0];
    const [name, value] = parts.split('=');
    return { name: name.trim(), value: value.trim(), domain: '.webapp.rahejaom.workers.dev' };
  });
}

function buildCookieHeader() {
  return cookieJar.map(c => `${c.name}=${c.value}`).join('; ');
}

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      // Parse cookies from response
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        parseCookies(setCookie).forEach(cookie => {
          const existing = cookieJar.findIndex(c => c.name === cookie.name);
          if (existing >= 0) {
            cookieJar[existing] = cookie;
          } else {
            cookieJar.push(cookie);
          }
        });
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  console.log('=== Testing Login Flow ===\n');
  
  // Step 1: Login
  console.log('1. POST /api/login');
  const loginRes = await request({
    hostname: 'api.codeabode.co',
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://app.codeabode.co'
    }
  }, JSON.stringify({ username: 'om', password: 'October32018!' }));
  
  console.log('   Status:', loginRes.status);
  console.log('   Body:', loginRes.body);
  console.log('   Set-Cookie headers:', loginRes.headers['set-cookie']);
  console.log('   Cookie jar:', cookieJar);
  
  // Step 2: List students
  console.log('\n2. POST /api/list_students');
  const listRes = await request({
    hostname: 'api.codeabode.co',
    path: '/api/list_students',
    method: 'POST',
    headers: {
      'Origin': 'https://app.codeabode.co',
      'Cookie': buildCookieHeader()
    }
  });
  
  console.log('   Status:', listRes.status);
  console.log('   Body:', listRes.body);
  
  // Check result
  try {
    const data = JSON.parse(listRes.body);
    if (Array.isArray(data) && data.length > 0) {
      console.log('\n=== SUCCESS ===');
      console.log('Students:', data.map(s => s.name).join(', '));
    } else if (data.error) {
      console.log('\n=== ERROR ===');
      console.log(data.error);
    } else {
      console.log('\n=== UNEXPECTED ===');
      console.log(JSON.stringify(data));
    }
  } catch (e) {
    console.log('Failed to parse response');
  }
}

test().catch(console.error);
