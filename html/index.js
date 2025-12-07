const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const loginForm = document.getElementById('login-card');
const studentsList = document.getElementById('students-card');
const welcomeHeadline = document.getElementById('welcome-headline');

const changePasswordBtn = document.getElementById('change-password-btn');
const changePasswordModal = document.getElementById('change-password-modal');
const closeModalBtn = document.querySelector('.close-modal');

// Text modal elements
const textModal = document.getElementById('text-modal');
const closeTextModalBtn = document.querySelector('.close-text-modal');
const textModalTitle = document.getElementById('text-modal-title');
const textModalBody = document.getElementById('text-modal-body');

const converter = new showdown.Converter();

// Open text modal
function openTextModal(title, content) {
  textModalTitle.textContent = title;
  textModalBody.innerHTML = content;
  textModal.classList.add('active');
}

// Close text modal
closeTextModalBtn.addEventListener('click', () => {
  textModal.classList.remove('active');
});

// Close text modal when clicking outside
textModal.addEventListener('click', (e) => {
  if (e.target === textModal) {
    textModal.classList.remove('active');
  }
});

// Close text modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && textModal.classList.contains('active')) {
    textModal.classList.remove('active');
  }
});
    
// Open change password modal
changePasswordBtn.addEventListener('click', () => {
  changePasswordModal.classList.add('active');
});

// Close modal
closeModalBtn.addEventListener('click', () => {
  changePasswordModal.classList.remove('active');
});

// Close modal when clicking outside
changePasswordModal.addEventListener('click', (e) => {
  if (e.target === changePasswordModal) {
    changePasswordModal.classList.remove('active');
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && changePasswordModal.classList.contains('active')) {
    changePasswordModal.classList.remove('active');
  }
});

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
  const u = getCookie("name");
  console.log(u);
  const loginStatus = qs('#login-status');
  if (u) {
    setStatus(loginStatus, `Signed in as “${decodeURIComponent(u)}”.`, 'ok');
    qs('#students-status').classList.remove('warn');
    setStatus(qs('#students-status'), 'Authenticated. You can load students now.', 'ok');
    loginForm.style.display = 'none';
    studentsList.style.display = 'block';
    welcomeHeadline.textContent = `Welcome, ${decodeURIComponent(u)}!`;

  } else {
    setStatus(loginStatus, 'Not signed in.', 'warn');
    setStatus(qs('#students-status'), 'You may need to login first.', 'warn');
    loginForm.style.display = 'block';
    studentsList.style.display = 'none';
    welcomeHeadline.textContent = 'Welcome to Codeabode!';
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

// Handle click events for view text buttons using event delegation
document.addEventListener('click', (e) => {
  // Check if the clicked element is a view-text-btn
  if (e.target.classList.contains('view-text-btn')) {
    const button = e.target;
    const classCard = button.closest('.class-card, .upcoming-class-card');
    const classId = classCard?.dataset.classId || 'Unknown Class';
    const fieldType = button.dataset.type;
    const className = classCard?.querySelector('strong')?.textContent || 'Class';
    
    // Find the actual text from the preview span
    const previewSpan = button.nextElementSibling;
    if (previewSpan?.classList.contains('text-preview')) {
      // Get the full text from the data attribute or from the student data
      // For now, we'll use a placeholder - you might want to store the full text in a data attribute
      const fullText = converter.makeHtml(button.dataset.fullText) || 
                      previewSpan.textContent.replace('...', '') + 
                      (button.dataset.fullText ? '' : ' (Full text not loaded)');
      
      const titles = {
        'classwork': 'Classwork',
        'homework': 'Homework',
      };
      
      openTextModal(
        `${titles[fieldType] || fieldType} - ${className}`,
        fullText
      );
    }
  }
});

function renderStudents(items) {
  if (!items?.length) {
    listEl.innerHTML = '<li class="empty">No students found.</li>';
    return;
  }
  listEl.innerHTML = '';
  for (const s of items) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><strong>${escapeHtml(s.name)}</strong></span>
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
  
  // Helper function to create view buttons for long text
  const createViewButton = (text, type, label) => {
    if (!text || text.trim() === '') return '';
    // If text is short (less than 150 chars), show inline, otherwise show button
    return `
      <div class="class-field">
        <strong>${label}:</strong>
        <button class="view-text-btn" data-type="${type}" data-full-text="${escapeHtml(text)}" style="
          margin-left: 0.5rem;
          padding: 0.25rem 0.75rem;
          font-size: 0.85rem;
          background: rgba(106, 165, 255, 0.15);
          border: 1px solid var(--accent);
          color: var(--accent);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        ">View ${label}</button>
        <span class="text-preview" style="
          display: inline-block;
          margin-left: 0.5rem;
          color: var(--muted);
          font-style: italic;
          font-size: 0.9rem;
        ">${escapeHtml(text.substring(0, 80))}...</span>
      </div>
    `;
  };

  // Create individual cards for each class
  const classCards = (s.classes || []).map(c => {
    // Store the full text in data attributes
    const classworkBtn = createViewButton(c.classwork, 'classwork', 'Classwork');
    const hwBtn = createViewButton(c.hw, 'homework', 'Homework');
    const notesBtn = createViewButton(c.notes, 'notes', 'Notes');
    const hwNotesBtn = createViewButton(c.hw_notes, 'hw_notes', 'HW Notes');
    
    return `
      <div class="${c.status == 'upcoming' ? 'upcoming-class-card' : 'class-card'}" data-class-id="${c.id || ''}">
        <div class="class-card-header">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="chip">${escapeHtml(c.status)}</span>
        </div>
        
        <div class="class-card-content">
          ${c.relevance ? `<div class="class-field"><strong>Relevance:</strong> ${escapeHtml(c.relevance)}</div>` : ''}
          
          ${c.methods?.length ? `
            <div class="class-field">
              <strong>Methods:</strong>
              <div class="chip-container">
                ${c.methods.map(m => `<span class="chip chip-soft">${escapeHtml(m)}</span>`).join('')}
              </div>
            </div>` : ''}
          
          ${c.stretch_methods?.length ? `
            <div class="class-field">
              <strong>Stretch Methods:</strong>
              <div class="chip-container">
                ${c.stretch_methods.map(m => `<span class="chip chip-soft">${escapeHtml(m)}</span>`).join('')}
              </div>
            </div>` : ''}
          
          ${c.skills_tested?.length ? `
            <div class="class-field">
              <strong>Skills Tested:</strong>
              <div class="chip-container">
                ${c.skills_tested.map(skill => `<span class="chip chip-soft">${escapeHtml(skill)}</span>`).join('')}
              </div>
            </div>` : ''}
          
          ${c.description ? `<div class="class-field"><strong>Description:</strong> ${escapeHtml(c.description)}</div>` : ''}
          ${classworkBtn}
          ${c.notes ? `<div class="class-field"><strong>Notes:</strong> ${escapeHtml(c.notes)}</div>` : ''}
          ${hwBtn}
           ${c.hw_notes ? `<div class="class-field"><strong>HW Notes:</strong> ${escapeHtml(c.hw_notes)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Create future concepts card (unchanged)
  const futureConceptsList = (s.future_concepts || []);
  const futureConceptsCard = futureConceptsList.length ? `
    <div class="future-concepts-card">
      <h3 style="margin:0 0 .75rem 0; color:var(--text)">Future Concepts</h3>
      <div class="future-concepts-list">
        ${futureConceptsList.map(concept => `
          <span class="concept-chip">${escapeHtml(concept)}</span>
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="card" style="margin-top:1rem">
      <h2>${escapeHtml(s.current_level)}</h2>
      <div style="margin-top:.75rem; display:grid; gap:.35rem">
        <div><strong>Age:</strong> ${s.age}</div>
        <div><strong>Final Goal:</strong> ${escapeHtml(s.final_goal)}</div>
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

      <hr style="border:0;border-top:1px solid var(--border);margin:1.5rem 0"/>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem">
        <h3 style="margin:0">Classes</h3>
        <span class="chip chip-soft">${summary.total} total (so far)</span>
      </div>
      
      ${classCards ? 
        `<div class="classes-container">
          ${classCards}
        </div>` : 
        '<div class="empty">No classes found.</div>'
      }

      ${futureConceptsCard}
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

