# 08 — Troubleshooting

Kumpulan masalah umum saat develop / running MMS Mobile beserta cara cepat mengatasinya.

---

## 1. Build & Gradle

### "Plugin not found" / "Could not resolve plugin"

```bash
flutter clean
flutter pub get
```

Jika masih → cek koneksi internet & VPN/proxy. Maven Central mungkin di-block jaringan kantor.

### Java version mismatch

`build.gradle.kts` memaksa Java 11 ([line 23](../android/app/build.gradle.kts#L23)). Jika muncul error `unsupported class file major version`:

```bash
# Cek
java -version
# Atau set via Android Studio: File → Project Structure → SDK Location → Gradle JDK = 11
```

### `desugar_jdk_libs` version mismatch

Pesan: `D8 versioned class files are not supported`. Pastikan [build.gradle.kts](../android/app/build.gradle.kts#L73) memakai `2.1.4` (atau lebih baru) dan `isCoreLibraryDesugaringEnabled = true`.

### `keystore.jks` tidak ditemukan

`Caused by: java.io.FileNotFoundException: ... keystore.jks`. Cek file `android/key.properties` mengarah ke path yang benar (relatif terhadap `android/app/`). Atau hapus `key.properties` sementara untuk build tanpa signing config (debug-signed).

---

## 2. Runtime crash

### "MissingPluginException" untuk `connectivity_plus` / `sqflite` / `hive`

```bash
flutter clean
flutter pub get
flutter run
```

Plugin native perlu rebuild setelah `pub get` baru.

### "Bad state: No element" saat parse JSON

Biasanya backend balas struktur tak terduga (mis. HTML 500 page). Cek log `debugPrint` di [main_menu_query.dart](../lib/data/api/main_menu_query.dart#L27-L36) — sudah ada fallback yang mengembalikan `{ success: false, message, raw }`. Tambahkan defensive parsing serupa di query lain bila masih raw `json.decode`.

### Dialog "Update Tersedia" muncul terus padahal versi sudah disamakan

Pastikan:
1. `AppVersion.current` di [constants.dart](../lib/data/constants.dart#L814) **persis sama** dengan `version` di response `/app-version`.
2. Tidak ada whitespace / karakter tersembunyi.
3. Format `X.Y.Z` (semver 3-segmen). Format lain (mis. `8.2`) akan di-treat sebagai "older" karena length mismatch (lihat [`_isOlder`](../lib/data/constants.dart#L861)).

### Notifikasi reminder tidak muncul (Android 13+)

User belum granted izin POST_NOTIFICATIONS. Periksa:
- Sudah dipanggil `ApprovalNotificationService.initialize()` (otomatis di [HomeRoot](../lib/views/home_root.dart#L55))?
- Cek Settings → Apps → MMS Mobile → Notifications → enabled?
- Channel `approval_reminder` aktif?

---

## 3. Offline mode

### Database lokal corrupt / data tidak konsisten

```bash
# Clear semua local state
adb shell pm clear com.mersi.mmsmobile
```

Atau uninstall + reinstall.

### Sync setelah reconnect tidak jalan

1. Cek `PendingSyncService` sudah `.initialize()` di [main.dart](../lib/main.dart#L46).
2. Trigger manual `ConnectivityService().checkConnection()` — kadang Android tidak emit event saat toggle airplane mode terlalu cepat.
3. Cek log `🔄 PendingSyncService:` — kalau gagal POST, pesan error muncul di sini.

### Banner offline tidak hilang padahal sudah online

`ConnectivityService` memakai `InternetAddress.lookup` untuk verifikasi koneksi nyata. Bila DNS lambat / blocked, status akan stuck offline. Coba:
- Buka browser di device → bisa ke `google.com`?
- `adb shell ping -c 3 8.8.8.8`?
- Restart app.

---

## 4. Login

### Login gagal padahal username & password benar

- Backend mungkin balas non-200 (5xx). Lihat `loginError` di state — bila pesan "Server returned status XXX", masalah di server, bukan client.
- Cek `BaseApi.url` di [constants.dart](../lib/data/constants.dart#L74) — pastikan menunjuk environment yang benar (PROD vs DEV vs localhost).
- Jika test di emulator + localhost backend, gunakan `10.0.2.2:8000` bukan `127.0.0.1:8000`.

### "Network error: SocketException"

Device tidak punya koneksi internet. Login wajib online (lihat [login_page.dart](../lib/views/pages/login_page.dart#L421)).

---

## 5. Foto / Tanda tangan

### Foto tidak ke-upload saat submit visit

- Cek path file masih ada (foto disimpan di temporary directory yang bisa di-purge OS).
- Cek ukuran file — jika besar, request timeout. Pertimbangkan kompres di [image_function.dart](../lib/data/image_function.dart) sebelum upload.
- Cek permission `CAMERA` & `READ_EXTERNAL_STORAGE` (atau scoped media permission Android 13+) di AndroidManifest.xml.

### Tanda tangan kosong saat di-render

Package `signature` butuh canvas non-zero. Pastikan parent widget punya height/width terdefinisi sebelum mount signature pad.

---

## 6. Lokasi (GPS)

### Koordinat selalu `0,0` atau null

- Cek izin `ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION`.
- Cek GPS device nyala.
- Cek di [location_function.dart](../lib/data/location_function.dart) apakah timeout terlalu pendek untuk indoor (GPS lambat) — extend kalau perlu.
- Beberapa device emulator tidak punya GPS aktif by default — set di Extended Controls → Location.

---

## 7. Hot reload tidak refresh perubahan

- Hot reload **tidak** mengubah `initState` / static field. Jika ubah `BaseApi.url`, perlu **restart**, bukan reload (`R` di terminal).
- Perubahan AndroidManifest, gradle, atau native plugin → full rebuild (`flutter run` ulang).

---

## 8. CI / GitHub Actions

Repo punya catatan di [CONTRIBUTING.md](../CONTRIBUTING.md) bahwa "GitHub Actions" harus lulus sebelum merge, tapi file workflow belum ada di repo (folder `.github/workflows/` tidak ditemukan). Jika diperlukan:

1. Buat `.github/workflows/flutter-ci.yml` minimal:
   - `flutter pub get`
   - `flutter analyze`
   - `flutter test`
   - (opsional) `flutter build apk --debug` untuk verifikasi compile.

2. Tambahkan badge status di [README.md](../README.md).

---

## 9. Saat tidak yakin

1. **Re-read** [01-getting-started.md](./01-getting-started.md) — pastikan environment sudah benar.
2. Buka issue di GitHub MMS_MOBILE dengan format:
   - Versi aplikasi (`AppVersion.current` + `pubspec.yaml`)
   - Device & OS version
   - Steps to reproduce
   - Log relevan (`flutter logs` / `adb logcat`)
3. Tag owner / lead di issue/PR untuk attention.
