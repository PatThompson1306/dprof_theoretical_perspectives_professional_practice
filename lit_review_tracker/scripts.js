/* ═══════════════════════════════════════════════════════
   Literature Review Results Tracker — scripts.js
   MOD006046
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────────────────────
const TRACK_LABELS = {
  T1: 'T1 Criminology',
  T2: 'T2 CS & NLP',
  T3: 'T3 Org & Policing',
  T4: 'T4 Ethics & Law',
  TX: 'Cross-track'
};

const STATUS_LABELS = {
  pending:   'Pending',
  retrieved: 'Retrieved',
  fulltext:  'Full-text',
  include:   'Include',
  exclude:   'Exclude'
};

const STORAGE_KEY = 'litreview_records';

// ── STATE ──────────────────────────────────────────────────────────────
let records       = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentTrack  = 'all';
let currentStatus = null;
let currentDB     = null;
let editingId     = null;

// ── PERSISTENCE ────────────────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── VIEW TOGGLE ────────────────────────────────────────────────────────
function setView(v) {
  ['table', 'form', 'export'].forEach(x => {
    document.getElementById('view-' + x).style.display = x === v ? 'block' : 'none';
    document.getElementById('vt-' + x).classList.toggle('active', x === v);
  });
  if (v === 'table') renderTable();
}

// ── SIDEBAR FILTERS ────────────────────────────────────────────────────
function filterTrack(t) {
  currentTrack  = t;
  currentStatus = null;
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sb-' + t)?.classList.add('active');
  renderTable();
}

function filterStatus(s) {
  currentStatus = s;
  currentTrack  = 'all';
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sb-' + s)?.classList.add('active');
  document.getElementById('sb-all')?.classList.add('active');
  renderTable();
}

function filterDB(db) {
  currentDB = db;
  renderTable();
}

function clearFilters() {
  currentTrack  = 'all';
  currentStatus = null;
  currentDB     = null;
  document.getElementById('search-input').value = '';
  document.getElementById('filter-year').value  = '';
  document.getElementById('filter-db').value    = '';
  document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sb-all')?.classList.add('active');
  renderTable();
}

// ── STATS & SIDEBAR COUNTS ─────────────────────────────────────────────
function updateStats() {
  const screened = records.filter(r =>
    ['retrieved', 'fulltext', 'include', 'exclude'].includes(r.status)
  ).length;

  document.getElementById('stat-identified').textContent = records.length;
  document.getElementById('stat-screened').textContent   = screened;
  document.getElementById('stat-fulltext').textContent   = records.filter(r =>
    ['fulltext', 'include', 'exclude'].includes(r.status)
  ).length;
  document.getElementById('stat-included').textContent = records.filter(r => r.status === 'include').length;
  document.getElementById('stat-excluded').textContent = records.filter(r => r.status === 'exclude').length;

  // sidebar track counts
  document.getElementById('cnt-all').textContent = records.length;
  ['T1', 'T2', 'T3', 'T4', 'TX'].forEach(t =>
    document.getElementById('cnt-' + t).textContent =
      records.filter(r => r.track === t).length
  );

  // sidebar status counts
  ['pending', 'retrieved', 'fulltext', 'include', 'exclude'].forEach(s =>
    document.getElementById('cnt-' + s).textContent =
      records.filter(r => r.status === s).length
  );

  // database sidebar list
  const dbCounts = {};
  records.forEach(r => {
    if (r.database) dbCounts[r.database] = (dbCounts[r.database] || 0) + 1;
  });
  const dbSide = document.getElementById('db-sidebar');
  dbSide.innerHTML = Object.entries(dbCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([db, n]) =>
      `<div class="sb-item" onclick="filterDB('${db.replace(/'/g, "\\'")}')">
        <span style="font-size:11.5px">${db}</span>
        <span class="sb-count">${n}</span>
      </div>`
    ).join('') ||
    '<div style="padding:6px 18px;font-size:11px;color:var(--muted)">No databases yet</div>';

  // year filter dropdown
  const years   = [...new Set(records.map(r => r.year).filter(Boolean))].sort((a, b) => b - a);
  const ySel    = document.getElementById('filter-year');
  const yCur    = ySel.value;
  ySel.innerHTML = '<option value="">All years</option>' +
    years.map(y => `<option value="${y}" ${y == yCur ? 'selected' : ''}>${y}</option>`).join('');

  // database filter dropdown
  const dbSel   = document.getElementById('filter-db');
  const dbCur   = dbSel.value;
  const allDBs  = [...new Set(records.map(r => r.database).filter(Boolean))].sort();
  dbSel.innerHTML = '<option value="">All databases</option>' +
    allDBs.map(d => `<option value="${d}" ${d === dbCur ? 'selected' : ''}>${d}</option>`).join('');
}

// ── FILTERING ─────────────────────────────────────────────────────────
function applyFilters() { renderTable(); }

function getFiltered() {
  const q  = (document.getElementById('search-input')?.value || '').toLowerCase();
  const yr = document.getElementById('filter-year')?.value  || '';
  const db = document.getElementById('filter-db')?.value    || '';

  return records.filter(r => {
    if (currentTrack  !== 'all' && r.track    !== currentTrack)  return false;
    if (currentStatus &&           r.status   !== currentStatus) return false;
    if (currentDB     &&           r.database !== currentDB)     return false;
    if (yr && String(r.year) !== yr)                             return false;
    if (db && r.database     !== db)                             return false;
    if (q) {
      const hay = [r.title, r.authors, r.notes, r.database, r.boolean].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ── TABLE RENDER ───────────────────────────────────────────────────────
function renderTable() {
  updateStats();
  const filtered = getFiltered();
  document.getElementById('filter-count').textContent =
    filtered.length + ' record' + (filtered.length !== 1 ? 's' : '');

  const tbody = document.getElementById('results-tbody');
  const empty = document.getElementById('empty-state');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(r => {
    const idx = records.indexOf(r);
    const tpSuffix = r.track === 'TX' ? 'x' : (r.track || '').slice(1);
    const tp = r.track
      ? `<span class="track-pill tp${tpSuffix}">${r.track}</span>`
      : '—';
    return `<tr>
      <td style="color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:10px">${idx + 1}</td>
      <td>${tp}</td>
      <td class="title-cell">
        <div class="title-text">${esc(r.title || '—')}</div>
        <div class="auth-cell">${esc(r.authors || '')}</div>
      </td>
      <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted)">${r.year || '—'}</td>
      <td style="font-size:11.5px;white-space:nowrap">${esc(r.database || '—')}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(r.exclusion || '')}</td>
      <td class="note-cell">${esc(r.notes || '')}</td>
      <td><div class="actions-cell">
        <button class="btn-icon" title="View detail"  onclick="openModal(${idx})">👁</button>
        <button class="btn-icon" title="Edit"         onclick="editRecord(${idx})">✏️</button>
        <button class="btn-icon" title="Delete"       onclick="deleteRecord(${idx})">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ── HELPERS ────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusBadge(s) {
  const map = {
    pending:   's-pending',
    retrieved: 's-retrieved',
    fulltext:  's-fulltext',
    include:   's-include',
    exclude:   's-exclude'
  };
  const label = STATUS_LABELS[s] || s || '—';
  return `<span class="status-badge ${map[s] || ''}">${label}</span>`;
}

// ── FORM ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-status').addEventListener('change', function () {
    document.getElementById('excl-group').style.display =
      this.value === 'exclude' ? 'block' : 'none';
  });
  renderTable();
});

function clearForm() {
  ['f-title', 'f-authors', 'f-year', 'f-doi', 'f-boolean', 'f-notes']
    .forEach(id => { document.getElementById(id).value = ''; });
  ['f-database', 'f-track', 'f-status', 'f-exclusion']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('excl-group').style.display = 'none';
  document.getElementById('form-error').style.display = 'none';
  editingId = null;
  document.querySelector('#view-form .card .card-title').textContent = 'Log a Search Result';
}

function saveEntry() {
  const title    = document.getElementById('f-title').value.trim();
  const database = document.getElementById('f-database').value;
  const track    = document.getElementById('f-track').value;
  const status   = document.getElementById('f-status').value;

  if (!title || !database || !track || !status) {
    const el = document.getElementById('form-error');
    el.textContent = 'Please fill in all required fields (*)';
    el.style.display = 'inline';
    return;
  }

  const entry = {
    id:        editingId || Date.now(),
    title,
    database,
    track,
    status,
    authors:   document.getElementById('f-authors').value.trim(),
    year:      document.getElementById('f-year').value    || null,
    doi:       document.getElementById('f-doi').value.trim(),
    boolean:   document.getElementById('f-boolean').value.trim(),
    exclusion: document.getElementById('f-exclusion').value,
    notes:     document.getElementById('f-notes').value.trim(),
    added:     editingId ? undefined : new Date().toISOString().slice(0, 10)
  };

  if (editingId) {
    const idx = records.findIndex(r => r.id === editingId);
    if (idx > -1) records[idx] = { ...records[idx], ...entry };
  } else {
    records.push(entry);
  }

  save();
  clearForm();
  showToast(editingId ? 'Entry updated' : 'Entry saved');
  setView('table');
}

function editRecord(i) {
  const r = records[i];
  editingId = r.id;
  document.getElementById('f-title').value     = r.title    || '';
  document.getElementById('f-authors').value   = r.authors  || '';
  document.getElementById('f-year').value      = r.year     || '';
  document.getElementById('f-database').value  = r.database || '';
  document.getElementById('f-track').value     = r.track    || '';
  document.getElementById('f-status').value    = r.status   || 'pending';
  document.getElementById('f-exclusion').value = r.exclusion || '';
  document.getElementById('f-doi').value       = r.doi      || '';
  document.getElementById('f-boolean').value   = r.boolean  || '';
  document.getElementById('f-notes').value     = r.notes    || '';
  document.getElementById('excl-group').style.display = r.status === 'exclude' ? 'block' : 'none';
  document.querySelector('#view-form .card .card-title').textContent = 'Edit Entry';
  setView('form');
  window.scrollTo(0, 0);
}

function deleteRecord(i) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  records.splice(i, 1);
  save();
  renderTable();
  showToast('Record deleted');
}

// ── CSV IMPORT ─────────────────────────────────────────────────────────
function importCSV() {
  const raw = document.getElementById('csv-input').value.trim();
  if (!raw) return;
  const lines  = raw.split('\n');
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  let added = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const obj = { id: Date.now() + i, added: new Date().toISOString().slice(0, 10) };
    header.forEach((h, j) => { obj[h] = cols[j]?.trim() || ''; });
    if (!obj.title) continue;
    records.push({
      id:        obj.id,
      title:     obj.title,
      authors:   obj.authors   || '',
      year:      obj.year      || null,
      database:  obj.database  || '',
      track:     obj.track     || '',
      status:    obj.status    || 'pending',
      notes:     obj.notes     || '',
      doi:       obj.doi       || '',
      boolean:   obj.boolean   || '',
      exclusion: obj.exclusion || '',
      added:     obj.added
    });
    added++;
  }
  save();
  const msg = document.getElementById('import-msg');
  msg.textContent = `${added} record(s) imported`;
  setTimeout(() => { msg.textContent = ''; }, 3000);
  renderTable();
}

// ── EXPORTS ────────────────────────────────────────────────────────────
function exportCSV() {
  const cols = ['id', 'title', 'authors', 'year', 'database', 'track',
                'status', 'exclusion', 'doi', 'boolean', 'notes', 'added'];
  const hdr  = cols.join(',');
  const rows = records.map(r =>
    cols.map(c => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',')
  );
  download('litreview_results.csv', [hdr, ...rows].join('\n'), 'text/csv');
  showToast('CSV exported');
}

function exportJSON() {
  download('litreview_backup.json', JSON.stringify(records, null, 2), 'application/json');
  showToast('JSON backup saved');
}

function exportRIS() {
  const inc = records.filter(r => r.status === 'include');
  const ris = inc.map(r => [
    'TY  - JOUR',
    `TI  - ${r.title    || ''}`,
    `AU  - ${r.authors  || ''}`,
    `PY  - ${r.year     || ''}`,
    `DO  - ${r.doi      || ''}`,
    `N1  - ${r.notes    || ''}`,
    'ER  - '
  ].join('\n')).join('\n\n');
  download('litreview_included.ris', ris, 'text/plain');
  showToast('RIS file exported (included only)');
}

function exportMarkdown() {
  const inc    = records.filter(r => r.status === 'include');
  const lines  = ['# Annotated Bibliography\n'];
  const byTrack = {};
  inc.forEach(r => { (byTrack[r.track] || (byTrack[r.track] = [])).push(r); });

  Object.entries(byTrack).forEach(([t, recs]) => {
    lines.push(`\n## ${TRACK_LABELS[t] || t}\n`);
    recs.forEach(r => {
      lines.push(`### ${r.title || 'Untitled'}`);
      if (r.authors)  lines.push(`**Authors:** ${r.authors}`);
      if (r.year)     lines.push(`**Year:** ${r.year}`);
      if (r.database) lines.push(`**Database:** ${r.database}`);
      if (r.doi)      lines.push(`**DOI:** ${r.doi}`);
      if (r.notes)    lines.push(`\n${r.notes}`);
      lines.push('');
    });
  });
  download('annotated_bibliography.md', lines.join('\n'), 'text/markdown');
  showToast('Annotated bibliography exported');
}

function exportPRISMA() {
  const n    = records.length;
  const scr  = records.filter(r => ['retrieved', 'fulltext', 'include', 'exclude'].includes(r.status)).length;
  const ft   = records.filter(r => ['fulltext', 'include', 'exclude'].includes(r.status)).length;
  const inc  = records.filter(r => r.status === 'include').length;
  const excl = records.filter(r => r.status === 'exclude').length;

  const reasons = {};
  records.filter(r => r.status === 'exclude').forEach(r => {
    reasons[r.exclusion || 'Unspecified'] = (reasons[r.exclusion || 'Unspecified'] || 0) + 1;
  });
  const rStr = Object.entries(reasons)
    .map(([k, v]) => `     - ${k}: n=${v}`).join('\n');

  const byDB = {};
  records.forEach(r => { (byDB[r.database] || (byDB[r.database] = [])).push(r); });
  const idStr = Object.entries(byDB)
    .map(([db, rs]) => `  ${db}: n=${rs.length}`).join('\n');

  const txt = `PRISMA-Inspired Flow Summary
Generated: ${new Date().toLocaleDateString('en-GB')}
=============================================

IDENTIFICATION
--------------
Records identified through database searching:
${idStr}
Total identified: n=${n}

SCREENING
---------
Records screened (title/abstract):  n=${scr}
Records excluded at screening:       n=${n - scr}

ELIGIBILITY
-----------
Full-text articles assessed:         n=${ft}
Full-text excluded:                  n=${excl}
Reasons for exclusion:
${rStr || '     (none recorded)'}

INCLUDED
--------
Studies included in synthesis:       n=${inc}

TRACK BREAKDOWN (included)
--------------------------
${['T1', 'T2', 'T3', 'T4', 'TX']
    .map(t => `  ${TRACK_LABELS[t]}: n=${records.filter(r => r.status === 'include' && r.track === t).length}`)
    .join('\n')}
`;

  document.getElementById('prisma-output').style.display = 'block';
  document.getElementById('prisma-text').textContent = txt;
}

function copyPRISMA() {
  navigator.clipboard.writeText(document.getElementById('prisma-text').textContent);
  showToast('Copied to clipboard');
}

function importJSON() {
  document.getElementById('json-file-input').click();
}

function handleJSONImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error('Not an array');
      records = data;
      save();
      renderTable();
      showToast(`${records.length} records restored`);
    } catch (err) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

// ── MODAL ──────────────────────────────────────────────────────────────
function openModal(i) {
  const r = records[i];
  document.getElementById('modal-title').textContent = r.title || '—';
  document.getElementById('modal-grid').innerHTML = `
    <div class="modal-field"><label>Track</label><p>${TRACK_LABELS[r.track] || r.track || '—'}</p></div>
    <div class="modal-field"><label>Status</label><p>${statusBadge(r.status)}</p></div>
    <div class="modal-field"><label>Authors</label><p>${esc(r.authors || '—')}</p></div>
    <div class="modal-field"><label>Year</label><p>${r.year || '—'}</p></div>
    <div class="modal-field"><label>Database</label><p>${esc(r.database || '—')}</p></div>
    <div class="modal-field"><label>Added</label><p>${r.added || '—'}</p></div>
    ${r.exclusion ? `<div class="modal-field"><label>Exclusion Reason</label><p>${esc(r.exclusion)}</p></div>` : ''}
    ${r.doi       ? `<div class="modal-field"><label>DOI / URL</label><p><a href="${esc(r.doi)}" target="_blank" style="color:var(--t2)">${esc(r.doi)}</a></p></div>` : ''}
    ${r.boolean   ? `<div class="modal-field modal-fullspan"><label>Boolean String Used</label><p style="font-family:'IBM Plex Mono',monospace;font-size:11px;line-height:1.6">${esc(r.boolean)}</p></div>` : ''}
    ${r.notes     ? `<div class="modal-field modal-fullspan"><label>Notes</label><p style="line-height:1.65">${esc(r.notes)}</p></div>` : ''}
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn-primary" onclick="editRecord(${i}); document.getElementById('modal').classList.remove('open')">Edit</button>
    <button class="btn-small"   onclick="document.getElementById('modal').classList.remove('open')">Close</button>
  `;
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) {
  if (e.target === document.getElementById('modal')) {
    document.getElementById('modal').classList.remove('open');
  }
}

// ── TOAST ──────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
