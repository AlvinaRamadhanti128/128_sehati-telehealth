'use strict';
/* ==========================================================
   Sehati — helper tampilan (ikon, badge, dialog, toast, dll)
   ========================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o == null ? null : o));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const textOf  = x => x == null ? '' : typeof x === 'string' ? x : (x.teks || x.text || x.label || x.judul || x.isi || '');
const labelOf = x => x == null ? '' : typeof x === 'object' ? (x.label || x.kode || '') : String(x);
const codeOf  = x => x && typeof x === 'object' ? x.kode : x;

/* ---------- tanggal (zona WIB) ---------- */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    .replace(/(\d{2})\.(\d{2})$/, '$1:$2');
}
function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
}
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

/* ---------- ikon (garis, 24px) ---------- */
const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3"/><path d="M12 9v9"/><path d="M17 5v13"/>',
  settings: '<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-15.5-6.3L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.3L21 16"/><path d="M21 21v-5h-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  ruler: '<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  plug: '<path d="M12 22v-5"/><path d="M9 8V2M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
};
function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
}

/* ---------- badge status ---------- */
const PENINJAUAN = {
  belum_dikirim:       ['gray',   'file'],
  menunggu_peninjauan: ['amber',  'clock'],
  sedang_ditinjau:     ['sky',    'eye'],
  perlu_klarifikasi:   ['rose',   'message'],
  klarifikasi_dijawab: ['violet', 'check'],
  sudah_ditinjau:      ['mint',   'shield']
};
const PENGIRIMAN = { draft: ['gray', 'edit'], terkirim: ['mint', 'send'] };

function badge(st, kind) {
  const code = codeOf(st) || '';
  const map = kind === 'kirim' ? PENGIRIMAN : PENINJAUAN;
  const [tone, ic] = map[code] || ['gray', 'info'];
  return `<span class="badge ${tone}">${icon(ic)}${esc(labelOf(st) || code)}</span>`;
}
const pill = (text, tone = 'gray', ic = '') => `<span class="badge ${tone}">${ic ? icon(ic) : ''}${esc(text)}</span>`;

/* ---------- cincin progres ---------- */
function ring(pct, { size = 84, stroke = 9, color = 'var(--p)', label, sub = '' } = {}) {
  const p = clamp(Number(pct) || 0, 0, 100);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - p / 100);
  const mid = size / 2;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" class="ring-fg" style="--c:${c.toFixed(2)};--o:${off.toFixed(2)}"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"/>
    </svg>
    <div class="ring-l"><b>${label != null ? esc(label) : Math.round(p) + '%'}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
  </div>`;
}

/* ---------- blok umum ---------- */
function skeleton(n = 3) {
  return `<div class="skel-wrap">${'<div class="skel"></div>'.repeat(n)}</div>`;
}
function emptyState({ ic = 'file', title, text = '', action = '' }) {
  return `<div class="empty"><div class="empty-ic">${icon(ic)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}
function errorState(e) {
  const unauthorized = e && e.status === 401;
  return `<div class="empty err"><div class="empty-ic">${icon(unauthorized ? 'lock' : 'plug')}</div>
    <h3>${unauthorized ? 'Token belum dikenali' : 'Belum bisa memuat data'}</h3>
    <p>${esc(friendlyError(e))}</p>
    <div class="row-center">
      <button class="btn primary" data-act="retry">${icon('refresh')}Coba lagi</button>
      <a class="btn ghost" href="#/pengaturan">${icon('settings')}Buka Pengaturan</a>
    </div></div>`;
}
const disclaimer = () => `<p class="disclaimer">${icon('shield')}<span><b>Hasil self-assessment bukan diagnosis.</b> Laporan Anda akan ditinjau oleh tenaga kesehatan bersama informasi lain.</span></p>`;

function pageHead({ title, sub = '', back = null, backAct = null, right = '' }) {
  const backEl = backAct
    ? `<button class="iconbtn" data-act="${backAct}" aria-label="Kembali">${icon('back')}</button>`
    : back ? `<a class="iconbtn" href="#${back}" aria-label="Kembali">${icon('back')}</a>` : '';
  return `<header class="pagehead"><div class="pagehead-in">${backEl}<div class="pagehead-t"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${right}</div></header>`;
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.classList.toggle('loading', !!on);
  btn.disabled = !!on;
}

/* ---------- toast ---------- */
function toast(msg, type = 'ok') {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check') + `<span>${esc(msg)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, type === 'error' ? 5200 : 3200);
}

/* ---------- dialog ---------- */
function dialog({ title, text = '', html = '', buttons }) {
  return new Promise(resolve => {
    const root = $('#dialog-root');
    root.innerHTML = `<div class="scrim"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${html}
      <div class="dialog-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || 'ghost'}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
    </div></div>`;
    const onKey = e => { if (e.key === 'Escape') close(null); };
    const close = v => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.scrim').addEventListener('click', e => {
      if (e.target.classList.contains('scrim')) return close(null);
      const b = e.target.closest('button[data-i]');
      if (b) close(buttons[+b.dataset.i].value);
    });
    const first = root.querySelector('button.primary, button.danger');
    if (first) first.focus();
  });
}
const confirmDialog = ({ title, text, ok = 'Ya, lanjut', cancel = 'Batal', danger = false }) =>
  dialog({ title, text, buttons: [{ label: cancel, value: false }, { label: ok, value: true, cls: danger ? 'danger' : 'primary' }] });

/* ---------- ilustrasi dekoratif ---------- */
function illus() {
  return `<svg viewBox="0 0 220 180" aria-hidden="true"><defs>
    <linearGradient id="il-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B4FD0"/><stop offset="1" stop-color="#E8588F"/></linearGradient>
    <linearGradient id="il-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD0B4"/><stop offset="1" stop-color="#FF8FB6"/></linearGradient></defs>
    <circle cx="110" cy="92" r="72" fill="url(#il-g)" opacity=".16"/><circle cx="110" cy="92" r="50" fill="url(#il-g)" opacity=".26"/>
    <rect x="62" y="38" width="96" height="108" rx="24" fill="#fff" stroke="#E9E2F5" stroke-width="2"/>
    <rect x="86" y="48" width="48" height="6" rx="3" fill="#EDE6F8"/>
    <path d="M110 118s-24-14-24-32a13 13 0 0 1 24-6 13 13 0 0 1 24 6c0 18-24 32-24 32z" fill="url(#il-h)"/>
    <path d="M72 134h22l6-10 8 18 7-12h25" fill="none" stroke="#6D4BC3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#6D4BC3" opacity=".7"><rect x="28" y="52" width="4" height="16" rx="2"/><rect x="22" y="58" width="16" height="4" rx="2"/></g>
    <g fill="#E8588F" opacity=".75"><rect x="186" y="110" width="4" height="14" rx="2"/><rect x="181" y="115" width="14" height="4" rx="2"/></g>
    <circle cx="178" cy="46" r="7" fill="#FFB48A"/><circle cx="40" cy="130" r="5" fill="#8B4FD0" opacity=".5"/><circle cx="196" cy="78" r="3.5" fill="#6D4BC3" opacity=".45"/></svg>`;
}
const pulseLine = () => `<svg class="pulse" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22h96l12-16 14 32 14-24 10 8h154" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ---------- tema, sapaan, animasi ---------- */
const isDark = () => document.documentElement.dataset.theme === 'dark';
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('sehati.theme', t); } catch (e) {}
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = t === 'dark' ? '#1B1430' : '#5B3FB5';
  updateThemeButtons();
}
function updateThemeButtons() {
  $$('[data-act="theme"]').forEach(b => {
    b.innerHTML = icon(isDark() ? 'sun' : 'moon') + (b.dataset.label ? `<span>${isDark() ? 'Mode terang' : 'Mode gelap'}</span>` : '');
  });
}
function sapaan() {
  const h = parseInt(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }), 10);
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}
function countUp(root) {
  $$('[data-count-to]', root).forEach(el => {
    const to = Number(el.dataset.countTo) || 0;
    if (!to) return;
    const t0 = performance.now();
    (function f(t) {
      const p = Math.min(1, (t - t0) / 800);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  });
}
function confetti() {
  try {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas');
    const x = c.getContext && c.getContext('2d');
    if (!x) return;
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:120';
    document.body.appendChild(c);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.width = innerWidth * dpr, Hh = c.height = innerHeight * dpr;
    const cols = ['#6D4BC3', '#8B4FD0', '#E8588F', '#FFB48A', '#1FA97F', '#FFD166'];
    const ps = Array.from({ length: 120 }, () => ({
      x: W / 2 + (Math.random() - .5) * W * .3, y: Hh * .38, vx: (Math.random() - .5) * 15 * dpr, vy: (-Math.random() * 14 - 4) * dpr,
      s: (6 + Math.random() * 8) * dpr, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, c: cols[Math.random() * cols.length | 0], dot: Math.random() < .4
    }));
    const t0 = performance.now();
    (function f(t) {
      const k = t - t0;
      x.clearRect(0, 0, W, Hh);
      ps.forEach(p => {
        p.vy += .36 * dpr; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - k / 2800); x.fillStyle = p.c;
        if (p.dot) { x.beginPath(); x.arc(0, 0, p.s / 2, 0, 6.28); x.fill(); } else x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        x.restore();
      });
      if (k < 2800) requestAnimationFrame(f); else c.remove();
    })(t0);
  } catch (e) { /* dekorasi saja */ }
}
