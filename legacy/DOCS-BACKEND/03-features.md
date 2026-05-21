# 03 — Fitur Backend

Fitur backend dikelompokkan per modul. Detail signature/payload tiap endpoint ada di [`04-api-reference`](./04-api-reference.md).

---

## 1. Otentikasi & menu user

### 1.1 Login

- **Endpoint**: `POST /login`
- **Controller**: [`MainMenuController::login`](../app/Http/Controllers/api_server/Api/MainMenuController.php#L15)
- **Flow**:
  1. Cari user di `users` by `username`.
  2. Verifikasi password dengan `Hash::check()` (bcrypt).
  3. Query `data_pegawai` WHERE `id_user = users.id` dan `IFNULL(status,"Exist")="Exist"` → ambil `rowid` (= id_peg), `id` (= id_ff), `divisi`, `jabatan`.
  4. Aggregate: `divisi` = comma-separated unique, `jabatan` = first row (asumsi 1 user = 1 jabatan).
  5. Response include array `id_peg` & `id_ff` (1 user bisa punya banyak pegawai).

> **Catatan**: tidak ada token / session. Mobile menyimpan response & re-kirim `id_peg` di tiap request berikutnya. Pertimbangkan Sanctum/Passport untuk hardening.

### 1.2 Daftar modul

- **Endpoint**: `GET /modul-user/{id_user}`
- **Controller**: [`MainMenuController::getModulesByUser`](../app/Http/Controllers/api_server/Api/MainMenuController.php#L72)
- **Logic**: JOIN `app_role_menu` × `app_modul` filter by `id_user`. Field yang di-return: `id_modul`, `nama_modul`, `icons2`.
- **Endpoint pendukung**: `GET /modul-all` (semua modul untuk debugging).

---

## 2. System / utility

### 2.1 Server date

- **Endpoint**: `GET /server-date`
- **Definisi inline di route** (lihat [`routes/api.php`](../routes/api.php#L29)).
- **Response**: `{ "date": "<ISO8601>" }` — pakai `now()->toIso8601String()`.
- **Pemakaian**: mobile pakai untuk sinkron jam (cegah device-time-change yang memalsukan `tgl_actual`).

### 2.2 App version gate

- **Endpoint**: `GET /app-version` → method `VisitController::getAppVersion`.
- **Sumber data**: tabel `call_version`.
- **Pemakaian**: mobile `VersionChecker.checkAndPromptUpdate()` membandingkan dengan `AppVersion.current`. Jika beda → dialog update wajib.
- **Selain itu**: setiap endpoint write/approve memanggil [`checkAppVersion()`](../app/Http/Controllers/api_server/Api/VisitController.php#L36) yang baca header `X-App-Version`. Empty → HTTP 426.

### 2.3 Master pendukung

| Endpoint | Sumber | Fungsi |
|----------|--------|--------|
| `GET /doctor-spec` | `data_spec_dr.spec` | Dropdown spesialisasi (inline definition di [route](../routes/api.php#L57)) |
| `GET /modul-all` | `app_modul` | Semua modul (inline di [route](../routes/api.php#L39)) |
| `GET /get-product-list` | `data_product` WHERE status='AKTIF' | Pilihan produk saat add call plan |
| `GET /get-unvisit-alasan` | hardcoded di controller | Pilihan alasan unvisit (sakit/cuti/event/dll.) |
| `GET /get-unvisit-config` | hardcoded di controller | `days_back=15`, `days_forward=30` untuk range picker |
| `GET /get-app-config` | konstanta di `JoinVisitController` | Radius join visit (default 100 meter) |

---

## 3. Master data dokter / customer

- **Endpoint**: `POST /doctor-list`
- **Controller**: [`VisitController::doctorList`](../app/Http/Controllers/api_server/Api/VisitController.php#L50)
- **Tabel**: `list_dokter_visit_new` (filter `STATUS_MD IS NULL OR 'AKTIF'`) + `data_pegawai` + `struktur` untuk hierarki.
- **Filter**: `search` (nama_dokter / institusi), `specFilter`, `classFilter`, `id_peg` (JSON array). Untuk DM/RSM/PE/PM, list akan di-expand ke semua bawahan via `struktur`.

### 3.1 NT (Non-Target Unique) data

- **Endpoint**: `POST /nt-get-data`
- **Method**: `VisitController::getNtData`
- **Bedanya dari `/doctor-list`**: grouping `nama_dokter + institusi` (multi-lokasi), tanpa filter periode call_list. Digunakan saat user mau add unplanned visit ke dokter di luar daftar call_list.

---

## 4. Call List

Daftar dokter/non-dokter yang **akan** dikunjungi bulan ini (planning awal bulan).

| Action | Endpoint | Method |
|--------|----------|--------|
| List existing | `POST /call-list-data` | `displayCallList` & `getCallListData` |
| Add — pilihan dokter | `POST /call-list-get` | `getCallList` (LEFT JOIN exclude already added) |
| Add — hitung sisa kuota | `POST /call-list-count` | `getMonthlyCount` |
| Add — simpan | `POST /call-list-save` | `saveCallList` |
| Edit | `POST /call-list-update` | `updateCallList` (hanya bisa kalau status='Reject') |
| Delete | `POST /call-list-delete` | `deleteCallList` (tidak boleh kalau sudah ada di `call_plan_actual` bulan itu) |
| History audit | `POST /call-list-history` | `getCallListHistory` |
| Cek target | `POST /get-call-list-target` | `getCallListTarget` (target dokter & non-dokter per jabatan/divisi) |
| Notif pending user | `POST /get-my-pending-call-list-count` | `getMyPendingCallListCount` (untuk badge MR) |

Target dokter & non-dokter di-baca dari tabel `call_target_list` — **dinamis** (bukan hardcode mobile). Mobile constants `CallReachTargets` adalah fallback jika tabel kosong.

### 4.1 Save flow

1. Cek `X-App-Version`.
2. Cek `BATAS_HARI_KERJA_LIST` (5 hari kerja awal bulan) — kecuali bulan ada di `OVERRIDE_BULAN_LIST`.
3. Cek duplikasi `id_mcl` untuk `id_peg` + bulan yang sama → reject jika ada.
4. Validasi total dokter & non-dokter vs target di `call_target_list` per jabatan & divisi.
5. Hitung `target_visit` (untuk wilayah luar kota — multiplier).
6. `INSERT call_list` dengan `approval = NULL`.

### 4.2 Update flow (re-submission)

- Hanya bisa kalau `approval = 'Reject'`.
- `UPDATE call_list` reset `approval = NULL` (re-trigger DM approval).
- `INSERT call_list_history` dengan field old/new untuk audit (lihat schema di [`05-database-schema`](./05-database-schema.md)).

---

## 5. Call Plan

Rencana kunjungan tanggal-spesifik dari daftar `call_list` yang sudah di-approve.

| Action | Endpoint | Method |
|--------|----------|--------|
| List existing | `POST /call-plan-data` | `displayCallPlan` |
| Add — pilihan dokter | `POST /call-plan-doctor` | `callPlanDoctor` (dari `call_list` WHERE approval='Approve') |
| Add — pilihan lokasi | `POST /call-plan-inst` | `callPlanInst` (multi-institusi per dokter) |
| Add — simpan | `POST /call-plan-save` | `saveCallPlan` |
| Delete | `POST /call-plan-delete` | `deleteCallPlan` (tolak kalau `tgl_actual` sudah ada) |
| Offline sync | `POST /offline-call-plan` | `offlineCallPlan` (download approved plan untuk cache mobile) |

### 5.1 Produk yang dipilih per plan

Kolom `call_plan_actual.product_list` (TEXT, JSON array) menyimpan ID produk yang akan dibahas saat kunjungan — di-isi dari `getProductList` di mobile. Migration awal ada di file root repo aplikasi (`add_product_list_column.sql` di repo mobile).

---

## 6. Call Actual

Realisasi kunjungan: GPS + foto + tanda tangan + waktu actual.

| Action | Endpoint | Method |
|--------|----------|--------|
| List existing | `POST /call-actual-data` | `displayActual` |
| Detail | `GET /call-actual-details/{id}` | `getActualDetails` (include resolve nama atasan join visit) |
| Save (planned) | `POST /call-actual-save` | `saveActual` (update row `call_plan_actual` yang sudah ada `tgl_plan`) |
| Save (unplanned/NT) | `POST /unplan-actual-save` | `saveUnplanned` (INSERT row baru tanpa `tgl_plan`) |
| Get FF name (untuk display) | `POST /get-ff-data` | `getFFname` |

### 6.1 Aturan validasi `saveActual` / `saveUnplanned`

- `X-App-Version` wajib.
- `tgl_actual` **harus = hari ini** server-side. Cek dengan `Carbon::today('Asia/Jakarta')`.
- Untuk status 'Offline' (sync dari mobile yang sebelumnya offline), maksimal **1 jam** dari `updated_date` row.
- Kolom yang di-update/insert: `koor_visit`, `tgl_actual`, `waktu_actual`, `status`, `keterangan`, `stt_koor`, `join_visit`, `join_visit_id`, `foto`, `tanda_tangan`.
- Untuk join visit (saat `join_visit=1`): tiap atasan di `join_visit_id` digandakan rownya via `joinVisitCopyData()` (lihat [`JoinVisitController`](../app/Http/Controllers/api_server/Api/JoinVisitController.php#L249)).

### 6.2 Foto & tanda tangan

Pipeline 2 langkah (lihat [`ImageController`](../app/Http/Controllers/api_server/Api/ImageController.php)):

1. `POST /upload-photo` (multipart, `photo=@file.jpg`) → backend simpan ke disk, return `filename` + `path` (URL).
2. `POST /actual-save-photo` `{ id, foto }` atau `POST /actual-save-signature` `{ id, signature }` → update kolom di `call_plan_actual`.

> Heuristik signature: file dianggap signature kalau nama file mengandung `signature` ATAU body field `type=signature`. Lokasi disk dibedakan (`assets/images/ttd` vs `assets/images/photos`).

---

## 7. Approval (DM/RSM/MM)

Tiga jenis approval di [`VisitApprovalController`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php):

| Jenis | Tabel yang di-update | Endpoint utama |
|-------|----------------------|----------------|
| Call List | `call_list.approval/approval_by/approval_date/approval_comment` | `/dm-approval-list-name`, `/dm-approval-list-details`, `/dm-approval-list-save` |
| Call Plan | `call_plan_actual.approval/approval_by/approval_date` | `/dm-approval-plan-name`, `/dm-approval-plan-details`, `/dm-approval-plan-save` |
| Call Actual | `call_plan_actual.approval_actual/approval_actual_by/approval_actual_date/approval_actual_comment` | `/dm-approval-actual-name`, `/dm-approval-actual-details`, `/dm-approval-actual-save`, `/dm-approval-actual-single` |

### 7.1 Pola "name → details → save"

1. **`name`** — list pegawai bawahan yang punya pending approval (untuk dashboard atasan).
2. **`details`** — detail item per pegawai (untuk halaman approve).
3. **`save`** — batch approve/reject multiple items sekaligus.

Tambahan untuk actual: `dm-approval-actual-single` untuk approval per-item dengan komentar wajib (dipakai dari halaman view detail actual di mobile).

### 7.2 Deadline approval

Lihat [`06-business-logic.md`](./06-business-logic.md#deadline-approval) untuk detail. Singkatnya:

- **List**: sampai hari kerja ke-`BATAS_HARI_KERJA_LIST` (5) tiap bulan.
- **Plan**: untuk `tgl_plan = hari ini`, batas sebelum `BATAS_JAM_PLAN` (10:00 WIB). Lewat itu → tgl_plan dianggap besok.
- **Actual**: maksimal `BATAS_HARI_ACTUAL` (1) hari setelah `tgl_actual`, di hari batas sebelum `BATAS_JAM_ACTUAL` (10:00 WIB). Weekend di-extend (Sunday +2, Monday +3).

### 7.3 Cascade & guard

- **Reject Plan** → auto cascade `approval_actual = 'Reject'` juga.
- **Approve Actual** → set `call_list.is_visited = 1` untuk semua row `id_peg` yang milik user yang sama (combo account via `id_user`).
- **Approve Actual tanpa foto** → tolak dengan `error_code: APPROVAL_ACTUAL_NO_FOTO`.
- **Approve Actual lewat deadline** → tolak dengan `error_code: APPROVAL_ACTUAL_EXPIRED`.

### 7.4 Notifikasi reminder

- **Endpoint**: `POST /dm-approval-notification-summary` → return count + deadline + `interval_minutes`.
- **Endpoint MR-side**: `POST /get-my-pending-call-list-count` → badge "Call List saya masih pending DM approve" untuk MR.
- Mobile `ApprovalNotificationService` polling pakai `interval_minutes` dari server. Saat ini konstanta `NOTIFICATION_INTERVAL_MINUTES = 1` (untuk testing). **Reset ke 30 sebelum production.**

---

## 8. Join Visit

Atasan ikut MR mengunjungi dokter.

| Action | Endpoint | Method |
|--------|----------|--------|
| List atasan yang bisa di-tag | `POST /call-join-visit` | `callJoinVisit` |
| List pending atasan (untuk approval) | `POST /approval-join-visit` | `approvalJoinVisit` |
| Detail per MR per bulan | `POST /approval-join-details` | `joinVisitDetails` |
| Copy row ke akun atasan | `POST /copy-join-visit` | `copyJoinVisit` |
| Konfigurasi (radius) | `GET /get-app-config` | `getAppConfig` (konstanta `JOIN_VISIT_RADIUS_METERS`) |

### 8.1 Logic copy

`joinVisitCopyData($actualId, $approverPegId, $koorVisit)` (privat di JoinVisitController):

1. Read row dari `call_plan_actual` by id MR.
2. Read approver dari `data_pegawai`.
3. Clone array, unset `id`.
4. Replace `id_peg`/`id_ff`/`nama_ff` dengan data approver.
5. Reset semua field approval (Approve/Reject diisi ulang oleh atasan masing-masing).
6. Set `join_visit = 0`, `join_visit_id = <id MR>`, `join_visit_ff = <approver rowid>`.
7. INSERT ke `call_plan_actual` sebagai row baru.

Hasil: 1 kunjungan tampil 2× (atau lebih) di laporan — masing-masing untuk MR & atasan.

---

## 9. Unvisit

Mencatat **ketidakhadiran** MR pada tanggal tertentu (sakit, cuti, training, dll.) supaya target dihitung pro-rata.

| Action | Endpoint | Method |
|--------|----------|--------|
| Get pilihan alasan | `GET /get-unvisit-alasan` | `getUnvisitAlasan` (hardcoded list) |
| Get config range tanggal | `GET /get-unvisit-config` | `getUnvisitConfig` (15 hari ke belakang, 30 hari depan) |
| Add | `POST /add-unvisit` | `addUnvisit` |
| List | `POST /get-unvisit-list` | `getUnvisitList` |
| Delete | `POST /delete-unvisit` | `deleteUnvisit` |

Tabel: `visit_tidak_kunjungan_mr` (untuk MR/PS/KAE), `visit_tidak_kunjungan` (lainnya). `addUnvisit` & `getUnvisitList` mem-route ke tabel yang sesuai berdasarkan `jabatan`.

`getProductivityTarget` & `getWorkingDays` mengurangi `working_days` dengan jumlah unvisit untuk hitung **effective working days** → target bulanan pro-rata.

---

## 10. Reports

| Endpoint | Method | Output |
|----------|--------|--------|
| `POST /get-call-report` | `getCallReport` | Detail report kunjungan |
| `POST /get-report-reach-prod` | `getReachProdReport` | `reach_doctor`, `reach_non_doctor`, `prod_doctor`, `prod_non_doctor` |
| `POST /get-report-freq` | `getFreqReport` | Per-dokter: target vs actual, `point` (1 kalau actual ≥ target) |
| `POST /get-working-days` | `getWorkingDays` | `working_days` − `unvisit_count` = `effective_working_days` |
| `POST /get-productivity-target` | `getProductivityTarget` | Target dokter/non-dokter bulanan = `per_day × effective_working_days` |

`getProductivityTarget` ⇒ menggantikan konstanta hardcode di mobile (`CallProductivityTargets`). Saat dipakai, mobile prefer angka dari endpoint ini supaya admin bisa ubah target tanpa rilis APK baru.

---

## 11. Offline endpoint

Mobile butuh **snapshot** approved data untuk kerja offline. Endpoint khusus:

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `POST /offline-call-plan` | `offlineCallPlan` | Plan yang sudah `approval='Approve'` dan `tgl_actual IS NULL` |
| (lainnya di `VisitController_dev`) | `offlineMCL`, `offlineCallList` | Untuk env dev — PROD biasanya pakai endpoint regular |

Tidak ada "queue endpoint" di backend — mobile menyimpan submission lokal dan replay ke endpoint biasa (`call-actual-save`, dll.) saat reconnect.

---

Lanjut ke [`04-api-reference.md`](./04-api-reference.md) untuk detail tiap endpoint.
