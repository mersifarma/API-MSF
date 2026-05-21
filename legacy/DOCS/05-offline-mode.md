# 05 — Offline Mode

Aplikasi mendukung pemakaian saat **tidak ada koneksi internet**. Implementasi dibagi tiga fase yang sudah terpasang di codebase:

| Phase | Fokus | File utama |
|-------|-------|------------|
| **Phase 0 — Init** | Bootstrap Hive sebelum `runApp` | [data/init.dart](../lib/data/init.dart) |
| **Phase 1 — Read offline** | Cache master data ke SQLite, deteksi koneksi, fallback otomatis | [data/offline/](../lib/data/offline/) |
| **Phase 2 — Write offline** | Queue submission saat offline, auto-sync saat reconnect | [pending_sync_service.dart](../lib/data/offline/pending_sync_service.dart) |

---

## 1. Persistence stack

Dua database lokal hidup berdampingan, masing-masing untuk tujuan yang berbeda:

### 1.1 SQLite (`sqflite`)

File: [database_helper.dart](../lib/data/offline/database_helper.dart)

- File DB: `mms_offline.db` di app documents dir.
- Versi schema: **2** (lihat [database_helper.dart](../lib/data/offline/database_helper.dart#L52)).
- Tabel utama:
  - `master_customers` — cache `/doctor-list`
  - `specializations` — cache spesialisasi
  - `call_list` — cache call list user
  - `institutions` — lokasi praktek
  - `pending_submissions` — antrian upload (ditambah di Phase 2)
- Helper: `DatabaseHelper().database` (singleton).

### 1.2 Hive (`hive_flutter`)

File: [init.dart](../lib/data/init.dart) + [models/offline_visit.dart](../lib/data/offline/models/offline_visit.dart)

- Box: `offline_visits` (nama konstanta di [hiveDB.OFFLINE_VISIT_BOX](../lib/data/constants.dart#L27)).
- Model `OfflineVisit` menyimpan: koordinat, path foto, path tanda tangan, catatan, tanggal selesai, flag `synced`, plus info dokter setelah sync (`docName`, `instName`, `visitType`).
- Aturan: `OFFLINE_EXPIRE_HOURS = 5` — data dianggap stale setelah 5 jam.

> Mengapa dua-duanya? **SQLite** untuk relational data (master + log), **Hive** untuk binary-friendly entries (form visit dengan file path & metadata) yang sering dibaca-tulis cepat.

---

## 2. Connectivity service

File: [connectivity_service.dart](../lib/data/offline/connectivity_service.dart)

- Singleton: `ConnectivityService()`.
- Pakai package `connectivity_plus` + cek via `InternetAddress.lookup` agar tidak false-positive (Wi-Fi nyala tapi tidak ada internet).
- API publik:
  - `Future<bool> checkConnection()` — cek sekarang.
  - `bool isOnline` — status terakhir.
  - `Stream<bool> connectionStream` — listener perubahan.
- Diinisialisasi otomatis di alur `VisitQuery.initializeOfflineMode()` (dipanggil dari [main.dart](../lib/main.dart#L39)).

[`ConnectionHelper`](../lib/data/constants.dart#L391) adalah facade di atas service ini dengan helper UI (SnackBar, Dialog, Banner overlay).

---

## 3. GlobalConnectionWrapper

File: [global_connection_wrapper.dart](../lib/views/widgets/global_connection_wrapper.dart)

Widget yang membungkus `MaterialApp` (lihat [main.dart](../lib/main.dart#L72)). Saat `connectionStream` emit `false`, banner merah dengan tombol Retry muncul **di seluruh halaman**. Tujuannya supaya user selalu sadar status koneksi tanpa perlu setiap page mengulang logika alert sendiri.

---

## 4. Hybrid query (Phase 1)

Pola yang dipakai `VisitQuery` untuk fitur read:

```dart
final isOnline = await ConnectivityService().checkConnection();
if (isOnline) {
  // 1. Fetch dari server lewat appHttp
  final res = await appHttp.post(...);
  // 2. Cache hasil ke SQLite lewat OfflineDataService
  await OfflineDataService().saveMasterCustomers(result);
  return result;
} else {
  // 3. Baca dari SQLite cache
  return await OfflineDataService().getMasterCustomers(filter);
}
```

Contoh implementasi nyata di [visit_query.dart](../lib/data/api/visit_query.dart) (bagian `getDoctorList`).

`OfflineDataService` ([file](../lib/data/offline/offline_data_service.dart)) berfungsi sebagai **glue** yang mengabstraksi SQLite & API agar caller tidak perlu peduli mode mana yang aktif.

---

## 5. Pending submission (Phase 2)

File: [pending_sync_service.dart](../lib/data/offline/pending_sync_service.dart) + tabel `pending_submissions` di SQLite + box Hive untuk visit form.

### 5.1 Flow saat offline

1. User isi form Call Actual / Plan / Unvisit di luar jaringan.
2. Data + path foto + path tanda tangan disimpan **lokal** (Hive untuk visit form, atau row di `pending_submissions` untuk endpoint generic).
3. Halaman list offline menampilkan item dengan badge "Pending sync".

### 5.2 Flow saat reconnect

`PendingSyncService` (singleton) di-`initialize()` dari [main.dart](../lib/main.dart#L46):

1. Listen ke `ConnectivityService.connectionStream`.
2. Saat koneksi kembali → loop semua row pending → POST ke endpoint sesuai jenis submission.
3. Bila sukses → mark `synced = true` (atau hapus row). Update Hive entry dengan `docName`, `instName`, `visitType` agar tampilan tidak hilang konteks.
4. Bila gagal → biarkan, retry di event reconnect berikutnya.

### 5.3 Halaman terkait

Lihat [03-features.md §5](./03-features.md#5-offline-mode) untuk daftar halaman offline (`offline_*_sync_page.dart`).

---

## 6. Master data sync

Setelah login (lihat [login_page.dart](../lib/views/pages/login_page.dart#L449)):

```dart
VisitQuery.syncMasterData().then((result) {
  debugPrint(' Sync completed: ${result.message}');
});
```

Sync download:
1. Master Customer (`/doctor-list`)
2. Spesialisasi
3. Call List user
4. Institusi

Sync background (non-blocking) — UI tetap masuk HomeRoot. Bila gagal (offline), app fallback ke cache lama (atau kosong jika belum pernah sync).

---

## 7. Aturan kedaluwarsa

`hiveDB.OFFLINE_EXPIRE_HOURS = 5` ([constants.dart](../lib/data/constants.dart#L30)). Pakai konstanta ini bila perlu validasi: "jika offline lebih dari 5 jam tanpa sync, paksa user reconnect sebelum bisa submit." Cek pemakaian di kode sebelum mengubah nilainya.

---

## 8. Debugging offline mode

Aktivasi log saat dev:

- Cek `flutter run` console — service-service offline mode print banner ASCII saat init.
- Forced offline test:
  - Toggle Airplane Mode pada device.
  - Atau pakai `adb shell svc wifi disable` + `svc data disable`.
- Cek isi SQLite:
  ```bash
  adb shell run-as com.mersi.mmsmobile cat databases/mms_offline.db > local.db
  ```
  Buka pakai DB Browser for SQLite.
- Cek isi Hive:
  - Path: `<app docs>/<box>.hive` — tidak human-readable, gunakan code Dart untuk dump (`Hive.box('offline_visits').toMap()`).

---

## 9. Hal-hal yang harus diperhatikan saat menambah fitur

Saat menambah call API baru:

1. Putuskan: apakah read ini perlu offline fallback?
2. Jika ya, tambahkan tabel cache di [database_helper.dart](../lib/data/offline/database_helper.dart) → bump `version` & implementasi `onUpgrade`.
3. Tambah method di [offline_data_service.dart](../lib/data/offline/offline_data_service.dart) untuk save/get cache.
4. Di method query, pakai pattern hybrid: cek `isOnline` → fetch+cache atau read cache.

Saat menambah submission (POST) baru:

1. Tambah row di `pending_submissions` saat offline.
2. Register handler-nya di [pending_sync_service.dart](../lib/data/offline/pending_sync_service.dart) agar di-replay saat reconnect.
3. Pastikan field "submission type" mengarahkan ke endpoint yang benar.
