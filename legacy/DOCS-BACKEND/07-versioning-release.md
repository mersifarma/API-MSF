# 07 — Versioning & Release (Backend)

Bagaimana backend mengontrol versi mobile dan bagaimana melakukan deploy backend itu sendiri.

---

## 1. Gate versi mobile

### 1.1 Header `X-App-Version`

Setiap endpoint **write/approve** memanggil `checkAppVersion(Request)`:

```php
private function checkAppVersion(Request $req)
{
    $version = trim($req->header('X-App-Version', ''));
    if (empty($version)) {
        return response()->json([
            'success' => false,
            'code'    => 'VERSION_OUTDATED',
            'message' => 'Aplikasi Anda tidak kompatibel...',
        ], 426);
    }
    return null;
}
```

- Header **kosong** → tolak dengan HTTP **426** Upgrade Required.
- Header **ada nilai apa pun** → lolos.
- Logikanya minimal: cuma cek **keberadaan** header, tidak parse semver. Mobile lama (v5/v6) tidak kirim header → ditolak.

**Implikasi**:
- Hanya **breaking change** yang efektif gate-nya (mobile lama auto-blocked).
- Kalau perlu blokir versi spesifik (mis. `< 8.2.30`), update `checkAppVersion` untuk parse semver.

### 1.2 Tabel `call_version`

Endpoint `GET /app-version` mengembalikan row dari `call_version`:

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `version` | string | semver `8.2.37` |
| `link_apk` | string | URL APK terbaru |

Mobile bandingkan `AppVersion.current` (di `constants.dart`) dengan `version` → kalau beda → dialog update wajib.

### 1.3 Flow rilis mobile yang melibatkan backend

```
Mobile bump:
  pubspec.yaml         version: 2.0.1+5
  constants.dart       AppVersion.current = "8.2.38"

Mobile build:
  flutter build apk --release
  upload APK → catat URL

Backend update:
  UPDATE call_version SET version = '8.2.38', link_apk = '<URL>' WHERE id = 1;
```

User dengan APK lama langsung kena dialog update wajib di startup berikutnya (atau saat request apa pun, karena `appHttp` di mobile inject header dan backend balas 426).

---

## 2. Konfigurasi runtime tanpa redeploy

Beberapa hal bisa diubah tanpa rilis backend (cukup edit database) atau tanpa rilis mobile (cukup edit konstanta backend + restart):

### 2.1 Cukup edit DB

| Apa | Tabel | Kolom |
|-----|-------|-------|
| Versi mobile minimum | `call_version` | `version`, `link_apk` |
| Target call list per role/divisi | `call_target_list` | `target_dokter`, `target_non_dokter` |
| Target call productivity per role/divisi | `call_target_hari` | `target_per_day_dokter`, `target_per_day_non_dokter` |
| Target frekuensi per class | `call_target_class` | `target` |
| Hari kerja per bulan | `report_admin_mkt.set_param_sum_mcr` | `hari_kerja` |
| Master produk | `data_product` | `nama_product`, `status`, dll. |
| Master dokter | `list_dokter_visit_new` | semua |
| Struktur organisasi | `struktur` | `id_peg_*`, `periode_*` |

### 2.2 Edit konstanta backend (perlu deploy backend, **tidak** perlu rilis mobile)

File: `VisitController.php` & `VisitApprovalController.php` & `JoinVisitController.php` (top class).

| Konstanta | File | Default |
|-----------|------|---------|
| `BATAS_HARI_KERJA_LIST` | `VisitController`, `VisitApprovalController` | `5` |
| `OVERRIDE_BULAN_LIST` | sama | `''` |
| `BATAS_JAM_PLAN` | `VisitApprovalController` | `10` |
| `BATAS_HARI_ACTUAL` | sama | `1` |
| `BATAS_JAM_ACTUAL` | sama | `10` |
| `NOTIFICATION_INTERVAL_MINUTES` | sama | `1` *(testing — set 30 untuk prod)* |
| `JOIN_VISIT_RADIUS_METERS` | `JoinVisitController` | `100` |

> Idealnya: pindahkan konstanta-konstanta ini ke tabel `call_setting` agar bisa diubah lewat admin panel.

---

## 3. Deploy backend

### 3.1 Server produksi

Hosting: `registrasi.mersimkt.web.id` (cPanel atau VPS — verifikasi dengan admin).

Cara deploy umumnya:

```bash
# Di server
cd /home/user/public_html  # atau path Laravel app
git pull origin main

composer install --no-dev --optimize-autoloader

php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Restart php-fpm / web server kalau perlu:

```bash
sudo systemctl restart php-fpm
sudo systemctl restart nginx
```

### 3.2 Env terpisah PROD vs DEV

Tidak ada Laravel environment file terpisah untuk PROD vs DEV — sebagai gantinya, **route prefix `/api/dev`** di-mount ke `VisitController_dev`. Mobile bisa switch env hanya dengan ganti `BaseApi.url` di mobile constants.

Untuk benar-benar isolate (different DB, different domain), pertimbangkan:
1. Buat subdomain `dev.registrasi.mersimkt.web.id`.
2. Deploy branch `develop` ke sana dengan `.env` terpisah.
3. Mobile pakai BaseApi.url ke subdomain saat dev.

---

## 4. Checklist rilis backend

- [ ] Pull `develop` → review changes.
- [ ] Run smoke test lokal (`php artisan serve`).
- [ ] Pastikan `NOTIFICATION_INTERVAL_MINUTES` di-set ke nilai prod (30) sebelum push.
- [ ] Pastikan konstanta deadline (`BATAS_*`) sesuai dengan keputusan business saat ini.
- [ ] Backup database `monitoring` (mysqldump).
- [ ] Deploy: `git pull` + `composer install` + `artisan cache:clear`.
- [ ] Test endpoint kritikal di prod:
  - `GET /api/server-date` (no DB).
  - `GET /api/app-version` (DB connectivity).
  - `POST /api/login` dengan akun test.
  - `POST /api/dm-approval-notification-summary` dengan akun DM.
- [ ] Monitor log error (Laravel `storage/logs/laravel.log`) selama 30 menit.
- [ ] Update changelog (saat ini belum standardized — sarankan `CHANGELOG.md` di root).

---

## 5. Backward compatibility

Saat menambah/mengubah endpoint, ingat:

- **Mobile lama** masih jalan di lapangan (tidak semua user langsung update).
- Selama gate `X-App-Version` ada, mobile lama otomatis di-blokir untuk endpoint write. **Tapi** endpoint read (`/doctor-list`, `/call-plan-data`, dll.) tidak gated — mobile lama masih bisa baca.
- Kalau response shape diubah (mis. tambah/hapus field), mobile lama bisa crash parsing.

**Rule of thumb**: tambah field ke response = aman (mobile lama abaikan). Hapus/rename field = breaking, perlu sinkron rilis mobile.

---

## 6. Database migration (informal)

Backend tidak punya `database/migrations/`. Saat ada perubahan schema:

1. Tulis SQL ALTER script di root, beri prefix `migration_<date>_<desc>.sql`.
2. Commit script ke repo.
3. Jalankan manual di prod via MySQL CLI atau phpMyAdmin.
4. Update [`05-database-schema.md`](./05-database-schema.md) dengan kolom baru.

Contoh dari repo mobile: `add_product_list_column.sql`:

```sql
ALTER TABLE monitoring.call_plan_actual
ADD COLUMN `product_list` TEXT NULL
  COMMENT 'JSON array produk...'
AFTER `keterangan`;
```

---

## 7. Monitoring & log

Laravel log di-store di `storage/logs/laravel.log`. Cek kalau ada error:

```bash
tail -f storage/logs/laravel.log
```

Untuk pesan dari `Illuminate\Support\Facades\Log` (sudah di-import di beberapa controller — `JoinVisitController`, `VisitController`, dst.).

Pertimbangkan untuk integrate ke service monitoring (Sentry / Bugsnag / Telescope) untuk visibilitas error production.

---

## 8. Backup strategy

- **DB**: schedule mysqldump harian (cron) ke external storage.
- **Storage** (`public/assets/images/`): foto kunjungan + tanda tangan — backup periodik, ukuran bisa besar.
- **Code**: sumber di Git — pastikan remote (GitHub / GitLab) ter-mirror.

---

Lanjut ke [`08-troubleshooting.md`](./08-troubleshooting.md).
