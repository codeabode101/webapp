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
  const saltRounds = 10;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...salt));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: saltRounds * 1000 },
    keyMaterial,
    256
  );
  
  const hash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  return `$2b$${saltRounds}$${saltB64}$${hash}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  
  const [, , saltRounds, rest] = parts;
  const [saltB64, hashB64] = rest.split('$');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const storedHashValue = atob(hashB64);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: parseInt(saltRounds) * 1000 },
    keyMaterial,
    256
  );
  
  const derivedHash = String.fromCharCode(...new Uint8Array(derivedBits));
  return derivedHash === storedHashValue;
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

async function setAuthCookies(response: Response, token: string, name: string): Promise<Response> {
  const expires = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toUTCString();
  
  response.headers.set('Set-Cookie', 
    `token=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`);
  response.headers.set('Set-Cookie', 
    `name=${encodeURIComponent(name)}; Path=/; SameSite=Strict; Expires=${expires}`);
  
  return response;
}

async function clearAuthCookies(response: Response): Promise<Response> {
  response.headers.set('Set-Cookie', 
    'token=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  response.headers.set('Set-Cookie', 
    'name=; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return response;
}

function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
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
  
  const response = new Response(JSON.stringify('Login successful'), {
    headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'text/plain' }
  });
  return setAuthCookies(response, token, user.name);
}

async function resetPassword(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    const response = new Response(JSON.stringify('Unauthorized'), { status: 401 });
    return clearAuthCookies(response);
  }
  
  const body = await request.json<{ username: string; password: string; new_password: string }>();
  
  const account = await env.DB.prepare(`
    SELECT id, password FROM accounts WHERE username = ? AND id = ?
  `).bind(body.username, user.userId).first<{ id: number; password: string }>();
  
  if (!account || !(await verifyPassword(body.password, account.password))) {
    const response = new Response(JSON.stringify('Incorrect password'), { status: 401 });
    return clearAuthCookies(response);
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
  return clearAuthCookies(response);
}

async function listStudents(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const students = await env.DB.prepare(`
    SELECT id, name FROM students WHERE account_id = ?
  `).bind(user.userId).all<{ id: number; name: string }>();
  
  return new Response(JSON.stringify(students.results), { headers: getCorsHeaders(request.headers.get('Origin')) });
}

async function getStudent(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  const student = await env.DB.prepare(`
    SELECT id, name, age, current_level, final_goal, future_concepts, notes, current_class
    FROM students 
    WHERE id = ? AND account_id = ?
  `).bind(id, user.userId).first<Student>();
  
  if (!student) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  
  const classes = await env.DB.prepare(`
    SELECT sc.class_id, sc.status, sc.name, sc.methods, sc.stretch_methods,
           sc.description, sc.classwork, sc.notes, sc.hw, sc.hw_notes,
           cw.work as classwork_submission, hw.work as homework_submission
    FROM students_classes sc
    LEFT JOIN (
      SELECT class_id, work FROM submissions 
      WHERE work_type = 'classwork' 
      ORDER BY id DESC LIMIT 1
    ) cw ON cw.class_id = sc.class_id
    LEFT JOIN (
      SELECT class_id, work FROM submissions 
      WHERE work_type = 'homework' 
      ORDER BY id DESC LIMIT 1
    ) hw ON hw.class_id = sc.class_id
    WHERE sc.student_id = ?
    ORDER BY sc.class_id DESC
  `).bind(id).all<StudentClass>();
  
  const result = {
    ...student,
    future_concepts: parseJsonArray(student.future_concepts),
    classes: classes.results.map(c => ({
      ...c,
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
  
  const result = await env.DB.prepare(`
    INSERT INTO submissions (work, work_type, account_id, class_id)
    SELECT ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM students_classes sc
      JOIN students s ON s.id = sc.student_id
      WHERE sc.class_id = ? AND s.account_id = ?
    )
  `).bind(body.work, workType, user.userId, body.class_id, user.userId).run();
  
  if (result.meta.changes === 0) {
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
  
  const body = await request.json<{
    title: string;
    description: string;
    class_id: number;
    work_type: string;
    deploy_method: string | null;
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
    INSERT INTO projects (account_id, submission_id, title, description, deploy_method, status)
    SELECT ?, ?, ?, ?, ?, 'pending'
    WHERE EXISTS (
      SELECT 1 FROM students s
      JOIN students_classes sc ON sc.class_id = ?
      WHERE s.id = sc.student_id AND s.account_id = ?
    )
  `).bind(user.userId, submissionId, body.title, body.description, body.deploy_method, body.class_id, user.userId).run();
  
  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: 'No valid submission found' }), { status: 400 });
  }
  
  const project = await env.DB.prepare(`
    SELECT id FROM projects ORDER BY rowid DESC LIMIT 1
  `).first<{ id: number }>();
  
  const buildServerUrl = env.BUILD_SERVER_URL || 'http://ubuntu@iloveuvania.omraheja.me';
  fetch(`${buildServerUrl}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: project?.id }),
  }).catch(console.error);
  
  return new Response(JSON.stringify({ id: project?.id, status: 'pending' }), {
    headers: getCorsHeaders(request.headers.get('Origin'))
  });
}

async function listProjects(env: Env): Promise<Response> {
  const projects = await env.DB.prepare(`
    SELECT 
      p.id,
      p.title,
      p.description,
      a.name as author_name,
      p.views,
      p.status,
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
    created_at: string;
  }>();
  
  const result = projects.results.map(p => ({
    ...p,
    url: `/static/projects/${p.id}/build/web/index.html`,
  }));
  
  return new Response(JSON.stringify(result), { headers: getCorsHeaders(request.headers.get('Origin')) });
}

async function incrementProjectView(env: Env, id: number): Promise<Response> {
  await env.DB.prepare(`
    UPDATE projects SET views = views + 1 WHERE id = ?
  `).bind(id).run();
  
  return new Response(JSON.stringify('OK'), { headers: getCorsHeaders(request.headers.get('Origin')) });
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
      
      if (path === '/api/projects' && request.method === 'GET') {
        return await listProjects(env);
      }
      
      if (path.startsWith('/api/projects/') && path.endsWith('/view') && request.method === 'POST') {
        const id = parseInt(path.split('/')[3]);
        return await incrementProjectView(env, id);
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
