# Sehati — Frontend Self-Assessment Telehealth

Aplikasi pasien untuk tugas UTS Telehealth (Pertemuan 6). Hanya frontend: HTML + CSS + JavaScript murni, **tanpa build**.
Semua data diproses oleh API `https://telehealth.informatikaunimus.site/api`.

## Menjalankan
Buka `index.html` langsung, atau jalankan server statis:

```bash
npx serve .          # atau: python3 -m http.server 8080
```

Saat pertama dibuka, isi **NIM, nama, kelas, token pasien** di halaman Pengaturan lalu klik *Simpan & uji koneksi*.
Token disimpan di `localStorage` browser, **tidak ada token di dalam kode** sehingga aman diunggah ke GitHub.

## Deploy (GitHub Pages)
1. Buat repository, unggah seluruh isi folder ini.
2. Settings → Pages → Source: `main` / root.
3. Tautan Pages itulah yang dikumpulkan bersama link repository.

## Halaman & endpoint
| Halaman | Rute | Endpoint |
|---|---|---|
| Identitas & koneksi | `#/pengaturan` | `GET /me` |
| Beranda | `#/` | `GET /me?nim`, `GET /forms`, `GET /uts/{nim}` |
| Petunjuk & persetujuan | `#/form/{id}` | `GET /forms/{id}`, `POST /assessments` |
| Pengisian bertahap (percabangan `show_if`) | `#/isi/{id}` | `GET /assessments/{id}`, `PATCH /assessments/{id}` |
| Periksa sebelum kirim | `#/periksa/{id}` | `POST /forms/{id}/validate` |
| Konfirmasi | `#/selesai/{id}` | `POST /assessments/{id}/submit` |
| Riwayat (filter, cari, lanjutkan/hapus draf) | `#/riwayat` | `GET /assessments?nim`, `DELETE` |
| Hasil (skor GAD-7, perubahan, keterbatasan) | `#/hasil/{id}` | `GET /assessments/{id}/hasil` |
| Status, klarifikasi, tindak lanjut, timeline | `#/status/{id}` | `GET …/status`, `POST …/clarifications/{cid}/reply` |
| Progres bukti fitur UTS | `#/progres` | `GET /uts/{nim}` |

Formulir dirender **dinamis** dari definisi API (text, textarea, single/multi choice dengan opsi `exclusive`, scale, number + satuan, date, data `pengukuran`).
"Tidak" dibedakan dari "Belum diisi". Pesan 401 / 409 / 422 ditampilkan dengan bahasa yang jelas. Pernyataan *hasil bukan diagnosis* tampil di setiap halaman.

## Checklist uji end-to-end (bagian 6 panduan)
1. Mulai + persetujuan → 2. Simpan draf lalu lanjutkan dari Riwayat → 3. Cabang Ya/Tidak & pasien/pendamping → 4. Validasi kolom wajib →
5. Periksa → 6. Kirim → 7. Riwayat → 8. Hasil → 9. Status → 10. Klarifikasi (setelah dosen meminta) → 11. Tindak lanjut → 12. GAD-7 dua kali → 13. Token salah / ubah laporan terkirim.
Pantau di halaman **Progres** (target 10/10).

## Struktur
```
index.html
css/style.css
js/api.js   # konfigurasi, fetch, penanganan galat
js/ui.js    # ikon, badge, dialog, toast
js/app.js   # halaman, router, aksi
```
