'use strict';
/* ==========================================================
   Sehati — logika aplikasi, halaman, dan router (hash)
   ========================================================== */

const view = $('#view');
let seqId = 0;          // penanda render terbaru (menghindari render basi)
let F = null;           // state halaman pengisian
let H = null;           // state halaman riwayat
let lastSubmit = null;  // hasil submit terakhir (untuk halaman konfirmasi)
const formCache = {};

const FORM_META = {
  'FRM-KELUHAN': { ic: 'clipboard', tag: ['Wajib', 'violet'], cls: '' },
  'FRM-GAD7':    { ic: 'smile',     tag: ['Bonus', 'peach'],  cls: 'gad' }
};
const go = path => { location.hash = '#' + path; };

/* ---------- akses definisi formulir (toleran nama field) ---------- */
const secsOf   = f => f.sections || f.bagian || [];
const qsOf     = s => s.questions || s.pertanyaan || [];
const secTitle = s => s.judul || s.title || s.nama || 'Bagian';
const secKey   = (form, s) => s.id || s.kode || String(secsOf(form).indexOf(s));
const qLabel   = q => q.pertanyaan || q.label || q.text || q.question || q.id;
const qHelp    = q => q.bantuan || q.petunjuk || q.help || q.deskripsi || q.keterangan || '';
const isReq    = q => q.required === true || q.wajib === true;
const formIdOf = d => (d.form && d.form.id) || d.form_id;

function optsOf(q) {
  const raw = q.options || q.opsi || q.pilihan || [];
  let list = raw.map(o => typeof o === 'object' && o !== null
    ? { value: o.value ?? o.nilai ?? o.kode ?? o.id, label: String(o.label ?? o.teks ?? o.value ?? ''), exclusive: !!o.exclusive }
    : { value: o, label: String(o) });
  if (!list.length && q.type === 'scale') {
    const a = q.min ?? 1, b = q.max ?? 5;
    for (let i = a; i <= b; i++) list.push({ value: i, label: String(i) });
  }
  return list;
}

/* ---------- percabangan (show_if) ---------- */
function isVisible(cond, answers) {
  if (!cond) return true;
  if (cond.any) return cond.any.some(c => isVisible(c, answers));
  if (cond.all) return cond.all.every(c => isVisible(c, answers));
  const v = answers[cond.question];
  const filled = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);
  if ('equals' in cond) return v === cond.equals;
  if ('in' in cond) return cond.in.includes(v);
  if ('includes' in cond) return Array.isArray(v) && v.includes(cond.includes);
  if ('filled' in cond) return filled === cond.filled;
  return true;
}
const visSecs = (form, answers) => secsOf(form).filter(s => isVisible(s.show_if, answers));
const visQs   = (s, answers) => qsOf(s).filter(q => isVisible(q.show_if, answers));
const isEmpty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);

function allQuestions(form) {
  const out = [];
  secsOf(form).forEach(s => qsOf(s).forEach(q => out.push(q)));
  return out;
}
/* jawaban hanya untuk pertanyaan yang tampil */
function pruned(form, answers) {
  const out = {};
  visSecs(form, answers).forEach(s => visQs(s, answers).forEach(q => {
    if (!isEmpty(answers[q.id])) out[q.id] = answers[q.id];
  }));
  return out;
}
function answerText(q, v) {
  if (isEmpty(v)) return null;
  const opts = optsOf(q);
  const lab = x => { const o = opts.find(o => String(o.value) === String(x)); return o ? o.label : String(x); };
  switch (q.type) {
    case 'multi_choice': return v.map(lab).join(', ');
    case 'single_choice': return lab(v);
    case 'scale': { const l = lab(v); return l === String(v) ? String(v) : `${l} (${v})`; }
    case 'number': return v + (q.satuan || q.unit ? ' ' + (q.satuan || q.unit) : '');
    case 'date': return fmtDay(v);
    default: return String(v);
  }
}
async function getForm(id) {
  if (!formCache[id]) formCache[id] = (await API.form(id)).data;
  return formCache[id];
}

/* ==========================================================
   CHROME: sidebar + tab bar
   ========================================================== */
const NAV = [
  { path: '/',          label: 'Beranda',    ic: 'home' },
  { path: '/riwayat',   label: 'Riwayat',    ic: 'history' },
  { path: '/progres',   label: 'Progres',    ic: 'chart' },
  { path: '/pengaturan', label: 'Pengaturan', ic: 'settings' }
];
function renderChrome() {
  const m = Store.mhs();
  const me = Store.ready() ? `<div class="side-me"><div class="avatar">${esc((m.nama || '?').trim().charAt(0).toUpperCase())}</div><div><b>${esc(m.nama)}</b><span>${esc(m.nim)} · ${esc(m.kelas)}</span></div></div>` : '';
  $('#side').innerHTML = `
    <div class="brand"><div class="brand-mark">${icon('heart')}</div><div><div class="brand-name">Sehati</div><div class="brand-sub">Self-assessment telehealth</div></div></div>
    <nav class="snav">${NAV.map(n => `<a href="#${n.path}" data-nav="${n.path}">${icon(n.ic)}${n.label}</a>`).join('')}</nav>${me}<button class="side-theme" data-act="theme" data-label="1"></button>
    <div class="side-foot"><b>Hasil bukan diagnosis</b>Jawaban Anda ditinjau oleh tenaga kesehatan sebelum konsultasi.</div>`;
  $('#tabbar').innerHTML = NAV.map(n => `<a class="tab" href="#${n.path}" data-nav="${n.path}"><span class="tab-ic">${icon(n.ic)}</span>${n.label}</a>`).join('');
  updateThemeButtons();
}
function navKey(path) {
  if (path === '/' || path.startsWith('/form/') || path.startsWith('/isi/') || path.startsWith('/periksa/') || path.startsWith('/selesai/')) return '/';
  if (path.startsWith('/riwayat') || path.startsWith('/hasil/') || path.startsWith('/status/')) return '/riwayat';
  return path;
}
function setActive(path) {
  const k = navKey(path);
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === k));
  const focus = /^\/(isi|periksa|form|selesai)\//.test(path);
  document.body.dataset.focus = focus ? '1' : '0';
}

/* ==========================================================
   ROUTER
   ========================================================== */
const ROUTES = [
  [/^\/$/, viewHome],
  [/^\/form\/([^/]+)$/, viewIntro],
  [/^\/isi\/([^/]+)$/, viewFill],
  [/^\/periksa\/([^/]+)$/, viewReview],
  [/^\/selesai\/([^/]+)$/, viewDone],
  [/^\/riwayat$/, viewHistory],
  [/^\/hasil\/([^/]+)$/, viewResult],
  [/^\/status\/([^/]+)$/, viewStatus],
  [/^\/progres$/, viewProgress],
  [/^\/pengaturan$/, viewSettings]
];
function parseHash() {
  const h = location.hash.slice(1) || '/';
  const i = h.indexOf('?');
  return { path: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
}
async function route() {
  const seq = ++seqId;
  const { path, q } = parseHash();
  if (path !== '/isi' && !path.startsWith('/isi/')) F = null;
  if (!Store.ready() && path !== '/pengaturan') return go('/pengaturan?awal=1');
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    setActive(path);
    window.scrollTo(0, 0);
    const ctx = { params: m.slice(1).map(decodeURIComponent), q, path, alive: () => seq === seqId };
    try { await fn(ctx); updateThemeButtons(); }
    catch (e) { if (ctx.alive()) view.innerHTML = errorState(e); }
    return;
  }
  setActive(path);
  view.innerHTML = emptyState({ ic: 'search', title: 'Halaman tidak ditemukan', text: 'Alamat yang Anda buka tidak tersedia.', action: `<div class="row-center"><a class="btn primary" href="#/">Ke Beranda</a></div>` });
}
window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', e => { if (F && F.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ==========================================================
   BERANDA
   ========================================================== */
async function viewHome(ctx) {
  view.innerHTML = skeleton(3);
  const [me, forms, uts] = await Promise.all([API.me(), API.forms(), API.uts().catch(() => null)]);
  if (!ctx.alive()) return;
  const p = me.data, st = p.statistik || {};
  const mhs = Store.mhs();
  const first = String(mhs.nama || p.nama || 'Pasien').trim().split(/\s+/)[0];
  const list = Array.isArray(forms.data) ? forms.data : (forms.data && forms.data.forms) || [];

  const tiles = [
    ['Total laporan', st.total || 0, 'file', 'violet'],
    ['Draf', st.draf || 0, 'edit', 'gray'],
    ['Menunggu', st.menunggu || 0, 'clock', 'amber'],
    ['Sudah ditinjau', st.sudah_ditinjau || 0, 'shield', 'mint']
  ];
  const ut = uts && uts.data;
  const bf = ut && ut.bukti_fitur;

  view.innerHTML = `
    <section class="hero">
      <i class="blob b1"></i><i class="blob b2"></i><div class="hero-art">${illus()}</div>${pulseLine()}<button class="hero-theme" data-act="theme" aria-label="Ganti tema"></button>
      <p class="eyebrow">${sapaan()}</p>
      <h1 class="hero-title">Halo, ${esc(first)}</h1>
      <p class="hero-sub">Ceritakan kondisi Anda dengan tenang. Petugas akan membacanya sebelum konsultasi.</p>
      <div class="hero-chip">${icon('user')}${esc(mhs.nama)} · ${esc(mhs.nim)} · ${esc(mhs.kelas)}</div>
      <p class="hero-acc">Mengisi sebagai akun pasien simulasi: ${esc(p.nama)} (${esc(p.id)})</p>
    </section>

    ${st.perlu_klarifikasi > 0 ? `<a class="callout rose" href="#/riwayat?f=klarifikasi">${icon('message')}<div><b>Ada ${st.perlu_klarifikasi} laporan yang memerlukan klarifikasi</b>Ketuk untuk melihat dan menjawab pertanyaan petugas.</div></a>` : ''}

    <div class="stats">${tiles.map(([l, n, ic, tone]) => `<div class="stat"><div class="stat-ic tone-${tone}">${icon(ic)}</div><b data-count-to="${n}">${n}</b><span>${l}</span></div>`).join('')}</div>

    <div class="sec-title"><h2>Alurnya mudah</h2></div>
    <ol class="flow">
      <li><i>${icon('clipboard')}</i><b>Isi</b><span>Jawab per bagian</span></li>
      <li><i>${icon('check')}</i><b>Periksa</b><span>Cek kelengkapan</span></li>
      <li><i>${icon('send')}</i><b>Kirim</b><span>Ke petugas</span></li>
      <li><i>${icon('eye')}</i><b>Pantau</b><span>Status & arahan</span></li>
    </ol>

    <div class="sec-title"><h2>Pilih formulir</h2></div>
    ${list.map(f => {
      const m = FORM_META[f.id] || { ic: 'clipboard', tag: null, cls: '' };
      const JENIS = { ringkasan: 'Ringkasan jawaban', skor_instrumen: 'Skor 0–21 + kategori' };
      const jr = labelOf(f.jenis_hasil), jenis = JENIS[jr] || jr;
      return `<article class="formcard ${m.cls}">
        <div class="formcard-ic">${icon(m.ic)}</div>
        <div class="formcard-b">
          <h3>${esc(f.judul || f.id)}</h3>
          <p>${esc(f.deskripsi || f.description || '')}</p>
          <div class="meta">
            ${m.tag ? pill(m.tag[0], m.tag[1]) : ''}
            ${f.estimasi_menit ? pill('±' + f.estimasi_menit + ' menit', 'gray', 'clock') : ''}
            ${jenis ? pill(jenis, 'sky') : ''}
          </div>
          <a class="btn primary sm" href="#/form/${encodeURIComponent(f.id)}">Mulai self-assessment ${icon('arrow')}</a>
        </div>
      </article>`;
    }).join('') || emptyState({ ic: 'clipboard', title: 'Belum ada formulir', text: 'Daftar formulir belum tersedia dari server.' })}

    <div class="sec-title"><h2>Status tugas UTS</h2><a href="#/progres">Lihat rincian</a></div>
    <a class="card utscard" href="#/progres">
      ${ring(bf ? (bf.tercapai / (bf.total || 10)) * 100 : 0, { size: 84, label: bf ? `${bf.tercapai}/${bf.total}` : '0/10', sub: 'fitur', color: 'var(--rose)' })}
      <div class="utscard-b">
        <h2>Bukti fitur terdeteksi</h2>
        <p class="sub" style="margin:0 0 8px">${bf ? 'Terus lengkapi hingga semua fitur tercatat.' : 'Kirim laporan pertama untuk mulai tercatat.'}</p>
        ${ut && ut.penilaian ? `<span class="badge ${ut.penilaian.status && ut.penilaian.status.kode === 'disetujui' ? 'mint' : 'gray'}">${esc(labelOf(ut.penilaian.status))}</span>` : pill('Belum diperiksa', 'gray')}
      </div>
    </a>
    ${disclaimer()}`;
  countUp(view);
}

/* ==========================================================
   PETUNJUK & PERSETUJUAN
   ========================================================== */
async function viewIntro(ctx) {
  const formId = ctx.params[0];
  view.innerHTML = skeleton(2);
  const form = await getForm(formId);
  if (!ctx.alive()) return;
  const m = FORM_META[formId] || { ic: 'clipboard' };
  let pet = form.petunjuk || form.instruksi || [];
  if (typeof pet === 'string') pet = [pet];
  if (pet && !Array.isArray(pet)) pet = pet.items || pet.daftar || [textOf(pet)];
  const consent = textOf(form.persetujuan) || 'Saya memahami bahwa data yang saya isi digunakan untuk persiapan konsultasi, hanya dapat diakses oleh petugas yang berwenang, dan hasilnya bukan diagnosis.';
  const periode = form.periode || form.periode_pelaporan || '';
  const menit = form.estimasi_menit;

  view.innerHTML = `
    ${pageHead({ title: 'Petunjuk pengisian', back: '/' })}
    <section class="intro-hero">
      <div class="intro-ic">${icon(m.ic)}</div>
      <h2>${esc(form.judul || formId)}</h2>
      <p>${esc(form.deskripsi || form.description || '')}</p>
      <div class="meta" style="justify-content:center">
        ${menit ? pill('±' + menit + ' menit', 'gray', 'clock') : ''}
        ${periode ? pill(textOf(periode), 'sky', 'calendar') : ''}
      </div>
    </section>
    ${pet.length ? `<div class="card"><h2>Sebelum mulai</h2><ol class="guide">${pet.map((t, i) => `<li><i>${i + 1}</i><span>${esc(textOf(t))}</span></li>`).join('')}</ol></div>` : ''}
    <div class="card">
      <h2>Persetujuan penggunaan data</h2>
      <p class="sub">Mohon dibaca, lalu centang untuk melanjutkan.</p>
      <label class="consent"><input type="checkbox" id="consent"><span>${esc(consent)}</span></label>
    </div>
    <div class="stack"><button class="btn primary block" id="start" data-act="start" data-form="${esc(formId)}" disabled>Mulai mengisi ${icon('arrow')}</button></div>
    ${disclaimer()}`;
  $('#consent').addEventListener('change', e => { $('#start').disabled = !e.target.checked; });
}

/* ==========================================================
   PENGISIAN BERTAHAP
   ========================================================== */
async function viewFill(ctx) {
  const id = ctx.params[0];
  view.innerHTML = skeleton(2);
  const d = (await API.get(id)).data;
  if (!ctx.alive()) return;
  if (codeOf(d.status_pengiriman) === 'terkirim') {
    toast('Laporan ini sudah dikirim dan tidak dapat diubah lagi.', 'info');
    return go('/status/' + id);
  }
  const formId = formIdOf(d);
  const form = await getForm(formId);
  if (!ctx.alive()) return;
  F = { id, form, formId, answers: clone(d.answers || {}), saved: clone(d.answers || {}), errors: {}, secId: null, dirty: false, savedAt: null };
  const secs = visSecs(form, F.answers);
  const want = parseInt(ctx.q.get('bagian'), 10);
  const idx = isNaN(want) ? 0 : clamp(want - 1, 0, secs.length - 1);
  F.secId = secKey(form, secs[idx]);
  renderFill();
}
const curSection = () => {
  const secs = visSecs(F.form, F.answers);
  return secs.find(s => secKey(F.form, s) === F.secId) || secs[0];
};
const secIndex = () => {
  const secs = visSecs(F.form, F.answers);
  const i = secs.findIndex(s => secKey(F.form, s) === F.secId);
  return { i: Math.max(0, i), n: secs.length, secs };
};
const findQ = id => allQuestions(F.form).find(q => q.id === id);

function qHtml(q) {
  const v = F.answers[q.id], opts = optsOf(q), id = esc(q.id);
  const maxLen = q.max_length || (q.type === 'textarea' ? 500 : 200);
  let input = '';
  switch (q.type) {
    case 'textarea':
      input = `<textarea class="input" rows="3" data-q="${id}" maxlength="${maxLen}">${esc(v ?? '')}</textarea><div class="count" data-count="${id}">${String(v || '').length}/${maxLen}</div>`;
      break;
    case 'single_choice':
      input = `<div class="opts">${opts.map(o => `<label class="opt"><input type="radio" name="r-${id}" data-q="${id}" value="${esc(o.value)}" ${String(v) === String(o.value) ? 'checked' : ''}><span class="opt-b"><i class="dot"></i>${esc(o.label)}</span></label>`).join('')}</div>${!isReq(q) && !isEmpty(v) ? `<button type="button" class="clear-q" data-act="clear-q" data-q="${id}">Hapus pilihan</button>` : ''}`;
      break;
    case 'multi_choice': {
      const arr = Array.isArray(v) ? v.map(String) : [];
      input = `<div class="opts">${opts.map(o => `<label class="opt chk"><input type="checkbox" data-q="${id}" value="${esc(o.value)}" ${arr.includes(String(o.value)) ? 'checked' : ''}><span class="opt-b"><i class="dot"></i>${esc(o.label)}</span></label>`).join('')}</div>`;
      break;
    }
    case 'scale': {
      const horiz = opts.length <= 5 && opts.every(o => o.label.length <= 16);
      input = `<div class="scale ${horiz ? 'h' : 'v'}" style="--n:${opts.length}">${opts.map(o => {
        const numOnly = String(o.label) === String(o.value);
        return `<label class="sc"><input type="radio" name="r-${id}" data-q="${id}" value="${esc(o.value)}" ${String(v) === String(o.value) ? 'checked' : ''}><span class="sc-b"><span class="sc-n">${esc(o.value)}</span>${numOnly ? '' : `<span class="sc-l">${esc(o.label)}</span>`}</span></label>`;
      }).join('')}</div>${!isReq(q) && !isEmpty(v) ? `<button type="button" class="clear-q" data-act="clear-q" data-q="${id}">Hapus pilihan</button>` : ''}`;
      break;
    }
    case 'number': {
      const unit = q.satuan || q.unit || '';
      input = `<div class="numwrap"><input class="input" type="number" inputmode="decimal" step="any" ${q.min != null ? `min="${q.min}"` : ''} ${q.max != null ? `max="${q.max}"` : ''} data-q="${id}" value="${esc(v ?? '')}" placeholder="${q.min != null && q.max != null ? `${q.min}–${q.max}` : ''}">${unit ? `<span class="unit">${esc(unit)}</span>` : ''}</div>`;
      break;
    }
    case 'date':
      input = `<input class="input" type="date" max="${todayISO()}" data-q="${id}" value="${esc(v ?? '')}">`;
      break;
    default:
      input = `<input class="input" type="text" data-q="${id}" maxlength="${maxLen}" value="${esc(v ?? '')}" autocomplete="off">`;
  }
  const hidden = !isVisible(q.show_if, F.answers);
  const help = qHelp(q);
  const err = F.errors[q.id];
  return `<div class="q ${hidden ? 'is-hidden' : ''} ${err ? 'has-error' : ''}" data-qwrap="${id}">
    <label class="q-l">${esc(qLabel(q))}${isReq(q) ? '<b class="req" aria-label="wajib">*</b>' : ''}${q.data_type === 'pengukuran' ? `<span class="q-chip">${icon('ruler')}Hasil pengukuran</span>` : ''}</label>
    ${help ? `<div class="q-h">${esc(help)}</div>` : ''}
    ${input}
    <div class="q-err" id="err-${id}">${err ? icon('alert') + '<span>' + esc(err) + '</span>' : ''}</div>
  </div>`;
}

function renderFill() {
  const sec = curSection();
  const { i, n } = secIndex();
  const last = i === n - 1;
  view.innerHTML = `
    ${pageHead({ title: F.form.judul || 'Self-assessment', sub: `Laporan ${F.id}`, backAct: 'fill-back' })}
    <div class="progress-wrap">
      <div class="progress-top"><span id="prog-txt">Bagian ${i + 1} dari ${n}</span><span id="saved-note" class="saved-note ${F.savedAt ? '' : 'hidden'}">${icon('check')}<span>${F.savedAt ? 'Draf tersimpan ' + F.savedAt : ''}</span></span></div>
      <div class="bar"><i id="prog-bar" style="width:${((i + 1) / n) * 100}%"></i></div>
      <div class="dots" id="prog-dots">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>
    </div>
    <section class="card fill-card">
      <h2>${esc(secTitle(sec))}</h2>
      ${sec.deskripsi || sec.description ? `<p class="sub">${esc(sec.deskripsi || sec.description)}</p>` : ''}
      ${qsOf(sec).map(qHtml).join('')}
    </section>
    ${disclaimer()}
    <div class="actionbar">
      ${i > 0 ? `<button class="btn ghost prev" data-act="fill-prev">${icon('back')}Kembali</button>` : ''}
      <button class="btn ghost" data-act="fill-save">${icon('save')}Simpan draf</button>
      <button class="btn primary" data-act="fill-next">${last ? 'Periksa jawaban' : 'Lanjut'} ${icon('arrow')}</button>
    </div>`;
}

/* tampil/sembunyi pertanyaan tanpa merender ulang (fokus input tidak hilang) */
function syncVisibility() {
  if (!F) return;
  const sec = curSection();
  if (sec && secKey(F.form, sec) !== F.secId) F.secId = secKey(F.form, sec);
  $$('[data-qwrap]').forEach(w => {
    const q = findQ(w.dataset.qwrap);
    if (q) w.classList.toggle('is-hidden', !isVisible(q.show_if, F.answers));
  });
  const { i, n } = secIndex();
  const t = $('#prog-txt'); if (t) t.textContent = `Bagian ${i + 1} dari ${n}`;
  const b = $('#prog-bar'); if (b) b.style.width = ((i + 1) / n) * 100 + '%';
  const d = $('#prog-dots'); if (d) d.innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('');
  const nx = $('[data-act="fill-next"]'); if (nx) nx.innerHTML = `${i === n - 1 ? 'Periksa jawaban' : 'Lanjut'} ${icon('arrow')}`;
}
function setAns(id, val) {
  if (isEmpty(val)) delete F.answers[id]; else F.answers[id] = val;
  F.dirty = true;
  if (F.errors[id]) {
    delete F.errors[id];
    const w = $(`[data-qwrap="${CSS.escape(id)}"]`);
    if (w) { w.classList.remove('has-error'); const e = $(`#err-${CSS.escape(id)}`); if (e) e.innerHTML = ''; }
  }
  syncVisibility();
}
const optVal = (q, str) => { const o = optsOf(q).find(o => String(o.value) === str); return o ? o.value : str; };

view.addEventListener('input', e => {
  if (!F) return;
  const el = e.target, id = el.dataset && el.dataset.q;
  if (!id) return;
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number'))) {
    let val = el.value;
    if (el.type === 'number') { if (val === '') val = ''; else { val = Number(val); if (isNaN(val)) return; } }
    if (el.tagName === 'TEXTAREA') { const c = $(`[data-count="${CSS.escape(id)}"]`); if (c) c.textContent = `${el.value.length}/${el.maxLength}`; }
    setAns(id, typeof val === 'string' ? val.replace(/^\s+/, '') : val);
  }
});
view.addEventListener('change', e => {
  if (!F) return;
  const el = e.target, id = el.dataset && el.dataset.q;
  if (!id) return;
  const q = findQ(id); if (!q) return;
  if (el.type === 'radio') { setAns(id, optVal(q, el.value)); const w = $(`[data-qwrap="${CSS.escape(id)}"]`); if (w && !w.querySelector('.clear-q') && !isReq(q)) w.querySelector('.opts, .scale').insertAdjacentHTML('afterend', `<button type="button" class="clear-q" data-act="clear-q" data-q="${esc(id)}">Hapus pilihan</button>`); }
  else if (el.type === 'checkbox') {
    const opts = optsOf(q);
    const boxes = $$(`input[type=checkbox][data-q="${CSS.escape(id)}"]`);
    const exclusive = opts.filter(o => o.exclusive).map(o => String(o.value));
    let sel = boxes.filter(b => b.checked).map(b => b.value);
    if (el.checked && exclusive.includes(el.value)) sel = [el.value];
    else if (el.checked) sel = sel.filter(v => !exclusive.includes(v));
    boxes.forEach(b => { b.checked = sel.includes(b.value); });
    setAns(id, opts.filter(o => sel.includes(String(o.value))).map(o => o.value));
  }
  else if (el.type === 'date') setAns(id, el.value);
});

function validateSection(sec) {
  const errs = {};
  visQs(sec, F.answers).forEach(q => {
    const v = F.answers[q.id];
    if (isEmpty(v)) { if (isReq(q)) errs[q.id] = q.pesan_wajib || 'Pertanyaan ini wajib diisi.'; return; }
    if (q.type === 'number' && (typeof v !== 'number' || (q.min != null && v < q.min) || (q.max != null && v > q.max)))
      errs[q.id] = q.min != null && q.max != null ? `Isi angka antara ${q.min} dan ${q.max}.` : 'Isi dengan angka yang valid.';
  });
  return errs;
}
function showErrors(errs) {
  F.errors = errs;
  $$('[data-qwrap]').forEach(w => {
    const id = w.dataset.qwrap, msg = errs[id];
    w.classList.toggle('has-error', !!msg);
    const e = $(`#err-${CSS.escape(id)}`); if (e) e.innerHTML = msg ? icon('alert') + '<span>' + esc(msg) + '</span>' : '';
  });
  const firstId = Object.keys(errs)[0];
  const w = firstId && $(`[data-qwrap="${CSS.escape(firstId)}"]`);
  if (w) w.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function buildPayload() {
  const pr = pruned(F.form, F.answers);
  const payload = Object.assign({}, pr);
  Object.keys(F.saved || {}).forEach(k => { if (!(k in pr)) payload[k] = null; });
  return { pr, payload };
}
/* simpan draf ke API (PATCH). true bila berhasil. */
async function saveDraft() {
  const { pr, payload } = buildPayload();
  if (!Object.keys(payload).length) return true;
  try {
    await API.patch(F.id, payload);
    F.saved = clone(pr); F.dirty = false;
    F.savedAt = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');
    const n = $('#saved-note'); if (n) { n.classList.remove('hidden'); n.innerHTML = icon('check') + '<span>Draf tersimpan ' + esc(F.savedAt) + '</span>'; }
    return true;
  } catch (e) {
    if (e.status === 422 && e.errors) {
      const ids = Object.keys(e.errors);
      const owner = visSecs(F.form, F.answers).find(s => qsOf(s).some(q => q.id === ids[0]));
      if (owner && secKey(F.form, owner) !== F.secId) { F.secId = secKey(F.form, owner); F.errors = e.errors; renderFill(); showErrors(e.errors); }
      else showErrors(e.errors);
      toast(e.message || 'Beberapa jawaban belum sesuai.', 'error');
    } else if (e.status === 409) {
      toast(friendlyError(e), 'error'); F.dirty = false; go('/status/' + F.id);
    } else toast(friendlyError(e), 'error');
    return false;
  }
}

/* ==========================================================
   PERIKSA SEBELUM MENGIRIM
   ========================================================== */
let R = null;
async function viewReview(ctx) {
  const id = ctx.params[0];
  view.innerHTML = skeleton(3);
  const d = (await API.get(id)).data;
  if (!ctx.alive()) return;
  if (codeOf(d.status_pengiriman) === 'terkirim') return go('/status/' + id);
  const formId = formIdOf(d), form = await getForm(formId), answers = d.answers || {};
  const v = (await API.validate(formId, answers)).data;
  if (!ctx.alive()) return;
  R = { id, formId };
  const kel = v.kelengkapan || {};
  const pct = kel.persen != null ? kel.persen : v.valid ? 100 : 0;
  const errs = v.errors || {};
  const secs = visSecs(form, answers);
  const bagianOf = qid => { const k = secs.findIndex(s => qsOf(s).some(q => q.id === qid)); return k < 0 ? 1 : k + 1; };
  const total = kel.wajib_total, filled = kel.wajib_terisi;

  view.innerHTML = `
    ${pageHead({ title: 'Periksa jawaban', sub: 'Pastikan semuanya benar sebelum dikirim', back: '/isi/' + encodeURIComponent(id) + '?bagian=1' })}
    <section class="card">
      <div class="review-top">
        ${ring(pct, { size: 92, color: v.valid ? 'var(--mint)' : 'var(--amber)' })}
        <div>
          <h2>${v.valid ? 'Siap dikirim' : 'Belum lengkap'}</h2>
          <p class="sub" style="margin:0 0 8px">${total != null ? `${filled} dari ${total} pertanyaan wajib terisi.` : esc(v.valid ? 'Semua jawaban sudah valid.' : 'Masih ada jawaban yang perlu diperbaiki.')}</p>
          ${pill(v.valid ? 'Lengkap' : 'Belum lengkap', v.valid ? 'mint' : 'amber', v.valid ? 'check' : 'alert')}
        </div>
      </div>
      ${Object.keys(errs).length ? `<div class="callout amber" style="margin:16px 0 0"><div><b>Masih ada yang perlu dilengkapi</b>
        <ul class="errlist">${Object.entries(errs).map(([qid, msg]) => `<li><a href="#/isi/${encodeURIComponent(id)}?bagian=${bagianOf(qid)}">${icon('arrow')}<span>${esc(msg)}</span></a></li>`).join('')}</ul></div></div>` : ''}
    </section>
    <section class="card">
      <h2>Ringkasan jawaban</h2>
      <p class="sub">Jawaban kosong ditandai <i>Belum diisi</i> — berbeda dengan jawaban “Tidak”.</p>
      <dl>${secs.map(s => `<div class="sum-sec">${esc(secTitle(s))}</div>${visQs(s, answers).map(q => {
        const t = answerText(q, answers[q.id]);
        return `<div class="sum-row"><dt>${esc(qLabel(q))}${q.data_type === 'pengukuran' ? ` <span class="q-chip">ukur</span>` : ''}</dt><dd class="${t == null ? 'empty' : ''}">${t == null ? 'Belum diisi' : esc(t)}</dd></div>`;
      }).join('')}`).join('')}</dl>
    </section>
    <div class="actionbar">
      <a class="btn ghost" href="#/isi/${encodeURIComponent(id)}?bagian=1">${icon('edit')}Ubah jawaban</a>
      <button class="btn primary" data-act="submit" ${v.valid ? '' : 'disabled'}>${icon('send')}Kirim jawaban</button>
    </div>
    ${disclaimer()}`;
}

/* ==========================================================
   KONFIRMASI PENGIRIMAN
   ========================================================== */
async function viewDone(ctx) {
  const id = ctx.params[0];
  let d;
  if (lastSubmit && lastSubmit.id === id) d = lastSubmit.data;
  else { view.innerHTML = skeleton(2); d = (await API.get(id)).data; }
  if (!ctx.alive()) return;
  const msg = d.pesan_status || d.pesan || '';
  view.innerHTML = `
    <section class="card done">
      <div class="done-ic">${icon('check')}</div>
      <h2>Formulir Anda telah diterima</h2>
      <p>Terima kasih sudah meluangkan waktu. Petugas akan meninjau laporan Anda.</p>
      <div class="meta"><span class="badge gray">${icon('file')}No. ${esc(d.id || id)}</span>${d.dikirim_pada ? pill(fmtDate(d.dikirim_pada), 'gray', 'clock') : ''}</div>
      <div class="badges" style="justify-content:center;margin-top:8px">${badge(d.status_pengiriman, 'kirim')}${badge(d.status_peninjauan)}</div>
      ${msg ? `<div class="callout sky" style="text-align:left;margin:18px 0 0">${icon('info')}<div>${esc(msg)}</div></div>` : ''}
      <div class="stack" style="margin-top:22px">
        <a class="btn primary block" href="#/status/${encodeURIComponent(id)}">${icon('eye')}Pantau status</a>
        <a class="btn ghost block" href="#/hasil/${encodeURIComponent(id)}">${icon('file')}Lihat ringkasan hasil</a>
        <a class="btn soft block" href="#/">Selesai</a>
      </div>
    </section>
    ${disclaimer()}`;
  if (lastSubmit && lastSubmit.id === id && !lastSubmit.shown) { lastSubmit.shown = true; confetti(); }
}

/* ==========================================================
   RIWAYAT
   ========================================================== */
const FILTERS = [
  ['semua', 'Semua', () => true],
  ['draf', 'Draf', a => codeOf(a.status_pengiriman) === 'draft'],
  ['diproses', 'Diproses', a => codeOf(a.status_pengiriman) === 'terkirim' && ['menunggu_peninjauan', 'sedang_ditinjau', 'klarifikasi_dijawab'].includes(codeOf(a.status_peninjauan))],
  ['klarifikasi', 'Perlu klarifikasi', a => codeOf(a.status_peninjauan) === 'perlu_klarifikasi'],
  ['ditinjau', 'Sudah ditinjau', a => codeOf(a.status_peninjauan) === 'sudah_ditinjau']
];
async function viewHistory(ctx) {
  view.innerHTML = skeleton(3);
  const r = await API.list();
  if (!ctx.alive()) return;
  const items = (r.data || []).slice().sort((a, b) => String(b.dibuat_pada || '').localeCompare(String(a.dibuat_pada || '')));
  const f = ctx.q.get('f');
  H = { items, filter: FILTERS.some(x => x[0] === f) ? f : 'semua', q: '' };
  view.innerHTML = `
    ${pageHead({ title: 'Riwayat', sub: `${items.length} laporan untuk NIM ${Store.mhs().nim}`, right: `<button class="iconbtn" data-act="retry" aria-label="Muat ulang">${icon('refresh')}</button>` })}
    <div class="search">${icon('search')}<input class="input" id="hq" type="search" placeholder="Cari keluhan atau nomor laporan" autocomplete="off"></div>
    <div class="chips" id="chips"></div>
    <div id="hlist"></div>
    ${disclaimer()}`;
  renderHistoryList();
  $('#hq').addEventListener('input', e => { H.q = e.target.value.trim().toLowerCase(); renderHistoryList(); });
}
function renderHistoryList() {
  $('#chips').innerHTML = FILTERS.map(([k, l, fn]) => `<button class="chipbtn ${H.filter === k ? 'on' : ''}" data-act="filter" data-k="${k}">${l}<em>${H.items.filter(fn).length}</em></button>`).join('');
  const fn = FILTERS.find(x => x[0] === H.filter)[2];
  const list = H.items.filter(fn).filter(a => !H.q || (String(a.judul || '') + ' ' + a.id + ' ' + String((a.form && a.form.judul) || '')).toLowerCase().includes(H.q));
  $('#hlist').innerHTML = list.length ? list.map(historyItem).join('') : emptyState({
    ic: 'history', title: H.items.length ? 'Tidak ada laporan di sini' : 'Belum ada self-assessment',
    text: H.items.length ? 'Coba pilih filter lain atau ubah kata pencarian.' : 'Mulai pengisian pertama Anda dari Beranda.',
    action: H.items.length ? '' : `<div class="row-center"><a class="btn primary" href="#/">Mulai sekarang</a></div>`
  });
}
function historyItem(a) {
  const draft = codeOf(a.status_pengiriman) === 'draft';
  const id = encodeURIComponent(a.id);
  const wait = a.klarifikasi_menunggu > 0;
  const skor = a.skor || (a.hasil && a.hasil.skor);
  return `<article class="item">
    <div class="item-top"><h3>${esc(a.judul || (a.form && a.form.judul) || a.id)}</h3>${badge(a.status_pengiriman, 'kirim')}</div>
    <div class="item-meta">${esc((a.form && a.form.judul) || '')} · ${esc(a.id)}<br>${draft ? 'Dibuat ' + esc(fmtDate(a.dibuat_pada)) : 'Dikirim ' + esc(fmtDate(a.dikirim_pada || a.dibuat_pada))}</div>
    <div class="badges">${badge(a.status_peninjauan)}${a.status_kelengkapan ? pill(a.status_kelengkapan === 'lengkap' ? 'Lengkap' : 'Belum lengkap', a.status_kelengkapan === 'lengkap' ? 'mint' : 'amber') : ''}${skor && skor.total != null ? pill(`Skor ${skor.total}${skor.kategori ? ' · ' + labelOf(skor.kategori) : ''}`, 'peach') : ''}</div>
    ${wait ? `<div class="callout amber">${icon('message')}<div>Petugas meminta klarifikasi. Silakan jawab.</div></div>` : ''}
    <div class="item-actions">
      ${draft
        ? `<a class="btn primary sm" href="#/isi/${id}">${icon('edit')}Lanjutkan pengisian</a><button class="btn danger-o sm" data-act="delete" data-id="${esc(a.id)}">${icon('trash')}Hapus draf</button>`
        : `<a class="btn ghost sm" href="#/hasil/${id}">${icon('file')}Lihat ringkasan</a>
           <a class="btn ${wait || a.ada_tindak_lanjut ? 'primary' : 'soft'} sm" href="#/status/${id}">${wait ? icon('message') + 'Jawab klarifikasi' : a.ada_tindak_lanjut ? icon('shield') + 'Lihat tindak lanjut' : icon('eye') + 'Pantau status'}</a>`}
    </div></article>`;
}

/* ==========================================================
   HASIL ASSESSMENT
   ========================================================== */
const KAT_TONE = { minimal: ['#1C9F77', 'mint'], ringan: ['#8DBB2E', 'mint'], sedang: ['#E89A1C', 'amber'], berat: ['#D63A49', 'red'] };
const KAT_RANGE = [['minimal', 5, '0–4'], ['ringan', 5, '5–9'], ['sedang', 5, '10–14'], ['berat', 7, '15–21']];

async function viewResult(ctx) {
  const id = ctx.params[0];
  view.innerHTML = skeleton(3);
  const d = (await API.hasil(id)).data;
  if (!ctx.alive()) return;
  const h = d.hasil || d;
  const perubahan = d.perubahan || h.perubahan;
  const kel = h.kelengkapan || {};
  const skor = h.skor;
  const ring_ = kel.persen != null ? kel.persen : 0;
  const katKode = skor && skor.kategori ? (codeOf(skor.kategori) || '').toLowerCase() : '';
  const [katColor, katTone] = KAT_TONE[katKode] || ['#6D4BC3', 'violet'];
  const ringkasan = h.ringkasan || [];

  let skorHtml = '';
  if (skor) {
    const tot = Number(skor.total) || 0, mx = Number(skor.maks) || 21;
    const pos = clamp(((tot + 0.5) / (mx + 1)) * 100, 2, 98);
    skorHtml = `<section class="card score-card">
      ${ring((tot / mx) * 100, { size: 150, stroke: 13, color: katColor, label: String(tot), sub: `dari ${mx}` })}
      <div class="score-cat">${pill('Kategori ' + labelOf(skor.kategori), katTone, 'sparkle')}</div>
      <div class="range"><div class="range-bar">${KAT_RANGE.map(([k, w]) => `<i style="flex:${w};background:${KAT_TONE[k][0]};opacity:${k === katKode ? 1 : .35}"></i>`).join('')}</div>
        <div class="range-pin" style="left:${pos}%;border-color:${katColor}"></div>
        <div class="range-lbl">${KAT_RANGE.map(([k, , r]) => `<span>${r}</span>`).join('')}</div></div>
      ${skor.keterangan ? `<p class="sub" style="margin:14px 0 0">${esc(skor.keterangan)}</p>` : ''}
    </section>`;
  }

  let ubahHtml = '';
  if (perubahan && (perubahan.skor || (perubahan.perubahan || []).length)) {
    const ps = perubahan.skor;
    const dif = ps ? Number(ps.selisih) || 0 : 0;
    ubahHtml = `<section class="card">
      <h2>Perubahan dari laporan sebelumnya</h2>
      <p class="sub">Dibandingkan dengan ${esc(perubahan.pembanding_id || 'pengisian sebelumnya')}.</p>
      ${ps ? `<div class="delta"><b>${esc(ps.sebelumnya)}</b><span class="arrow">${icon('arrow')}</span><b>${esc(ps.sekarang)}</b><span class="diff ${dif > 0 ? 'up' : dif < 0 ? 'down' : 'same'}">${dif > 0 ? '+' : ''}${dif}</span></div>` : ''}
      ${(perubahan.perubahan || []).map(c => `<div class="change"><b>${esc(c.label)}</b><span>${esc(c.sebelumnya)}</span> ${icon('arrow')} <em>${esc(c.sekarang)}</em></div>`).join('')}
    </section>`;
  }

  const belum = (kel.belum_diisi || []).map(x => typeof x === 'object' ? (x.label || x.pertanyaan || x.id) : x);
  view.innerHTML = `
    ${pageHead({ title: 'Ringkasan hasil', sub: `${d.id || id}`, back: '/riwayat' })}
    <section class="card" style="display:flex;gap:16px;align-items:center">
      ${ring(ring_, { size: 84, color: ring_ >= 100 ? 'var(--mint)' : 'var(--amber)' })}
      <div style="flex:1;min-width:0"><h2>${esc(h.judul || d.judul || 'Self-assessment')}</h2>
        <div class="badges" style="margin-top:6px">${pill('Kelengkapan: ' + (kel.label || (ring_ >= 100 ? 'Lengkap' : 'Belum lengkap')), ring_ >= 100 ? 'mint' : 'amber')}${kel.wajib_total != null ? pill(`${kel.wajib_terisi}/${kel.wajib_total} wajib`, 'gray') : ''}</div></div>
    </section>
    ${skorHtml}
    ${ubahHtml}
    ${ringkasan.length ? `<section class="card"><h2>${skor ? 'Jawaban Anda' : 'Ringkasan jawaban'}</h2><p class="sub">Jawaban kosong ditandai <i>Belum diisi</i>.</p><dl>
      ${ringkasan.map(r => `<div class="sum-row"><dt>${esc(r.label || r.pertanyaan || r.question_id)}${r.data_type === 'pengukuran' ? ' <span class="q-chip">ukur</span>' : ''}</dt><dd class="${r.terisi === false ? 'empty' : ''}">${r.terisi === false ? 'Belum diisi' : esc(r.jawaban_teks ?? r.jawaban)}</dd></div>`).join('')}</dl></section>` : ''}
    ${belum.length ? `<div class="callout amber">${icon('alert')}<div><b>Belum diisi</b>${esc(belum.join(', '))}</div></div>` : ''}
    <div class="callout amber">${icon('shield')}<div><b>Keterbatasan hasil</b>${esc(h.keterbatasan || 'Hasil self-assessment bukan diagnosis. Hasil akan ditinjau bersama informasi lain oleh tenaga kesehatan.')}</div></div>
    <div class="callout sky">${icon('arrow')}<div><b>Langkah berikutnya</b>${esc(h.langkah_berikutnya || 'Tunggu hasil peninjauan petugas. Anda dapat memantau status laporan di menu Riwayat.')}</div></div>
    <div class="stack"><a class="btn primary block" href="#/status/${encodeURIComponent(id)}">${icon('eye')}Pantau status laporan</a></div>
    ${disclaimer()}`;
}

/* ==========================================================
   TRACKING STATUS, KLARIFIKASI & TINDAK LANJUT
   ========================================================== */
const EVT_IC = { dibuat: 'file', dikirim: 'send', mulai_ditinjau: 'eye', klarifikasi_diminta: 'message', klarifikasi_dijawab: 'check', tindak_lanjut: 'shield' };
let S = null;
async function viewStatus(ctx) {
  const id = ctx.params[0];
  if (!S || S.id !== id) view.innerHTML = skeleton(3);
  const d = (await API.status(id)).data;
  if (!ctx.alive()) return;
  S = { id };
  const wait = d.klarifikasi_menunggu || [];
  const answered = (d.klarifikasi || []).filter(k => codeOf(k.status) !== 'menunggu_jawaban' && (k.jawaban || k.jawaban_pasien));
  const tl = d.tindak_lanjut;
  const timeline = (d.timeline || []).slice().reverse();
  const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':');

  view.innerHTML = `
    ${pageHead({ title: 'Status laporan', sub: id, back: '/riwayat', right: `<button class="iconbtn" data-act="retry" aria-label="Muat ulang">${icon('refresh')}</button>` })}
    <section class="card">
      <div class="statrow"><span>Pengiriman</span>${badge(d.status_pengiriman, 'kirim')}</div>
      <div class="statrow"><span>Peninjauan</span>${badge(d.status_peninjauan)}</div>
      ${d.pesan ? `<div class="callout sky" style="margin:12px 0 0">${icon('info')}<div>${esc(d.pesan)}</div></div>` : ''}
    </section>

    ${wait.length ? `<section class="card"><h2>Klarifikasi dari petugas</h2><p class="sub">Petugas membutuhkan informasi tambahan dari Anda.</p>
      ${wait.map(k => `<div class="qa"><div class="qa-q">${esc(k.pertanyaan)}</div><small>${esc(k.id)}${k.dibuat_pada ? ' · ' + esc(fmtDate(k.dibuat_pada)) : ''}</small>
        <textarea class="input" id="reply-${esc(k.id)}" rows="3" maxlength="500" placeholder="Tulis jawaban Anda di sini"></textarea>
        <button class="btn primary block" data-act="reply" data-cid="${esc(k.id)}">${icon('send')}Kirim jawaban</button></div>`).join('')}
    </section>` : ''}

    ${tl ? `<section class="card followup"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><h2>Tindak lanjut</h2>${pill(labelOf(tl.jenis), 'mint', 'shield')}</div>
      <p style="margin-top:8px">${esc(tl.arahan || '')}</p>
      ${tl.jadwal_konsultasi ? `<div class="followup-when">${icon('calendar')}<span>Jadwal konsultasi: ${esc(fmtDate(tl.jadwal_konsultasi))}</span></div>` : ''}
      <p class="sub" style="margin:12px 0 0">${tl.dicatat_oleh && tl.dicatat_oleh.nama ? 'Dicatat oleh ' + esc(tl.dicatat_oleh.nama) : ''}${tl.dicatat_pada ? ' · ' + esc(fmtDate(tl.dicatat_pada)) : ''}</p></section>` : ''}

    ${answered.length ? `<section class="card"><h2>Klarifikasi yang sudah dijawab</h2>${answered.map(k => `<div class="qa"><div class="qa-q">${esc(k.pertanyaan)}</div><div class="qa-a">${esc(k.jawaban || k.jawaban_pasien)}</div></div>`).join('')}</section>` : ''}

    <section class="card"><h2>Riwayat status</h2>
      ${timeline.length ? `<ul class="timeline">${timeline.map(t => `<li><span class="tl-dot">${icon(EVT_IC[t.event] || 'clock')}</span><div class="tl-b"><b>${esc(t.keterangan || t.event)}</b><span>${esc(fmtDate(t.waktu))}${t.oleh ? ' · ' + esc(textOf(t.oleh.nama ? t.oleh.nama : t.oleh)) : ''}</span></div></li>`).join('')}</ul>` : '<p class="sub">Belum ada riwayat.</p>'}
    </section>
    <div class="row"><a class="btn ghost" href="#/hasil/${encodeURIComponent(id)}">${icon('file')}Lihat ringkasan</a><button class="btn primary" data-act="retry">${icon('refresh')}Muat ulang status</button></div>
    <p class="updated">Diperbarui pukul ${now} WIB</p>
    ${disclaimer()}`;
}

/* ==========================================================
   PROGRES TUGAS UTS
   ========================================================== */
const FITUR_HINT = {
  buat: 'Mulai pengisian dengan persetujuan', simpan_draf: 'Simpan draf lalu lanjutkan',
  validasi: 'Buka halaman Periksa jawaban', kirim: 'Kirim formulir keluhan', riwayat: 'Buka halaman Riwayat',
  hasil: 'Buka ringkasan hasil laporan terkirim', status: 'Buka halaman pantau status',
  klarifikasi: 'Jawab klarifikasi dari petugas', tindak_lanjut: 'Buka status setelah laporan ditinjau', gad7: 'Kirim kuesioner GAD-7 (bonus)'
};
async function viewProgress(ctx) {
  view.innerHTML = skeleton(3);
  let ut = null;
  try { ut = (await API.uts()).data; }
  catch (e) { if (e.status !== 404) throw e; }
  if (!ctx.alive()) return;
  const head = pageHead({ title: 'Progres tugas', sub: `NIM ${Store.mhs().nim}`, right: `<button class="iconbtn" data-act="retry" aria-label="Muat ulang">${icon('refresh')}</button>` });
  if (!ut) {
    view.innerHTML = head + emptyState({ ic: 'chart', title: 'Belum ada laporan terkirim', text: 'Bukti fitur tercatat otomatis saat aplikasi Anda memanggil API. Mulai dengan mengirim laporan pertama.', action: `<div class="row-center"><a class="btn primary" href="#/">Mulai mengisi</a></div>` }) + disclaimer();
    return;
  }
  const bf = ut.bukti_fitur || { tercapai: 0, total: 10, daftar: [] };
  const j = ut.jumlah || {};
  const pn = ut.penilaian;
  view.innerHTML = `${head}
    <section class="card">
      <div class="utscard">${ring((bf.tercapai / (bf.total || 10)) * 100, { size: 104, stroke: 11, color: 'var(--rose)', label: `${bf.tercapai}/${bf.total}`, sub: 'fitur' })}
        <div class="utscard-b"><h2>${esc(ut.nama || Store.mhs().nama)}</h2><p class="sub" style="margin:0 0 8px">${esc(ut.nim || '')} · ${esc(ut.kelas || '')}</p>
          ${pn ? badge(pn.status, 'x').replace(/class="badge [a-z]+"/, `class="badge ${codeOf(pn.status) === 'disetujui' ? 'mint' : codeOf(pn.status) === 'perlu_revisi' ? 'amber' : codeOf(pn.status) === 'ditolak' ? 'red' : 'gray'}"`) : ''}</div></div>
      <div class="mini"><div><b>${j.total || 0}</b><span>Total</span></div><div><b>${j.terkirim || 0}</b><span>Terkirim</span></div><div><b>${j.draf || 0}</b><span>Draf</span></div><div><b>${j.sudah_ditinjau || 0}</b><span>Ditinjau</span></div></div>
    </section>
    ${pn && pn.catatan ? `<div class="callout violet">${icon('message')}<div><b>Catatan dosen</b>${esc(pn.catatan)}</div></div>` : ''}
    <section class="card"><h2>Bukti fitur</h2><p class="sub">Tercatat otomatis dari penggunaan API oleh aplikasi ini.</p>
      ${(bf.daftar || []).map(f => `<div class="feat ${f.tercapai ? 'ok' : ''}"><span class="feat-c">${icon('check')}</span><div><b>${esc(f.label || f.kode)}</b><span>${esc(FITUR_HINT[f.kode] || '')}</span></div></div>`).join('')}
    </section>
    ${disclaimer()}`;
}

/* ==========================================================
   PENGATURAN & IDENTITAS MAHASISWA
   ========================================================== */
async function viewSettings(ctx) {
  const c = Store.get();
  const first = ctx.q.get('awal') === '1' || !Store.ready();
  view.innerHTML = `
    ${first ? `<section class="welcome-banner"><div class="wb-text"><span class="eyebrow">Langkah awal</span><h2>Selamat datang di Sehati</h2><p>Lengkapi identitas dan token untuk mulai. Data disimpan hanya di perangkat ini.</p></div><div class="wb-art">${illus()}</div></section>` : pageHead({ title: 'Pengaturan', sub: 'Identitas mahasiswa & koneksi API' })}
    <section class="card"><div class="card-h"><span class="ci">${icon('user')}</span><div><h2>Identitas mahasiswa</h2><p class="sub">Dikirim bersama setiap self-assessment agar dosen dapat memeriksa pekerjaan Anda.</p></div></div>
      <div class="field"><label for="f-nim">NIM</label><input class="input" id="f-nim" value="${esc(c.nim || '')}" placeholder="mis. G2A021001" autocomplete="off" autocapitalize="characters"><div class="err" id="e-nim"></div></div>
      <div class="field"><label for="f-nama">Nama lengkap</label><input class="input" id="f-nama" value="${esc(c.nama || '')}" placeholder="Nama lengkap" autocomplete="name"><div class="err" id="e-nama"></div></div>
      <div class="field" style="margin-bottom:0"><label for="f-kelas">Kelas</label><input class="input" id="f-kelas" value="${esc(c.kelas || '')}" placeholder="mis. TI-5A" autocomplete="off"><div class="err" id="e-kelas"></div></div>
    </section>
    <section class="card"><div class="card-h"><span class="ci">${icon('plug')}</span><div><h2>Koneksi API</h2><p class="sub">Token dibagikan dosen. Satu token = satu akun pasien simulasi (P-001, P-002, atau P-003).</p></div></div>
      <div class="field"><label for="f-token">Token pasien</label><div class="input-row"><input class="input masked" id="f-token" type="text" name="sehati-token" data-lpignore="true" value="${esc(c.token || '')}" placeholder="tlh_pasien_…" autocomplete="off" spellcheck="false"><button class="btn ghost" type="button" data-act="paste-token" aria-label="Tempel token">${icon('clipboard')}</button><button class="btn ghost" type="button" data-act="toggle-token" aria-label="Tampilkan token">${icon('eye')}</button></div><div class="err" id="e-token"></div></div>
      <div class="field" style="margin-bottom:0"><label for="f-api">Alamat API</label><input class="input" id="f-api" value="${esc(c.api || DEFAULT_API)}" autocomplete="off" spellcheck="false"><div class="hint">Harus berakhiran <b>/api</b>.</div></div>
    </section>
    <div class="stack"><button class="btn primary block" data-act="save-settings">${icon('plug')}Simpan &amp; uji koneksi</button>
      ${Store.ready() ? `<button class="btn danger-o block" data-act="reset-settings">${icon('trash')}Hapus data di perangkat ini</button>` : ''}</div>
    <div class="conn" id="conn"></div>
    ${disclaimer()}`;
}

/* ==========================================================
   AKSI (delegasi klik)
   ========================================================== */
const actions = {
  retry: () => route(),

  async start(btn) {
    setLoading(btn, true);
    try {
      const r = await API.create(btn.dataset.form);
      toast('Draf dibuat. Selamat mengisi!');
      go('/isi/' + encodeURIComponent(r.data.id));
    } catch (e) {
      setLoading(btn, false);
      if (e.status === 422) {
        toast(friendlyError(e) + ' Periksa identitas Anda di Pengaturan.', 'error');
      } else toast(friendlyError(e), 'error');
    }
  },

  async 'fill-next'(btn) {
    const sec = curSection();
    const errs = validateSection(sec);
    if (Object.keys(errs).length) { showErrors(errs); toast('Masih ada isian wajib yang belum lengkap.', 'error'); return; }
    setLoading(btn, true);
    const ok = await saveDraft();
    setLoading(btn, false);
    if (!ok) return;
    const { i, n, secs } = secIndex();
    if (i >= n - 1) { F.dirty = false; return go('/periksa/' + encodeURIComponent(F.id)); }
    F.secId = secKey(F.form, secs[i + 1]);
    renderFill(); window.scrollTo(0, 0);
  },
  'fill-prev'() {
    const { i, secs } = secIndex();
    if (i > 0) { F.secId = secKey(F.form, secs[i - 1]); F.errors = {}; renderFill(); window.scrollTo(0, 0); }
  },
  async 'fill-save'(btn) {
    setLoading(btn, true);
    const ok = await saveDraft();
    setLoading(btn, false);
    if (ok) toast('Draf tersimpan. Anda bisa melanjutkan kapan saja dari Riwayat.');
  },
  async 'fill-back'() {
    if (F && F.dirty) {
      const c = await dialog({ title: 'Simpan perubahan?', text: 'Ada jawaban yang belum tersimpan sebagai draf.', buttons: [
        { label: 'Batal', value: null }, { label: 'Keluar tanpa simpan', value: 'discard', cls: 'ghost' }, { label: 'Simpan & keluar', value: 'save', cls: 'primary' }] });
      if (c === null) return;
      if (c === 'save') { const ok = await saveDraft(); if (!ok) return; }
      F.dirty = false;
    }
    go('/riwayat');
  },
  'clear-q'(btn) {
    const id = btn.dataset.q;
    setAns(id, undefined);
    $$(`[data-q="${CSS.escape(id)}"]`).forEach(i => { i.checked = false; });
    btn.remove();
  },

  async submit(btn) {
    const ok = await confirmDialog({ title: 'Kirim jawaban sekarang?', text: 'Setelah dikirim, jawaban tidak dapat diubah. Petugas akan mulai meninjau laporan Anda.', ok: 'Ya, kirim' });
    if (!ok) return;
    setLoading(btn, true);
    try {
      const r = await API.submit(R.id);
      lastSubmit = { id: R.id, data: r.data };
      go('/selesai/' + encodeURIComponent(R.id));
    } catch (e) {
      setLoading(btn, false);
      if (e.status === 409) { toast(friendlyError(e), 'error'); go('/status/' + R.id); }
      else { toast(e.status === 422 ? 'Masih ada jawaban wajib yang belum diisi.' : friendlyError(e), 'error'); if (e.status === 422) route(); }
    }
  },

  filter(btn) { H.filter = btn.dataset.k; renderHistoryList(); },
  async delete(btn) {
    const ok = await confirmDialog({ title: 'Hapus draf ini?', text: 'Draf yang dihapus tidak dapat dikembalikan.', ok: 'Hapus', danger: true });
    if (!ok) return;
    setLoading(btn, true);
    try { await API.remove(btn.dataset.id); toast('Draf dihapus.'); route(); }
    catch (e) { setLoading(btn, false); toast(friendlyError(e), 'error'); }
  },

  async reply(btn) {
    const cid = btn.dataset.cid, ta = $('#reply-' + CSS.escape(cid));
    const text = ta.value.trim();
    if (!text) { ta.focus(); toast('Tulis jawaban Anda terlebih dahulu.', 'error'); return; }
    setLoading(btn, true);
    try { await API.reply(S.id, cid, text); toast('Jawaban klarifikasi terkirim. Terima kasih!'); route(); }
    catch (e) { setLoading(btn, false); toast(friendlyError(e), 'error'); if (e.status === 409) route(); }
  },

  'toggle-token'(btn) {
    const i = $('#f-token'), show = i.classList.contains('masked');
    i.classList.toggle('masked', !show);
    btn.innerHTML = icon(show ? 'eyeoff' : 'eye');
  },
  async 'paste-token'() {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (!t) return toast('Clipboard kosong. Salin token dulu.', 'info');
      $('#f-token').value = t; $('#e-token').textContent = '';
      toast('Token ditempel.');
    } catch (e) { toast('Browser tidak mengizinkan membaca clipboard. Tempel manual dengan Ctrl+V.', 'info'); }
  },
  theme() { setTheme(isDark() ? 'light' : 'dark'); },
  async 'save-settings'(btn) {
    const nim = $('#f-nim').value.trim().toUpperCase(), nama = $('#f-nama').value.trim(), kelas = $('#f-kelas').value.trim();
    const token = $('#f-token').value.trim(), api = ($('#f-api').value.trim() || DEFAULT_API).replace(/\/+$/, '');
    const e = {
      nim: !/^[A-Z0-9]{5,20}$/.test(nim) ? 'NIM 5–20 karakter huruf/angka.' : '',
      nama: nama.length < 3 || nama.length > 100 ? 'Nama 3–100 karakter.' : '',
      kelas: !kelas || kelas.length > 20 ? 'Kelas wajib diisi (maks. 20 karakter).' : '',
      token: !token ? 'Token pasien wajib diisi.' : !token.startsWith('tlh_pasien_') ? 'Token pasien berawalan tlh_pasien_.' : ''
    };
    Object.keys(e).forEach(k => { $('#e-' + k).textContent = e[k]; });
    if (Object.values(e).some(Boolean)) return;
    Store.set({ nim, nama, kelas, token, api });
    renderChrome();
    setLoading(btn, true);
    const box = $('#conn');
    try {
      const r = await API.me();
      box.innerHTML = `<div class="callout mint">${icon('check')}<div><b>Terhubung!</b>Masuk sebagai ${esc(r.data.nama)} (${esc(r.data.id)}). Pengaturan tersimpan di perangkat ini.</div></div>
        <div class="stack"><a class="btn primary block" href="#/">Ke Beranda ${icon('arrow')}</a></div>`;
      toast('Koneksi berhasil.');
    } catch (err) {
      box.innerHTML = `<div class="callout rose">${icon('alert')}<div><b>Koneksi gagal</b>${esc(friendlyError(err))}</div></div>`;
    }
    setLoading(btn, false);
  },
  async 'reset-settings'() {
    const ok = await confirmDialog({ title: 'Hapus data di perangkat ini?', text: 'Identitas dan token akan dihapus dari browser. Laporan di server tidak terpengaruh.', ok: 'Hapus', danger: true });
    if (!ok) return;
    Store.clear(); renderChrome(); toast('Data perangkat dihapus.', 'info'); route();
  }
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = actions[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t, e); }
});

/* ---------- mulai ---------- */
renderChrome();
route();
