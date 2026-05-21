# 04 — API Reference

Daftar lengkap endpoint backend MMS API. Base URL:

- **PROD**: `https://registrasi.mersimkt.web.id/api`
- **DEV** : `https://registrasi.mersimkt.web.id/api/dev`
- **Local**: `http://127.0.0.1:8000/api`

Semua endpoint mengembalikan JSON. Convention:

```json
{ "success": true, "data": <...>, "message": "..." }
```

> Endpoint **write/approve** wajib kirim header `X-App-Version: <semver>`. Tanpa header → HTTP `426`:
> ```json
> { "success": false, "code": "VERSION_OUTDATED", "message": "Aplikasi Anda tidak kompatibel..." }
> ```

---

## Daftar isi

1. [Auth & menu](#1-auth--menu)
2. [System & utility](#2-system--utility)
3. [Image upload](#3-image-upload)
4. [Master data dokter](#4-master-data-dokter)
5. [Call List](#5-call-list)
6. [Call Plan](#6-call-plan)
7. [Call Actual](#7-call-actual)
8. [Approval — List](#8-approval--call-list)
9. [Approval — Plan](#9-approval--call-plan)
10. [Approval — Actual](#10-approval--call-actual)
11. [Approval — Notifikasi](#11-approval--notifikasi)
12. [Join Visit](#12-join-visit)
13. [Unvisit](#13-unvisit)
14. [Reports](#14-reports)
15. [Targets & hari kerja](#15-targets--hari-kerja)
16. [Offline sync](#16-offline-sync)

---

## 1. Auth & menu

### `POST /login`

Verifikasi user dan return profile + struktur pegawai.

**Body** (`x-www-form-urlencoded`):

| Field | Tipe | Required | Catatan |
|-------|------|----------|---------|
| `username` | string | ✓ | match `users.username` |
| `password` | string | ✓ | di-`Hash::check` bcrypt |

**Response 200**:

```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 12,
    "username": "wahab",
    "name": "Wahab",
    "role": "user",
    "id_peg": [4501, 4502],
    "id_ff": [101, 102],
    "divisi": "Neptune,Jupiter",
    "jabatan": "MR"
  }
}
```

**Error** (username/password salah): `{ success: false, message: "Incorrect username/password." }` (HTTP 200).

---

### `GET /modul-user/{id_user}`

Modul yang boleh diakses user (untuk grid Home).

**Path param**: `id_user` (int).

**Response 200**:

```json
{
  "success": true,
  "modules": [
    { "id_modul": 1, "nama_modul": "Visit", "icons2": "visit.png" },
    { "id_modul": 2, "nama_modul": "Sales", "icons2": "sales.png" }
  ]
}
```

---

### `GET /modul-all`

Semua modul (debug/admin).

**Response**:

```json
{ "success": true, "data": [ ... ] }
```

---

## 2. System & utility

### `GET /server-date`

Tanggal-waktu server (untuk sinkron mobile, anti device-time-change).

**Response**: `{ "date": "2026-05-20T10:30:00+07:00" }`.

---

### `GET /app-version`

Versi APK terbaru (gate update wajib).

**Response 200**:

```json
{
  "success": true,
  "data": { "version": "8.2.37", "link_apk": "https://.../app-release.apk" }
}
```

Sumber: tabel `call_version`.

---

### `GET /doctor-spec`

Daftar spesialisasi (untuk dropdown filter).

**Response**: `{ "success": true, "data": ["Anak", "Bedah", ...] }`.

Sumber: `data_spec_dr.spec`.

---

### `GET /get-app-config`

Konfigurasi runtime untuk fitur join visit (radius validasi GPS).

**Response**:

```json
{
  "success": true,
  "data": {
    "join_visit_radius_meters": 100
  }
}
```

Sumber: konstanta `JoinVisitController::JOIN_VISIT_RADIUS_METERS`.

---

### `GET /get-product-list`

Daftar produk aktif untuk dipilih saat add call plan.

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id_product": 12,
      "nama_product": "Obat A",
      "jenis_product": "Ethical",
      "kemasan": "Strip 10 tablet",
      "product_detail_link": "https://..."
    }
  ]
}
```

Sumber: `data_product` WHERE `status = 'AKTIF'`.

---

## 3. Image upload

### `POST /upload-photo`

Upload file gambar (foto kunjungan atau tanda tangan).

**Body** (`multipart/form-data`):

| Field | Tipe | Required | Catatan |
|-------|------|----------|---------|
| `photo` | file | ✓ | `image|mimes:jpeg,png,jpg|max:5120` (5 MB) |
| `type` | string | optional | jika `signature` → simpan di folder `ttd` |

Heuristik signature: filename mengandung kata "signature" **atau** field `type=signature`.

**Response 200**:

```json
{
  "success": true,
  "filename": "1717843200_a1b2c.jpg",
  "path": "http://.../assets/images/photos/1717843200_a1b2c.jpg"
}
```

Validation error → 422 (Laravel default).

---

### `POST /actual-save-photo`

Update kolom `foto` di row `call_plan_actual`.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id` | int | ✓ (harus exists di `call_plan_actual.id`) |
| `foto` | string | ✓ (max 100, biasanya filename hasil `/upload-photo`) |

**Response**: `{ "success": true }`.

---

### `POST /actual-save-signature`

Update kolom `tanda_tangan` di row `call_plan_actual`.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id` | int | ✓ |
| `signature` | string | ✓ (max 100) |

**Response**: `{ "success": true }`.

---

## 4. Master data dokter

### `POST /doctor-list`

Master list dokter dengan filter & hierarchy.

**Body**:

| Field | Tipe | Required | Catatan |
|-------|------|----------|---------|
| `search` | string | optional | match `nama_dokter` atau `institusi` (LIKE %...%) |
| `specFilter` | string | optional | filter `spec` |
| `classFilter` | string | optional | filter `class` |
| `id_peg` | JSON string | optional | `"[4501,4502]"` — untuk DM/RSM auto-expand ke bawahan via `struktur` |

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id_md": 123,
      "nama_dokter": "dr. Andi",
      "spec": "Anak",
      "class": "A",
      "segmen_md": "Doctor",
      "institusi": "RS Mersi",
      "hari_praktek": "Senin,Rabu",
      "jam_mulai_praktek": "09:00",
      "jam_selesai_praktek": "12:00",
      "divisi": "Neptune",
      "id_peg": 4501,
      "id_ff": 101
    }
  ]
}
```

---

### `POST /nt-get-data`

Master untuk **Non-Target visit** (unplanned). Grouping by `nama_dokter + institusi`, tidak filter periode call_list.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id_peg` | JSON string | optional |
| `search` | string | optional |

**Response**: list `id_mcl`, `nama_dokter`, `spec`, `segmen_md`, `class`, `institusi`, `alamat_praktek`, `koordinat_institusi`.

---

### `POST /get-ff-data`

Lookup info Field Force (atasan/MR) by `id_peg`.

**Body**: `id_peg` (int atau array).

**Response**:

```json
{
  "success": true,
  "data": [
    { "rowid": 4501, "id": 101, "nama": "Wahab", "divisi": "Neptune" }
  ]
}
```

---

## 5. Call List

### `POST /call-list-data`

List call list user untuk bulan tertentu.

> ⚠️ Di [`routes/api.php`](../routes/api.php) endpoint ini dideklarasi dua kali (line 67 & 72), mapping berbeda (`displayCallList` & `getCallListData`). Yang aktif yang terakhir didaftarkan Laravel — verifikasi.

**Body**:

| Field | Tipe | Required | Catatan |
|-------|------|----------|---------|
| `id_peg` | JSON string | optional | filter pegawai |
| `periode` | date | optional | `'2026-05-01'` untuk filter bulan |

**Response**: list field dari `call_list` (`id`, `periode`, `id_peg`, `id_mcl`, `nama_dokter`, `spec`, `segmen`, `class`, `approval`, `target_visit`, dst.).

---

### `POST /call-list-get`

Pilihan dokter yang **belum** masuk call_list bulan ini (untuk add page).

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `search` | string | optional |
| `id_peg` | JSON string | optional (auto-expand via `struktur` untuk DM/RSM) |
| `id_ff` | int | optional |
| `periode` | date | optional |

**Response**: list `id_mcl`, `nama_dokter`, `spec`, `segmen_md`, `class`, + array `institusi`, `alamat_praktek` (1 dokter bisa multi-institusi).

---

### `POST /call-list-count`

Hitung sisa kuota call list bulan ini.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id_peg` | int | ✓ |
| `periode` | date | ✓ |

**Response**:

```json
{
  "success": true,
  "count": 45,
  "count_dokter": 30,
  "count_non_dokter": 15
}
```

---

### `POST /call-list-save`

Tambah dokter ke call_list.

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required | Catatan |
|-------|------|----------|---------|
| `id_mcl` | int | ✓ | from `list_dokter_visit_new.id_md` |
| `periode` | date | ✓ | format `YYYY-MM-01` |
| `id_peg` | int | ✓ | pemilik call_list |
| `nama_dokter`, `spec`, `segmen`, `class`, `id_ff` | various | optional | denormalized snapshot |

**Response 200**:

```json
{ "success": true, "message": "Call list saved successfully.", "id": 1234 }
```

**Errors yang mungkin** (mobile harus handle):
- HTTP 426 — `VERSION_OUTDATED`.
- HTTP 200 dengan `success: false` — over-target, duplikasi, atau lewat `BATAS_HARI_KERJA_LIST`.

---

### `POST /call-list-update`

Edit row call_list (hanya kalau status = `Reject`).

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `call_list_id` | int | ✓ |
| `id_mcl`, `periode`, `id_peg` | various | ✓ |
| `nama_dokter`, `spec`, `segmen`, `class`, `id_ff`, `wilayah`, `target_visit` | various | optional |
| `reason` | string | optional (untuk audit history) |

**Side effect**: reset `approval` ke `NULL` (re-trigger DM approve) + INSERT row di `call_list_history` (old/new value tiap kolom).

**Response**:

```json
{ "success": true, "message": "Call list updated successfully.", "changes": 1 }
```

---

### `POST /call-list-delete`

Hapus row call_list.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id_mcl` | int | ✓ |
| `id_peg` | int | ✓ |
| `periode` | date | ✓ |

**Guards**:
- Tolak kalau `call_plan_actual` sudah ada entry untuk `id_mcl` + `id_peg` di bulan yang sama.
- Tolak kalau `approval = 'Reject'` (harus pakai update flow).

**Response**:

```json
{ "success": true, "message": "Call list deleted successfully.", "deleted_rows": 1 }
```

---

### `POST /call-list-history`

Audit trail edit untuk call_list.

**Body**: `call_list_id` (int, ✓).

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "action_type": "UPDATE",
      "action_date": "2026-05-15 14:00:00",
      "old_id_mcl": 123,
      "new_id_mcl": 456,
      "old_nama_dokter": "dr. A",
      "new_nama_dokter": "dr. B",
      "reason": "Salah pilih"
    }
  ]
}
```

---

### `POST /get-call-list-target`

Target call list dokter & non-dokter user (per jabatan + divisi).

**Body**: `id_peg` (int / array), `periode` (date).

**Response**:

```json
{
  "success": true,
  "jabatan": "MR",
  "divisi": "Neptune",
  "target_dokter": 20,
  "target_non_dokter": 40,
  "target_total": 60
}
```

Sumber: `data_pegawai` (jabatan, divisi) → `call_target_list`.

---

### `POST /get-my-pending-call-list-count`

Badge MR: berapa call list saya yang masih pending DM approve.

**Body**: `id_peg` (array), `month` (int), `year` (int).

**Response**: `{ "success": true, "data": { "my_pending_count": 3 } }`.

---

## 6. Call Plan

### `POST /call-plan-data`

List call plan untuk bulan tertentu.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id_peg` | JSON string | optional |
| `monthYear` | string | optional (`"2026-05"`) |
| `dateSearch` | date | optional |
| `search` | string | optional |

**Response**: list dari `call_plan_actual` WHERE `tgl_plan IS NOT NULL`.

---

### `POST /call-plan-doctor`

Pilihan dokter (dari call_list yang sudah approve) untuk add call plan.

**Body**: `search`, `id_peg`, `year`, `month` (optional semua).

**Response**: list `id_mcl`, `nama_dokter`, `spec`, `segmen`, `class`, `id_ff`, `id_peg`.

---

### `POST /call-plan-inst`

Lokasi/institusi untuk dokter yang dipilih (dokter bisa praktek multi-lokasi).

**Body**: `id_mcl`, `id_ff`.

**Response**: list institusi + alamat + koordinat + FF resolution (untuk DM/RSM cari MR di bawahnya).

---

### `POST /call-plan-save`

Simpan call plan baru.

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id_mcl` | int | ✓ |
| `tgl_plan` | date | ✓ |
| `waktu` | time | ✓ |
| `id_peg` | int | ✓ |
| `nama_dokter`, `spec`, `segmen_md`, `class`, `id_ff`, `nama_ff`, `divisi`, `institusi`, `alamat_praktek`, `keterangan`, `koordinat_institusi` | various | optional (snapshot) |
| `product_list` | JSON array | optional (`"[12,34,56]"`) |
| `status` | string | optional |

**Response**: `{ "success": true, "message": "Call list saved successfully.", "id": 9999 }`.

---

### `POST /call-plan-delete`

Hapus call plan (tolak kalau `tgl_actual` sudah diisi).

**Body**: `id` (int, ✓).

**Response**: `{ "success": true, "message": "Call plan deleted successfully." }`.

---

## 7. Call Actual

### `GET /call-actual-details/{id}`

Detail satu row `call_plan_actual` + resolve nama atasan untuk join visit.

**Path param**: `id` (int).

**Response**:

```json
{
  "success": true,
  "data": {
    "id": 1234,
    "id_peg": 4501,
    "tgl_plan": "2026-05-15",
    "tgl_actual": "2026-05-15",
    "waktu_actual": "10:15:00",
    "koor_visit": "-6.234,106.789",
    "status": "Visit",
    "foto": "1717843200_a1b2c.jpg",
    "tanda_tangan": "signature_1717843300_x9y8z.png",
    "join_visit": 1,
    "join_visit_ff": "4001,4002",
    "join_visit_names": ["DM Budi", "RSM Cici"]
  }
}
```

---

### `POST /call-actual-data`

List actual visit.

**Body**: `id_peg`, `monthYear`, `dateSearch`, `search` (semua optional).

**Response**: list dari `call_plan_actual` WHERE `status IS NOT NULL`.

---

### `POST /call-actual-save`

Update planned row dengan actual data (GPS + foto + signature + waktu).

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required | Catatan |
|-------|------|----------|---------|
| `id` | int | ✓ | row di `call_plan_actual` |
| `koor_visit` | string | ✓ | `"lat,long"` max 100 char |
| `tgl_actual` | date | ✓ | **harus = today server-side** |
| `waktu_actual` | time | optional | - |
| `status` | string | optional | `Visit`, `Offline`, dst. |
| `keterangan` | string | optional | - |
| `stt_koor` | int | optional | flag status koordinat |
| `join_visit` | int | optional | 1 = ada atasan ikut |
| `join_visit_id` | string | optional | CSV peg ID atasan, `"4001,4002"` |
| `foto` | string | optional | filename (sudah upload via `/upload-photo`) |
| `tanda_tangan` | string | optional | filename |

**Guards**:
- `tgl_actual` harus `today` di TZ Asia/Jakarta.
- Untuk `status=Offline`: max 1 jam sejak `updated_date` row (mencegah replay terlalu lama).

**Side effect**: untuk tiap `join_visit_id`, panggil `joinVisitCopyData()` → INSERT row baru atas nama atasan.

**Response**: `{ "success": true, "id": 1234 }`.

---

### `POST /unplan-actual-save`

INSERT row baru untuk visit yang **tidak** ada plan-nya (NTU / unplanned).

**Headers**: `X-App-Version` ✓.

**Body**: Semua field di `/call-actual-save` PLUS `id_peg`, `id_ff`, `id_mcl`, `nama_dokter`, `spec`, `segmen_md`, `class`, `institusi`, `alamat_praktek`, `koordinat_institusi`, `product_list`.

**Guards**: sama dengan `saveActual` + tolak duplikasi (`id_peg + id_mcl + tgl_actual` sudah ada).

**Response**: `{ "success": true, "message": "Call list saved successfully.", "id": 9999 }`.

---

## 8. Approval — Call List

Update kolom: `call_list.approval`, `approval_by`, `approval_date`, `approval_comment`.

### `POST /dm-approval-list-name`

List pegawai bawahan yang punya call_list pending approval.

**Body**: `id_peg` (array), `month` (int), `year` (int).

**Response**:

```json
{
  "success": true,
  "data": [
    { "id_peg": 4501, "nama_pegawai": "Wahab", "total_request": 12 }
  ]
}
```

Empty array kalau deadline `BATAS_HARI_KERJA_LIST` sudah lewat.

---

### `POST /dm-approval-list-details`

Detail call list pending per pegawai.

**Body**: `id_peg` (int), `month`, `year`.

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "periode": "2026-05-01",
      "nama_dokter": "dr. A",
      "spec": "Anak",
      "segmen": "Doctor",
      "class": "A"
    }
  ]
}
```

---

### `POST /dm-approval-list-save`

Batch approve/reject call list.

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `dm_id_peg` | int | ✓ (rowid atasan) |
| `approvals` | array | ✓ |
| `approvals[].id` | int | ✓ (`call_list.id`) |
| `approvals[].approval` | string | ✓ (`"Approve"` / `"Reject"`) |
| `approvals[].approval_comment` | string | optional (wajib kalau Reject — enforce di mobile) |

**Response success**: `{ "success": true, "message": "Approvals saved successfully" }`.

**Response expired**:

```json
{
  "success": false,
  "error_code": "APPROVAL_LIST_EXPIRED",
  "message": "Deadline approval call list bulan ini sudah lewat."
}
```

---

## 9. Approval — Call Plan

Update kolom: `call_plan_actual.approval`, `approval_by`, `approval_date`.

### `POST /dm-approval-plan-name`

List pegawai dengan pending plan approval.

**Body**: `id_peg` (array), `month`, `year`.

**Response**: sama format `dm-approval-list-name`.

Filter: hanya tampilkan plan yang `tgl_plan` belum lewat batas `BATAS_JAM_PLAN`.

---

### `POST /dm-approval-plan-details`

Detail plan pending per pegawai.

**Body**: `id_peg` (int), `month`, `year`.

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 200,
      "tgl_plan": "2026-05-15",
      "waktu": "10:00:00",
      "id_mcl": 123,
      "nama_dokter": "dr. A",
      "spec": "Anak",
      "segmen_md": "Doctor",
      "class": "A",
      "institusi": "RS Mersi",
      "alamat_praktek": "Jl. ..."
    }
  ]
}
```

---

### `POST /dm-approval-plan-save`

Batch approve/reject plan.

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `dm_id_peg` | int | ✓ |
| `approvals[].id` | int | ✓ (`call_plan_actual.id`) |
| `approvals[].approval` | string | ✓ |

**Side effect** kalau Reject: cascade `approval_actual = 'Reject'`, `approval_actual_by`, `approval_actual_date` ke-set juga.

**Per-item guards**:
- `tgl_plan < today` → expired, item di-skip dengan error.
- `tgl_plan = today` AND sudah lewat `BATAS_JAM_PLAN` → expired.

**Response**: `{ "success": true, "message": "Plan approvals saved successfully" }`.

---

## 10. Approval — Call Actual

Update kolom: `call_plan_actual.approval_actual`, `approval_actual_by`, `approval_actual_date`, `approval_actual_comment`.

### `POST /dm-approval-actual-name`

List pegawai dengan pending actual approval.

**Body**: `id_peg` (array), `month`, `year`.

**Response**: format sama.

Filter cutoff dengan `BATAS_HARI_ACTUAL` + `BATAS_JAM_ACTUAL` + weekend adjustment.

---

### `POST /dm-approval-actual-details`

Detail actual pending per pegawai (dengan enrich nama join visit).

**Body**: `id_peg`, `month`, `year`.

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": 300,
      "tgl_plan": "2026-05-15",
      "tgl_actual": "2026-05-15",
      "waktu_actual": "10:30:00",
      "id_mcl": 123,
      "nama_dokter": "dr. A",
      "institusi": "RS Mersi",
      "alamat_praktek": "Jl. ...",
      "status": "Visit",
      "foto": "1717843200_a1b2c.jpg",
      "join_visit": 1,
      "join_visit_ff": "4001",
      "join_visit_names": ["DM Budi"]
    }
  ]
}
```

---

### `POST /dm-approval-actual-save`

Batch approve/reject actual.

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `dm_id_peg` | int | ✓ |
| `approvals[].id` | int | ✓ |
| `approvals[].approval_actual` | string | ✓ |
| `approvals[].approval_actual_comment` | string | ✓ untuk Reject |

**Per-item guards**:
1. Approve tapi `foto` kosong → tolak dengan `error_code: APPROVAL_ACTUAL_NO_FOTO`.
2. `tgl_actual` lewat cutoff (`BATAS_HARI_ACTUAL` + `BATAS_JAM_ACTUAL`, weekend +extra) → `APPROVAL_ACTUAL_EXPIRED`.

**Side effect** kalau Approve:
- `UPDATE call_list SET is_visited = 1` untuk semua row dengan `id_peg` yang sama-user (combo account via `data_pegawai.id_user`).

Dibungkus `DB::transaction()`.

**Response**:

```json
{ "success": true, "message": "Actual approvals saved successfully" }
```

---

### `POST /dm-approval-actual-single`

Approval per item (untuk halaman view detail). Komentar **wajib**.

**Headers**: `X-App-Version` ✓.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id` | int | ✓ |
| `dm_id_peg` | int | ✓ |
| `approval_actual` | string | ✓ |
| `approval_actual_comment` | string | ✓ (non-empty) |

**Update guard**: hanya update kalau `approval_actual IS NULL OR = 'Reject'` (idempotent).

**Response**: `{ "success": true, "message": "Actual berhasil di-approve" }`.

---

## 11. Approval — Notifikasi

### `POST /dm-approval-notification-summary`

Polling endpoint untuk reminder lokal di mobile.

**Body**: `id_peg` (array), `month`, `year`.

**Response**:

```json
{
  "success": true,
  "data": {
    "list_count": 3,
    "plan_count": 1,
    "actual_count": 5,
    "list_deadline": "2026-05-08 23:59:59",
    "plan_deadline": "2026-05-21 10:00:00",
    "actual_deadline": "2026-05-22 10:00:00",
    "interval_minutes": 30
  }
}
```

`interval_minutes` di-respect mobile → polling cadence di-kontrol server tanpa rilis APK.

---

## 12. Join Visit

### `POST /call-join-visit`

List atasan eligible untuk join visit MR ini.

**Body**: `id_peg` (JSON array).

**Response (MR)**:

```json
{
  "role": "MR",
  "atasan": [
    { "rowid": 4001, "nama": "DM Budi" },
    { "rowid": 4002, "nama": "RSM Cici" }
  ]
}
```

**Response (DM)**:

```json
{
  "role": "DM",
  "atasan": [
    { "rowid": 4002, "nama": "RSM Cici" }
  ]
}
```

Sumber: tabel `struktur` filter by `periode_awal/periode_akhir` yang mencakup `now()`.

---

### `POST /approval-join-visit`

List pegawai yang punya join visit pending approval atasan.

**Body**: `id_peg` (array), `month`, `year`.

**Response**:

```json
{
  "success": true,
  "data": [
    { "id_peg": 4501, "nama_pegawai": "Wahab", "total_request": 2 }
  ]
}
```

Filter: `call_plan_actual.join_visit=1` AND `updated_date >= NOW() - INTERVAL 30 MINUTE` (window 30 menit setelah submit).

---

### `POST /approval-join-details`

Detail join visit per pegawai (untuk halaman approval).

**Body**: `id_peg`, `month`, `year`, `approver_id`.

**Response**: list field `call_plan_actual` (id, tgl_plan, waktu, tgl_actual, waktu_actual, id_mcl, nama_dokter, spec, segmen_md, class, institusi, alamat_praktek, keterangan, status, foto).

---

### `POST /copy-join-visit`

Duplikasi row MR ke akun atasan (atas approval).

**Body**: `id` (int, ✓), `id_peg` (int, ✓, rowid approver), `koor_visit` (optional).

**Response**: `{ "success": true, "message": "Copy berhasil" }`.

Detail logic: lihat [03-features §8](./03-features.md#8-join-visit).

---

## 13. Unvisit

### `GET /get-unvisit-alasan`

Pilihan alasan unvisit.

**Response**:

```json
{
  "success": true,
  "data": [
    { "value": "sakit", "label": "Sakit" },
    { "value": "izin_tidak_masuk", "label": "Izin Tidak Masuk" },
    { "value": "cuti", "label": "Cuti" },
    { "value": "administrasi", "label": "Administrasi" },
    { "value": "event", "label": "Event" },
    { "value": "meeting", "label": "Meeting" },
    { "value": "training", "label": "Training" },
    { "value": "belum_aktif_bekerja", "label": "Belum Aktif Bekerja" },
    { "value": "other", "label": "Lainnya" }
  ]
}
```

---

### `GET /get-unvisit-config`

Range tanggal yang boleh untuk unvisit.

**Response**:

```json
{
  "success": true,
  "config": { "days_back": 15, "days_forward": 30 }
}
```

---

### `POST /add-unvisit`

Catat ketidakhadiran tanggal tertentu.

**Body**:

| Field | Tipe | Required |
|-------|------|----------|
| `id_peg` | int | ✓ |
| `periode` | date | ✓ (`YYYY-MM-01`) |
| `tanggal` | date | ✓ |
| `alasan` | string | ✓ (dari pilihan `/get-unvisit-alasan`) |
| `id_ff`, `nama`, `jabatan`, `divisi`, `keterangan` | various | optional |

**Guards**: tanggal harus dalam range `-days_back` s/d `+days_forward`. Cek duplikasi `id_peg + tanggal`.

**Routing tabel**:
- Jabatan match `MR/PS/KAE` → INSERT `visit_tidak_kunjungan_mr`.
- Selain itu → INSERT `visit_tidak_kunjungan`.

**Response**: `{ "success": true, "message": "...", "table": "visit_tidak_kunjungan_mr" }`.

---

### `POST /get-unvisit-list`

List unvisit bulan tertentu.

**Body**: `id_peg` (array), `periode` (date).

**Response**: merge dari 2 tabel, sorted by `tanggal`.

---

### `POST /delete-unvisit`

Hapus row unvisit by id.

**Body**: `id` (int, ✓).

**Behavior**: cari di `visit_tidak_kunjungan_mr` dulu; fallback ke `visit_tidak_kunjungan`.

**Response**: `{ "success": true, "message": "Data unvisit berhasil dihapus." }`.

---

## 14. Reports

### `POST /get-call-report`

Laporan kunjungan detail (per visit).

**Body**: `id_peg`, `periode`/`monthYear`, dll.

**Response**: list dari `call_plan_actual` dengan filter approved.

> Catatan: payload bisa berbeda tergantung versi controller — verifikasi langsung di [`VisitController::getCallReport`](../app/Http/Controllers/api_server/Api/VisitController.php).

---

### `POST /get-report-reach-prod`

Reach & Productivity report.

**Body**: `id_peg`, `year`, `month`.

**Response**:

```json
{
  "success": true,
  "reach_doctor": 18,
  "reach_non_doctor": 32,
  "prod_doctor": 75,
  "prod_non_doctor": 110
}
```

- `reach_*` = jumlah unique customer yang dikunjungi.
- `prod_*` = total kunjungan.

---

### `POST /get-report-freq`

Frequency report per dokter.

**Body**: `id_peg` (array), `periode` (`"YYYY-MM"`).

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id_peg": 4501,
      "id_ff": 101,
      "jabatan": "MR",
      "divisi": "Neptune",
      "id_mcl": 123,
      "nama_dokter": "dr. A",
      "segmen": "Doctor",
      "class": "A",
      "target": 4,
      "actual": 5,
      "point": 1
    }
  ],
  "freq_doctor": 12,
  "freq_non_doctor": 8
}
```

`point = 1` kalau `actual >= target`. Target per class diambil dari `call_target_class`.

---

## 15. Targets & hari kerja

### `POST /get-working-days`

Hari kerja & effective working days bulan.

**Body**: `year`, `month`, `id_peg` (optional).

**Response**:

```json
{
  "success": true,
  "working_days": 22,
  "unvisit_count": 3,
  "effective_working_days": 19,
  "period": "05-2026",
  "debug": { "input_year": 2026, "input_month": 5, ... }
}
```

Sumber working_days: `report_admin_mkt.set_param_sum_mcr`. Unvisit count: tabel `visit_tidak_kunjungan*`.

---

### `POST /get-productivity-target`

Target call productivity bulanan (dinamis dari DB, bukan hardcode mobile).

**Body**: `id_peg`, `year`, `month`.

**Response**:

```json
{
  "success": true,
  "jabatan": "MR",
  "divisi": "Neptune",
  "target_per_day_dokter": 4,
  "target_per_day_non_dokter": 6,
  "working_days": 22,
  "unvisit_count": 3,
  "effective_working_days": 19,
  "target_dokter": 76,
  "target_non_dokter": 114,
  "target_total": 190
}
```

Formula: `target = target_per_day × effective_working_days`.

Sumber target_per_day: `call_target_hari` (per jabatan × divisi). Mobile pakai endpoint ini untuk override konstanta lokal.

---

## 16. Offline sync

### `POST /offline-call-plan`

Snapshot approved plan untuk download mobile (cache offline).

**Body**: `id_peg`, `monthYear`, `dateSearch`, `search` (optional).

**Response**: list `call_plan_actual` WHERE `approval='Approve'` AND `tgl_actual IS NULL`.

---

### Endpoint dev offline lain

Di route group `prefix('dev')` ada:

- `offlineMCL` → master dokter (`VisitController_dev`).
- `offlineCallList` → call_list approved.

Untuk PROD, mobile pakai endpoint regular (`/doctor-list`, `/call-list-data`).

---

Lanjut ke [`05-database-schema.md`](./05-database-schema.md) untuk struktur tabel & relasi.
