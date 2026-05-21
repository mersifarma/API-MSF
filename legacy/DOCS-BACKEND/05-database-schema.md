# 05 — Database Schema

Database utama: **`monitoring`** (MySQL). Database sekunder: **`report_admin_mkt`** (1 tabel cross-database).

> Schema ini direkonstruksi dari pemakaian kolom di controller (tidak ada migration file di repo). Kalau ada kolom yang tidak konsisten dengan production, **production adalah sumber kebenaran** — update dokumen ini dengan `DESCRIBE <table>` output.

---

## 1. Tabel utama (database `monitoring`)

### 1.1 `users`

User account untuk login.

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | int PK | - |
| `username` | string | unique |
| `password` | string | bcrypt hash (`Hash::check`) |
| `name` | string | display name |
| `role` | string | default `"user"` di response login |

Dipakai di: `MainMenuController::login`.

---

### 1.2 `data_pegawai`

Master pegawai (multi-row per user untuk combo account).

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `rowid` | int PK | dipakai sebagai `id_peg` di mobile |
| `id` | int | dipakai sebagai `id_ff` (field force ID) |
| `id_user` | int | FK ke `users.id` |
| `nama` | string | - |
| `jabatan` | string | `MR`, `PS`, `KAE`, `DM`, `RSM`, `MM`, dll. |
| `divisi` | string | `Neptune`, `Jupiter`, `Mercury`, dll. |
| `status` | string nullable | `"Exist"` atau NULL = aktif |

**Penting**: 1 user di `users` bisa punya **multiple** row `data_pegawai` (mis. handle 2 wilayah). Mobile receive `id_peg[]` dan `id_ff[]` sebagai array.

---

### 1.3 `struktur`

Hierarki organisasi MR → DM → RSM → MM, dengan periode aktif.

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id_peg_mr` | int | rowid MR |
| `id_peg_dm` | int | rowid DM |
| `id_peg_rsm` | int | rowid RSM |
| `id_peg_mm` | int nullable | rowid Marketing Manager |
| `periode_awal` | date | mulai berlaku |
| `periode_akhir` | date | berakhir |

Dipakai untuk:
- Expand `id_peg` (DM/RSM) ke semua MR bawahan (`doctorList`, `getCallList`).
- `JoinVisitController::callJoinVisit` — cari atasan yang bisa diajak join.

---

### 1.4 `app_modul` & `app_role_menu`

Akses modul user.

`app_modul`:

| Kolom | Tipe |
|-------|------|
| `id_modul` | int PK |
| `nama_modul` | string |
| `icons2` | string |

`app_role_menu`:

| Kolom | Tipe |
|-------|------|
| `id_user` | int |
| `id_modul` | int |

JOIN sederhana di `getModulesByUser`.

---

### 1.5 `call_version`

Gate versi mobile.

| Kolom | Tipe |
|-------|------|
| `version` | string (semver `8.2.37`) |
| `link_apk` | string (URL ke APK) |

Dipakai di `getAppVersion`. Biasanya cuma 1 row (latest).

---

### 1.6 `list_dokter_visit_new`

Master dokter / non-dokter (customer).

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id_md` | int PK | dipakai sebagai `id_mcl` di flow call_list/plan/actual |
| `nama_dokter` | string | - |
| `spec` | string | spesialisasi |
| `class` | string | `A`/`B`/`C`/dst |
| `segmen_md` | string | `Doctor`, `Non-Doctor` |
| `institusi` | string | RS / klinik / outlet |
| `alamat_praktek` | string | - |
| `hari_praktek` | string | comma-separated |
| `jam_mulai_praktek` | time | - |
| `jam_selesai_praktek` | time | - |
| `koordinat_institusi` | string | `"lat,long"` |
| `divisi` | string | - |
| `id_peg` | int | rowid MR yang handle |
| `id_ff` | int | - |
| `STATUS_MD` | string nullable | filter: NULL atau `"AKTIF"` |

> **Naming inconsistency**: di mobile pakai `id_mcl`, di backend tabel ini `id_md`. Mobile-side aliasing mapping (lihat `getNtData` returning `id_mcl` dari `id_md`).

---

### 1.7 `call_list`

Daftar customer yang akan dikunjungi bulan ini (planning awal bulan).

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | int PK | - |
| `id_peg` | int | pemilik (MR) |
| `id_ff` | int | - |
| `id_mcl` | int | FK ke `list_dokter_visit_new.id_md` |
| `periode` | date | `YYYY-MM-01` |
| `nama_dokter`, `spec`, `segmen`, `class` | various | denormalized snapshot |
| `wilayah` | string nullable | jika luar kota → multiplier `target_visit` |
| `target_visit` | int | target kunjungan untuk customer ini bulan ini |
| `approval` | string nullable | NULL / `"Approve"` / `"Reject"` |
| `approval_by` | int | rowid DM |
| `approval_date` | datetime | - |
| `approval_comment` | string | wajib jika Reject |
| `is_visited` | int | 0 / 1 — di-set saat actual approved |
| `updated_by`, `updated_date` | - | audit |

**Aturan unik**: 1 row per `(id_peg, id_mcl, periode)`. Duplikasi di-tolak di save.

---

### 1.8 `call_list_history`

Audit trail untuk edit `call_list`.

| Kolom | Tipe |
|-------|------|
| `id` | int PK |
| `call_list_id` | int FK |
| `action_type` | string (mis. `UPDATE`) |
| `action_date` | datetime |
| `action_by` | int |
| `reason` | string |
| `old_id_mcl`, `new_id_mcl` | int |
| `old_nama_dokter`, `new_nama_dokter` | string |
| `old_spec`, `new_spec` | string |
| `old_class`, `new_class` | string |
| `old_segmen`, `new_segmen` | string |
| `old_wilayah`, `new_wilayah` | string |
| `old_target_visit`, `new_target_visit` | int |

INSERT di `updateCallList`. Mobile baca via `getCallListHistory`.

---

### 1.9 `call_plan_actual` (tabel inti)

Sentral untuk plan + actual + approval (1 tabel, 2 fungsi).

| Kolom | Tipe | Fungsi |
|-------|------|--------|
| `id` | int PK | - |
| `id_peg` | int | pemilik (MR atau atasan kalau join_visit copy) |
| `id_ff` | int | - |
| `nama_ff` | string | - |
| `divisi` | string | - |
| `id_mcl` | int | FK ke `list_dokter_visit_new.id_md` |
| `nama_dokter`, `spec`, `segmen_md`, `class` | various | snapshot |
| `institusi`, `alamat_praktek`, `koordinat_institusi` | various | snapshot |
| **Plan fields** | | |
| `tgl_plan` | date nullable | tanggal rencana |
| `waktu` | time | jam plan |
| `product_list` | TEXT/JSON | produk yang akan dibahas |
| `keterangan` | string | catatan plan |
| `approval` | string | NULL/Approve/Reject — untuk plan |
| `approval_by`, `approval_date` | various | - |
| **Actual fields** | | |
| `tgl_actual` | date nullable | tanggal kunjungan |
| `waktu_actual` | time | jam actual |
| `koor_visit` | string | GPS `"lat,long"` |
| `stt_koor` | int | status koordinat |
| `status` | string | `Visit`, `Offline`, dll. |
| `foto` | string | filename foto |
| `tanda_tangan` | string | filename tanda tangan |
| `approval_actual` | string | NULL/Approve/Reject — untuk actual |
| `approval_actual_by`, `approval_actual_date`, `approval_actual_comment` | various | - |
| **Join visit fields** | | |
| `join_visit` | int | 1 = atasan ikut |
| `join_visit_id` | string | row asal (jika row ini hasil copy atasan) |
| `join_visit_ff` | string | CSV peg ID atasan yang ikut |
| **Audit** | | |
| `updated_date` | datetime | dipakai validasi window 30 menit / 1 jam |

**State machine** (umum):

```
INSERT (tgl_plan, waktu, ...)
   │
   │ approval = NULL
   ▼
DM approve plan → approval = 'Approve'
   │
   ▼
MR save actual → UPDATE (tgl_actual, waktu_actual, koor_visit, foto, tanda_tangan, status)
   │            approval_actual = NULL
   │            (jika join_visit=1, JoinVisitController::joinVisitCopyData INSERT row baru atas nama atasan)
   ▼
DM approve actual → approval_actual = 'Approve'
   │              call_list.is_visited = 1 (untuk semua row id_peg di user yang sama)
   ▼
DONE
```

Untuk unplanned/NTU visit: INSERT langsung dengan `tgl_plan = NULL`, `tgl_actual = today`.

---

### 1.10 `call_setting`

Konfigurasi bisnis per role/divisi.

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `input_set` | string | identifier rule (mis. `approval_list_deadline`) |
| `jumlah` | int nullable | nilai konfigurasi (mis. `5` untuk hari kerja) |
| `id_user` | int | (?) — dipakai dalam JOIN dengan `data_pegawai` |

JOIN: `call_setting × data_pegawai ON id_user`. Membantu mendiferensiasi rule per role.

---

### 1.11 `call_target_list`

Target call list per (jabatan, divisi).

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `jabatan` | string | - |
| `divisi` | string | - |
| `target_dokter` | int | jumlah dokter max |
| `target_non_dokter` | int | jumlah non-dokter max |

Dipakai di `saveCallList` (validasi) dan `getCallListTarget`.

---

### 1.12 `call_target_hari`

Target call productivity per hari per (jabatan, divisi).

| Kolom | Tipe |
|-------|------|
| `jabatan` | string |
| `divisi` | string |
| `target_per_day_dokter` | int |
| `target_per_day_non_dokter` | int |

Dipakai di `getProductivityTarget`.

---

### 1.13 `call_target_class`

Target frekuensi per class (untuk `freq report`).

| Kolom | Tipe |
|-------|------|
| `jabatan` | string |
| `class` | string |
| `target` | int |

JOIN di `getFreqReport`.

---

### 1.14 `data_product`

Master produk.

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id_product` | int PK | - |
| `nama_product` | string | - |
| `jenis_product` | string | mis. `Ethical` |
| `kemasan` | string | - |
| `product_detail_link` | string | URL PDF detail produk |
| `status` | string | filter `AKTIF` |

---

### 1.15 `data_spec_dr`

Spesialisasi dokter (dropdown).

| Kolom | Tipe |
|-------|------|
| `spec` | string PK |

---

### 1.16 `visit_tidak_kunjungan` & `visit_tidak_kunjungan_mr`

Unvisit (ketidakhadiran).

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | int PK | - |
| `id_peg` | int | - |
| `id_ff` | string | - |
| `nama` | string | snapshot |
| `jabatan` | string | snapshot |
| `divisi` | string | snapshot |
| `periode` | string | format `MM-YYYY` |
| `week` | string/int | nomor minggu |
| `tanggal` | date | tanggal yang tidak masuk |
| `alasan` | string | dari pilihan tetap |
| `keterangan` | string | optional |

**Routing**: jabatan MR/PS/KAE → `visit_tidak_kunjungan_mr`. Lainnya → `visit_tidak_kunjungan`.

Dipakai di:
- `addUnvisit` / `getUnvisitList` / `deleteUnvisit`.
- `getWorkingDays` & `getProductivityTarget` untuk hitung `effective_working_days`.

---

## 2. Tabel cross-database (`report_admin_mkt`)

### 2.1 `set_param_sum_mcr`

Kalender hari kerja per periode.

| Kolom | Tipe |
|-------|------|
| `periode` | string (`MM-YYYY`) |
| `hari_kerja` | int |

Dipakai di `getWorkingDays` & `getProductivityTarget`.

> **Setup**: user MySQL backend harus punya `GRANT SELECT ON report_admin_mkt.set_param_sum_mcr` (atau seluruh schema). Atau pindahkan jadi koneksi terpisah di `config/database.php`.

---

## 3. Storage filesystem

Tidak ada tabel — file di-store di disk:

| Folder | Isi |
|--------|-----|
| `public/assets/images/photos/` | Foto kunjungan (`<timestamp>_<rand5>.jpg`) |
| `public/assets/images/ttd/` | Tanda tangan (`signature_<timestamp>_<rand5>.png`) |

Hanya **filename** yang disimpan di `call_plan_actual.foto` & `tanda_tangan`. Mobile assemble URL = `BaseApi.publicUrl + "/assets/images/{folder}/" + filename`.

---

## 4. Relasi (ringkas)

```
users (1) ─── id_user ──→ (N) data_pegawai
                              rowid = id_peg
                                  │
                                  ├──→ call_list (N)
                                  │     id_mcl ──→ list_dokter_visit_new
                                  │
                                  ├──→ call_plan_actual (N)
                                  │     id_mcl ──→ list_dokter_visit_new
                                  │     join_visit_id ──→ call_plan_actual (self)
                                  │
                                  └──→ visit_tidak_kunjungan{_mr} (N)

struktur (N) ─── id_peg_mr/dm/rsm/mm ──→ data_pegawai

app_role_menu (N) ─── id_modul ──→ app_modul
                  └── id_user ──→ users
```

---

## 5. Index yang direkomendasikan

Berdasarkan pola query yang sering muncul:

- `call_list`: composite index `(id_peg, periode)` + `(id_peg, periode, approval)`.
- `call_plan_actual`:
  - `(id_peg, tgl_plan)`
  - `(id_peg, tgl_actual, approval_actual)`
  - `(approval, tgl_plan)` (untuk approval queue)
  - `(join_visit, updated_date)` (window 30 menit)
- `struktur`: `(periode_awal, periode_akhir)` + `(id_peg_mr)`, `(id_peg_dm)`.
- `data_pegawai`: `(id_user)`, `(jabatan, divisi)`.

Cek `EXPLAIN` di query yang lambat dan tambahkan index sesuai kebutuhan.

---

## 6. Catatan migration

Backend tidak punya migration file di repo. Untuk perubahan schema:

- **Sekali pakai**: tulis SQL script di root (`add_*.sql`) seperti file di mobile repo `add_product_list_column.sql`.
- **Long-term**: pertimbangkan untuk generate `database/migrations/*.php` dari schema existing dengan `php artisan migrate:install` + tools introspeksi (mis. `kitloong/laravel-migrations-generator`), supaya perubahan ke depan ter-version-control.

Lanjut ke [`06-business-logic.md`](./06-business-logic.md).
