# 04 — API & Backend Integration

Dokumen ini mendaftarkan **endpoint backend** yang dipanggil app, beserta pola request/response yang dipakai.

> Base URL diatur di [`BaseApi.url`](../lib/data/constants.dart#L74). Backend = Laravel.
> Default: `https://registrasi.mersimkt.web.id/api`.

---

## 1. HTTP client `appHttp`

File: [lib/data/constants.dart](../lib/data/constants.dart#L13)

```dart
final appHttp = _AppHttpClient();

class _AppHttpClient extends http.BaseClient {
  final _inner = http.Client();
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) {
    request.headers['X-App-Version'] = AppVersion.current;
    return _inner.send(request);
  }
}
```

- Setiap request yang lewat `appHttp` mengirim header `X-App-Version`.
- Backend bisa mengecek header ini dan balas `426 VERSION_OUTDATED` untuk memaksa update aplikasi.
- `appNavigatorKey` (di file yang sama) dipakai bila kelak `appHttp` perlu menampilkan dialog tanpa `BuildContext`.

**Rekomendasi**: konsisten pakai `appHttp` daripada `http.get/post` langsung untuk semua call yang **sudah memerlukan login**. Endpoint pre-login (`/login`, `/server-date`, `/app-version`) boleh tetap pakai `http` biasa.

---

## 2. Endpoint inti

### 2.1 Auth & menu

| Method | Endpoint | Body / Param | Dipanggil dari |
|--------|----------|--------------|----------------|
| POST | `/login` | `username`, `password` | [`MainMenuQuery.login`](../lib/data/api/main_menu_query.dart#L7) |
| GET | `/modul-all` | - | `MainMenuQuery.getModulName()` |
| GET | `/modul-user/{userId}` | path: userId | `MainMenuQuery.getUserModules()` |

Response `/login` (success): `{ success: true, user: { id, name, email, username, divisi, jabatan, id_peg: [...], id_ff: [...] } }`.

### 2.2 System / utility

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/server-date` | Source-of-truth tanggal/bulan server. Dipakai `GlobalQuery.getServerDate()` & `getServerMonth()` |
| GET | `/app-version` | Cek versi terbaru + `link_apk`. Dipakai `VersionChecker.checkAndPromptUpdate()` |

Response `/app-version`:
```json
{ "success": true, "data": { "version": "8.2.37", "link_apk": "https://..." } }
```

### 2.3 Visit — Master data

| Method | Endpoint | Body | Caller |
|--------|----------|------|--------|
| POST | `/doctor-list` | `id_peg` (JSON array), `search?`, `specFilter?`, `classFilter?` | [`VisitQuery.getDoctorList()`](../lib/data/api/visit_query.dart) |
| GET / POST | `/specialization-list` | id_peg | `VisitQuery` (untuk dropdown spec) |
| POST | `/call-list-customer` | id_peg, periode | `VisitQuery` |

> Daftar lengkap call ada di [visit_query.dart](../lib/data/api/visit_query.dart) (700+ baris). Pola yang dipakai: pakai `appHttp`, parsing JSON manual, fallback offline via `OfflineDataService` jika `!isOnline`.

### 2.4 Visit — Plan & Actual & Submission

| Endpoint | Fungsi |
|----------|--------|
| `/call-plan-submit` | Submit form Call Plan |
| `/call-actual-submit` | Submit form Call Actual (multipart: foto + signature + koordinat) |
| `/unvisit-submit` | Submit unvisit |
| `/non-target-submit` | Submit Non-Target Unique visit |
| `/join-visit-submit` | Submit join visit |
| `/edit-actual` / `/edit-plan` | Update visit yang sudah ada |
| `/dashboard-summary` | Counter untuk dashboard (lihat `visit_dashboard_query.dart`) |

Multipart upload (foto + signature) memakai `http.MultipartRequest`. Path file lokal disimpan oleh Hive di model [`OfflineVisit`](../lib/data/offline/models/offline_visit.dart) selama belum sync.

### 2.5 Approval (DM / RSM)

| Endpoint | Fungsi |
|----------|--------|
| `/dm-approval-list` | List call list yang menunggu approval |
| `/dm-approval-plan` | List call plan yang menunggu approval |
| `/dm-approval-actual` | List call actual yang menunggu approval |
| `/approval-action` | Submit approve / reject |
| `/dm-approval-notification-summary` | Summary count untuk reminder lokal |

Reminder summary response (lihat [`ApprovalNotificationService.checkAndNotify`](../lib/data/constants.dart#L682)):

```json
{
  "success": true,
  "data": {
    "list_count": 3,
    "plan_count": 1,
    "actual_count": 0,
    "list_deadline": "2026-05-21 17:00:00",
    "plan_deadline": "2026-05-22 17:00:00",
    "actual_deadline": null,
    "interval_minutes": 30
  }
}
```

`interval_minutes` di-respect oleh service → atur reminder cadence dari backend tanpa update app.

---

## 3. Konvensi response

Mayoritas endpoint balas struktur:

```json
{
  "success": true,
  "message": "OK",
  "data": <object | array>
}
```

Kalau gagal: `success: false`, `message` berisi alasan. Pola error handling lihat [`MainMenuQuery.login`](../lib/data/api/main_menu_query.dart#L18-L36) — termasuk fallback bila body bukan JSON (server return HTML error page).

---

## 4. Image / storage URL

Gambar disimpan di Laravel storage. Helper di [`BaseApi`](../lib/data/constants.dart#L86):

```dart
BaseApi.imgUrl   // → https://registrasi.mersimkt.web.id/storage
BaseApi.publicUrl // → https://registrasi.mersimkt.web.id
```

Contoh: foto dokter `${BaseApi.imgUrl}/profile/dokter/12345.jpg`.

Ikon modul **tidak** dari endpoint API — di-fetch langsung dari `https://monitoring.mersimkt.web.id/vendor/icons/{file}` (lihat [home_page.dart](../lib/views/pages/home_page.dart#L98)).

---

## 5. Backend migration (DB)

Repo punya satu script SQL one-off: [add_product_list_column.sql](../add_product_list_column.sql)

```sql
ALTER TABLE monitoring.call_plan_actual
ADD COLUMN `product_list` TEXT NULL
  COMMENT 'JSON array produk yang dipilih saat add call plan...'
AFTER `keterangan`;
```

Ini menambahkan kolom JSON untuk menyimpan produk yang user pilih saat membuat Call Plan. Wajib di-apply ke database `monitoring` sebelum fitur "produk di Call Plan" jalan di backend.

---

## 6. Auth / token

Pengamatan dari kode:

- Tidak terlihat bearer token / API key terstruktur — autentikasi tampaknya berbasis **`id_peg`** (yang disimpan setelah login) yang dikirim sebagai body tiap request.
- Mode session-less di sisi mobile: state user disimpan di `SharedPreferences`, backend mengandalkan `id_peg` untuk filter data.
- **Hati-hati**: pastikan backend mem-validasi `id_peg` terhadap user yang sah (mis. lewat token / sesi sisi server lain). Skema kirim `id_peg` raw dari mobile bukan otentikasi yang kuat.

> Bila ada perubahan ke autentikasi berbasis token (JWT/Sanctum), file yang paling perlu disesuaikan: [`appHttp`](../lib/data/constants.dart#L13) (inject header `Authorization`) dan [`SessionService`](../lib/data/offline/session_service.dart) (simpan token).
