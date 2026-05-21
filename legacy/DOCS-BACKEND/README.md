# MMS API Backend (MSF) — Dokumentasi Project

Backend **Laravel** untuk aplikasi **Mersi Sales Force (MMS) Mobile** — sistem visit/Call Report Departemen Marketing **Mersifarma**.

> Repo ini berisi **API server** yang dipanggil oleh aplikasi Flutter (`MMS_MOBILE`).
> Untuk dokumentasi sisi mobile lihat folder [`DOCS/`](../DOCS/) di repo aplikasi.

---

## Ringkasan teknis

| Item | Nilai | Sumber |
|------|-------|--------|
| Framework | Laravel (controller di-namespace `App\Http\Controllers\Api`) | [routes/api.php](../routes/api.php) |
| Base URL produksi | `https://registrasi.mersimkt.web.id/api` | dipakai mobile di `BaseApi.url` |
| Base URL dev | `https://registrasi.mersimkt.web.id/api/dev` | route group `prefix('dev')` |
| Database utama | `monitoring` (MySQL) | mayoritas `DB::table(...)` |
| Database sekunder | `report_admin_mkt` | tabel `set_param_sum_mcr` |
| Auth | username/password → response berisi `id_peg[]` (no token) | [`MainMenuController::login`](../app/Http/Controllers/api_server/Api/MainMenuController.php#L15) |
| Gate versi mobile | header `X-App-Version`, kalau kosong → HTTP 426 `VERSION_OUTDATED` | [`checkAppVersion`](../app/Http/Controllers/api_server/Api/VisitController.php#L36) |
| Image storage | `public/assets/images/photos` & `.../ttd` | [`ImageController`](../app/Http/Controllers/api_server/Api/ImageController.php) |

---

## Peta dokumen

| Dokumen | Isi |
|---------|-----|
| [01-getting-started.md](./01-getting-started.md) | Setup environment Laravel, koneksi DB, jalankan dev server |
| [02-architecture.md](./02-architecture.md) | Struktur folder, controller, layer DB, konvensi response |
| [03-features.md](./03-features.md) | Fitur backend: auth, modul user, call list/plan/actual, approval, join visit, unvisit |
| [04-api-reference.md](./04-api-reference.md) | Daftar semua endpoint dengan request/response lengkap |
| [05-database-schema.md](./05-database-schema.md) | Tabel-tabel utama (monitoring), relasi, kolom approval & cascade |
| [06-business-logic.md](./06-business-logic.md) | Aturan validasi: target call list, deadline approval, hari kerja, join visit, foto wajib |
| [07-versioning-release.md](./07-versioning-release.md) | Gate `X-App-Version`, sinkronisasi tabel `call_version`, deploy |
| [08-troubleshooting.md](./08-troubleshooting.md) | Error umum (426, foto kosong, deadline expired, dsb.) + diagnosa |

---

## Quick start untuk dev baru

1. Clone repo, pastikan PHP & Composer terinstall (lihat [`01-getting-started`](./01-getting-started.md)).
2. `composer install`, copy `.env`, set koneksi DB ke schema `monitoring`.
3. `php artisan serve` → endpoint tersedia di `http://127.0.0.1:8000/api`.
4. Test dengan `GET /api/server-date` — harus balas `{ date: "<iso8601>" }`.
5. Untuk testing dari emulator Android Flutter pakai base URL `http://10.0.2.2:8000/api`.

---

## Catatan penting

- **Tidak ada token / Sanctum** — request hanya kirim `id_peg` (rowid pegawai) di body. Backend mempercayai client. Pertimbangkan untuk menambahkan token-based auth (lihat [`08-troubleshooting`](./08-troubleshooting.md#auth)).
- **Dua varian controller** untuk visit: `VisitController` (PROD) dan `VisitController_dev` (DEV). Route group `/api/dev/*` mengarah ke versi dev — gunakan untuk percobaan tanpa mengganggu produksi.
- **Konstanta deadline** dikontrol via constants di top controller — lihat [`06-business-logic`](./06-business-logic.md#konfigurasi). Aturan bisa diubah server-side tanpa rilis ulang mobile.
- **Komentar di route file** ([routes/api.php](../routes/api.php)) sangat informatif — sumber kebenaran kedua selain controller body.
