/* =============================================================
   Inventory Management System — Prototype
   Plain HTML + CSS + JavaScript. No server needed.
   All data is saved in the browser using localStorage.
   ============================================================= */
'use strict';

/* ---------------- 1. STORAGE ---------------- */
const DATA_KEY = 'ims_data_v1';   // all business data
const SESSION_KEY = 'ims_user';   // logged-in user id (cleared when tab closes)
const memoryStore = {};           // fallback if the browser blocks storage

function readStore(area, key) {
  try { return window[area].getItem(key); } catch (e) { return memoryStore[area + key] ?? null; }
}
function writeStore(area, key, value) {
  try { window[area].setItem(key, value); } catch (e) { memoryStore[area + key] = value; }
}
function removeStore(area, key) {
  try { window[area].removeItem(key); } catch (e) { delete memoryStore[area + key]; }
}

let db = null; // { users, products, suppliers, movements, seq }

function loadData() {
  const raw = readStore('localStorage', DATA_KEY);
  if (raw) {
    try { db = JSON.parse(raw); return; } catch (e) { /* corrupted → reseed */ }
  }
  seedData();
}
function saveData() {
  writeStore('localStorage', DATA_KEY, JSON.stringify(db));
}
function nextId(kind) {
  db.seq[kind] = (db.seq[kind] || 0) + 1;
  return db.seq[kind];
}

/* ---------------- 2. SMALL HELPERS ---------------- */
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toDateStr(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); };
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const isWholeNumber = v => /^\d+$/.test(String(v));
const isPositiveInt = v => isWholeNumber(v) && Number(v) > 0;

// Simple password hash (cyrb53). Fine for a prototype – a real system would hash on a server.
function hashPassword(username, password) {
  const str = username.toLowerCase() + ':' + password;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const productById = id => db.products.find(p => p.id === Number(id));
const supplierById = id => db.suppliers.find(s => s.id === Number(id));
const userById = id => db.users.find(u => u.id === Number(id));
const activeProducts = () => db.products.filter(p => p.active);
const newestFirst = list => [...list].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || b.id - a.id);
const isLow = p => p.active && p.quantity <= p.reorderLevel;

/* ---------------- 3. STOCK MOVEMENTS (core logic) ----------------
   Every stock change (IN = purchase, OUT = sale, ADJ = adjustment)
   goes through this one function. The product quantity and the
   history record are saved together in ONE write, so they never
   get out of sync (SRS reliability requirement). */
function recordMovement(m) {
  const product = productById(m.productId);
  if (!product) throw new Error('Product not found');
  const newQty = product.quantity + m.change;
  if (newQty < 0) throw new Error('Not enough stock');
  product.quantity = newQty;
  db.movements.push({ id: nextId('movement'), time: nowTime(), ...m, balance: newQty });
  saveData();
  return product;
}

/* ---------------- 4. DEMO DATA ---------------- */
function seedData() {
  db = { users: [], products: [], suppliers: [], movements: [], seq: {} };

  [['admin', 'admin123', 'admin', 'Administrator'],
   ['staff', 'staff123', 'staff', 'Store Staff']].forEach(([username, pw, role, name]) =>
    db.users.push({ id: nextId('user'), username, name, role, active: true, passwordHash: hashPassword(username, pw) }));

  [['Sai Stationery Suppliers', 'Ramesh K', '9876543210', 'sai.stationery@example.com', 'Main Road, Guntur'],
   ['Krishna Paper Mart', 'Suresh P', '9123456780', 'krishnapaper@example.com', 'Brodipet, Guntur'],
   ['Lakshmi Traders', 'Lakshmi N', '9988776655', 'lakshmitraders@example.com', 'Vijayawada']]
    .forEach(([name, contact, phone, email, address]) =>
      db.suppliers.push({ id: nextId('supplier'), name, contact, phone, email, address }));

  // [SKU, name, category, unit, price, reorder level, opening stock, supplier id]
  const products = [
    ['NB-001', 'Notebook 200 pages', 'Notebooks', 'pcs', 60, 20, 120, 1],
    ['NB-002', 'Long notebook 100 pages', 'Notebooks', 'pcs', 40, 25, 90, 1],
    ['PN-001', 'Blue ball pen', 'Pens', 'pcs', 10, 50, 300, 3],
    ['PN-002', 'Black gel pen', 'Pens', 'pcs', 15, 40, 150, 3],
    ['PN-003', 'Permanent marker', 'Pens', 'pcs', 30, 10, 12, 3],
    ['PC-001', 'HB pencil', 'Pencils', 'pcs', 5, 50, 250, 1],
    ['PC-002', 'Eraser', 'Pencils', 'pcs', 5, 30, 150, 1],
    ['PP-001', 'A4 paper (500 sheets)', 'Paper', 'ream', 280, 5, 20, 2],
    ['PP-002', 'Chart paper', 'Paper', 'pcs', 10, 20, 15, 2],
    ['AC-001', 'Geometry box', 'Accessories', 'pcs', 120, 8, 30, 3],
    ['AC-002', 'Stapler', 'Accessories', 'pcs', 90, 5, 6, 3],
    ['AC-003', 'Glue stick', 'Accessories', 'pcs', 25, 15, 40, 1],
  ];
  products.forEach(([sku, name, category, unit, price, reorderLevel, opening, supplierId]) => {
    const p = { id: nextId('product'), sku, name, category, unit, price, reorderLevel, quantity: 0, active: true };
    db.products.push(p);
    recordMovement({ type: 'IN', productId: p.id, change: opening, supplierId, unitCost: Math.round(price * 0.7 * 100) / 100,
      reference: 'OPEN-' + sku, date: daysAgo(14), time: '10:00', userId: 1 });
  });

  // Some sales over the last two weeks: [SKU, qty, days ago]
  [['NB-001', 25, 12], ['PN-001', 60, 11], ['PC-001', 40, 10], ['PN-002', 30, 9], ['NB-002', 20, 8],
   ['PN-003', 5, 7], ['AC-002', 2, 6], ['PP-001', 6, 5], ['PP-002', 3, 4], ['AC-001', 10, 3],
   ['NB-001', 15, 2], ['PN-001', 45, 1], ['AC-003', 12, 1], ['PC-002', 20, 0]]
    .forEach(([sku, qty, ago], i) => {
      const p = db.products.find(x => x.sku === sku);
      recordMovement({ type: 'OUT', productId: p.id, change: -qty, unitPrice: p.price,
        reference: 'INV-' + (1001 + i), date: daysAgo(ago), time: `${pad(11 + (i % 7))}:15`, userId: 2 });
    });

  // One restock and one adjustment
  recordMovement({ type: 'IN', productId: 1, change: 50, supplierId: 1, unitCost: 42, reference: 'BILL-552', date: daysAgo(1), time: '09:30', userId: 2 });
  recordMovement({ type: 'ADJ', productId: 7, change: -3, reason: 'Damaged items found during stock check', date: daysAgo(0), time: '09:00', userId: 1 });

  saveData();
}

/* ---------------- 5. SESSION ---------------- */
function currentUser() {
  const id = readStore('sessionStorage', SESSION_KEY);
  const u = id && userById(id);
  return u && u.active ? u : null;
}
const isAdmin = () => currentUser()?.role === 'admin';

/* ---------------- 6. UI BUILDING BLOCKS ---------------- */
function field(label, name, value = '', o = {}) {
  const id = 'f_' + name;
  const attrs = [
    o.type && !['select', 'textarea'].includes(o.type) ? `type="${o.type}"` : 'type="text"',
    o.step != null ? `step="${o.step}"` : '', o.min != null ? `min="${o.min}"` : '', o.max != null ? `max="${o.max}"` : '',
    o.placeholder ? `placeholder="${esc(o.placeholder)}"` : '', o.list ? `list="${o.list}"` : '',
    o.autocomplete ? `autocomplete="${o.autocomplete}"` : '',
  ].join(' ');
  let input;
  if (o.type === 'select') {
    input = `<select id="${id}" name="${name}">${o.options.map(([v, t]) =>
      `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  } else if (o.type === 'textarea') {
    input = `<textarea id="${id}" name="${name}" rows="3" placeholder="${esc(o.placeholder || '')}">${esc(value)}</textarea>`;
  } else {
    input = `<input id="${id}" name="${name}" ${attrs} value="${esc(value)}">`;
  }
  return `<div class="field">
    <label for="${id}">${esc(label)}${o.required ? ' <span class="req">*</span>' : ''}</label>
    ${input}
    ${o.help ? `<small class="help" id="${id}_help">${o.help}</small>` : ''}
    <small class="err" data-err="${name}"></small>
  </div>`;
}

function formData(form) {
  const out = {};
  new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
  return out;
}

// Shows each error message under its field. Returns true if there were errors.
function showErrors(form, errors) {
  form.querySelectorAll('.err').forEach(e => { e.textContent = ''; });
  form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
  const keys = Object.keys(errors || {});
  keys.forEach(k => {
    const msg = form.querySelector(`[data-err="${k}"]`);
    if (msg) msg.textContent = errors[k];
    const input = form.querySelector(`[name="${k}"]`);
    if (input) input.classList.add('invalid');
  });
  if (keys.length) form.querySelector(`[name="${keys[0]}"]`)?.focus();
  return keys.length > 0;
}

function table(headers, rows, opts = {}) {
  const numCols = opts.numCols || [];
  const th = headers.map((h, i) => `<th class="${numCols.includes(i) ? 'num' : ''}">${h}</th>`).join('');
  const body = rows.length
    ? rows.map(r => `<tr>${r.map((c, i) => `<td class="${numCols.includes(i) ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="empty">${opts.empty || 'No records found.'}</td></tr>`;
  const foot = opts.foot ? `<tfoot><tr>${opts.foot.map((c, i) => `<td class="${numCols.includes(i) ? 'num' : ''}">${c}</td>`).join('')}</tr></tfoot>` : '';
  return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
}

const typeBadge = t => ({ IN: '<span class="pill in">Stock In</span>', OUT: '<span class="pill out">Sale</span>', ADJ: '<span class="pill adj">Adjust</span>' }[t]);
const typeName = t => ({ IN: 'Stock In', OUT: 'Sale', ADJ: 'Adjustment' }[t]);
const signed = n => `<span class="chg ${n > 0 ? 'pos' : 'neg'}">${n > 0 ? '+' : ''}${n}</span>`;
const stat = (label, value, cls = '') => `<div class="stat ${cls}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
const statusPill = p => !p.active ? '<span class="pill off">Inactive</span>'
  : isLow(p) ? '<span class="pill warn">Low stock</span>' : '<span class="pill ok">In stock</span>';

let toastTimer;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function openModal(title, bodyHtml, onSubmit, submitText = 'Save') {
  const root = $('#modal-root');
  root.innerHTML = `<div class="overlay"><form class="modal" novalidate>
    <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="x" aria-label="Close">×</button></div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">${submitText}</button></div>
  </form></div>`;
  const form = root.querySelector('form');
  const close = () => { root.innerHTML = ''; };
  root.querySelectorAll('.x, [data-close]').forEach(b => { b.onclick = close; });
  root.querySelector('.overlay').onclick = e => { if (e.target.classList.contains('overlay')) close(); };
  form.onsubmit = e => {
    e.preventDefault();
    const errors = onSubmit(formData(form));
    if (errors && showErrors(form, errors)) return;
    close();
  };
  form.querySelector('input, select, textarea')?.focus();
}

// In-page Yes/Cancel box (used instead of the browser's confirm())
function confirmDialog(title, messageHtml, yesText, onYes) {
  openModal(title, `<p>${messageHtml}</p>`, () => { onYes(); }, yesText);
  $('#modal-root .modal-foot .primary').classList.add('danger');
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function downloadCSV(filename, headers, rows) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  downloadFile(filename, '﻿' + csv, 'text/csv;charset=utf-8'); // BOM so Excel shows ₹ correctly
}

/* ---------------- 7. LOGIN ---------------- */
function renderLogin() {
  document.title = 'Sign in · Inventory Management System';
  $('#app').innerHTML = `<div class="login-wrap">
    <form class="card login-card" id="loginForm" novalidate>
      <span class="logo">IMS</span>
      <h1>Inventory Management System</h1>
      <p class="muted">Sign in to continue</p>
      ${field('Username', 'username', '', { autocomplete: 'username' })}
      ${field('Password', 'password', '', { type: 'password', autocomplete: 'current-password' })}
      <div class="form-error" id="loginError"></div>
      <button class="btn primary block">Sign in</button>
      <p class="hint">Demo logins: <b>admin</b> / admin123 &nbsp;·&nbsp; <b>staff</b> / staff123</p>
    </form></div>`;

  $('#loginForm').onsubmit = e => {
    e.preventDefault();
    const f = formData(e.target);
    $('#loginError').textContent = '';
    const errors = {};
    if (!f.username) errors.username = 'Enter your username';
    if (!f.password) errors.password = 'Enter your password';
    if (showErrors(e.target, errors)) return;

    const u = db.users.find(x => x.username.toLowerCase() === f.username.toLowerCase());
    if (!u || u.passwordHash !== hashPassword(u.username, f.password)) {
      $('#loginError').textContent = 'Invalid username or password.';
      return;
    }
    if (!u.active) { $('#loginError').textContent = 'This account has been deactivated. Contact the administrator.'; return; }
    writeStore('sessionStorage', SESSION_KEY, String(u.id));
    if (location.hash === '#/dashboard') router(); else location.hash = '#/dashboard';
  };
}

/* ---------------- 8. LAYOUT & ROUTER ---------------- */
// [route, label, adminOnly, section]
const NAV = [
  ['dashboard', 'Dashboard', false, 'Overview'],
  ['products', 'Products', false, 'Records'],
  ['suppliers', 'Suppliers', false, 'Records'],
  ['stockin', 'Stock In (Purchase)', false, 'Transactions'],
  ['stockout', 'Stock Out (Sale)', false, 'Transactions'],
  ['adjust', 'Stock Adjustment', true, 'Transactions'],
  ['reports', 'Reports', false, 'Reports'],
  ['users', 'Users', true, 'Admin'],
  ['backup', 'Backup & Restore', true, 'Admin'],
];

let view; // the main content element

function renderShell(route) {
  const u = currentUser();
  let lastSection = '';
  const links = NAV.filter(n => !n[2] || isAdmin()).map(([r, label, , section]) => {
    const head = section !== lastSection ? `<div class="nav-label">${section}</div>` : '';
    lastSection = section;
    return `${head}<a href="#/${r}" class="${r === route ? 'active' : ''}">${label}</a>`;
  }).join('');

  $('#app').innerHTML = `<div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="logo">IMS</span><span>Inventory</span></div>
      <nav>${links}</nav>
      <div class="userbox">
        <div><strong>${esc(u.name)}</strong><span class="badge ${u.role}">${u.role}</span></div>
        <button class="btn small" id="logoutBtn">Log out</button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar"><button class="menu-btn" id="menuBtn" aria-label="Open menu">☰</button><h2 id="pageTitle"></h2></header>
      <section class="view" id="view"></section>
    </div>
  </div>`;
  view = $('#view');

  $('#logoutBtn').onclick = () => { removeStore('sessionStorage', SESSION_KEY); location.hash = ''; renderLogin(); };
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#sidebar nav').onclick = () => $('#sidebar').classList.remove('open');
}

function setTitle(t) {
  $('#pageTitle').textContent = t;
  document.title = t + ' · Inventory Management System';
}

const VIEWS = {
  dashboard: viewDashboard, products: viewProducts, suppliers: viewSuppliers,
  stockin: viewStockIn, stockout: viewStockOut, adjust: viewAdjust,
  reports: viewReports, users: viewUsers, backup: viewBackup,
};

function router() {
  $('#modal-root').innerHTML = '';
  if (!currentUser()) { renderLogin(); return; }
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  let route = path || 'dashboard';
  const nav = NAV.find(n => n[0] === route);
  if (!nav) route = 'dashboard';
  else if (nav[2] && !isAdmin()) { route = 'dashboard'; setTimeout(() => toast('Only the administrator can open that page.', 'error'), 50); }
  renderShell(route);
  VIEWS[route](params);
  window.scrollTo(0, 0);
}

/* ---------------- 9. DASHBOARD ---------------- */
function viewDashboard() {
  setTitle('Dashboard');
  const active = activeProducts();
  const low = active.filter(isLow);
  const units = active.reduce((s, p) => s + p.quantity, 0);
  const value = active.reduce((s, p) => s + p.quantity * p.price, 0);
  const recent = newestFirst(db.movements).slice(0, 8);

  view.innerHTML = `
    <div class="stats">
      ${stat('Active products', active.length)}
      ${stat('Low stock items', low.length, low.length ? 'warn' : '')}
      ${stat('Units in stock', units.toLocaleString('en-IN'))}
      ${stat('Stock value (selling price)', money(value))}
    </div>
    <div class="quick">
      <a class="btn primary" href="#/stockin">+ Stock In</a>
      <a class="btn primary" href="#/stockout">+ Record Sale</a>
      ${isAdmin() ? '<a class="btn" href="#/products?add=1">+ New Product</a>' : ''}
      <a class="btn" href="#/reports">View Reports</a>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card-head"><h3>⚠ Low stock alerts</h3><a href="#/reports?type=low">Full report</a></div>
        ${low.length ? table(['SKU', 'Product', 'Stock', 'Reorder at'],
          low.map(p => [esc(p.sku), esc(p.name), `<span class="qty low">${p.quantity}</span>`, p.reorderLevel]), { numCols: [2, 3] })
          : '<p class="empty">All products are above their reorder level.</p>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>Recent stock movements</h3><a href="#/reports">All history</a></div>
        ${table(['Date', 'Product', 'Type', 'Qty', 'By'],
          recent.map(m => [m.date, esc(productById(m.productId)?.name), typeBadge(m.type), signed(m.change), esc(userById(m.userId)?.username)]),
          { numCols: [3], empty: 'No movements yet.' })}
      </div>
    </div>`;
}

/* ---------------- 10. PRODUCTS ---------------- */
function viewProducts(params = {}) {
  setTitle('Products');
  const cats = [...new Set(db.products.map(p => p.category))].sort();
  view.innerHTML = `
    <div class="toolbar">
      <input id="q" type="search" placeholder="Search by name or SKU…" aria-label="Search products">
      <select id="cat" aria-label="Category"><option value="">All categories</option>${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <select id="status" aria-label="Status"><option value="active">Active</option><option value="low">Low stock</option><option value="inactive">Inactive</option><option value="">All</option></select>
      ${isAdmin() ? '<button class="btn primary" id="addBtn">+ Add product</button>' : ''}
    </div>
    <div class="card" id="list"></div>
    ${isAdmin() ? '' : '<p class="note">You have view-only access. Ask the administrator to add or edit products.</p>'}`;

  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), cat = $('#cat').value, st = $('#status').value;
    const rows = db.products.filter(p =>
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
      (!cat || p.category === cat) &&
      (st === '' || (st === 'active' && p.active) || (st === 'inactive' && !p.active) || (st === 'low' && isLow(p))));
    const headers = ['SKU', 'Name', 'Category', 'Unit', 'Price', 'Stock', 'Reorder', 'Status'];
    if (isAdmin()) headers.push('');
    $('#list').innerHTML = table(headers, rows.map(p => {
      const r = [`<strong>${esc(p.sku)}</strong>`, esc(p.name), esc(p.category), esc(p.unit), money(p.price),
        `<span class="qty ${isLow(p) ? 'low' : ''}">${p.quantity}</span>`, p.reorderLevel, statusPill(p)];
      if (isAdmin()) r.push(`<div class="actions"><button class="btn small" data-edit="${p.id}">Edit</button>
        <button class="btn small ${p.active ? 'danger-outline' : ''}" data-toggle="${p.id}">${p.active ? 'Deactivate' : 'Activate'}</button></div>`);
      return r;
    }), { numCols: [4, 5, 6], empty: 'No products match your search.' });
  };
  ['q', 'cat', 'status'].forEach(id => $('#' + id).addEventListener('input', draw));
  draw();

  $('#list').onclick = e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.edit) productForm(productById(btn.dataset.edit), draw);
    if (btn.dataset.toggle) {
      const p = productById(btn.dataset.toggle);
      p.active = !p.active;
      saveData();
      toast(`${p.name} ${p.active ? 'activated' : 'deactivated'}.`);
      draw();
    }
  };
  if (isAdmin()) {
    $('#addBtn').onclick = () => productForm(null, () => viewProducts());
    if (params.add) productForm(null, () => viewProducts());
  }
}

function productForm(p, onSaved) {
  const cats = [...new Set(db.products.map(x => x.category))];
  openModal(p ? 'Edit product' : 'Add product', `
    <div class="row2">
      ${field('SKU', 'sku', p?.sku, { required: true, placeholder: 'e.g. PN-004' })}
      ${field('Product name', 'name', p?.name, { required: true })}
    </div>
    <div class="row2">
      ${field('Category', 'category', p?.category, { required: true, list: 'catlist', placeholder: 'Choose or type new' })}
      ${field('Unit', 'unit', p?.unit || 'pcs', { required: true, placeholder: 'pcs, box, ream…' })}
    </div>
    <div class="row2">
      ${field('Selling price (₹)', 'price', p?.price ?? '', { type: 'number', step: '0.01', min: 0, required: true })}
      ${field('Reorder level', 'reorderLevel', p?.reorderLevel ?? '', { type: 'number', step: 1, min: 0, required: true,
        help: 'Alert shows when stock reaches this number.' })}
    </div>
    <datalist id="catlist">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    ${p ? `<p class="note">Current stock: <b>${p.quantity}</b>. To change stock use Stock In, Sale or Adjustment.</p>`
        : '<p class="note">New products start with 0 stock. Use <b>Stock In</b> to add quantity.</p>'}`,
  f => {
    const errors = {};
    if (!f.sku) errors.sku = 'SKU is required';
    else if (!/^[A-Za-z0-9-]{2,20}$/.test(f.sku)) errors.sku = 'Use 2–20 letters, numbers or "-"';
    else if (db.products.some(x => x.sku.toLowerCase() === f.sku.toLowerCase() && x.id !== p?.id)) errors.sku = 'This SKU already exists';
    if (!f.name) errors.name = 'Product name is required';
    if (!f.category) errors.category = 'Category is required';
    if (!f.unit) errors.unit = 'Unit is required';
    if (f.price === '' || isNaN(f.price) || Number(f.price) < 0) errors.price = 'Enter a price of 0 or more';
    if (!isWholeNumber(f.reorderLevel)) errors.reorderLevel = 'Enter a whole number (0 or more)';
    if (Object.keys(errors).length) return errors;

    const data = { sku: f.sku.toUpperCase(), name: f.name, category: f.category, unit: f.unit,
      price: Math.round(Number(f.price) * 100) / 100, reorderLevel: Number(f.reorderLevel) };
    if (p) Object.assign(p, data);
    else db.products.push({ id: nextId('product'), ...data, quantity: 0, active: true });
    saveData();
    toast(p ? 'Product updated.' : 'Product added.');
    onSaved();
  });
}

/* ---------------- 11. SUPPLIERS ---------------- */
function viewSuppliers() {
  setTitle('Suppliers');
  view.innerHTML = `
    <div class="toolbar">
      <input id="q" type="search" placeholder="Search supplier name, contact or phone…" aria-label="Search suppliers">
      ${isAdmin() ? '<button class="btn primary" id="addBtn">+ Add supplier</button>' : ''}
    </div>
    <div class="card" id="list"></div>`;

  const draw = () => {
    const q = $('#q').value.trim().toLowerCase();
    const rows = db.suppliers.filter(s => !q || [s.name, s.contact, s.phone].some(v => (v || '').toLowerCase().includes(q)));
    const headers = ['Supplier', 'Contact person', 'Phone', 'Email', 'Address', 'Receipts'];
    if (isAdmin()) headers.push('');
    $('#list').innerHTML = table(headers, rows.map(s => {
      const r = [`<strong>${esc(s.name)}</strong>`, esc(s.contact), esc(s.phone), esc(s.email), esc(s.address),
        db.movements.filter(m => m.supplierId === s.id).length];
      if (isAdmin()) r.push(`<div class="actions"><button class="btn small" data-edit="${s.id}">Edit</button></div>`);
      return r;
    }), { numCols: [5], empty: 'No suppliers found.' });
  };
  $('#q').addEventListener('input', draw);
  draw();
  $('#list').onclick = e => {
    const btn = e.target.closest('[data-edit]');
    if (btn) supplierForm(supplierById(btn.dataset.edit), draw);
  };
  if (isAdmin()) $('#addBtn').onclick = () => supplierForm(null, draw);
}

function supplierForm(s, onSaved) {
  openModal(s ? 'Edit supplier' : 'Add supplier', `
    ${field('Supplier name', 'name', s?.name, { required: true })}
    <div class="row2">
      ${field('Contact person', 'contact', s?.contact)}
      ${field('Phone', 'phone', s?.phone, { type: 'tel', placeholder: '10-digit mobile' })}
    </div>
    ${field('Email', 'email', s?.email, { type: 'email' })}
    ${field('Address', 'address', s?.address, { type: 'textarea' })}`,
  f => {
    const errors = {};
    if (!f.name) errors.name = 'Supplier name is required';
    else if (db.suppliers.some(x => x.name.toLowerCase() === f.name.toLowerCase() && x.id !== s?.id)) errors.name = 'A supplier with this name already exists';
    if (f.phone && !/^[0-9+\-\s]{7,15}$/.test(f.phone)) errors.phone = 'Enter a valid phone number';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.email = 'Enter a valid email address';
    if (Object.keys(errors).length) return errors;
    const data = { name: f.name, contact: f.contact, phone: f.phone, email: f.email, address: f.address };
    if (s) Object.assign(s, data); else db.suppliers.push({ id: nextId('supplier'), ...data });
    saveData();
    toast(s ? 'Supplier updated.' : 'Supplier added.');
    onSaved();
  });
}

/* ---------------- 12. STOCK IN / OUT / ADJUST ---------------- */
const productOptions = () => [['', '— Select product —'],
  ...activeProducts().map(p => [p.id, `${p.sku} — ${p.name} (stock: ${p.quantity})`])];

function recentMovementsTable(type) {
  const list = newestFirst(db.movements.filter(m => m.type === type)).slice(0, 8);
  const extra = type === 'IN' ? 'Supplier' : type === 'OUT' ? 'Reference' : 'Reason';
  return table(['Date', 'Product', 'Qty', extra, 'By'], list.map(m => [
    m.date, esc(productById(m.productId)?.name), signed(m.change),
    esc(type === 'IN' ? supplierById(m.supplierId)?.name : type === 'OUT' ? m.reference : m.reason),
    esc(userById(m.userId)?.username)]), { numCols: [2], empty: 'Nothing recorded yet.' });
}

function validateDate(f, errors) {
  if (!f.date) errors.date = 'Date is required';
  else if (f.date > today()) errors.date = 'Date cannot be in the future';
}

function viewStockIn() {
  setTitle('Stock In (Purchase)');
  if (!db.suppliers.length) { view.innerHTML = '<div class="card"><p class="empty">Add a supplier first.</p></div>'; return; }
  view.innerHTML = `<div class="grid2 form-grid">
    <form class="card" id="f" novalidate>
      <h3>Record stock received</h3>
      ${field('Product', 'productId', '', { type: 'select', required: true, options: productOptions() })}
      ${field('Supplier', 'supplierId', '', { type: 'select', required: true, options: [['', '— Select supplier —'], ...db.suppliers.map(s => [s.id, s.name])] })}
      <div class="row2">
        ${field('Quantity received', 'qty', '', { type: 'number', min: 1, step: 1, required: true })}
        ${field('Unit cost (₹)', 'unitCost', '', { type: 'number', min: 0, step: '0.01', required: true })}
      </div>
      <div class="row2">
        ${field('Date', 'date', today(), { type: 'date', required: true, max: today() })}
        ${field('Bill / reference no.', 'reference', '', { placeholder: 'Optional' })}
      </div>
      <div class="total" id="total"></div>
      <button class="btn primary block">Save stock in</button>
    </form>
    <div class="card"><h3>Recent stock in</h3>${recentMovementsTable('IN')}</div>
  </div>`;

  const form = $('#f');
  form.oninput = () => {
    const f = formData(form);
    const p = productById(f.productId);
    $('#total').innerHTML = p && isPositiveInt(f.qty)
      ? `New stock will be <b>${p.quantity + Number(f.qty)} ${esc(p.unit)}</b>${f.unitCost !== '' ? ` · Total cost <b>${money(Number(f.qty) * Number(f.unitCost))}</b>` : ''}` : '';
  };
  form.onsubmit = e => {
    e.preventDefault();
    const f = formData(form), errors = {};
    if (!productById(f.productId)) errors.productId = 'Select a product';
    if (!supplierById(f.supplierId)) errors.supplierId = 'Select a supplier';
    if (!isPositiveInt(f.qty)) errors.qty = 'Enter a whole number greater than 0';
    if (f.unitCost === '' || isNaN(f.unitCost) || Number(f.unitCost) < 0) errors.unitCost = 'Enter a cost of 0 or more';
    validateDate(f, errors);
    if (showErrors(form, errors)) return;
    const p = recordMovement({ type: 'IN', productId: Number(f.productId), change: Number(f.qty), supplierId: Number(f.supplierId),
      unitCost: Number(f.unitCost), reference: f.reference, date: f.date, userId: currentUser().id });
    toast(`Saved. ${p.name} stock is now ${p.quantity} ${p.unit}.`);
    viewStockIn();
  };
}

function viewStockOut() {
  setTitle('Stock Out (Sale)');
  view.innerHTML = `<div class="grid2 form-grid">
    <form class="card" id="f" novalidate>
      <h3>Record a sale / issue</h3>
      ${field('Product', 'productId', '', { type: 'select', required: true, options: productOptions(), help: 'Select a product to see available stock.' })}
      <div class="row2">
        ${field('Quantity sold', 'qty', '', { type: 'number', min: 1, step: 1, required: true })}
        ${field('Date', 'date', today(), { type: 'date', required: true, max: today() })}
      </div>
      ${field('Invoice / reference no.', 'reference', '', { placeholder: 'Optional' })}
      <div class="total" id="total"></div>
      <button class="btn primary block">Save sale</button>
    </form>
    <div class="card"><h3>Recent sales</h3>${recentMovementsTable('OUT')}</div>
  </div>`;

  const form = $('#f');
  form.oninput = () => {
    const f = formData(form);
    const p = productById(f.productId);
    $('#f_productId_help').innerHTML = p
      ? `Available: <b class="${isLow(p) ? 'qty low' : ''}">${p.quantity} ${esc(p.unit)}</b> · Price ${money(p.price)}`
      : 'Select a product to see available stock.';
    $('#total').innerHTML = p && isPositiveInt(f.qty)
      ? (Number(f.qty) > p.quantity ? `<span class="qty low">Only ${p.quantity} available.</span>`
        : `Sale amount <b>${money(Number(f.qty) * p.price)}</b> · Stock after sale <b>${p.quantity - Number(f.qty)}</b>`) : '';
  };
  form.onsubmit = e => {
    e.preventDefault();
    const f = formData(form), errors = {};
    const p = productById(f.productId);
    if (!p) errors.productId = 'Select a product';
    if (!isPositiveInt(f.qty)) errors.qty = 'Enter a whole number greater than 0';
    else if (p && Number(f.qty) > p.quantity) errors.qty = `Not enough stock. Only ${p.quantity} ${p.unit} available.`;
    validateDate(f, errors);
    if (showErrors(form, errors)) return;
    recordMovement({ type: 'OUT', productId: p.id, change: -Number(f.qty), unitPrice: p.price,
      reference: f.reference, date: f.date, userId: currentUser().id });
    toast(isLow(p) ? `Sale saved. ⚠ ${p.name} is now low (${p.quantity} left).` : `Sale saved. ${p.name}: ${p.quantity} left.`);
    viewStockOut();
  };
}

function viewAdjust() {
  setTitle('Stock Adjustment');
  view.innerHTML = `<div class="grid2 form-grid">
    <form class="card" id="f" novalidate>
      <h3>Correct stock quantity</h3>
      <p class="note">Use this for damaged, lost or miscounted items. Every adjustment is saved with your name and reason.</p>
      ${field('Product', 'productId', '', { type: 'select', required: true, options: productOptions() })}
      <div class="row2">
        ${field('Quantity change', 'change', '', { type: 'number', step: 1, required: true, help: 'Use minus for a decrease, e.g. -3' })}
        ${field('Date', 'date', today(), { type: 'date', required: true, max: today() })}
      </div>
      ${field('Reason', 'reason', '', { type: 'textarea', required: true, placeholder: 'e.g. 3 pieces damaged in storage' })}
      <div class="total" id="total"></div>
      <button class="btn primary block">Save adjustment</button>
    </form>
    <div class="card"><h3>Adjustment history</h3>${recentMovementsTable('ADJ')}</div>
  </div>`;

  const form = $('#f');
  form.oninput = () => {
    const f = formData(form);
    const p = productById(f.productId);
    const n = Number(f.change);
    $('#total').innerHTML = p && /^-?\d+$/.test(f.change) && n !== 0
      ? `Stock will change from <b>${p.quantity}</b> to <b class="${p.quantity + n < 0 ? 'qty low' : ''}">${p.quantity + n}</b>` : '';
  };
  form.onsubmit = e => {
    e.preventDefault();
    const f = formData(form), errors = {};
    const p = productById(f.productId);
    if (!p) errors.productId = 'Select a product';
    if (!/^-?\d+$/.test(f.change) || Number(f.change) === 0) errors.change = 'Enter a whole number that is not 0';
    else if (p && p.quantity + Number(f.change) < 0) errors.change = `Stock cannot go below 0 (current: ${p.quantity})`;
    if (!f.reason || f.reason.length < 5) errors.reason = 'Please explain the reason (at least 5 characters)';
    validateDate(f, errors);
    if (showErrors(form, errors)) return;
    recordMovement({ type: 'ADJ', productId: p.id, change: Number(f.change), reason: f.reason, date: f.date, userId: currentUser().id });
    toast(`Adjustment saved. ${p.name} stock is now ${p.quantity}.`);
    viewAdjust();
  };
}

/* ---------------- 13. REPORTS ---------------- */
function viewReports(params = {}) {
  setTitle('Reports');
  const type = ['movements', 'stock', 'low'].includes(params.type) ? params.type : 'movements';
  view.innerHTML = `<div class="tabs">
      ${[['movements', 'Movement history'], ['stock', 'Stock on hand'], ['low', 'Low stock']]
        .map(([k, t]) => `<a href="#/reports?type=${k}" class="${k === type ? 'active' : ''}">${t}</a>`).join('')}
    </div><div id="rep"></div>`;
  ({ movements: reportMovements, stock: reportStock, low: reportLow })[type]();
}

const printHead = (title, sub) => `<div class="print-head"><h2>Inventory Management System — ${esc(title)}</h2>
  <div class="muted">${esc(sub)} · Printed ${today()} by ${esc(currentUser().username)}</div></div>`;
const reportButtons = `<div class="toolbar no-print"><span class="spacer"></span>
  <button class="btn" id="csvBtn">Export CSV</button><button class="btn" id="printBtn">Print</button></div>`;

function reportMovements() {
  const rep = $('#rep');
  rep.innerHTML = `
    <form class="card no-print" id="filters" novalidate>
      <div class="filters">
        ${field('From', 'from', daysAgo(30), { type: 'date' })}
        ${field('To', 'to', today(), { type: 'date' })}
        ${field('Product', 'productId', '', { type: 'select', options: [['', 'All products'], ...db.products.map(p => [p.id, `${p.sku} — ${p.name}`])] })}
        ${field('Type', 'type', '', { type: 'select', options: [['', 'All types'], ['IN', 'Stock In'], ['OUT', 'Sale'], ['ADJ', 'Adjustment']] })}
        <button class="btn primary">Apply</button>
      </div>
    </form>
    <div id="out"></div>`;

  const form = $('#filters');
  const run = () => {
    const f = formData(form), errors = {};
    if (!f.from) errors.from = 'Required';
    if (!f.to) errors.to = 'Required';
    if (f.from && f.to && f.from > f.to) errors.to = '"To" date must be on or after "From" date';
    if (showErrors(form, errors)) return;

    const list = newestFirst(db.movements.filter(m => m.date >= f.from && m.date <= f.to &&
      (!f.productId || m.productId === Number(f.productId)) && (!f.type || m.type === f.type)));

    const sum = (t, fn) => list.filter(m => m.type === t).reduce((s, m) => s + fn(m), 0);
    const inQty = sum('IN', m => m.change), inValue = sum('IN', m => m.change * (m.unitCost || 0));
    const outQty = -sum('OUT', m => m.change), outValue = sum('OUT', m => -m.change * (m.unitPrice || 0));
    const adjCount = list.filter(m => m.type === 'ADJ').length;

    const amount = m => m.type === 'IN' ? money(m.change * m.unitCost) : m.type === 'OUT' ? money(-m.change * m.unitPrice) : '—';
    const details = m => m.type === 'IN' ? `${supplierById(m.supplierId)?.name || ''}${m.reference ? ' · ' + m.reference : ''}`
      : m.type === 'OUT' ? (m.reference || '') : (m.reason || '');

    $('#out').innerHTML = `
      ${printHead('Stock movement report', `${f.from} to ${f.to}`)}
      <div class="stats" style="margin-top:16px">
        ${stat('Stock in (units)', inQty)}${stat('Purchase value', money(inValue))}
        ${stat('Sold (units)', outQty)}${stat('Sales value', money(outValue))}
      </div>
      <div class="card" style="margin-top:16px">
        ${reportButtons}
        ${table(['Date', 'Time', 'Product', 'Type', 'Qty', 'Balance', 'Amount', 'Supplier / Ref / Reason', 'By'],
          list.map(m => [m.date, m.time || '', esc(productById(m.productId)?.name), typeBadge(m.type), signed(m.change), m.balance,
            amount(m), esc(details(m)), esc(userById(m.userId)?.username)]),
          { numCols: [4, 5, 6], empty: 'No movements in this date range.' })}
        <p class="note">${list.length} record(s) · ${adjCount} adjustment(s)</p>
      </div>`;

    $('#csvBtn').onclick = () => downloadCSV(`movements_${f.from}_to_${f.to}.csv`,
      ['Date', 'Time', 'SKU', 'Product', 'Type', 'Quantity change', 'Balance after', 'Amount (INR)', 'Supplier/Reference/Reason', 'User'],
      list.map(m => { const p = productById(m.productId); return [m.date, m.time, p?.sku, p?.name, typeName(m.type), m.change, m.balance,
        m.type === 'IN' ? (m.change * m.unitCost).toFixed(2) : m.type === 'OUT' ? (-m.change * m.unitPrice).toFixed(2) : '',
        details(m), userById(m.userId)?.username]; }));
    $('#printBtn').onclick = () => window.print();
  };
  form.onsubmit = e => { e.preventDefault(); run(); };
  run();
}

function reportStock() {
  const list = activeProducts().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const totalUnits = list.reduce((s, p) => s + p.quantity, 0);
  const totalValue = list.reduce((s, p) => s + p.quantity * p.price, 0);
  $('#rep').innerHTML = `${printHead('Stock on hand', 'All active products')}
    <div class="card">${reportButtons}
      ${table(['SKU', 'Product', 'Category', 'Unit', 'Stock', 'Reorder', 'Price', 'Value', 'Status'],
        list.map(p => [esc(p.sku), esc(p.name), esc(p.category), esc(p.unit), `<span class="qty ${isLow(p) ? 'low' : ''}">${p.quantity}</span>`,
          p.reorderLevel, money(p.price), money(p.quantity * p.price), statusPill(p)]),
        { numCols: [4, 5, 6, 7], foot: ['', 'Total', '', '', totalUnits, '', '', money(totalValue), ''] })}
    </div>`;
  $('#csvBtn').onclick = () => downloadCSV(`stock_on_hand_${today()}.csv`,
    ['SKU', 'Product', 'Category', 'Unit', 'Stock', 'Reorder level', 'Price (INR)', 'Value (INR)'],
    list.map(p => [p.sku, p.name, p.category, p.unit, p.quantity, p.reorderLevel, p.price.toFixed(2), (p.quantity * p.price).toFixed(2)]));
  $('#printBtn').onclick = () => window.print();
}

function reportLow() {
  const lastSupplier = p => {
    const m = [...db.movements].reverse().find(x => x.productId === p.id && x.type === 'IN');
    return m ? supplierById(m.supplierId)?.name || '' : '';
  };
  // Suggested order = enough to reach double the reorder level
  const suggest = p => Math.max(p.reorderLevel * 2 - p.quantity, 1);
  const list = activeProducts().filter(isLow).sort((a, b) => a.quantity / (a.reorderLevel || 1) - b.quantity / (b.reorderLevel || 1));
  $('#rep').innerHTML = `${printHead('Low stock report', 'Products at or below reorder level')}
    <div class="card">${reportButtons}
      ${table(['SKU', 'Product', 'Stock', 'Reorder level', 'Suggested order', 'Last supplier'],
        list.map(p => [esc(p.sku), esc(p.name), `<span class="qty low">${p.quantity}</span>`, p.reorderLevel, `${suggest(p)} ${esc(p.unit)}`, esc(lastSupplier(p))]),
        { numCols: [2, 3, 4], empty: 'Great — no products are low on stock.' })}
      <p class="note">Suggested order = quantity needed to reach 2 × reorder level.</p>
    </div>`;
  $('#csvBtn').onclick = () => downloadCSV(`low_stock_${today()}.csv`,
    ['SKU', 'Product', 'Stock', 'Reorder level', 'Suggested order', 'Last supplier'],
    list.map(p => [p.sku, p.name, p.quantity, p.reorderLevel, suggest(p), lastSupplier(p)]));
  $('#printBtn').onclick = () => window.print();
}

/* ---------------- 14. USERS (admin) ---------------- */
function viewUsers() {
  setTitle('Users');
  view.innerHTML = `<div class="toolbar"><span class="note">Admin: full access. Staff: stock in, sales, reports (view only for products & suppliers).</span>
      <span class="spacer"></span><button class="btn primary" id="addBtn">+ Add user</button></div>
    <div class="card" id="list"></div>`;
  const draw = () => {
    $('#list').innerHTML = table(['Username', 'Full name', 'Role', 'Status', 'Transactions', ''],
      db.users.map(u => [`<strong>${esc(u.username)}</strong>`, esc(u.name), `<span class="badge ${u.role}">${u.role}</span>`,
        u.active ? '<span class="pill ok">Active</span>' : '<span class="pill off">Inactive</span>',
        db.movements.filter(m => m.userId === u.id).length,
        `<div class="actions"><button class="btn small" data-edit="${u.id}">Edit</button>
         ${u.id === currentUser().id ? '' : `<button class="btn small ${u.active ? 'danger-outline' : ''}" data-toggle="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button>`}</div>`]),
      { numCols: [4] });
  };
  draw();
  $('#addBtn').onclick = () => userForm(null, draw);
  $('#list').onclick = e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.edit) userForm(userById(btn.dataset.edit), draw);
    if (btn.dataset.toggle) {
      const u = userById(btn.dataset.toggle);
      u.active = !u.active;
      saveData();
      toast(`User ${u.username} ${u.active ? 'activated' : 'deactivated'}.`);
      draw();
    }
  };
}

function userForm(u, onSaved) {
  const self = u && u.id === currentUser().id;
  openModal(u ? 'Edit user' : 'Add user', `
    <div class="row2">
      ${field('Username', 'username', u?.username, { required: true, autocomplete: 'off' })}
      ${field('Full name', 'name', u?.name, { required: true })}
    </div>
    ${self ? '<p class="note">You cannot change your own role.</p>'
      : field('Role', 'role', u?.role || 'staff', { type: 'select', options: [['staff', 'Staff'], ['admin', 'Admin']] })}
    ${field(u ? 'New password' : 'Password', 'password', '', { type: 'password', required: !u, autocomplete: 'new-password',
      help: u ? 'Leave blank to keep the current password.' : 'At least 6 characters.' })}`,
  f => {
    const errors = {};
    if (!/^[A-Za-z0-9_]{3,20}$/.test(f.username || '')) errors.username = '3–20 letters, numbers or _';
    else if (db.users.some(x => x.username.toLowerCase() === f.username.toLowerCase() && x.id !== u?.id)) errors.username = 'Username already taken';
    if (!f.name) errors.name = 'Full name is required';
    if ((!u || f.password) && (f.password || '').length < 6) errors.password = 'Password must be at least 6 characters';
    // the password hash uses the username, so a new username needs a new password
    else if (u && !f.password && f.username && u.username.toLowerCase() !== f.username.toLowerCase()) errors.password = 'Enter a new password when changing the username';
    if (Object.keys(errors).length) return errors;
    const target = u || { id: nextId('user'), active: true };
    target.username = f.username;
    target.name = f.name;
    if (!self) target.role = f.role;
    if (f.password) target.passwordHash = hashPassword(f.username, f.password);
    if (!u) db.users.push(target);
    saveData();
    toast(u ? 'User updated.' : 'User added.');
    onSaved();
  });
}

/* ---------------- 15. BACKUP & RESTORE (admin) ---------------- */
function viewBackup() {
  setTitle('Backup & Restore');
  view.innerHTML = `<div class="grid3">
    <div class="card"><h3>Download backup</h3>
      <p class="note">Saves all products, suppliers, users and history into one <b>.json</b> file. Do this regularly.</p>
      <button class="btn primary" id="backupBtn">Download backup</button></div>
    <div class="card"><h3>Restore from backup</h3>
      <p class="note">Replaces <b>all current data</b> with the data in a backup file.</p>
      <input type="file" id="restoreFile" accept=".json,application/json">
      <small class="err" id="restoreErr"></small></div>
    <div class="card"><h3>Reset demo data</h3>
      <p class="note">Deletes everything and loads the sample stationery shop data again.</p>
      <button class="btn danger" id="resetBtn">Reset to demo data</button></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Restore procedure</h3>
    <ol class="note">
      <li>Sign in as an administrator and open <b>Backup &amp; Restore</b>.</li>
      <li>Under <b>Restore from backup</b>, choose the <code>ims-backup-YYYY-MM-DD.json</code> file.</li>
      <li>Confirm the message. The system checks the file, loads it and signs you out.</li>
      <li>Sign in again with a user account that exists in the backup.</li>
    </ol>
    <p class="note">Data is stored in this browser (localStorage). Clearing browser data or using another browser/computer will not show this data — use backups to move it.</p>
  </div>`;

  $('#backupBtn').onclick = () => {
    downloadFile(`ims-backup-${today()}.json`, JSON.stringify({ app: 'IMS', exportedAt: new Date().toISOString(), data: db }, null, 2), 'application/json');
    toast('Backup downloaded.');
  };
  $('#restoreFile').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const d = parsed.data || parsed;
        const ok = d && ['users', 'products', 'suppliers', 'movements'].every(k => Array.isArray(d[k])) && d.seq && d.users.some(u => u.role === 'admin');
        if (!ok) throw new Error('bad');
        e.target.value = '';
        confirmDialog('Restore backup?',
          `This backup has <b>${d.products.length}</b> products and <b>${d.movements.length}</b> movements. All current data will be replaced.`,
          'Yes, restore', () => {
            db = d;
            saveData();
            removeStore('sessionStorage', SESSION_KEY);
            location.hash = '';
            renderLogin();
            toast('Backup restored. Please sign in again.');
          });
      } catch (err) {
        $('#restoreErr').textContent = 'This is not a valid IMS backup file.';
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };
  $('#resetBtn').onclick = () => {
    confirmDialog('Reset all data?', 'This deletes <b>all</b> products, suppliers, users and history, and loads the demo data again. This cannot be undone.',
      'Yes, reset', () => {
        seedData();
        removeStore('sessionStorage', SESSION_KEY);
        location.hash = '';
        renderLogin();
        toast('Demo data restored. Please sign in again.');
      });
  };
}

/* ---------------- 16. START ---------------- */
loadData();
window.addEventListener('hashchange', router);
router();
