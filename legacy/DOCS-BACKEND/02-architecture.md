# 02 — Arsitektur Backend

Dokumen ini menjelaskan **struktur folder**, **lapisan kode**, dan **konvensi** yang dipakai backend Laravel MMS.

---

## 1. Struktur folder repo

```
API-MSF/
├── app/
│   └── Http/
│       └── Controllers/
│           └── api_server/
│               └── Api/                       ← namespace App\Http\Controllers\Api
│                   ├── ImageController.php          Upload & save foto/signature
│                   ├── JoinVisitController.php      Logic join visit (MR + atasan)
│                   ├── MainMenuController.php       Login + modul user
│                   ├── VisitApprovalController.php  Approval list/plan/actual (1695 baris)
│                   └── VisitController.php          Inti visit + reports (2927 baris)
├── routes/
│   └── api.php                                Definisi route (PROD + DEV)
└── DOCS-BACKEND/                              ← folder ini
```

> Catatan: nested `api_server/Api` adalah path file, sementara namespace di-`use` sebagai `App\Http\Controllers\Api\...` (lihat route file). Struktur ini hasil import dari ZIP — jika dirapikan ke `app/Http/Controllers/Api/` standar Laravel, namespace tidak perlu diubah.

---

## 2. Lapisan kode

Backend ini **flat** (controller → DB), **tanpa service layer / repository**:

```
┌─────────────────────────────────────────────────────────┐
│  Routes (routes/api.php)                                │
│  - 60+ POST/GET endpoints                               │
│  - Group prefix('dev') untuk env testing                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  Controllers (app/Http/Controllers/api_server/Api/)     │
│  - 5 controller, semua extend App\Http\Controllers\…    │
│  - Method publik = handler endpoint                     │
│  - Method privat = helper (checkAppVersion, hitungDead…)│
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  DB Query Builder (Illuminate\Support\Facades\DB)       │
│  - DB::table('...') untuk SELECT / INSERT / UPDATE      │
│  - Sebagian INSERT/UPDATE dibungkus DB::transaction()   │
└─────────────────────────────────────────────────────────┘
```

Eloquent model **tidak dipakai konsisten** — beberapa file `app/Models/*` di-import (`AppModul`, `User`, `list_dokter_visit`, `data_dokter`) tapi controller mayoritas pakai `DB::table()` langsung.

---

## 3. Tanggung jawab per controller

### `MainMenuController` (86 baris)

Login & menu dinamis.

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `login()` | `POST /login` | Verifikasi user, return profil + `id_peg[]` + divisi + jabatan |
| `getModulesByUser($id_user)` | `GET /modul-user/{id_user}` | Modul yang boleh diakses user, dari `app_role_menu × app_modul` |

### `ImageController` (74 baris)

Upload file + simpan path ke row visit.

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `uploadPhoto()` | `POST /upload-photo` | Validasi `image|mimes:jpeg,png,jpg|max:5120`, simpan ke disk |
| `savePhoto()` | `POST /actual-save-photo` | Update kolom `foto` di `call_plan_actual` |
| `saveSignature()` | `POST /actual-save-signature` | Update kolom `tanda_tangan` di `call_plan_actual` |

> Heuristik signature/photo: file disebut signature kalau nama file mengandung `signature` ATAU body field `type=signature`. Lokasi disk dipilih berdasarkan flag ini.

### `VisitController` (2927 baris)

Inti modul Visit — master, call list, call plan, call actual, reports, unvisit, offline. Lihat [`04-api-reference`](./04-api-reference.md#3-visitcontroller) untuk daftar method lengkap.

Method privat penting:
- `checkAppVersion(Request)` — return null kalau OK, atau response 426 kalau header `X-App-Version` kosong.

Konstanta yang bisa di-tune tanpa redeploy mobile:
- `BATAS_HARI_KERJA_LIST = 5` — sampai hari kerja ke-5 boleh add call list.
- `OVERRIDE_BULAN_LIST = ''` — set `'YYYY-MM'` untuk bypass batas pada bulan tertentu.

### `VisitApprovalController` (1695 baris)

Approval call list / plan / actual oleh DM/RSM/MM. Lihat [`04-api-reference`](./04-api-reference.md#4-visitapprovalcontroller) untuk daftar method.

Konstanta penting:
- `BATAS_HARI_KERJA_LIST = 5` — sama seperti VisitController.
- `BATAS_JAM_PLAN = 10` — batas jam (WIB) untuk approve plan di hari yang sama dengan `tgl_plan`.
- `BATAS_HARI_ACTUAL = 1` — approve actual maksimal 1 hari setelah `tgl_actual`.
- `BATAS_JAM_ACTUAL = 10` — di hari batas, harus selesai sebelum 10:00 WIB.
- `NOTIFICATION_INTERVAL_MINUTES = 1` — interval polling reminder yang di-konsumsi mobile (default deploy: 30; saat ini 1 untuk testing — **perlu di-reset sebelum prod**).

### `JoinVisitController` (320 baris)

Kunjungan bersama atasan (DM/RSM ikut MR ke dokter).

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `callJoinVisit()` | `POST /call-join-visit` | Cari atasan eligible (DM/RSM) dari `struktur` |
| `approvalJoinVisit()` | `POST /approval-join-visit` | List pegawai yang punya join visit pending |
| `joinVisitDetails()` | `POST /approval-join-details` | Detail join visit per pegawai per bulan |
| `copyJoinVisit()` | `POST /copy-join-visit` | Duplikasi row `call_plan_actual` atas nama atasan |

> `joinVisitCopyData()` (privat) menggandakan row dari MR ke approver — clear `id`, ganti `id_peg`/`id_ff`, set `join_visit_id` ke ID asli, reset semua field approval. Logic ini krusial untuk laporan atasan.

---

## 4. Routing

File: [`routes/api.php`](../routes/api.php).

Pola:

- **Top-level routes** → controller PROD (`VisitController`, dll.).
- **Group `prefix('dev')`** → kebanyakan ke `VisitController_dev`, sebagian shared ke controller PROD.

Akses dev: `<host>/api/dev/<endpoint>` — mobile bisa pakai dengan ganti `BaseApi.url` ke `.../api/dev`.

Visit route yang sama (mis. `/doctor-list`) dideklarasi **dua kali** — sekali di top level (PROD) dan sekali di dalam `prefix('dev')` (DEV). Tabel mapping cepat:

| PROD | DEV (prefix `dev/`) | Catatan |
|------|---------------------|---------|
| `VisitController` | `VisitController_dev` | DEV pakai class terpisah |
| `VisitApprovalController` | `VisitApprovalController` | Sama (shared) |
| `JoinVisitController` | `JoinVisitController` | Sama (shared) |
| `MainMenuController` | `MainMenuController` | Sama (shared) |
| `ImageController` | `ImageController` | Sama (shared) |

> Di route file ada **dua deklarasi `/call-list-data`** berurutan (line 67 & 72), keduanya `POST` ke method berbeda (`displayCallList` & `getCallListData`). Laravel akan mendaftarkan keduanya tapi yang terakhir akan menang. Ini kemungkinan bug — verifikasi behavior yang diinginkan.

---

## 5. HTTP request flow (contoh: save call list)

```
Mobile (Flutter)
  └─ POST /api/call-list-save
       headers:
         X-App-Version: 8.2.37
       body:
         id_mcl=123, periode=2026-05-01, id_peg=45, …
         │
         ▼
Laravel Router → VisitController::saveCallList(Request)
  1. checkAppVersion()                     → 426 jika header kosong
  2. Validasi BATAS_HARI_KERJA_LIST        → reject jika sudah lewat
  3. Cek duplikasi id_mcl per bulan        → reject jika dobel
  4. Validasi target_list (dokter/non)     → reject jika over-target
  5. DB::table('call_list')->insert(...)
  6. response()->json([success, id])
         │
         ▼
Mobile parsing JSON
```

---

## 6. Konvensi response

Struktur umum yang dipakai mayoritas endpoint:

```json
{
  "success": true,
  "message": "Optional text",
  "data": <object | array>
}
```

Variasi yang muncul:

- Endpoint **legacy** (mis. `displayCallList`) hanya balas `{ "data": [...] }` tanpa `success`.
- Endpoint **error gate** balas `{ success: false, code: "VERSION_OUTDATED", message: "..." }` dengan HTTP **426**.
- Endpoint **approval actual** bisa balas `error_code: "APPROVAL_ACTUAL_NO_FOTO" | "APPROVAL_ACTUAL_EXPIRED"`.

Rekomendasi: konsisten gunakan `success` di semua response baru.

---

## 7. Timezone

Beberapa method men-set `date_default_timezone_set('Asia/Jakarta')` di awal (mis. `JoinVisitController::approvalJoinVisit`). Sisanya pakai `Carbon::now('Asia/Jakarta')` saat butuh waktu lokal.

Konsisten ke satu pola (saran: set di `config/app.php` → `'timezone' => 'Asia/Jakarta'`) agar tidak perlu override per-method.

---

## 8. Modul `App\Models`

Beberapa class model di-`use` di controller:

- `App\Models\User` — Eloquent, dipakai untuk lookup `users.id`.
- `App\Models\AppModul` — Eloquent, dipakai di `/modul-all`.
- `App\Models\data_dokter` — Eloquent, di-import tapi jarang di-call.
- `App\Models\list_dokter_visit` — Eloquent (di-import di banyak controller).

Mayoritas query tetap pakai `DB::table()`. Pertimbangkan untuk migrasi ke Eloquent secara bertahap untuk dapat relasi & type safety, tapi **jangan paksa di sekali jalan** — tabel-tabel ini sudah dipakai banyak query.

Lanjut ke [`03-features.md`](./03-features.md).
