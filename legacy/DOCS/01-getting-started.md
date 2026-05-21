# 01 — Getting Started

Panduan setup environment, menjalankan, dan membangun aplikasi **MMS Mobile**.

---

## 1. Prasyarat

| Tool | Versi minimum | Catatan |
|------|---------------|---------|
| Flutter SDK | yang mendukung Dart `^3.9.2` | gunakan `flutter doctor` untuk verifikasi |
| Android Studio / Android SDK | API 24+ (akan otomatis pakai versi dari Flutter plugin) | wajib jika build Android |
| JDK | Java 11 | dipakai oleh Gradle, lihat [build.gradle.kts](../android/app/build.gradle.kts#L23) |
| Git | semua versi modern | untuk akses repo |
| Device fisik / emulator Android | API 24+ | iOS belum jadi target rilis |

> `compileSdk` dan `ndkVersion` mengikuti nilai dari Flutter plugin (lihat [build.gradle.kts](../android/app/build.gradle.kts#L19)).

---

## 2. Clone repository

```bash
git clone https://github.com/wahabworkk/MMS_MOBILE.git
cd MMS_MOBILE
```

Aturan branch (singkat — full di [CONTRIBUTING.md](../CONTRIBUTING.md)):

- **Jangan** push langsung ke `main` atau `develop`.
- Kerja di branch pribadi (`wahab`, `igna`) atau `feature/*`, `bugfix/*`, `hotfix/*`.
- PR target = `develop`. Merge ke `main` hanya oleh owner.

---

## 3. Install dependencies

```bash
flutter pub get
```

Dependencies utama (lihat [pubspec.yaml](../pubspec.yaml)):

| Package | Fungsi |
|---------|--------|
| `http` | HTTP client (dibungkus `appHttp` di constants.dart) |
| `shared_preferences` | Persist session & flag offline |
| `sqflite` | Local DB untuk cache master data |
| `hive_flutter` | Local box untuk offline visits (form sederhana) |
| `connectivity_plus` | Cek online/offline + listen perubahan |
| `flutter_local_notifications` | Reminder approval lokal (interval dari server) |
| `geolocator` | Ambil koordinat GPS saat visit |
| `image_picker` | Ambil foto dokter/outlet saat visit |
| `signature` | Tanda tangan elektronik dokter |
| `webview_flutter` | Tampilkan PDF product detail via Google Docs Viewer |
| `url_launcher` | Buka link APK update dari dialog VersionChecker |
| `dropdown_search`, `flutter_typeahead` | Dropdown & autocomplete form |
| `month_year_picker` | Picker bulan-tahun |

---

## 4. Konfigurasi backend

File [lib/data/constants.dart](../lib/data/constants.dart#L73) berisi konstanta `BaseApi.url`. Beberapa preset sudah disiapkan, aktifkan satu sesuai kebutuhan:

```dart
class BaseApi {
  static const String url = "https://registrasi.mersimkt.web.id/api";          // PROD
  // static const String url = "https://registrasi.mersimkt.web.id/api/dev";   // DEV
  // static const String url = "http://127.0.0.1:8000/api";                    // localhost
  // static const String url = "http://192.168.x.x:8000/api";                  // phone localhost
  // static const String url = "http://10.0.2.2:8000/api";                     // android emulator localhost
}
```

> Saat develop di emulator Android, alamat host machine adalah `10.0.2.2`, **bukan** `127.0.0.1`.

`BaseApi.publicUrl` & `BaseApi.imgUrl` diturunkan otomatis dari `url`.

---

## 5. Menjalankan aplikasi

```bash
# List device yang terdeteksi
flutter devices

# Jalankan ke device pertama yang tersedia
flutter run

# Atau pilih device tertentu
flutter run -d <device_id>
```

Saat startup, urutan inisialisasi (lihat [main.dart](../lib/main.dart)):

1. `WidgetsFlutterBinding.ensureInitialized()`
2. `AppInit.init()` → Hive + open box `OFFLINE_VISIT_BOX`
3. Baca `SharedPreferences` → flag `isLoggedIn` & `name`
4. `VisitQuery.initializeOfflineMode()` → SQLite, connectivity monitoring, load cache
5. `PendingSyncService().initialize()` → listener auto-sync saat connect kembali
6. `runApp(MyApp(...))` → cek `isLoggedIn` → arahkan ke `HomeRoot` atau `LoginPage`

---

## 6. Build APK release

Build APK signed (release):

```bash
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`.

### Signing config

Signing menggunakan file `android/key.properties` (tidak di-commit). Jika file ada, [build.gradle.kts](../android/app/build.gradle.kts#L32) akan auto-load:

```properties
storeFile=../keystore.jks
storePassword=...
keyAlias=...
keyPassword=...
```

Jika `key.properties` tidak ada → build release **akan tetap jalan tanpa signing config** (debug-signed). Untuk publish, pastikan file dan keystore tersedia.

---

## 7. Verifikasi awal jalan dengan benar

Setelah `flutter run`:

1. **Login page muncul** → versi terlihat di bawah (`Version 8.2.37` atau apapun nilai `AppVersion.current`).
2. **Login** dengan kredensial valid → diarahkan ke `HomeRoot`.
3. **Home page** menampilkan grid modul (di-fetch dari `/modul-user/{userId}`).
4. Cek log di console untuk pesan inisialisasi:
   - ` AppInit completed`
   - ` Offline mode initialized`
   - ` Pending sync service initialized`
   - `🌐 CONNECTIVITY SERVICE - INITIALIZING`
   - `📦 OFFLINE DATABASE - INITIALIZING`

Jika ada error koneksi (`SocketException` / DNS fail) → akan muncul SnackBar/banner offline.

---

## 8. Reset session / clear cache lokal

Saat develop, kadang perlu reset state penuh. Cara:

- Uninstall app dari device (paling bersih), atau
- `adb shell pm clear com.mersi.mmsmobile`

Ini akan menghapus `SharedPreferences`, Hive box, dan SQLite database lokal.
