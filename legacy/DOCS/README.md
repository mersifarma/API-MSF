# MMS Mobile / MSF-MOBILE — Dokumentasi Project

Aplikasi **Mersi Sales Force (MMS) Mobile** — versi mobile dari sistem MMS untuk Departemen Marketing **Mersifarma**.
Dibangun dengan **Flutter** untuk Android (utama) dan menargetkan backend Laravel di `https://registrasi.mersimkt.web.id/api`.

> Repo ini di GitHub dikenal sebagai `MMS_MOBILE` (lihat [CONTRIBUTING.md](../CONTRIBUTING.md)). Folder kerja lokal: `MSF-MOBILE`.

---

## Versi saat ini

| Item | Nilai | Sumber |
|------|-------|--------|
| Versi aplikasi (build) | `2.0.0+4` | [pubspec.yaml](../pubspec.yaml) |
| Versi fungsional (server check) | `8.2.37` | `AppVersion.current` di [lib/data/constants.dart](../lib/data/constants.dart#L814) |
| Min SDK Dart | `^3.9.2` | [pubspec.yaml](../pubspec.yaml) |
| Application ID | `com.mersi.mmsmobile` | [android/app/build.gradle.kts](../android/app/build.gradle.kts) |
| Base API | `https://registrasi.mersimkt.web.id/api` | `BaseApi.url` di [constants.dart](../lib/data/constants.dart#L74) |

> Catatan: ada **dua versi** yang dilacak: `pubspec.yaml` (untuk Play Store) dan `AppVersion.current` (untuk gate update wajib di server). Keduanya wajib dinaikkan saat rilis.

---

## Peta dokumen

| Dokumen | Isi |
|---------|-----|
| [01-getting-started.md](./01-getting-started.md) | Setup environment, clone, run, build APK |
| [02-architecture.md](./02-architecture.md) | Struktur folder, lapisan kode, alur navigasi |
| [03-features.md](./03-features.md) | Fitur utama: login, home, visit, approval, profile |
| [04-api-integration.md](./04-api-integration.md) | Konvensi API, `appHttp`, endpoint penting |
| [05-offline-mode.md](./05-offline-mode.md) | Phase 0/1/2 offline mode, Hive, SQLite, pending sync |
| [06-call-targets.md](./06-call-targets.md) | Target Call Reach & Call Productivity per divisi/jabatan |
| [07-versioning-release.md](./07-versioning-release.md) | Version gate, build APK, signing, publish |
| [08-troubleshooting.md](./08-troubleshooting.md) | Error umum & cara mengatasinya |

---

## Ringkasan cepat untuk dev baru

1. Install Flutter SDK `>=3.9.2` & Android Studio.
2. Clone repo, pindah ke branch pribadi (lihat [CONTRIBUTING.md](../CONTRIBUTING.md)).
3. `flutter pub get` → `flutter run` ke device/emulator.
4. Mode dev: ganti `BaseApi.url` di [constants.dart](../lib/data/constants.dart#L74) ke endpoint dev/localhost.
5. Setiap rilis: naikkan **dua versi** (`pubspec.yaml` + `AppVersion.current`) lalu update entry di tabel server (`/app-version`).

---

## Kontak & kepemilikan

- Repository GitHub: `wahabworkk/MMS_MOBILE`
- Tim aktif (per CONTRIBUTING): `wahab`, `igna`
- Owner / Lead: pengelola merge ke `main` & `develop`
- Aturan branching & PR: [CONTRIBUTING.md](../CONTRIBUTING.md)
