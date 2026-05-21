# 06 — Target Call Reach & Call Productivity

Aplikasi punya **dua jenis target visit** yang berbeda berdasarkan **divisi** dan **jabatan** user. Aturan ini di-hardcode di [lib/data/constants.dart](../lib/data/constants.dart#L134-L383).

> Untuk mengubah target → edit konstanta di file ini, lalu rilis ulang. **Tidak ada API yang mengontrol target** — perlu update aplikasi.

---

## 1. Definisi target

### Call Reach

> Jumlah **unik** dokter/outlet yang harus dikunjungi dalam satu periode (mis. bulan).

### Call Productivity

> Jumlah kunjungan **per hari** (total bisa dipakai kali jumlah hari kerja).

---

## 2. Klasifikasi divisi & jabatan

Klasifikasi via string-matching (lower-case + `trim`), lihat helper privat di `CallReachTargets`:

| Helper | Pattern jabatan |
|--------|-----------------|
| `_isJabatanKAE` | mengandung `kae` atau persis `key account executive` |
| `_isJabatanMR` | mengandung `mr` / `ps`, atau persis `medical representative` / `product specialist` (catatan: KAE **tidak** termasuk di sini lagi) |
| `_isJabatanDM` | mengandung `dm` / `district` atau persis `district manager` |
| `_isJabatanRSM` | mengandung `rsm` / `regional` atau persis `regional sales manager` |

Klasifikasi divisi: hanya pengecekan `divisi.startsWith('neptune')` untuk membedakan Neptune dari Jupiter/Mercury.

> Konsekuensi: divisi baru selain "Neptune" yang punya pattern target lain akan otomatis di-treated sebagai Jupiter/Mercury. Tambah branch di helper kalau perlu.

---

## 3. Target Call Reach

### 3.1 Jupiter & Mercury (`JupiterMercuryTargets`)

| Jabatan | Dokter | Non-Dokter |
|---------|--------|------------|
| MR / PS / KAE | 60 | 0 |
| DM | 40 | 0 |
| RSM | 20 | 0 |

> Jupiter & Mercury **tidak** memiliki target Non-Dokter (outlet).

### 3.2 Neptune (`NeptuneTargets`)

| Jabatan | Dokter | Non-Dokter |
|---------|--------|------------|
| MR / PS | 20 | 40 |
| **KAE** | 10 | 50 |
| DM | 15 | 25 |
| RSM | 5 | 15 |

> Untuk **KAE di Neptune**, breakdown berbeda dari MR/PS — diperiksa secara eksplisit di [`getDokterTarget`](../lib/data/constants.dart#L184) (block `_isJabatanKAE && isNeptune`).

### 3.3 Helper

```dart
CallReachTargets.getDokterTarget(divisi, jabatan)
CallReachTargets.getNonDokterTarget(divisi, jabatan)
CallReachTargets.getTotalTarget(divisi, jabatan)
```

---

## 4. Target Call Productivity (per hari)

### 4.1 Jupiter & Mercury (`JupiterMercuryProductivityTargets`)

| Jabatan | Per hari |
|---------|----------|
| MR / PS / KAE | 10 |
| DM | 4 |
| RSM | 2 |

### 4.2 Neptune (`NeptuneProductivityTargets`)

| Jabatan | Dokter | Outlet | Total per hari |
|---------|--------|--------|----------------|
| MR / PS / KAE | 4 | 6 | **10** |
| DM | 2 | 4 | **6** |
| RSM | 2 | 2 | **4** |

> Untuk Neptune, breakdown Dokter+Outlet tersedia, tetapi helper `getTargetPerDay` hanya mengembalikan total.

### 4.3 Helper

```dart
CallProductivityTargets.getTargetPerDay(divisi, jabatan)
CallProductivityTargets.getTotalTarget(divisi, jabatan, hariKerja)
// → targetPerDay * hariKerja
```

`hariKerja` di-pass dari backend (`/server-date` atau dashboard summary) untuk akurasi sesuai kalender perusahaan (libur nasional, cuti bersama).

---

## 5. Cara mengubah target

1. Edit nilai konstanta di [constants.dart](../lib/data/constants.dart#L140-L332) bagian `JupiterMercuryTargets`, `NeptuneTargets`, `JupiterMercuryProductivityTargets`, `NeptuneProductivityTargets`.
2. **Naikkan versi** (`pubspec.yaml` + `AppVersion.current`).
3. Update entry di tabel app-version backend agar user lama dipaksa update.
4. Rebuild APK & distribusi.

> Karena target hard-coded, **versi APK lama tetap memakai angka lama**. Itulah salah satu alasan dialog update wajib dibuat strict (non-dismissible).

---

## 6. Kasus edge

- **Jabatan tidak dikenal** (mis. typo, role baru) → fallback ke target MR.
- **Divisi kosong / null** → di-treat sebagai non-Neptune (= Jupiter/Mercury).
- **KAE di Jupiter/Mercury** → ikut target MR (karena `_isJabatanMR` mencakup `kae`? — **TIDAK**, `_isJabatanMR` saat ini secara eksplisit hanya match `mr`/`ps`/etc, jadi KAE non-Neptune jatuh ke fallback MR via default branch). Verifikasi di [getDokterTarget](../lib/data/constants.dart#L184) bila perilaku ini berubah.

---

## 7. Pemakaian di UI

Target dipakai di **Visit Dashboard** untuk progress bar/gauge "X dari Y". Caller utama:

- [visit_dashboard_page.dart](../lib/views/pages/visit/visit_dashboard_page.dart) → ambil `divisi` & `jabatan` dari `SessionService`/`SharedPreferences`, panggil helper di atas.
- Komponen progress bisa membandingkan `actualCount` vs target untuk styling warna (merah/kuning/hijau) menggunakan token di [`AppColor`](../lib/data/constants.dart#L33).
