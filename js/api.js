'use strict';
/* ==========================================================
   Sehati — lapisan API & penyimpanan konfigurasi
   Token TIDAK ditulis di kode: diisi pengguna di halaman
   Pengaturan lalu disimpan di localStorage perangkat.
   ========================================================== */

const DEFAULT_API = 'https://telehealth.informatikaunimus.site/api';

const Store = {
  KEY: 'sehati.config.v1',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch (e) { return {}; }
  },
  set(patch) {
    const next = Object.assign({}, this.get(), patch);
    try { localStorage.setItem(this.KEY, JSON.stringify(next)); } catch (e) { /* mode privat */ }
    return next;
  },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} },
  ready() {
    const c = this.get();
    return !!(c.nim && c.nama && c.kelas && c.token);
  },
  mhs() {
    const c = this.get();
    return { nim: String(c.nim || '').toUpperCase(), nama: c.nama || '', kelas: c.kelas || '' };
  }
};

class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || 'Terjadi kesalahan.');
    this.status = status;
    this.body = body || null;
    this.errors = (body && body.errors) || null;
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  const c = Store.get();
  const base = String(c.api || DEFAULT_API).replace(/\/+$/, '');
  let url = base + path;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    if (qs) url += '?' + qs;
  }
  const headers = { Accept: 'application/json' };
  if (c.token) headers.Authorization = 'Bearer ' + c.token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new ApiError(0, { message: 'Tidak dapat terhubung ke server. Periksa koneksi internet dan Alamat API di Pengaturan.' });
  }
  let json = null;
  try { json = await res.json(); } catch (e) { /* bukan JSON */ }
  if (!json) {
    throw new ApiError(res.status || 500, { message: 'Respons server tidak dapat dibaca. Pastikan Alamat API berakhiran /api.' });
  }
  if (!res.ok || json.success === false) throw new ApiError(res.status, json);
  return json;
}

const enc = encodeURIComponent;

const API = {
  me:        ()              => request('/me', { query: { nim: Store.mhs().nim } }),
  forms:     ()              => request('/forms'),
  form:      (id)            => request('/forms/' + enc(id)),
  validate:  (formId, answers) => request(`/forms/${enc(formId)}/validate`, { method: 'POST', body: { nim: Store.mhs().nim, answers } }),
  create:    (formId, answers) => request('/assessments', {
    method: 'POST',
    body: Object.assign(
      { form_id: formId, persetujuan: true, mahasiswa: Store.mhs() },
      answers && Object.keys(answers).length ? { answers } : {}
    )
  }),
  list:      ()              => request('/assessments', { query: { nim: Store.mhs().nim } }),
  get:       (id)            => request('/assessments/' + enc(id)),
  patch:     (id, answers)   => request('/assessments/' + enc(id), { method: 'PATCH', body: { answers } }),
  remove:    (id)            => request('/assessments/' + enc(id), { method: 'DELETE' }),
  submit:    (id)            => request(`/assessments/${enc(id)}/submit`, { method: 'POST' }),
  hasil:     (id)            => request(`/assessments/${enc(id)}/hasil`),
  status:    (id)            => request(`/assessments/${enc(id)}/status`),
  reply:     (id, cid, text) => request(`/assessments/${enc(id)}/clarifications/${enc(cid)}/reply`, { method: 'POST', body: { jawaban: text } }),
  uts:       ()              => request('/uts/' + enc(Store.mhs().nim))
};

/* Pesan galat yang mudah dipahami pasien (401 / 409 / 422 dsb.) */
function friendlyError(e) {
  if (!(e instanceof ApiError)) return (e && e.message) || 'Terjadi kesalahan tak terduga.';
  const m = e.body && e.body.message;
  switch (e.status) {
    case 0:   return m;
    case 400: return 'Permintaan tidak dapat dibaca server. ' + (m || '');
    case 401: return 'Token tidak valid atau belum diisi. Periksa kembali token pasien Anda di Pengaturan.';
    case 403: return 'Akun ini tidak berhak mengakses fitur tersebut.';
    case 404: return m || 'Data tidak ditemukan.';
    case 405: return m || 'Aksi tidak didukung.';
    case 409: return m || 'Aksi ini tidak dapat dilakukan pada status laporan saat ini.';
    case 422: return m || 'Beberapa isian belum sesuai. Periksa kembali.';
    default:  return m || `Server sedang bermasalah (kode ${e.status}). Coba lagi sebentar lagi.`;
  }
}
