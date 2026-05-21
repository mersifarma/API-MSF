# 01 — Getting Started (Backend)

Panduan setup, run, dan test backend Laravel MMS API.

---

## 1. Prasyarat

| Tool | Versi yang disarankan | Catatan |
|------|------------------------|---------|
| PHP | 8.1+ | Cek dengan `php -v`. Laravel modern butuh 8.1+. |
| Composer | 2.x | Dependency manager PHP. |
| MySQL / MariaDB | 5.7+ / 10.3+ | Schema utama: `monitoring`. Schema sekunder: `report_admin_mkt`. |
| Web server | `php artisan serve` (dev) atau nginx + php-fpm (prod) | - |
| Git | semua versi modern | - |

Ekstensi PHP yang umumnya dibutuhkan Laravel: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `gd` (untuk image processing).

---

## 2. Clone & install

```bash
git clone <repo-url> API-MSF
cd API-MSF
composer install
```

Jika `vendor/` belum ada di repo (umumnya tidak di-commit), `composer install` akan mengunduh semua dependencies.

---

## 3. Environment

Copy template `.env`:

```bash
cp .env.example .env
php artisan key:generate
```

Set koneksi database utama di `.env`:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=monitoring
DB_USERNAME=<user>
DB_PASSWORD=<password>
```

> Beberapa query mengacu ke database kedua (`report_admin_mkt.set_param_sum_mcr`) secara cross-database. Pastikan user MySQL punya privilege `SELECT` ke kedua schema, atau definisikan koneksi tambahan `connections.report` di `config/database.php`.

---

## 4. Schema database

Backend ini **tidak punya migration file** di repo (controller pakai `DB::table(...)` raw, bukan Eloquent migration). Tabel harus sudah ada di database `monitoring`. Daftar tabel utama: lihat [`05-database-schema.md`](./05-database-schema.md).

Minimal tabel yang wajib ada untuk app jalan:

- `users` (login)
- `data_pegawai` (rowid = id_peg, jabatan, divisi)
- `app_modul`, `app_role_menu` (menu dinamis)
- `call_version` (gate update mobile)
- `list_dokter_visit_new` (master customer)
- `call_list`, `call_plan_actual`
- `struktur` (hierarchy MR-DM-RSM)
- `call_setting`, `call_target_list`, `call_target_hari`, `call_target_class`
- `data_product`
- `data_spec_dr`
- `visit_tidak_kunjungan` & `visit_tidak_kunjungan_mr`
- `call_list_history`

---

## 5. Storage folder

`ImageController::uploadPhoto` menyimpan file ke:

- `public/assets/images/photos/` — foto kunjungan.
- `public/assets/images/ttd/` — tanda tangan dokter.

Folder akan dibuat otomatis (`mkdir 0755 recursive`) saat upload pertama. Pastikan user webserver (mis. `www-data`) punya **write permission** ke `public/assets/images/`.

---

## 6. Menjalankan dev server

```bash
php artisan serve
# Default: http://127.0.0.1:8000
```

Endpoint cek cepat:

```bash
curl http://127.0.0.1:8000/api/server-date
# → {"date":"2026-05-20T10:30:00+07:00"}
```

> Endpoint `/server-date` tidak butuh DB, jadi aman untuk smoke test.

---

## 7. Connect dari mobile Flutter

Di [`lib/data/constants.dart`](../../lib/data/constants.dart) mobile, set `BaseApi.url`:

| Konteks | URL |
|---------|-----|
| Production server | `https://registrasi.mersimkt.web.id/api` |
| Dev server (sub-route) | `https://registrasi.mersimkt.web.id/api/dev` |
| Localhost — desktop browser | `http://127.0.0.1:8000/api` |
| Localhost — emulator Android | `http://10.0.2.2:8000/api` |
| Localhost — HP fisik (1 jaringan) | `http://<IP-PC>:8000/api` |

Untuk variant terakhir, jalankan: `php artisan serve --host=0.0.0.0` agar listen di semua interface.

---

## 8. Test endpoint kritikal

Setelah server jalan, validasi cepat:

```bash
# 1. Server-date — no DB
curl http://127.0.0.1:8000/api/server-date

# 2. App version — butuh tabel call_version
curl http://127.0.0.1:8000/api/app-version

# 3. Login — butuh tabel users + data_pegawai
curl -X POST http://127.0.0.1:8000/api/login \
  -d "username=<user>&password=<password>"
```

Untuk endpoint yang ada di balik gate `X-App-Version` (semua save/approval), wajib kirim header:

```bash
curl -X POST http://127.0.0.1:8000/api/call-list-save \
  -H "X-App-Version: 8.2.37" \
  -d ...
```

Tanpa header → response HTTP **426** `{ success: false, code: "VERSION_OUTDATED" }`.

---

## 9. Konvensi & gaya kode

- Semua controller di `app/Http/Controllers/api_server/Api/` (namespace `App\Http\Controllers\Api`).
- Query DB pakai **Query Builder** (`DB::table('...')`), **bukan Eloquent**. Beberapa model dideklarasi di `App\Models\*` tapi sebagian besar query bypass model.
- Response selalu JSON. Struktur umum:
  ```json
  { "success": true, "data": <...>, "message": "..." }
  ```
- Date/time pakai `Carbon` + timezone `Asia/Jakarta`.

---

## 10. Stop / clear cache

```bash
# Stop dev server: Ctrl+C

# Clear Laravel cache
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

Lanjut ke [`02-architecture.md`](./02-architecture.md) untuk struktur kode.
