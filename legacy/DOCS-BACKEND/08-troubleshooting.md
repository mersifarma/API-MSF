# 08 — Troubleshooting (Backend)

Masalah umum + cara diagnosa cepat.

---

## 1. HTTP 426 `VERSION_OUTDATED`

**Gejala**: client (Postman / mobile lama) dapat response:

```json
{
  "success": false,
  "code": "VERSION_OUTDATED",
  "message": "Aplikasi Anda tidak kompatibel..."
}
```

**Penyebab**: header `X-App-Version` kosong atau tidak terkirim.

**Fix**:
- Postman / curl: kirim header `X-App-Version: 8.2.37` (nilai apa saja, asal non-empty).
- Mobile lama: paksa user update.
- Reverse proxy / Cloudflare: pastikan tidak strip custom header.

Lihat [`checkAppVersion`](../app/Http/Controllers/api_server/Api/VisitController.php#L36).

---

## 2. Login gagal padahal username & password benar

**Diagnosis**:

```sql
SELECT id, username, password FROM users WHERE username = '<username>';
```

- Cek hash password — kalau bukan bcrypt (`$2y$...`), `Hash::check` akan fail.
- Cek case sensitivity username.

**Trace**:

```php
// Tambahkan sementara di MainMenuController::login
\Log::info('Login attempt', [
    'username' => $request->username,
    'user_found' => $user ? true : false,
]);
```

Lihat `storage/logs/laravel.log`.

---

## 3. `data_pegawai` kosong setelah login

**Gejala**: login success tapi `id_peg = []`, mobile crash saat panggil endpoint visit.

**Penyebab**: tidak ada row `data_pegawai` WHERE `id_user = <user.id>` AND `IFNULL(status,"Exist")="Exist"`.

**Fix**:

```sql
-- Cek row
SELECT * FROM data_pegawai WHERE id_user = <id>;

-- Pastikan status NULL atau 'Exist' (bukan 'Non Aktif' / lainnya)
UPDATE data_pegawai SET status = 'Exist' WHERE id_user = <id> AND rowid = <rowid>;
```

---

## 4. `/doctor-list` kosong padahal data ada

**Diagnosis**:

```sql
SELECT COUNT(*) FROM list_dokter_visit_new
WHERE STATUS_MD IS NULL OR STATUS_MD = 'AKTIF';
```

- Kalau 0 → data semua marked non-active, fix `STATUS_MD`.
- Kalau > 0 tapi mobile dapat list kosong → cek filter `id_peg` di body. Untuk DM/RSM, list di-expand via `struktur`. Periksa:

```sql
SELECT * FROM struktur
WHERE id_peg_dm = <rowid_dm>
  AND periode_awal <= CURDATE() AND periode_akhir >= CURDATE();
```

Kalau hasilnya kosong → DM tidak terdaftar di `struktur` periode aktif → tidak punya bawahan visible.

---

## 5. Save call list ditolak: "deadline lewat"

**Penyebab**: sudah lewat hari kerja ke-`BATAS_HARI_KERJA_LIST` (5) di bulan ini.

**Fix sementara** (untuk bulan tertentu):

Edit [`VisitController.php`](../app/Http/Controllers/api_server/Api/VisitController.php#L28):

```php
const OVERRIDE_BULAN_LIST = '2026-05';
```

Deploy. Hapus override setelah selesai.

**Fix permanen** (jika aturan berubah): naikkan `BATAS_HARI_KERJA_LIST` nilainya.

---

## 6. Save actual ditolak: "tanggal aktual tidak valid"

**Penyebab**: `tgl_actual ≠ today` (Asia/Jakarta) atau status=Offline tapi `updated_date` > 1 jam lalu.

**Diagnosis**:

```bash
# Cek server time
curl http://<api>/api/server-date
```

- Pastikan TZ server = Asia/Jakarta. Set di `config/app.php` `'timezone' => 'Asia/Jakarta'`.
- Cek apakah ada NTP sync issue di server.

**Untuk offline sync**: cek `call_plan_actual.updated_date` row yang mau di-sync — kalau lebih dari 1 jam lalu, mobile harus paksa user re-input.

---

## 7. Approval actual gagal: `APPROVAL_ACTUAL_NO_FOTO`

**Penyebab**: DM mau approve actual tapi `call_plan_actual.foto` NULL/empty.

**Fix**:
- MR harus re-submit dengan foto. Atau,
- Admin update manual:
  ```sql
  UPDATE call_plan_actual SET foto = '<existing-filename>' WHERE id = <id>;
  ```
  Tapi ini melemahkan compliance — sebaiknya kembalikan ke MR.

---

## 8. Approval actual gagal: `APPROVAL_ACTUAL_EXPIRED`

**Penyebab**: lewat cutoff `tgl_actual + BATAS_HARI_ACTUAL` jam `BATAS_JAM_ACTUAL`.

**Fix**:
- Naikkan `BATAS_HARI_ACTUAL` dan/atau `BATAS_JAM_ACTUAL` di [`VisitApprovalController.php`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L58-L62).
- Atau approve via SQL langsung (last resort):
  ```sql
  UPDATE call_plan_actual
  SET approval_actual = 'Approve',
      approval_actual_by = <dm_rowid>,
      approval_actual_date = NOW(),
      approval_actual_comment = 'manual approve'
  WHERE id = <id>;
  -- Jangan lupa cascade is_visited:
  UPDATE call_list SET is_visited = 1
  WHERE id_mcl = <mcl>
    AND id_peg IN (SELECT rowid FROM data_pegawai WHERE id_user = <user_id>)
    AND YEAR(periode) = YEAR(<tgl_actual>)
    AND MONTH(periode) = MONTH(<tgl_actual>);
  ```

---

## 9. Notifikasi reminder mobile terlalu sering

**Penyebab**: konstanta `NOTIFICATION_INTERVAL_MINUTES` di [`VisitApprovalController`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L67) di-set rendah.

**Saat ini**: `1` (testing).

**Fix**: ubah ke `30` (prod default) → deploy.

Mobile akan reschedule timer otomatis di polling berikutnya (respect `interval_minutes` dari response).

---

## 10. Upload foto timeout / file kosong

**Diagnosis**:

```bash
# Cek size limit PHP
php -i | grep upload_max_filesize
php -i | grep post_max_size
```

Default PHP 2MB sering jadi bottleneck. Naikkan:

```ini
; php.ini
upload_max_filesize = 10M
post_max_size = 12M
```

Restart php-fpm.

**Cek folder writable**:

```bash
ls -la public/assets/images/
# pastikan www-data atau user webserver punya write permission
chown -R www-data:www-data public/assets/images/
chmod -R 755 public/assets/images/
```

---

## 11. `joinVisitDetails` / `approvalJoinVisit` selalu kosong

**Penyebab**: filter window 30 menit.

```php
->whereRaw('cpa.updated_date >= NOW() - INTERVAL 30 MINUTE')
```

Atasan baru bisa lihat join visit kalau MR submit < 30 menit lalu.

**Fix** (untuk testing): naikkan ke `INTERVAL 1 DAY` sementara di [`JoinVisitController.php`](../app/Http/Controllers/api_server/Api/JoinVisitController.php#L152) line ~152 & 219.

---

## 12. `getWorkingDays` selalu return 0

**Penyebab**: tabel `report_admin_mkt.set_param_sum_mcr` tidak punya entry untuk `periode = '<MM-YYYY>'`, atau user MySQL tidak punya GRANT ke schema itu.

**Diagnosis**:

```sql
SHOW GRANTS FOR CURRENT_USER();

-- Cek entry
SELECT * FROM report_admin_mkt.set_param_sum_mcr
WHERE periode = '05-2026';
```

**Fix**:

```sql
GRANT SELECT ON report_admin_mkt.* TO '<api_user>'@'<host>';
FLUSH PRIVILEGES;

-- Tambahkan periode kalau missing
INSERT INTO report_admin_mkt.set_param_sum_mcr (periode, hari_kerja)
VALUES ('05-2026', 22);
```

---

## 13. `/api/dev/...` ke kontrol PROD bukan DEV

**Penyebab**: route file punya `Route::prefix('dev')->group(...)`, tapi sebagian route di-mount ke controller PROD (intentional untuk shared logic).

**Lihat** [`routes/api.php`](../routes/api.php#L221) — dev group berisi:
- Visit routes → `VisitController_dev`.
- Sisanya (login, approval, image, join-visit, unvisit) → controller PROD.

**Implikasi**: jika ubah `MainMenuController`, kedua env terdampak.

---

## 14. Duplicate route `/call-list-data`

**Gejala**: routing definition aneh di [`routes/api.php`](../routes/api.php#L67-L72):

```php
Route::post('/call-list-data', [VisitController::class, 'displayCallList']);
// ...
Route::post('/call-list-data', [VisitController::class, 'getCallListData']);
```

Laravel akan **register kedua**, tapi yang terakhir didefinisikan akan menang. Ini kemungkinan bug.

**Fix**:
- Pilih satu method dan hapus deklarasi lainnya.
- Atau pisahkan jadi 2 endpoint berbeda (`/call-list-data` vs `/call-list-data-filter`).
- Cek dengan: `php artisan route:list | grep call-list-data`.

---

## 15. CORS issue saat develop dari web/mobile

**Gejala**: browser console error `CORS policy: No 'Access-Control-Allow-Origin'`.

**Fix**: Laravel punya CORS middleware bawaan (Laravel 8+). Edit `config/cors.php`:

```php
'paths' => ['api/*'],
'allowed_methods' => ['*'],
'allowed_origins' => ['*'], // atau spesifik domain mobile webview
'allowed_headers' => ['*'],
```

Restart server. Untuk emulator Android Flutter (`10.0.2.2`), origin biasanya tidak masalah (HTTP biasa).

---

## 16. `Auth` dan keamanan

Karena backend **tidak pakai token / Sanctum**, ada risiko:

| Risiko | Mitigasi (saran) |
|--------|------------------|
| Tampering `id_peg` di body | Implement Sanctum personal access token. Saat login, return token. Middleware verify token → resolve `id_peg` dari `users.id`. |
| Replay attack | HTTPS only + signed request hash. |
| Approval bypass (kirim `dm_id_peg` orang lain) | Backend verify `dm_id_peg` cocok dengan token authenticated user. |

**Workaround sementara**: log request body + IP di middleware untuk audit; cek log kalau ada aktivitas mencurigakan.

---

## 17. Memory limit saat query besar

**Gejala**: `Allowed memory size of X bytes exhausted` saat `displayCallPlan` atau `displayActual` dengan rentang bulan besar.

**Fix**:

```ini
; php.ini
memory_limit = 256M
```

Atau, lebih baik: paginate query di controller:

```php
$query->orderBy('tgl_plan')->paginate(100);
```

Mobile sudah support infinite scroll di beberapa list page — tinggal switch ke pagination response shape.

---

## 18. Log tidak muncul

**Cek**:

```bash
ls -la storage/logs/
# pastikan writable
chmod -R 775 storage/
```

Kalau path-nya tidak writable, Laravel akan diam (atau crash).

Cek `.env`:

```env
LOG_CHANNEL=stack
LOG_LEVEL=debug   # ubah ke debug saat troubleshooting
```

Restart PHP setelah ubah `.env`.

---

## 19. Endpoint return HTML alih-alih JSON

**Gejala**: response body = HTML (Laravel error page).

**Penyebab umum**:
- 500 error tidak ter-handle (mis. table not found, null pointer).
- `APP_DEBUG=true` di `.env` → Laravel render HTML stack trace.

**Fix**:
- Set `APP_DEBUG=false` di prod (jangan expose stack ke client).
- Cek `storage/logs/laravel.log` untuk root cause.
- Mobile-side: tambahkan defensive parsing (cek apakah body valid JSON sebelum decode).

---

## 20. Kalau benar-benar stuck

1. Capture request + response (Postman / curl).
2. Cek `storage/logs/laravel.log` untuk timestamp request.
3. Cek MySQL slow query log (`/var/log/mysql/slow.log` di server).
4. Tambah `\Log::debug(...)` di method yang dicurigai, lalu replay request.
5. Buat issue di repo dengan format:
   - Endpoint + body
   - Response (status + body)
   - Versi mobile (dari header `X-App-Version` log)
   - Log relevan dari Laravel
6. Tag owner / lead backend.
