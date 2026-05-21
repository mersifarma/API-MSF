# 07 — Versioning, Build & Release

Catatan praktis untuk **menaikkan versi**, **build APK**, dan **publish**.

---

## 1. Dua versi yang harus dijaga

Aplikasi punya dua tempat versi yang **harus selalu diselaraskan** saat rilis:

| Tempat | Format | Untuk | File |
|--------|--------|-------|------|
| `pubspec.yaml` → `version:` | `X.Y.Z+build` (mis. `2.0.0+4`) | Play Store / Android `versionCode` & `versionName` | [pubspec.yaml](../pubspec.yaml#L8) |
| `AppVersion.current` | `X.Y.Z` (mis. `8.2.37`) | Gate update wajib via `/app-version` di server | [constants.dart](../lib/data/constants.dart#L814) |

> Kedua format bisa berbeda — yang penting backend punya entry `/app-version` yang nilai `version`-nya **persis** sama dengan `AppVersion.current` agar dialog update tidak salah trigger.

### Aturan praktis

- Kenaikan minor (bug fix/UI tweak) → naikkan **patch** di kedua field.
- Kenaikan major (perubahan struktur DB / endpoint baru) → naikkan **minor** atau **major**, dan pastikan migrasi backward-compatible jika beberapa user belum update.

---

## 2. Flow rilis

```
1. Bug fix / fitur baru → develop
        │
        ▼
2. Owner review & merge ke develop
        │
        ▼
3. Naikkan version di:
   - pubspec.yaml         (Play Store)
   - constants.dart       (gate /app-version)
        │
        ▼
4. flutter build apk --release
        │
        ▼
5. Upload APK ke server (dropbox / drive / S3) → catat link
        │
        ▼
6. Update tabel app-version di backend:
   - version  = "X.Y.Z" (sama persis dengan AppVersion.current)
   - link_apk = <link APK terbaru>
        │
        ▼
7. (Opsional) Publish ke Play Store internal track
        │
        ▼
8. Merge develop → main, tag commit, dokumentasikan changelog
```

User dengan versi lama akan otomatis kena dialog "Update Sekarang" saat buka aplikasi (lihat [03-features.md §6](./03-features.md#6-version-gate-update-wajib)).

---

## 3. Build APK release

```bash
flutter clean         # opsional, untuk build bersih
flutter pub get
flutter build apk --release
```

Output: `build/app/outputs/flutter-apk/app-release.apk`.

Untuk **App Bundle** (Play Store):

```bash
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

### 3.1 Split per ABI (optional, hemat ukuran)

```bash
flutter build apk --split-per-abi --release
```

Menghasilkan 3 APK (`armeabi-v7a`, `arm64-v8a`, `x86_64`). Untuk distribusi manual (bukan Play Store), biasanya cukup `arm64-v8a`.

---

## 4. Signing

File: [android/app/build.gradle.kts](../android/app/build.gradle.kts#L32)

Build release akan auto-load `key.properties` di `android/`:

```properties
storePassword=...
keyPassword=...
keyAlias=...
storeFile=../keystore.jks
```

**Jangan commit** `key.properties` dan `*.jks` ke git. Pastikan keduanya di `.gitignore` (verifikasi sebelum rilis pertama).

Bila `key.properties` tidak ada, build release **tetap berjalan** tapi APK akan **debug-signed** — tidak valid untuk publish Play Store. Pastikan keystore ada sebelum rilis production.

### Generate keystore baru (sekali, owner saja)

```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias mms-mobile
```

Simpan password & file `.jks` di password manager terenkripsi. Kehilangan keystore = tidak bisa update app di Play Store (harus rilis package name baru).

---

## 5. Properties Android lain

| Property | Lokasi | Catatan |
|----------|--------|---------|
| `applicationId` | [build.gradle.kts](../android/app/build.gradle.kts#L47) | `com.mersi.mmsmobile` — jangan ubah pasca-rilis Play Store |
| `compileSdk` | `build.gradle.kts` | mengikuti Flutter SDK |
| `ndkVersion` | `build.gradle.kts` | mengikuti Flutter SDK |
| `coreLibraryDesugaringEnabled` | true | wajib untuk `flutter_local_notifications` |
| `desugar_jdk_libs` | `2.1.4` | dependency desugaring |
| `versionCode` / `versionName` | dari `pubspec.yaml` via Flutter plugin | jangan set manual |

`android/gradle.properties` & `android/local.properties` punya nilai default Flutter — jangan diubah kecuali tahu efeknya.

---

## 6. App icon

Generated via `flutter_launcher_icons`:

```yaml
flutter_icons:
  android: true
  ios: true
  image_path: "assets/images/icon_mersi.jpg"
```

Untuk regenerate icon setelah ganti `icon_mersi.jpg`:

```bash
dart run flutter_launcher_icons
```

---

## 7. Checklist rilis

- [ ] PR ke `develop` di-review & merge oleh owner
- [ ] Update `pubspec.yaml` `version:`
- [ ] Update `AppVersion.current` di [constants.dart](../lib/data/constants.dart#L814)
- [ ] `flutter pub get`
- [ ] `flutter build apk --release` sukses
- [ ] Test install APK di device fisik (min. 1 device Android 8+ & 1 device Android 13+)
- [ ] Test login + minimal 1 visit flow + offline scenario
- [ ] Upload APK ke link distribusi
- [ ] Update tabel `app-version` di backend (`version` + `link_apk`)
- [ ] Tag git: `git tag v8.2.37 && git push --tags`
- [ ] Merge `develop` → `main` (owner)
- [ ] Catat changelog (tempat penyimpanan changelog: belum standardized, sarankan `CHANGELOG.md`)
