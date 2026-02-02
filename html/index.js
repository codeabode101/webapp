const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const loginForm = document.getElementById('login-card');
const studentsList = document.getElementById('students-card');
const welcomeHeadline = document.getElementById('welcome-headline');

const changePasswordBtn = document.getElementById('change-password-btn');
const changePasswordModal = document.getElementById('change-password-modal');
const closeModalBtn = document.querySelector('.close-modal');

const classworkPage = document.getElementById('classwork-page');
const classworkTitle = document.getElementById('classwork-title');
const classworkContent = document.getElementById('classwork-content');
const backBtn = document.querySelector('.back-btn');
const fileUploadBox = document.getElementById('file-upload-box');
const fileInput = document.getElementById('file-input');
const textInput = document.getElementById('text-input');
const submitBtn = document.querySelector('.submit-btn');
const myWorkBtn = document.querySelector('.my-work-btn');

const submissionContent = document.querySelector('.submission-code');

// classwork or homework if we're submitting
let submittingType = null;
let classId = null;

// Handle file upload box click
fileUploadBox.addEventListener('click', () => {
  fileInput.click();
});

// Handle file selection
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    fileUploadBox.innerHTML = `
      <div style="text-align:center">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
        <div><strong>${file.name}</strong></div>
        <div style="font-size: 0.8rem; margin-top: 0.5rem;">${(file.size / 1024).toFixed(2)} KB</div>
      </div>
    `;
  }
});

submitBtn.addEventListener('click', async () => {
    let work = null;
  
    if (fileInput.files.length > 0) {
        work = await fileInput.files[0].text();
    } else {
        work = textInput.value.trim();
    }
  
    try {
      const res = await fetch(`/api/submit/${submittingType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ class_id: Number(classId), work })
      });
      if (res.ok) {
        alert("Submitted");
      } else {
        const text = await res.text();
        alert(`${res.status} : ${text}`);
      }
    } catch (e) {
      alert(e);
    } 
  
  
    textInput.value = "";
  
    fileInput.value = "";
    fileUploadBox.innerHTML =  `
          <span>Click to upload file or drag &amp; drop</span>
          <input type="file" id="file-input">
    `;
    submissionContent.innerHTML = `<pre><code>${escapeHtml(work)}</code></pre>`;
    myWorkBtn.style.display = 'grid';
});

myWorkBtn.addEventListener('click', () => {
    if (submissionContent.style.display == 'none') {
        submissionContent.style.display = 'grid';
    } else {
        submissionContent.style.display = 'none';
    }
});

// Function to show classwork page
function showClassworkPage(type, className, content, submission) {
  // Hide main app
  document.querySelector('.main-app-header').style.display = 'none'; 
  document.querySelector('.main-app').style.display = 'none';

  console.log(submission);

  if (submission) {
    myWorkBtn.style.display = 'grid';
    myWorkBtn.dataset.submission = submission;
  } else {
    myWorkBtn.style.display = 'none';
  } 

  submissionContent.style.display = 'none';
  submissionContent.innerHTML = `<pre><code>${escapeHtml(submission)}</code></pre>`;
  
  // Show classwork page
  classworkPage.style.display = 'grid';

  // Set titles and content
  const displayType = type === 'classwork' ? 'Classwork' : 'Homework';
  classworkTitle.textContent = `${displayType} - ${className}`;
  
  // Convert markdown to HTML if needed (using showdown if available)
  if (typeof showdown !== "undefined") { 
      const converter = new showdown.Converter();
      classworkContent.innerHTML = converter.makeHtml(content);
  } else {
      classworkContent.innerText = content;
  } 

  // scroll all the way up
  window.scrollTo(0, 0);

  //TODO:  Update URL
  //window.history.pushState({ classId, type }, '', `/${type}/${classId}`);
}

// Function to show main app
function showMainApp() {
  // Show main app
  document.querySelector('.main-app-header').style.display = 'flex';
  document.querySelector('.main-app').style.display = 'grid';

  // hide classworkPage
  classworkPage.style.display = 'none';
  
  //TODO: Update URL
  //window.history.pushState({}, '', '/');
}

// Back button event
backBtn.addEventListener('click', showMainApp);

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.classId) {
    // We need to reload the content from your data
    // For now, just show the page with whatever content we have
    classId = event.state.classId;
    console.log(classId);
    showClassworkPage(event.state.type, 'Class', 'Content loaded from history', "The submission");
  } else {
    showMainApp();
  }
});

document.addEventListener('click', (e) => {
  // Check if the clicked element is a view-text-btn
  if (e.target.classList.contains('view-text-btn')) {
    const button = e.target;
    const classCard = button.closest('.class-card, .current-class-card, .upcoming-class-card');

    classId = classCard?.dataset.classId || 'unknown';

    submittingType = button.dataset.type; // 'classwork' or 'homework'
    const className = classCard?.querySelector('strong')?.textContent || 'Unknown Class';
    
    // Get the full text from data attribute
    const fullText = button.dataset.fullText || '';

    // Show the classwork page
    showClassworkPage(submittingType, className, fullText, button.dataset.work);
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
      setTimeout(() => {
        location.reload();
      }, 1000);
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
        document.cookie = "name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        updateLoginUI();
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
/*
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
                      previewSpan.textContent.replace('...', '') + index.js
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
*/

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
    if (res.status == 404) {
        document.cookie = "name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        updateLoginUI();
    }
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
  const createViewButton = (text, type, label, work) => {
    if (!text || text.trim() === '') return '';
    // If text is short (less than 150 chars), show inline, otherwise show button
    return `
      <div class="class-field">
        <strong>${label}:</strong>
        <button class="view-text-btn" data-type="${type}" 
            data-full-text="${escapeHtml(text)}"
            ${work ? `data-work="${escapeHtml(work)}"` : ''}
        >
            View ${label}
        </button>
        <span class="text-preview">
            ${escapeHtml(text.substring(0, 80))}...
        </span>
      </div>
    `;
  };

  // Create individual cards for each class
  const classCards = (s.classes || []).map(c => {
    // Store the full text in data attributes
    console.log(c.classwork_submission);
    const classworkBtn = createViewButton(c.classwork, 'classwork', 
        'Classwork', c.classwork_submission);
    const hwBtn = createViewButton(c.hw, 'homework', 
        'Homework', c.homework_submission);
    
    return `
      <div class="${s.current_class == c.class_id ? 'current-class-card' :
                (c.status == 'upcoming' 
              ? 'upcoming-class-card' 
              : 'class-card')}" 
            data-class-id="${c.class_id || ''}">
        <div class="class-card-header">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="chip">${
                s.current_class === c.class_id ? 'current' :
                escapeHtml(c.status)
            }</span>
        </div>
        
        <div class="class-card-content">
          ${c.description ? `<div class="class-field">${escapeHtml(c.description)}</div>` : ''}
          
          ${c.methods?.length ? `
            <div class="class-field">
              <strong>Objectives:</strong>
              <div class="chip-container">
                ${c.methods.map(m => `<span class="chip chip-soft">${escapeHtml(m)}</span>`).join('')}
              </div>
            </div>` : ''}
          
          ${c.stretch_methods?.length ? `
            <div class="class-field">
              <strong>Stretch Objectives:</strong>
              <div class="chip-container">
                ${c.stretch_methods.map(m => `<span class="chip chip-soft">${escapeHtml(m)}</span>`).join('')}
              </div>
            </div>` : ''}
          
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
  classworkPage.style.display = 'none';
  
  // Check URL on load - if we're on a classwork/homework page, show it
  const path = window.location.pathname;
  const match = path.match(/\/(classwork|homework)\/(.+)/);
  if (match) {
    const type = match[1];
    classId = match[2];
    // You'd need to load the actual content here from your data
    showClassworkPage(type, 'Loading...', 'Content would load here', "Lorem ipsum");
  }
})();

// adding this line makes the above work somehow
console.log('CodeAbode WebApp loaded.');
