# 02 — Arsitektur & Struktur Project

Dokumen ini menjelaskan **lapisan kode**, **struktur folder**, dan **alur navigasi** aplikasi MMS Mobile.

---

## 1. Lapisan kode

Aplikasi pakai pola sederhana **View ↔ Data Layer** (tanpa state management eksternal — cuma `setState` + `ValueNotifier`).

```
┌──────────────────────────────────────────────────────────┐
│  views/                  UI: Pages, Widgets, NavBar      │
│    home_root.dart        Shell + bottom navbar           │
│    pages/                Halaman fitur                   │
│    widgets/              Komponen reusable               │
└──────────────────────┬───────────────────────────────────┘
                       │ (panggil static method)
┌──────────────────────▼───────────────────────────────────┐
│  data/api/              Network layer (HTTP)             │
│    main_menu_query.dart                                  │
│    visit_query.dart      ← hybrid (online/offline)       │
│    visit_dashboard_query.dart                            │
│    visit_query_nonactual.dart                            │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│  data/offline/          Persistence + offline support    │
│    database_helper.dart      SQLite (master data cache)  │
│    offline_visit_db.dart     SQLite (form visits)        │
│    offline_data_service.dart Hybrid online/offline glue  │
│    pending_sync_service.dart Auto-sync saat reconnect    │
│    session_service.dart      Centralized user session    │
│    connectivity_service.dart Listener koneksi            │
│    models/offline_visit.dart Hive-friendly model         │
└──────────────────────────────────────────────────────────┘
```

Selain itu, file lintas-layer:

- [lib/data/constants.dart](../lib/data/constants.dart) — base URL, `appHttp` client, color palette, `AppVersion`, `VersionChecker`, `ApprovalNotificationService`, `ConnectionHelper`, target Call Reach/Productivity.
- [lib/data/init.dart](../lib/data/init.dart) — bootstrap Hive (sebelum runApp).
- [lib/data/notifier.dart](../lib/data/notifier.dart) — global `ValueNotifier` (`selectPage`, `isDarkMode`).
- [lib/data/image_function.dart](../lib/data/image_function.dart) — helper ambil & kompres foto.
- [lib/data/location_function.dart](../lib/data/location_function.dart) — helper GPS.

---

## 2. Struktur folder lengkap

```
MSF-MOBILE/
├── android/                         Flutter Android wrapper
│   └── app/
│       ├── build.gradle.kts         App ID com.mersi.mmsmobile, signing
│       └── src/                     AndroidManifest.xml dll.
├── ios/  macos/  linux/  windows/  web/   Platform lain (jarang dipakai)
├── assets/
│   └── images/                      47 file ikon modul & logo (Mersi)
├── lib/
│   ├── main.dart                    Bootstrap, MyApp, routing awal
│   ├── data/
│   │   ├── constants.dart           Base URL, http client, version, color
│   │   ├── init.dart                Hive init
│   │   ├── notifier.dart            ValueNotifier global
│   │   ├── image_function.dart
│   │   ├── location_function.dart
│   │   ├── api/
│   │   │   ├── main_menu_query.dart       /login, /modul-*
│   │   │   ├── visit_query.dart           Visit + master data (hybrid)
│   │   │   ├── visit_dashboard_query.dart Dashboard counters
│   │   │   └── visit_query_nonactual.dart Non-target & helper visit
│   │   └── offline/
│   │       ├── database_helper.dart       SQLite mms_offline.db
│   │       ├── offline_data_service.dart  Glue online↔offline
│   │       ├── offline_visit_db.dart      Tabel offline visits
│   │       ├── pending_sync_service.dart  Auto-sync queue
│   │       ├── session_service.dart       UserSession + prefs
│   │       ├── connectivity_service.dart  Stream<bool> connection
│   │       ├── offline.dart               Barrel / public export
│   │       └── models/offline_visit.dart  Model OfflineVisit
│   └── views/
│       ├── home_root.dart                 Shell + bottom navbar
│       ├── pages/
│       │   ├── login_page.dart
│       │   ├── home_page.dart             Grid modul user
│       │   ├── profile_page.dart
│       │   └── visit/                     35 halaman fitur visit
│       └── widgets/
│           ├── navbar.dart                Bottom nav utama
│           ├── page_template.dart         AppBar + safe area
│           ├── button_container.dart      Tombol modul grid
│           ├── connection_alert.dart      UI alert offline
│           ├── global_connection_wrapper.dart  Banner offline global
│           ├── mersi_logo.dart            Logo hero widget
│           └── style.dart                 Text/decoration helpers
├── pubspec.yaml                     Dependencies & flutter config
├── analysis_options.yaml            Lint flutter_lints
├── add_product_list_column.sql      One-off DB migration script (backend)
├── README.md                        Singkat
├── CONTRIBUTING.md                  Aturan branch & PR
└── DOCS/                            (Folder ini)
```

> File-file `*copy*.dart` / `*_pagi.dart` di [views/widgets/](../lib/views/widgets/) adalah snapshot lama yang masih tertinggal — pertimbangkan untuk dirapikan, tetapi jangan dihapus tanpa konfirmasi owner.

---

## 3. Alur navigasi (top-level)

```
runApp(MyApp)
  └─ GlobalConnectionWrapper       ← banner offline persist di SEMUA halaman
       └─ MaterialApp (navigatorKey = appNavigatorKey)
            ├─ isLoggedIn = false → LoginPage
            │     └─ login OK → HomeRoot
            └─ isLoggedIn = true  → HomeRoot
                   ├─ bottom tab 0: HomePage  → grid modul → VisitPage → ...
                   └─ bottom tab 1: ProfilePage
```

- [`appNavigatorKey`](../lib/data/constants.dart#L11) dipakai oleh `appHttp` (lewat header `X-App-Version`) untuk menampilkan dialog update wajib bila backend balas `426 VERSION_OUTDATED`.
- [`GlobalConnectionWrapper`](../lib/views/widgets/global_connection_wrapper.dart) memasang banner merah di atas seluruh aplikasi saat offline.
- Setelah masuk `HomeRoot`, `ApprovalNotificationService.startPeriodicCheck()` aktif → polling reminder ke `/dm-approval-notification-summary`.

---

## 4. Sub-tree halaman Visit

Folder [lib/views/pages/visit/](../lib/views/pages/visit/) berisi **35 file** halaman untuk modul utama "Visit". Garis besar pengelompokan:

| Kelompok | File | Fungsi |
|----------|------|--------|
| Entry | `visit_page.dart`, `visit_dashboard_page.dart` | Landing modul visit + dashboard counter |
| Customer / Master | `master_customer_page.dart`, `customer_detail_page.dart` | Dropdown & detail dokter / outlet |
| Call List | `main_call_list_page.dart`, `add_call_list_page.dart` | Daftar customer yang akan dikunjungi |
| Call Plan | `main_call_plan_page.dart`, `add_call_plan_page.dart`, `plan_actual_page.dart`, `planned_actual_page.dart` | Rencana kunjungan periode tertentu |
| Call Actual | `main_call_actual_page.dart`, `view_actual_page.dart`, `actual_details.dart`, `unplan_actual_page.dart`, `non_target_actual_page.dart` | Realisasi kunjungan + foto + tanda tangan |
| Approval (untuk DM/RSM) | `main_approval_list.dart`, `main_approval_plan.dart`, `main_approval_actual.dart`, `approval_list_details.dart`, `approval_plan_details.dart`, `approval_actual_details.dart`, `view_approval_actual_detail_page.dart` | Setujui/tolak call list/plan/actual dari bawahan |
| Join Visit | `main_join_visit_page.dart`, `join_visit_details.dart`, `view_join_visit_details.dart` | Kunjungan bersama atasan |
| Unvisit | `main_unvisit_page.dart`, `add_unvisit_page.dart` | Pencatatan customer yang tidak dikunjungi + alasan |
| Offline | `offline_visit_page.dart`, `add_offline_visit_page.dart`, `offline_NTU_sync_page.dart`, `offline_planned_sync_page.dart`, `offline_unplanned_sync_page.dart`, `offline_edit_sync_page.dart`, `offline_readonly_sync_page.dart` | Form & queue sync saat offline / setelah reconnect |
| Misc | `visit_call_report_page.dart` | Laporan call report |

Detail per-flow ada di [03-features.md](./03-features.md).

---

## 5. Konvensi penamaan & gaya

- **File**: `snake_case.dart`, halaman utama berakhiran `_page.dart`, detail `_details.dart`.
- **Class**: `PascalCase` widget, `XxxQuery` untuk class API statis.
- **Method API**: semua di-`static`, return `Future<...>` (Map atau List<Map>).
- **State**: pakai `setState` lokal + `ValueNotifier` global (`selectPage`, `isDarkMode`). Tidak ada Provider/Riverpod/Bloc.
- **Komentar**: banyak komentar ber-emoji (✅ ⚠️ 🔄 📦 dst.) yang menandai phase offline mode. Pertahankan untuk konsistensi atau bersihkan secara terkoordinasi.

---

## 6. Konvensi warna & theming

Palet tersentral di [`AppColor`](../lib/data/constants.dart#L33):

| Token | Hex | Pemakaian |
|-------|-----|-----------|
| `primaryDark` | `#1E3A8A` | AppBar, header gradient start |
| `primaryBlue` | `#2563EB` | Button utama, link, gradient end |
| `success` `#10B981` / `warning` `#F59E0B` / `error` `#EF4444` / `info` `#3B82F6` | Status badge & SnackBar |
| `textPrimary` `#1E293B` → `textLight` `#94A3B8` | Hierarki teks |
| `backgroundLight` `#F8FAFC` / `backgroundGray` `#F1F5F9` / `cardBackground` `#FFFFFF` | Background |

Theme di-set di [main.dart](../lib/main.dart) lewat `ColorScheme.fromSeed` (seed = `#9AB7E7`).

Mode gelap di-toggle via `isDarkMode` `ValueNotifier`, tetapi belum sepenuhnya digunakan di UI saat ini.

---

## 7. HTTP client `appHttp`

Semua call yang harus tunduk pada gate versi wajib pakai [`appHttp`](../lib/data/constants.dart#L13) (`_AppHttpClient extends http.BaseClient`). Header `X-App-Version` di-inject otomatis. Backend bisa balas `426` → trigger dialog update lewat `appNavigatorKey`.

Beberapa endpoint sederhana (mis. `/login`, `/server-date`, `/app-version`) masih pakai `http.get/post` langsung — pola yang lebih konsisten kedepannya adalah selalu pakai `appHttp`.
