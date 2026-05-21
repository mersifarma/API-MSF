# 03 — Fitur Aplikasi

Dokumen ini menjelaskan **fungsionalitas end-user** beserta file kode yang relevan.

---

## 1. Otentikasi & Session

### 1.1 Login

File: [lib/views/pages/login_page.dart](../lib/views/pages/login_page.dart)

Flow:

1. User input `username` + `password`.
2. Cek koneksi via `ConnectionHelper.checkConnection()`. Jika offline → SnackBar, login dibatalkan (login wajib online).
3. Panggil `MainMenuQuery.login(username, password)` → POST `/login`.
4. Jika sukses, `SessionService().saveSession(data, username)` menulis semua data user ke `SharedPreferences`.
5. Trigger `VisitQuery.syncMasterData()` di background untuk download master customer/spesialisasi/call list.
6. Navigasi ke [HomeRoot](../lib/views/home_root.dart).

`VersionChecker.checkAndPromptUpdate(context)` dipanggil di `initState` — kalau versi lokal lebih lama dari server, dialog update wajib muncul (tidak bisa di-dismiss).

### 1.2 Session storage

File: [lib/data/offline/session_service.dart](../lib/data/offline/session_service.dart)

Class `UserSession` di-persist ke `SharedPreferences`. Field yang disimpan:

| Field | Tipe | Sumber |
|-------|------|--------|
| `user_id` | int | response `/login` → `user.id` |
| `name`, `email`, `username` | String | response `/login` → `user.*` |
| `divisi`, `jabatan` | String | menentukan target visit (lihat [06](./06-call-targets.md)) |
| `id_peg_list` | JSON `List<int>` | semua peg yang dipegang user |
| `id_ff_list` | JSON `List<int>` | force/field assignment |
| `last_login`, `last_sync` | ISO date | auditing lokal |
| `isLoggedIn` | bool | flag boot di [main.dart](../lib/main.dart) |

Logout = panggil `SessionService.clear()` (akan menghapus semua key di atas + flag `isLoggedIn`).

---

## 2. Home & Modul

### 2.1 HomePage

File: [lib/views/pages/home_page.dart](../lib/views/pages/home_page.dart)

- Memuat nama user dari `SharedPreferences`.
- Memuat daftar modul user via `MainMenuQuery.getUserModules(userId)` → `/modul-user/{userId}`.
- Render `GridView` 4 kolom dengan ikon modul. Ikon di-fetch dari `https://monitoring.mersimkt.web.id/vendor/icons/{file}`.
- Tap modul → mapping di `modulePages`. Saat ini hanya **"Visit"** yang ter-mapping ke `VisitPage`. Modul lain (Sales, Inventory, dll.) belum diimplementasi.

> Untuk menambah modul baru: tambahkan entry di `modulePages` map dengan nama persis seperti `nama_modul` di backend, dan arahkan ke widget halaman yang sesuai.

### 2.2 Bottom Navbar

File: [lib/views/widgets/navbar.dart](../lib/views/widgets/navbar.dart)

Dua tab: **Home** (index 0) & **Profile** (index 1). State diatur di [HomeRoot](../lib/views/home_root.dart) via `setState`.

### 2.3 ProfilePage

File: [lib/views/pages/profile_page.dart](../lib/views/pages/profile_page.dart)

Menampilkan info user (nama, divisi, jabatan, foto bila ada), dan tombol logout.

---

## 3. Modul Visit (utama)

Inti aplikasi. Terdiri dari beberapa alur:

### 3.1 Dashboard Visit

- File: [visit_dashboard_page.dart](../lib/views/pages/visit/visit_dashboard_page.dart) + API [visit_dashboard_query.dart](../lib/data/api/visit_dashboard_query.dart)
- Menampilkan counter: total Call List, Plan, Actual untuk periode bulan berjalan.
- Memakai `Call Reach` & `Call Productivity` target dari [`CallReachTargets`](../lib/data/constants.dart#L176) / [`CallProductivityTargets`](../lib/data/constants.dart#L334) untuk gauge pencapaian.

### 3.2 Call List

Daftar customer (dokter/outlet) yang akan dikunjungi.

| File | Fungsi |
|------|--------|
| [main_call_list_page.dart](../lib/views/pages/visit/main_call_list_page.dart) | List call list user |
| [add_call_list_page.dart](../lib/views/pages/visit/add_call_list_page.dart) | Tambah customer ke call list |
| [master_customer_page.dart](../lib/views/pages/visit/master_customer_page.dart) | Picker master customer (dokter/outlet) |
| [customer_detail_page.dart](../lib/views/pages/visit/customer_detail_page.dart) | Detail satu customer + jadwal praktek |

Backend endpoint utama: `/doctor-list` (POST dengan body `id_peg`). Offline mirror via [DatabaseHelper.master_customers](../lib/data/offline/database_helper.dart) table.

### 3.3 Call Plan

Rencana kunjungan periode (mingguan/bulanan).

| File | Fungsi |
|------|--------|
| [main_call_plan_page.dart](../lib/views/pages/visit/main_call_plan_page.dart) | List plan |
| [add_call_plan_page.dart](../lib/views/pages/visit/add_call_plan_page.dart) | Form plan + pilih produk (kolom `product_list` di tabel `call_plan_actual` — lihat [add_product_list_column.sql](../add_product_list_column.sql)) |
| [plan_actual_page.dart](../lib/views/pages/visit/plan_actual_page.dart) | Realisasi dari plan tertentu |
| [planned_actual_page.dart](../lib/views/pages/visit/planned_actual_page.dart) | List actual yang sudah linked ke plan |

### 3.4 Call Actual

Realisasi kunjungan (foto, tanda tangan, koordinat).

| File | Fungsi |
|------|--------|
| [main_call_actual_page.dart](../lib/views/pages/visit/main_call_actual_page.dart) | List actual user |
| [view_actual_page.dart](../lib/views/pages/visit/view_actual_page.dart) | Detail satu actual |
| [actual_details.dart](../lib/views/pages/visit/actual_details.dart) | Komponen detail (reusable) |
| [unplan_actual_page.dart](../lib/views/pages/visit/unplan_actual_page.dart) | Actual tanpa plan terlebih dahulu |
| [non_target_actual_page.dart](../lib/views/pages/visit/non_target_actual_page.dart) | Customer di luar target (Non-Target Unique = NTU) |
| [visit_call_report_page.dart](../lib/views/pages/visit/visit_call_report_page.dart) | Laporan call hasil visit |

Form actual ambil:
- **GPS** via `geolocator` (lihat [location_function.dart](../lib/data/location_function.dart)) — disimpan sebagai `lat,long` string.
- **Foto** via `image_picker` (lihat [image_function.dart](../lib/data/image_function.dart)).
- **Tanda tangan** via package `signature` → di-export ke PNG.
- **Note / catatan**: text bebas.

### 3.5 Unvisit

Mencatat customer yang **tidak** dikunjungi pada hari itu + alasan.

| File | Fungsi |
|------|--------|
| [main_unvisit_page.dart](../lib/views/pages/visit/main_unvisit_page.dart) | List unvisit |
| [add_unvisit_page.dart](../lib/views/pages/visit/add_unvisit_page.dart) | Form alasan unvisit |

### 3.6 Join Visit

Kunjungan bersama atasan (DM/RSM ikut MR ke dokter).

| File | Fungsi |
|------|--------|
| [main_join_visit_page.dart](../lib/views/pages/visit/main_join_visit_page.dart) | List join visit |
| [join_visit_details.dart](../lib/views/pages/visit/join_visit_details.dart) | Form detail join visit |
| [view_join_visit_details.dart](../lib/views/pages/visit/view_join_visit_details.dart) | Read-only view |

---

## 4. Approval Flow (DM / RSM)

Untuk jabatan **DM** dan **RSM**, atasan harus approve call list/plan/actual bawahan sebelum data dianggap final.

| File | Fungsi |
|------|--------|
| [main_approval_list.dart](../lib/views/pages/visit/main_approval_list.dart) | List pending approval (Call List) |
| [main_approval_plan.dart](../lib/views/pages/visit/main_approval_plan.dart) | List pending approval (Call Plan) |
| [main_approval_actual.dart](../lib/views/pages/visit/main_approval_actual.dart) | List pending approval (Call Actual) |
| [approval_list_details.dart](../lib/views/pages/visit/approval_list_details.dart) | Detail + tombol approve/reject untuk List |
| [approval_plan_details.dart](../lib/views/pages/visit/approval_plan_details.dart) | Detail + approve untuk Plan |
| [approval_actual_details.dart](../lib/views/pages/visit/approval_actual_details.dart) | Detail + approve untuk Actual |
| [view_approval_actual_detail_page.dart](../lib/views/pages/visit/view_approval_actual_detail_page.dart) | Read-only view approval actual |

### Reminder approval

[`ApprovalNotificationService`](../lib/data/constants.dart#L625) memunculkan **local notification** saat ada approval pending.

- Diaktifkan di [HomeRoot.initState](../lib/views/home_root.dart) → `startPeriodicCheck()`.
- Interval awal **30 menit**, tetapi tiap respons server bisa mengirim `interval_minutes` baru → service self-reschedule.
- Endpoint: POST `/dm-approval-notification-summary` body `{ id_peg: [...], month, year }`.
- Notifikasi pakai `InboxStyleInformation` untuk multi-line: tampilkan Call List / Plan / Actual count + sisa waktu deadline.
- Channel ID: `approval_reminder`, importance HIGH.

Untuk Android 13+, izin `POST_NOTIFICATIONS` di-request otomatis saat `initialize()`.

---

## 5. Offline Mode

Aplikasi support **add visit walau offline**, lalu auto-sync saat connect kembali. Detail lengkap di [05-offline-mode.md](./05-offline-mode.md). Halaman yang spesifik untuk offline:

| File | Fungsi |
|------|--------|
| [offline_visit_page.dart](../lib/views/pages/visit/offline_visit_page.dart) | List offline visits di local Hive |
| [add_offline_visit_page.dart](../lib/views/pages/visit/add_offline_visit_page.dart) | Form offline (saat tidak ada koneksi) |
| [offline_planned_sync_page.dart](../lib/views/pages/visit/offline_planned_sync_page.dart) | Queue untuk planned visit yang menunggu sync |
| [offline_unplanned_sync_page.dart](../lib/views/pages/visit/offline_unplanned_sync_page.dart) | Queue unplanned visit |
| [offline_NTU_sync_page.dart](../lib/views/pages/visit/offline_NTU_sync_page.dart) | Queue NTU visit |
| [offline_edit_sync_page.dart](../lib/views/pages/visit/offline_edit_sync_page.dart) | Queue edit yang pending |
| [offline_readonly_sync_page.dart](../lib/views/pages/visit/offline_readonly_sync_page.dart) | Tampilan read-only data offline |

---

## 6. Version Gate (Update Wajib)

File: [`VersionChecker`](../lib/data/constants.dart#L821) + [`AppVersion`](../lib/data/constants.dart#L810)

- Dipanggil di `initState` dari [LoginPage](../lib/views/pages/login_page.dart#L33) **dan** [HomeRoot](../lib/views/home_root.dart#L50).
- GET `/app-version` → bandingkan `AppVersion.current` dengan `data.version`.
- Jika `local < server` → tampilkan dialog **non-dismissible** dengan tombol "Update Sekarang" → buka `link_apk` via `url_launcher`.
- Setiap rilis baru:
  1. Naikkan `version:` di [pubspec.yaml](../pubspec.yaml).
  2. Naikkan `AppVersion.current` di [constants.dart](../lib/data/constants.dart#L814).
  3. Update entry di tabel app-version backend (versi + `link_apk`).

Selain dialog manual, `appHttp` juga otomatis menampilkan dialog ini jika **request apa pun** balas HTTP `426 VERSION_OUTDATED` (lihat hint komentar di [visit_query.dart](../lib/data/api/visit_query.dart#L7)).

---

## 7. Banner offline global

[`GlobalConnectionWrapper`](../lib/views/widgets/global_connection_wrapper.dart) di-pasang sebagai pembungkus `MaterialApp` di [main.dart](../lib/main.dart). Saat `ConnectivityService.connectionStream` emit `false`, banner merah muncul di atas seluruh layar (di semua halaman), dengan tombol Retry.

Helper di [`ConnectionHelper`](../lib/data/constants.dart#L391):
- `showOfflineSnackBar(context)` — alert non-blocking di bawah.
- `showOfflineDialog(context)` — alert blocking.
- `checkAndShowAlert(context)` — combo cek + alert.
