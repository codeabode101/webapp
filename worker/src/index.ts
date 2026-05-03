export interface Env {
  DB: D1Database;
  BUILD_SERVER_URL: string;
}

interface Student {
  id: number;
  name: string;
  age: number;
  current_level: string;
  final_goal: string;
  future_concepts: string;
  notes: string | null;
  account_id: number | null;
  current_class: number | null;
}

interface StudentClass {
  class_id: number;
  status: string;
  name: string;
  class_type: string | null;
  class_date: string | null;
  accomplished: string | null;
  methods: string;
  stretch_methods: string | null;
  description: string;
  classwork: string | null;
  notes: string | null;
  hw: string | null;
  hw_notes: string | null;
  classwork_submission: string | null;
  homework_submission: string | null;
}

interface Token {
  token: string;
  user_id: number;
  expires_at: string;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = new Uint8Array(hashBuffer);
  return '\\x' + Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = new Uint8Array(hashBuffer);
  const computedHash = '\\x' + Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === storedHash;
}

async function getUserFromRequest(request: Request, env: Env): Promise<{ userId: number; token: string } | null> {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').filter(Boolean).map(c => {
      const [key, ...vals] = c.split('=');
      return [key, vals.join('=')];
    })
  );
  
  const token = cookies['token'];
  if (!token) return null;
  
  const result = await env.DB.prepare(`
    SELECT user_id, expires_at 
    FROM tokens 
    WHERE token = ? AND expires_at > datetime('now')
  `).bind(token).first<Token>();
  
  if (!result) return null;
  return { userId: result.user_id, token };
}

function setAuthCookies(response: Response, token: string, name: string, origin: string | null): Response {
  const expires = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toUTCString();
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'text/plain');
  headers.append('Set-Cookie', `token=${token}; Path=/; Domain=codeabode.co; HttpOnly; Secure; Expires=${expires}`);
  headers.append('Set-Cookie', `name=${encodeURIComponent(name)}; Path=/; Domain=codeabode.co; Secure; Expires=${expires}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function clearAuthCookies(response: Response, origin: string | null): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'text/plain');
  headers.append('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=None; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  headers.append('Set-Cookie', 'name=; Path=/; SameSite=None; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Build-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Security-Policy': "worker-src 'self' blob: https://cjrtnc.leaningtech.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cjrtnc.leaningtech.com; connect-src 'self' https://api.codeabode.co https://cjrtnc.leaningtech.com blob: data:; default-src 'self' blob: data:; object-src 'self' https://*.r2.dev;",
  };
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ username: string; password: string }>();
  
  const user = await env.DB.prepare(`
    SELECT id, name, password FROM accounts WHERE username = ?
  `).bind(body.username).first<{ id: number; name: string; password: string }>();
  
  if (!user || !(await verifyPassword(body.password, user.password))) {
    return new Response(JSON.stringify('Incorrect password'), { 
      status: 401,
      headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'text/plain' }
    });
  }
  
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
  
  await env.DB.prepare(`
    INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, ?)
  `).bind(token, user.id, expiresAt).run();
  
  const origin = request.headers.get('Origin');
  const response = new Response(JSON.stringify('Login successful'), {
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'text/plain' }
  });
  return setAuthCookies(response, token, user.name, origin);
}

async function resetPassword(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  const origin = request.headers.get('Origin');
  if (!user) {
    const response = new Response(JSON.stringify('Unauthorized'), { status: 401 });
    return clearAuthCookies(response, origin);
  }
  
  const body = await request.json<{ username: string; password: string; new_password: string }>();
  
  const account = await env.DB.prepare(`
    SELECT id, password FROM accounts WHERE username = ? AND id = ?
  `).bind(body.username, user.userId).first<{ id: number; password: string }>();
  
  if (!account || !(await verifyPassword(body.password, account.password))) {
    const response = new Response(JSON.stringify('Incorrect password'), { status: 401 });
    return clearAuthCookies(response, origin);
  }
  
  const newHash = await hashPassword(body.new_password);
  await env.DB.prepare(`
    UPDATE accounts SET password = ? WHERE id = ?
  `).bind(newHash, account.id).run();
  
  await env.DB.prepare(`
    DELETE FROM tokens WHERE user_id = ? AND expires_at > datetime('now')
  `).bind(account.id).run();
  
  const response = new Response(JSON.stringify('Password reset successfully'), {
    headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'text/plain' }
  });
  return clearAuthCookies(response, origin);
}

async function listStudents(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const uid = String(user.userId);
  const students = await env.DB.prepare(`
    SELECT id, name FROM students 
    WHERE account_id LIKE '%' || $1 || ',%' 
       OR account_id LIKE '%,' || $1 || '}'
       OR account_id = '{' || $1 || '}'
  `).bind(uid).all<{ id: number; name: string }>();
  
  return new Response(JSON.stringify(students.results), { headers: getCorsHeaders(request.headers.get('Origin')) });
}

async function getStudent(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const uid = String(user.userId);
  const student = await env.DB.prepare(`
    SELECT id, name, age, current_level, final_goal, future_concepts, notes, current_class
    FROM students 
    WHERE id = ? AND (
      account_id LIKE '%' || $1 || ',%' 
      OR account_id LIKE '%,' || $1 || '}'
      OR account_id = '{' || $1 || '}'
    )
  `).bind(id, uid).first<Student>();
  
  if (!student) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  
  const classes = await env.DB.prepare(`
    SELECT sc.class_id, sc.status, sc.name, sc.class_type, sc.class_date, sc.accomplished,
           sc.methods, sc.stretch_methods, sc.description, sc.classwork,
           sc.notes, sc.hw, sc.hw_notes,
           (
             SELECT s2.work FROM submissions s2
             WHERE s2.class_id = sc.class_id AND s2.work_type = 'classwork'
             ORDER BY id DESC LIMIT 1
           ) as classwork_submission,
           (
             SELECT s2.work FROM submissions s2
             WHERE s2.class_id = sc.class_id AND s2.work_type = 'homework'
             ORDER BY id DESC LIMIT 1
           ) as homework_submission
    FROM students_classes sc
    WHERE sc.student_id = ?
    ORDER BY 
      CASE WHEN sc.status = 'current' THEN 0 ELSE 1 END,
      sc.class_id DESC
  `).bind(id).all<StudentClass>();
  
  const result = {
    ...student,
    future_concepts: parseJsonArray(student.future_concepts),
    classes: classes.results.map(c => ({
      ...c,
      class_type: c.class_type || null,
      class_date: c.class_date || null,
      accomplished: parseJsonArray(c.accomplished),
      methods: parseJsonArray(c.methods),
      stretch_methods: parseJsonArray(c.stretch_methods),
    })),
  };
  
  return new Response(JSON.stringify(result), { headers: getCorsHeaders(request.headers.get('Origin')) });
}

async function submitWork(request: Request, env: Env, workType: string): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const body = await request.json<{ class_id: number; work: string }>();
  
  const uid = String(user.userId);
  const result = await env.DB.prepare(`
    INSERT INTO submissions (work, work_type, account_id, class_id)
    SELECT $1, $2, $3, $4
    WHERE EXISTS (
      SELECT 1 FROM students_classes sc
      JOIN students s ON s.id = sc.student_id
      WHERE sc.class_id = $5 AND (
        s.account_id LIKE '%' || $6 || ',%' 
        OR s.account_id LIKE '%,' || $6 || '}'
        OR s.account_id = '{' || $6 || '}'
      )
    )
  `).bind(body.work, workType, user.userId, body.class_id, body.class_id, uid).run();
  
  if (!result.meta.changes) {
    return new Response(JSON.stringify('Something went wrong'), { status: 401 });
  }
  
  return new Response(JSON.stringify('OK'), { 
    status: 200,
    headers: getCorsHeaders(request.headers.get('Origin'))
  });
}

async function submitQuestion(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const body = await request.json<{
    work_type: string;
    class_id: number;
    error: string;
    interpretation: string;
    question: string;
  }>();
  
  const submission = await env.DB.prepare(`
    SELECT s.id FROM submissions s
    JOIN students_classes sc ON sc.class_id = s.class_id
    WHERE s.work_type = ? AND sc.student_id = (
      SELECT student_id FROM students_classes WHERE class_id = ?
    )
    ORDER BY s.id DESC LIMIT 1
  `).bind(body.work_type, body.class_id).first<{ id: number }>();
  
  const submissionId = submission?.id || null;
  
  const result = await env.DB.prepare(`
    INSERT INTO questions (account_id, submission_id, error, interpretation, question)
    VALUES (?, ?, ?, ?, ?)
  `).bind(user.userId, submissionId, body.error, body.interpretation, body.question).run();
  
  const question = await env.DB.prepare(`
    SELECT created_at FROM questions WHERE rowid = last_insert_rowid()
  `).first<{ created_at: string }>();
  
  return new Response(JSON.stringify(question?.created_at || ''), {
    status: 200,
    headers: getCorsHeaders(request.headers.get('Origin'))
  });
}

async function submitComment(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const body = await request.json<{ question_id: number; comment: string }>();
  
  await env.DB.prepare(`
    INSERT INTO comments (account_id, question_id, comment)
    VALUES (?, ?, ?)
  `).bind(user.userId, body.question_id, body.comment).run();
  
  const comment = await env.DB.prepare(`
    SELECT created_at FROM comments WHERE rowid = last_insert_rowid()
  `).first<{ created_at: string }>();
  
  return new Response(JSON.stringify(comment?.created_at || ''), {
    status: 200,
    headers: getCorsHeaders(request.headers.get('Origin'))
  });
}

async function getQuestions(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const questions = await env.DB.prepare(`
    SELECT 
      q.id,
      st.name as student_name,
      q.error,
      q.interpretation,
      q.question,
      s.work,
      q.created_at
    FROM questions q
    LEFT JOIN submissions s ON s.id = q.submission_id
    LEFT JOIN students_classes sc ON sc.class_id = s.class_id
    LEFT JOIN students st ON st.id = sc.student_id
    ORDER BY q.created_at DESC
  `).all<{
    id: number;
    student_name: string | null;
    error: string | null;
    interpretation: string | null;
    question: string;
    work: string | null;
    created_at: string;
  }>();
  
  const questionsWithComments = await Promise.all(
    questions.results.map(async (q) => {
      const comments = await env.DB.prepare(`
        SELECT c.id, a.name as account_name, c.comment, c.created_at
        FROM comments c
        LEFT JOIN accounts a ON a.id = c.account_id
        WHERE c.question_id = ?
        ORDER BY c.created_at ASC
      `).bind(q.id).all<{ id: number; account_name: string | null; comment: string; created_at: string }>();
      
      return {
        ...q,
        comments: comments.results,
      };
    })
  );
  
  return new Response(JSON.stringify(questionsWithComments), { headers: getCorsHeaders(request.headers.get('Origin')) });
}

async function submitProject(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const contentType = request.headers.get('Content-Type') || '';

  // Handle Java jar upload (multipart/form-data)
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const title = form.get('title') as string;
    const description = form.get('description') as string;
    const jarFile = form.get('jar') as File;

    if (!title || !jarFile) {
      return new Response(JSON.stringify({ error: 'Missing title or jar file' }), { status: 400 });
    }
    if (!jarFile.name.endsWith('.jar')) {
      return new Response(JSON.stringify({ error: 'File must be a .jar' }), { status: 400 });
    }

    // Insert Java project
    await env.DB.prepare(`
      INSERT INTO projects (account_id, title, description, deploy_method, status)
      VALUES (?, ?, ?, 'java', 'ready')
    `).bind(user.userId, title, description).run();

    // Get last insert ID reliably
    const project = await env.DB.prepare(`SELECT last_insert_rowid() as id`).first<{ id: number }>();
    const projectId = project?.id;
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Failed to create project' }), { status: 500 });
    }

    // Upload jar to Backblaze B2 private bucket
    const jarKey = `app/${projectId}.jar`;
    const jarArrayBuffer = await jarFile.arrayBuffer();

    try {
      // Step 1: Authorize with B2
      const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: {
          'Authorization': `Basic ${btoa(`${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`)}`
        }
      });

      if (!authRes.ok) {
        const errText = await authRes.text();
        console.error(`B2 auth failed: ${errText}`);
        throw new Error('B2 auth failed');
      }

      const authData = await authRes.json() as any;
      const apiUrl = authData.apiUrl;
      const authToken = authData.authorizationToken;

      // Step 2: Get upload URL
      const uploadUrlRes = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: { 'Authorization': authToken },
        body: JSON.stringify({ bucketId: authData.bucketId })
      });

      if (!uploadUrlRes.ok) {
        const errText = await uploadUrlRes.text();
        console.error(`B2 get upload URL failed: ${errText}`);
        throw new Error('Failed to get upload URL');
      }

      const uploadData = await uploadUrlRes.json() as any;

      // Step 3: Upload file
      const uploadRes = await fetch(uploadData.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadData.authorizationToken,
          'X-Bz-File-Name': jarKey,
          'Content-Type': 'application/java-archive',
          'X-Bz-Content-Sha1': 'do_not_verify'
        },
        body: jarArrayBuffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error(`B2 upload failed: ${errText}`);
        throw new Error('B2 upload failed');
      }

      console.log(`B2 upload successful for project ${projectId}`);
    } catch (e) {
      console.error(`B2 upload error: ${e}`);
      return new Response(JSON.stringify({ error: 'Failed to upload jar to storage' }), { status: 500 });
    }

    return new Response(JSON.stringify({ id: projectId, status: 'ready' }), {
      headers: getCorsHeaders(request.headers.get('Origin'))
    });
  }

  // Handle JSON requests (Pygame: class-based or direct standalone)
  const body = await request.json<{
    title: string;
    description: string;
    class_id?: number | null;
    work_type: string;
    work: string; // code for standalone Pygame
    deploy_method: string | null;
  }>();

  let submissionId: number | null = null;
  let projectId: number | null = null;

  // Direct standalone Pygame project (no class_id)
  if (!body.class_id && body.work_type === 'standalone') {
    // Create submission with null class_id
    await env.DB.prepare(`
      INSERT INTO submissions (work, work_type, account_id, class_id)
      VALUES (?, 'standalone', ?, NULL)
    `).bind(body.work, user.userId).run();

    const sub = await env.DB.prepare(`SELECT last_insert_rowid() as id`).first<{ id: number }>();
    submissionId = sub?.id || null;

    // Insert project (no class access check needed for standalone)
    await env.DB.prepare(`
      INSERT INTO projects (account_id, submission_id, title, description, deploy_method, status)
      VALUES (?, ?, ?, ?, ?, 'building')
    `).bind(user.userId, submissionId, body.title, body.description, body.deploy_method).run();

    const project = await env.DB.prepare(`SELECT last_insert_rowid() as id`).first<{ id: number }>();
    projectId = project?.id;
  } else {
    // Existing class-based flow with access check
    const submission = await env.DB.prepare(`
      SELECT s.id FROM submissions s
      JOIN students_classes sc ON sc.class_id = s.class_id
      WHERE s.work_type = ? AND sc.student_id = (
        SELECT student_id FROM students_classes WHERE class_id = ?
      )
      ORDER BY s.id DESC LIMIT 1
    `).bind(body.work_type, body.class_id).first<{ id: number }>();
    submissionId = submission?.id || null;

    const uid = String(user.userId);
    const result = await env.DB.prepare(`
      INSERT INTO projects (account_id, submission_id, title, description, deploy_method, status)
      SELECT ?, ?, ?, ?, ?, 'building'
      WHERE EXISTS (
        SELECT 1 FROM students s
        JOIN students_classes sc ON sc.class_id = ?
        WHERE s.id = sc.student_id AND (
          s.account_id LIKE '%' || $1 || ',%' 
          OR s.account_id LIKE '%,' || $1 || '}'
          OR s.account_id = '{' || $1 || '}'
        )
      )
    `).bind(user.userId, submissionId, body.title, body.description, body.deploy_method, body.class_id, uid).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'No valid submission found or unauthorized' }), { status: 400 });
    }

    const project = await env.DB.prepare(`SELECT last_insert_rowid() as id`).first<{ id: number }>();
    projectId = project?.id;
  }

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Failed to create project' }), { status: 500 });
  }

  // Trigger build server for Pygame projects
  if (submissionId) {
    const subWork = await env.DB.prepare(`
      SELECT work FROM submissions WHERE id = ?
    `).bind(submissionId).first<{ work: string }>();

    if (subWork?.work) {
      console.log(`SubmitProject: Building project ${projectId} with code from submission ${submissionId}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const buildRes = await fetch('https://iloveuvania.omraheja.me/build', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Build-Key': 'codeabode-build-secret-2026'
          },
          body: JSON.stringify({ project_id: projectId, code: subWork.work }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        const result = await buildRes.json();
        console.log(`SubmitProject: Build result: ${JSON.stringify(result)}`);
      } catch (e) {
        console.error(`SubmitProject: Build failed: ${e}`);
      }
    }
  }

  return new Response(JSON.stringify({ id: projectId, status: 'building' }), {
    headers: getCorsHeaders(request.headers.get('Origin'))
  });
}

async function listProjects(env: Env, origin: string | null): Promise<Response> {
  const projects = await env.DB.prepare(`
    SELECT 
      p.id,
      p.title,
      p.description,
      a.name as author_name,
      p.views,
      p.status,
      p.submission_id,
      p.created_at
    FROM projects p
    LEFT JOIN accounts a ON a.id = p.account_id
    WHERE p.status = 'ready'
    ORDER BY p.created_at DESC
  `).all<{
    id: number;
    title: string;
    description: string;
    author_name: string | null;
    views: number;
    status: string;
    submission_id: number | null;
    created_at: string;
  }>();
  
// Use absolute URL for static files (so they work in iframe on other domains)
  const result = projects.results.map(p => ({
    ...p,
    url: p.status === 'ready' ? `https://api.codeabode.co/static/projects/${p.id}/build/web/index.html` : null,
  }));

  return new Response(JSON.stringify(result), { headers: getCorsHeaders(origin) });
}

async function getAllProjectsList(env: Env, origin: string | null): Promise<Response> {
  const projects = await env.DB.prepare(`
    SELECT p.id, p.title, p.description, p.account_id, p.views, p.status, p.submission_id, p.created_at
    FROM projects p
    ORDER BY p.created_at DESC
    LIMIT 20
  `).all<{
    id: number;
    title: string;
    description: string;
    account_id: number | null;
    views: number;
    status: string;
    submission_id: number | null;
    created_at: string;
  }>();
  
  // Use absolute URL for static files
  const result = projects.results.map(p => ({
    ...p,
    url: p.status === 'ready' ? `https://api.codeabode.co/static/projects/${p.id}/build/web/index.html` : null,
  }));

  return new Response(JSON.stringify(result), { headers: getCorsHeaders(origin) });
}

async function getPendingProjectsCheck(env: Env, origin: string | null): Promise<Response> {
  const projects = await env.DB.prepare(`
    SELECT p.id, p.title, p.submission_id, p.created_at
    FROM projects p
    WHERE p.status = 'pending' 
    ORDER BY p.created_at ASC
    LIMIT 5
  `).all<{
    id: number;
    title: string;
    submission_id: number | null;
    created_at: string;
  }>();
  
  if (projects.results.length > 0) {
    for (const p of projects.results) {
      await env.DB.prepare(`UPDATE projects SET status = 'building' WHERE id = ?`).bind(p.id).run();
    }
  }
  
  return new Response(JSON.stringify(projects.results), { headers: getCorsHeaders(origin) });
}

async function updateProjectStatus(env: Env, id: number, request: Request, origin: string | null): Promise<Response> {
  try {
    // Allow requests from build server without origin header
    const buildKey = request.headers.get('X-Build-Key');
    const effectiveOrigin = buildKey === 'codeabode-build-secret-2026' ? '*' : origin;
    
    const body = await request.json<{ status: string }>();
    await env.DB.prepare(`UPDATE projects SET status = ? WHERE id = ?`).bind(body.status, id).run();
    return new Response(JSON.stringify({ success: true }), { 
      headers: { 
        'Access-Control-Allow-Origin': effectiveOrigin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Build-Key',
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: getCorsHeaders(origin) });
  }
}

async function incrementProjectView(env: Env, id: number, origin: string | null): Promise<Response> {
  await env.DB.prepare(`
    UPDATE projects SET views = views + 1 WHERE id = ?
  `).bind(id).run();
  
  return new Response(JSON.stringify('OK'), { headers: getCorsHeaders(origin) });
}

const PYTHON_COURSE = [
  { name: "Variables", description: "Store and label data in your program", content: "A variable is like a labeled box where you store information.\n\nFor example, when you write:\n  name = 'Sarah'\n  age = 12\n\nYou just created two boxes: one labeled 'name' that holds 'Sarah', and one labeled 'age' that holds 12.\n\nVariable names should describe what they store: 'player_score' not 'x', 'enemy_health' not 'n'.\n\nIn Python, you can store:\n- Text (called 'strings'): name = 'Hello'\n- Whole numbers (called 'integers'): age = 12\n- Decimal numbers (called 'floats'): height = 5.5\n- True/False values (called 'booleans'): is_alive = True" },
  { name: "Functions", description: "Create reusable pieces of code", content: "Functions are like recipes: you write them once, then use them many times.\n\nFor example, a 'greet' function might say 'Hello!' whenever called:\n  def greet():\n      print('Hello!')\n\nThen you can call it:\n  greet()  # prints Hello!\n  greet()  # prints Hello!\n\nFunctions can take ingredients (parameters):\n  def greet(name):\n      print('Hello, ' + name)\n\n  greet('Sarah')  # prints Hello, Sarah\n\nAnd they can return results:\n  def add(a, b):\n      return a + b\n\n  result = add(3, 5)  # result is 8" },
  { name: "Conditionals", description: "Make your program make decisions", content: "Conditionals let your program choose what to do based on situations.\n\n\nFor example, in a game:\n  if player_health > 0:\n      print('You are alive!')\n  else:\n      print('Game Over!')\n\nYou can check multiple things:\n  if age >= 18:\n      print('You can vote')\n  elif age >= 13:\n      print('You are a teenager')\n  else:\n      print('You are young')\n\nComparison operators:\n- == means 'equals'\n- != means 'not equals'\n- > means 'greater than'\n- < means 'less than'" },
  { name: "Loops", description: "Repeat code without rewriting it", content: "Loops let you repeat code multiple times.\n\nThe 'for' loop goes through a sequence:\n  for i in range(5):\n      print(i)  # prints 0, 1, 2, 3, 4\n\nLoop through a list:\n  fruits = ['apple', 'banana', 'cherry']\n  for fruit in fruits:\n      print(fruit)\n\nThe 'while' loop keeps going until something changes:\n  while player_health > 0:\n      print('Still fighting!')\n      player_health = player_health - 1\n\nControl your loop:\n- 'break' stops the loop immediately\n- 'continue' skips to the next iteration" },
  { name: "Exceptions", description: "Handle errors without crashing", content: "Exceptions handle errors gracefully so your program doesn't crash.\n\nFor example, if a file doesn't exist:\n  try:\n      with open('data.txt') as file:\n          content = file.read()\n  except:\n      print('File not found!')\n\nYou can handle different errors differently:\n  try:\n      number = int(user_input)\n  except ValueError:\n      print('Please enter a number')\n  except:\n      print('Something went wrong')\n\nThis way, even if something goes wrong, your program keeps running." },
  { name: "Libraries", description: "Use code others already wrote", content: "Libraries are collections of code other people wrote that you can use.\n\nFor example, to get random numbers:\n  import random\n  number = random.randint(1, 10)  # random number 1-10\n\nFor math operations:\n  import math\n  print(math.sqrt(16))  # prints 4.0\n  print(math.pi)        # prints 3.14159...\n\nOther useful libraries:\n- 'datetime' for dates and times\n- 'json' for reading JSON files\n- 'os' for interacting with your computer" },
  { name: "Unit Tests", description: "Automatically verify your code works", content: "Unit tests automatically check if your code works correctly.\n\nFor example:\n  def add(a, b):\n      return a + b\n\n  def test_add():\n      assert add(2, 3) == 5\n      assert add(-1, 1) == 0\n      print('All tests passed!')\n\n\nIf add(2, 3) didn't equal 5, the test would fail and you'd know something is wrong.\n\nThis is super useful when your programs get bigger and you want to make sure new changes don't break old code." },
  { name: "File I/O", description: "Save and load data from files", content: "File I/O lets you save data so it's there when you run your program again.\n\n\nReading a file:\n  with open('scores.txt') as file:\n      content = file.read()\n      print(content)\n\nWriting to a file:\n  with open('scores.txt', 'w') as file:\n      file.write('Player: 100')\n\nReading line by line:\n  with open('notes.txt') as file:\n      for line in file:\n          print(line)\n\n\nThe 'with' statement automatically closes the file when you're done, even if an error happens." },
  { name: "Regular Expressions", description: "Find and match patterns in text", content: "Regular expressions (regex) find patterns in text.\n\nFor example, find all phone numbers:\n  import re\n  text = 'Call 555-1234 or 555-5678'\n  numbers = re.findall(r'\\d\\d\\d-\\d\\d\\d\\d', text)\n  # finds '555-1234' and '555-5678'\n\nCommon patterns:\n- \\d matches any digit (0-9)\n- \\w matches any letter or number\n- + means 'one or more'\n- * means 'zero or more'\n- . matches any character\n\nExample: finding emails:\n  email_pattern = r'\\w+@\\w+\\.\\w+'\n  emails = re.findall(email_pattern, text)" },
  { name: "Object-Oriented Programming", description: "Organize code with objects and classes", content: "Object-Oriented Programming (OOP) organizes code around objects.\n\nA class is a blueprint, an object is what you create from it.\n\n\nFor example, a 'Dog' class:\n  class Dog:\n      def __init__(self, name):\n          self.name = name\n          self.energy = 100\n      \n      def bark(self):\n          print('Woof!')\n      \n      def sleep(self):\n          self.energy = 100\n\nCreating dogs from this blueprint:\n  buddy = Dog('Buddy')\n  max = Dog('Max')\n  \n  buddy.bark()  # Buddy barks!\n  print(buddy.name)  # prints 'Buddy'" },
  { name: "Project: Text Adventure", description: "Build a story-based adventure game!", content: "In this project, you'll build a text adventure game where players explore rooms, collect items, and make choices.\n\nYou'll use:\n- Variables to track player location, inventory, health\n- Conditionals for player choices\n- Loops for game replay\n- Functions for room descriptions, item interactions\n- Maybe save progress to a file\n\nExample features:\n- Multiple rooms with descriptions\n- An inventory system\n- Win/lose conditions\n- A map showing explored rooms" },
];

const JAVASCRIPT_COURSE = [
  { name: "Variables & Data Types", description: "Store and label data in your program", content: "A variable stores information, like a labeled box.\n\nIn JavaScript:\n  let name = 'Sarah';\n  let age = 12;\n\nUse 'let' when the value changes, 'const' when it doesn't:\n  const PI = 3.14;  // this won't change\n  let score = 0;     // this will\n\nData types in JavaScript:\n- Strings (text): 'Hello'\n- Numbers: 12, 3.14\n- Booleans: true, false\n\nYou can combine strings with +:\n  let greeting = 'Hello, ' + name;  // 'Hello, Sarah'" },
  { name: "Console & Debugging", description: "Find and fix bugs in your code", content: "The console is your best friend for finding bugs.\n\nOpen it: Right-click page > Inspect > Console tab\n\nPrint messages:\n  console.log('Hello!');\n  console.log(score);\n\nSee mistakes:\n  console.log('Error at step 3');\n\n\nThis helps you understand what your code is actually doing." },
  { name: "DOM Manipulation", description: "Change the webpage with JavaScript", content: "The DOM (Document Object Model) is the webpage structure JavaScript can change.\n\n\nGet an element by its ID:\n  let title = document.getElementById('title');\n\nChange the text:\n  title.textContent = 'New Title!';\n\n\nChange HTML:\n  element.innerHTML = '<strong>Bold!</strong>';\n\n\nChange styles:\n  element.style.color = 'blue';\n  element.style.fontSize = '20px';\n\n\nThis is how you make interactive webpages!" },
  { name: "Event Listeners", description: "Respond when users click or type", content: "Event listeners make your page respond to user actions.\n\n\nWhen someone clicks a button:\n  button.addEventListener('click', function() {\n      alert('You clicked!');\n  });\n\nOther useful events:\n- 'mouseover': when mouse enters element\n- 'mouseout': when mouse leaves element\n- 'keydown': when a key is pressed\n- 'submit': when a form is submitted\n\nExample: change text on click:\n  button.addEventListener('click', function() {\n      message.textContent = 'Clicked!';\n  });" },
  { name: "Conditionals", description: "Make decisions in your code", content: "Conditionals let your code make choices.\n\n\nSimple if/else:\n  if (score > 100) {\n      console.log('You win!');\n  } else {\n      console.log('Keep trying!');\n  }\n\nMultiple choices:\n  if (age < 13) {\n      console.log('Kid');\n  } else if (age < 20) {\n      console.log('Teenager');\n  } else {\n      console.log('Adult');\n  }\n\nComparisons:\n- === equals\n- !== not equals\n- > greater than\n- < less than" },
  { name: "Loops", description: "Repeat code without rewriting", content: "Loops repeat code multiple times.\n\nThe for loop:\n  for (let i = 0; i < 5; i++) {\n      console.log(i);  // prints 0, 1, 2, 3, 4\n  }\n\nLoop through an array:\n  let fruits = ['apple', 'banana'];\n  for (let fruit of fruits) {\n      console.log(fruit);\n  }\n\nWhile loop:\n  while (health > 0) {\n      console.log('Still alive!');\n      health--;\n  }\n\nBreak to stop early, continue to skip iterations." },
  { name: "Functions", description: "Create reusable pieces of code", content: "Functions are reusable blocks of code.\n\n\nRegular function:\n  function greet(name) {\n      return 'Hello, ' + name;\n  }\n\nArrow function (shorter):\n  const greet = (name) => 'Hello, ' + name;\n\nUsing them:\n  console.log(greet('Sarah'));  // 'Hello, Sarah'\n\nFunctions can do multiple things:\n  function showMessage(text) {\n      console.log(text);\n      document.getElementById('msg').textContent = text;\n  }" },
  { name: "Arrays", description: "Store lists of items", content: "Arrays store ordered lists.\n\nCreate one:\n  let scores = [100, 85, 92];\n\nAccess items (counting from 0):\n  console.log(scores[0]);  // 100\n  console.log(scores[2]);  // 92\n\nAdd items:\n  scores.push(88);  // adds to end\n\nHow many items:\n  console.log(scores.length);  // 4\n\nLoop through:\n  for (let score of scores) {\n      console.log(score);\n  }" },
  { name: "Objects", description: "Store related data together", content: "Objects group related information.\n\nCreate one:\n  let player = {\n      name: 'Sarah',\n      health: 100,\n      level: 5\n  };\n\nAccess properties:\n  console.log(player.name);    // 'Sarah'\n  console.log(player['health']);  // 100\n\nChange properties:\n  player.health = 95;\n  player.score = 0;\n\nObjects are perfect for game entities, user profiles, and any structured data." },
  { name: "Classes", description: "Create blueprints for objects", content: "Classes are blueprints for creating objects.\n\n\nDefine a class:\n  class Dog {\n      constructor(name) {\n          this.name = name;\n          this.energy = 100;\n      }\n      bark() {\n          return 'Woof!';\n      }\n  }\n\nCreate objects from it:\n  let buddy = new Dog('Buddy');\n  console.log(buddy.name);   // 'Buddy'\n  console.log(buddy.bark()); // 'Woof!'\n\nThis makes creating multiple similar objects easy." },
  { name: "Project: Browser Game", description: "Build an interactive browser game!", content: "In this project, you'll build a game that runs in the browser.\n\n\nYou'll use:\n- Variables to track score, lives, game state\n- Conditionals for win/lose conditions\n- Loops for game animation\n- Functions for game logic\n- Event listeners for controls\n- Canvas for drawing graphics\n\nExample features:\n- A character that moves with arrow keys\n- Collectible items that add points\n- Obstacles to avoid\n- A score display\n- Win/lose screens" },
];

const AI_COURSE = [
  { name: "Search", description: "Find paths in graphs and puzzles", content: "Search algorithms help AI find solutions in problem spaces.\n\nBreadth-First Search (BFS): explores all neighbors first, guaranteed to find shortest path.\n\nDepth-First Search (DFS): explores as far as possible before backtracking.\n\nA* Search: uses heuristics to find optimal paths faster.\n\nExample: navigating a maze, finding shortest route on a map." },
  { name: "Knowledge", description: "Represent and reason with facts", content: "Knowledge representation lets AI store and use facts.\n\nPropositional Logic: true/false statements.\n\nFirst-Order Logic: rules like 'all humans are mortal'.\n\nInference: drawing conclusions from known facts.\n\nExample: a medical diagnosis system that knows symptoms and diseases." },
  { name: "Uncertainty", description: "Deal with incomplete information", content: "Probabilistic reasoning helps AI handle uncertainty.\n\nBayes' Theorem: P(A|B) = P(B|A) * P(A) / P(B)\n\nBayesian Networks: model relationships between variables.\n\nExample: spam filters that calculate probability an email is spam." },
  { name: "Optimization", description: "Find the best solution among many", content: "Optimization algorithms find the best solution when there are many choices.\n\nLocal Search: hill climbing, simulated annealing.\n\nGenetic Algorithms: evolve solutions over generations.\n\nExample: scheduling, route planning, resource allocation." },
  { name: "Learning", description: "Learn patterns from data", content: "Machine learning lets AI improve from experience.\n\nSupervised Learning: learn from labeled examples.\n\nUnsupervised Learning: find patterns in unlabeled data.\n\nReinforcement Learning: learn from rewards and penalties.\n\nExample: predicting house prices, recommending movies." },
  { name: "Neural Networks", description: "Model the brain's structure", content: "Neural networks are inspired by biological neurons.\n\nLayers: input, hidden layers, output.\n\nTraining: adjust weights to minimize error.\n\nBackpropagation: algorithm for learning.\n\nExample: image recognition, speech synthesis." },
  { name: "Language", description: "Understand and generate text", content: "Natural Language Processing helps AI work with human language.\n\nTokenization: breaking text into words.\n\nEmbeddings: representing words as numbers.\n\nTransformers: attention mechanisms for context.\n\nExample: chatbots, translation, sentiment analysis." },
  { name: "Project: AI Game", description: "Build an AI-powered game!", content: "In this project, you'll build a game with AI opponents.\n\nYou'll use:\n- Minimax algorithm for game AI\n- Alpha-beta pruning to optimize\n- Evaluation functions\n- Machine learning for smarter opponents\n\nExample features:\n- Tic-tac-toe with unbeatable AI\n- Connect Four with varying difficulty\n- Chess or checkers AI" },
];

async function getCourses(request: Request, env: Env, origin: string | null): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  const isPaid = user !== null;
  
  const courses = {
    python: PYTHON_COURSE,
    javascript: JAVASCRIPT_COURSE,
    ai: AI_COURSE,
  };
  
  const response = {
    courses,
    isPaid,
  };
  
  return new Response(JSON.stringify(response), {
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request.headers.get('Origin')) });
    }
    
    try {
      if (path === '/api/login' && request.method === 'POST') {
        return await login(request, env);
      }
      
      if (path === '/api/reset-password' && request.method === 'POST') {
        return await resetPassword(request, env);
      }
      
      if (path === '/api/list_students' && request.method === 'POST') {
        return await listStudents(request, env);
      }
      
      if (path.startsWith('/api/get_student/') && request.method === 'POST') {
        const id = parseInt(path.split('/').pop() || '');
        return await getStudent(request, env, id);
      }
      
      if (path.startsWith('/api/submit/') && request.method === 'POST') {
        const workType = path.split('/').pop() || '';
        return await submitWork(request, env, workType);
      }
      
      if (path === '/api/ask' && request.method === 'POST') {
        return await submitQuestion(request, env);
      }
      
      if (path === '/api/comment' && request.method === 'POST') {
        return await submitComment(request, env);
      }
      
      if (path === '/api/get_questions' && request.method === 'GET') {
        return await getQuestions(request, env);
      }
      
      if (path === '/api/submit_project' && request.method === 'POST') {
        return await submitProject(request, env);
      }
      
      const origin = request.headers.get('Origin');
      
      if (path === '/api/projects' && request.method === 'GET') {
        return await listProjects(env, origin);
      }
      
      if (path === '/api/projects/all' && request.method === 'GET') {
        return await getAllProjectsList(env, origin);
      }
      
      if (path === '/api/projects/pending' && request.method === 'GET') {
        return await getPendingProjects(env, origin);
      }

      if (path.startsWith('/api/projects/') && path.endsWith('/status') && request.method === 'PATCH') {
        const id = parseInt(path.split('/')[3]);
        return await updateProjectStatus(env, id, request, origin);
      }
      
if (path.startsWith('/api/projects/') && path.endsWith('/view') && request.method === 'POST') {
        const id = parseInt(path.split('/')[3]);
        return await incrementProjectView(env, id, origin);
      }

      if (path === '/api/courses' && request.method === 'GET') {
        return await getCourses(request, env, origin);
      }

      // Proxy static files from build server (same-origin workaround)
      if (path.startsWith('/static/projects/')) {
        const buildUrl = `https://iloveuvania.omraheja.me${path}`;
        try {
          const buildResp = await fetch(buildUrl);
          const body = await buildResp.arrayBuffer();
          return new Response(body, {
            status: buildResp.status,
            headers: {
              'Content-Type': buildResp.headers.get('Content-Type') || 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
            }
          });
        } catch (e) {
          return new Response('Not found', { status: 404 });
        }
      }

      // Serve Java jars from Backblaze B2 (private bucket)
      if (path.startsWith('/app/') && path.endsWith('.jar')) {
        try {
          const bucketName = env.B2_BUCKET_NAME || 'sigmaboy';
          const fileName = path.slice(1); // remove leading /
          
          // Authorize with B2
          const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: {
              'Authorization': `Basic ${btoa(`${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`)}`
            }
          });
          
          if (!authRes.ok) return new Response('Not found', { status: 404 });
          const authData = await authRes.json() as any;
          
          // Download file using B2 API
          const downloadUrl = `${authData.downloadUrl}/file/${bucketName}/${fileName}`;
          const downloadRes = await fetch(downloadUrl, {
            headers: { 'Authorization': authData.authorizationToken }
          });
          
          if (!downloadRes.ok) return new Response('Not found', { status: 404 });
          const body = await downloadRes.arrayBuffer();
          
          return new Response(body, {
            status: 200,
            headers: {
              'Content-Type': 'application/java-archive',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=31536000',
            }
          });
        } catch (e) {
          console.error(`B2 download failed: ${e}`);
          return new Response('Not found', { status: 404 });
        }
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: String(error) }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  },
};
