const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function hexToByteArray(hexx) {
    var hex = hexx.toString();
    var byteArray = [];
    for (var i = 0; i < hex.length; i += 2) {
        byteArray.push(parseInt(hex.substr(i, 2), 16));
    }
    return byteArray;
}

function setStatus(el, text, kind = "") {
  el.classList.remove("ok", "err", "warn");
  if (kind) el.classList.add(kind);
  el.textContent = text;
}


function getCookie(name) {
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="))?.split("=")[1];
}

function updateLoginUI() {
  const u = getCookie("username");
  console.log(u);
  const loginStatus = qs('#login-status');
  if (u) {
    setStatus(loginStatus, `Signed in as “${decodeURIComponent(u)}”.`, 'ok');
    qs('#students-status').classList.remove('warn');
    setStatus(qs('#students-status'), 'Authenticated. You can load students now.', 'ok');
  } else {
    setStatus(loginStatus, 'Not signed in.', 'warn');
    setStatus(qs('#students-status'), 'You may need to login first.', 'warn');
  }
}


qs('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = qs('#login-username').value.trim();
  const password = qs('#login-password').value;
  const statusEl = qs('#login-status');
  setStatus(statusEl, 'Signing in…');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password })
    });
    const text = await res.text();
    if (res.ok) {
      setStatus(statusEl, text || 'Login successful', 'ok');
      updateLoginUI();
    } else if (res.status === 401) {
      setStatus(statusEl, 'Incorrect password.', 'err');
    } else {
      setStatus(statusEl, `Login failed: ${text}`, 'err');
    }
  } catch (err) {
    setStatus(statusEl, 'Network error. See console.', 'err');
    console.error(err);
  }
});


qs('#logout-btn').addEventListener('click', () => {
  document.cookie = 'username=; Max-Age=0; path=/';
  document.cookie = 'password=; Max-Age=0; path=/';
  updateLoginUI();
  qs('#students-list').innerHTML = '<li class="empty">Logged out. Student list cleared.</li>';
  qs('#student-detail').classList.add('hide');
});


qs('#change-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = qs('#cp-username').value.trim();
  const password = qs('#cp-current').value;
  const new_password = qs('#cp-new').value;
  const statusEl = qs('#change-status');
  setStatus(statusEl, 'Updating password…');

  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password, new_password })
    });
    const text = await res.text();
    if (res.ok) {
      setStatus(statusEl, text || 'Password updated successfully.', 'ok');
    } else if (res.status === 401) {
      setStatus(statusEl, 'Incorrect password.', 'err');
    } else {
      setStatus(statusEl, `Update failed: ${text}`, 'err');
    }
  } catch (err) {
    setStatus(statusEl, 'Network error. See console.', 'err');
    console.error(err);
  }
});


const listEl = qs('#students-list');
const detailEl = qs('#student-detail');
let students = [];

async function loadStudents() {
  setStatus(qs('#students-status'), 'Loading students…');
  detailEl.classList.add('hide');
  try {
    const res = await fetch('/api/list_students', {
      method: 'POST',
      credentials: 'same-origin'
    });
    if (!res.ok) {
      if (res.status === 401) {
        setStatus(qs('#students-status'), 'Unauthorized. Please login first.', 'warn');
      } else {
        const text = await res.text();
        setStatus(qs('#students-status'), `Failed: ${text}`, 'err');
      }
      return;
    }
    students = await res.json();
    renderStudents(students);
    setStatus(qs('#students-status'), 'Loaded.', 'ok');
  } catch (err) {
    setStatus(qs('#students-status'), 'Network error. See console.', 'err');
    console.error(err);
  }
}

function renderStudents(items) {
  if (!items?.length) {
    listEl.innerHTML = '<li class="empty">No students found.</li>';
    return;
  }
  listEl.innerHTML = '';
  for (const s of items) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>#${s.id}</strong> — ${escapeHtml(s.name)}</span>
      <span>
        <button data-id="${s.id}" class="view-btn">View</button>
      </span>`;
    listEl.appendChild(li);
  }
  qsa('.view-btn', listEl).forEach(btn => btn.addEventListener('click', () => viewStudent(btn.dataset.id)));
}

async function viewStudent(id) {
  setStatus(qs('#students-status'), `Loading student #${id}…`);
  try {
    const res = await fetch(`/api/get_student/${encodeURIComponent(id)}`, {
      method: 'POST',
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const text = await res.text();
      setStatus(qs('#students-status'), `Failed: ${text}`, 'err');
      return;
    }
    const data = await res.json();
    detailEl.classList.remove('hide');
    detailEl.innerHTML = renderStudentDetail(data);
    setStatus(qs('#students-status'), 'Loaded.', 'ok');
  } catch (err) {
    setStatus(qs('#students-status'), 'Network error. See console.', 'err');
    console.error(err);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


function computeStudentSummary(s) {
  const classes = s.classes || [];
  const total = classes.length;
  let completed = 0;
  let methods = 0, stretch = 0, skills = 0;
  for (const c of classes) {
    const st = (c.status || '').toLowerCase();
    if (st === 'completed' || st === 'done' || st === 'finished') completed++;
    methods += (c.methods || []).length;
    stretch += (c.stretch_methods || []).length;
    skills  += (c.skills_tested || []).length;
  }
  const percent = total ? Math.round((completed/total)*100) : 0;
  return { total, completed, percent, methods, stretch, skills };
}

function renderStudentDetail(s) {
  const summary = computeStudentSummary(s);
  const cls = (s.classes || []).map(c => `
    <li>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="chip">${escapeHtml(c.status)}</span>
        ${c.methods?.length ? `<span class="chip chip-soft">${c.methods.length} methods</span>` : ''}
        ${c.stretch_methods?.length ? `<span class=\"chip chip-soft\">${c.stretch_methods.length} stretch</span>` : ''}
        ${c.skills_tested?.length ? `<span class=\"chip chip-soft\">${c.skills_tested.length} skills</span>` : ''}
      </div>
      ${c.relevance ? `<div>Relevance: ${escapeHtml(c.relevance)}</div>` : ''}
      ${c.methods?.length ? `<div>Methods: ${c.methods.map(escapeHtml).join(', ')}</div>` : ''}
      ${c.stretch_methods?.length ? `<div>Stretch: ${c.stretch_methods.map(escapeHtml).join(', ')}</div>` : ''}
      ${c.skills_tested?.length ? `<div>Skills: ${c.skills_tested.map(escapeHtml).join(', ')}</div>` : ''}
      ${c.description ? `<div>Description: ${escapeHtml(c.description)}</div>` : ''}
      ${c.classwork ? `<div>Classwork: ${escapeHtml(c.classwork)}</div>` : ''}
      ${c.notes ? `<div>Notes: ${escapeHtml(c.notes)}</div>` : ''}
      ${c.hw ? `<div>HW: ${escapeHtml(c.hw)}</div>` : ''}
      ${c.hw_notes ? `<div>HW Notes: ${escapeHtml(c.hw_notes)}</div>` : ''}
    </li>
  `).join('');

  return `
    <div class="card" style="margin-top:1rem">
      <h2>Student Detail</h2>
      <div class="small" style="color:var(--muted)">ID #${s.id}</div>
      <div style="margin-top:.75rem; display:grid; gap:.35rem">
        <div><strong>Name:</strong> ${escapeHtml(s.name)}</div>
        <div><strong>Age:</strong> ${s.age}</div>
        <div><strong>Current Level:</strong> ${escapeHtml(s.current_level)}</div>
        <div><strong>Final Goal:</strong> ${escapeHtml(s.final_goal)}</div>
        <div><strong>Future Concepts:</strong> ${(s.future_concepts||[]).map(escapeHtml).join(', ') || '—'}</div>
        <div><strong>Notes:</strong> ${s.notes ? escapeHtml(s.notes) : '—'}</div>
      </div>

      <div class="pbar-wrap" style="margin-top:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
          <div class="small" style="color:var(--muted)">Overall Progress</div>
          <div class="small"><strong>${summary.completed}/${summary.total}</strong> (${summary.percent}%)</div>
        </div>
        <div class="pbar"><span style="width:${summary.percent}%"></span></div>
        <div style="display:flex; gap:.5rem; margin-top:.5rem; flex-wrap:wrap">
          <span class="chip chip-soft">${summary.methods} methods</span>
          <span class="chip chip-soft">${summary.stretch} stretch</span>
          <span class="chip chip-soft">${summary.skills} skills</span>
        </div>
      </div>

      <hr style="border:0;border-top:1px solid var(--border);margin:1rem 0"/>
      <h3 style="margin:.2rem 0 0.5rem">Classes</h3>
      ${cls ? `<ul style="list-style:none;padding:0;margin:.4rem 0 0;display:grid;gap:.6rem">${cls}</ul>` : '<div class="empty">No classes found.</div>'}
    </div>
  `;
}


qs('#student-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = students.filter(s => s.name.toLowerCase().includes(q));
  renderStudents(filtered);
});

qs('#refresh-students').addEventListener('click', loadStudents);


(function init(){
  qs('#year').textContent = new Date().getFullYear();
  updateLoginUI();
})();

// adding this line makes the above work somehow
console.log('CodeAbode WebApp loaded.');
