# 06 — Business Logic & Validation Rules

Dokumen ini memetakan **aturan bisnis** yang ditegakkan backend: deadline, target, foto wajib, hierarchy, dst. Termasuk di mana konstanta bisa diubah tanpa rilis ulang aplikasi mobile.

---

## 1. Konfigurasi (konstanta yang server-tunable)

### 1.1 `VisitController`

File: [`VisitController.php`](../app/Http/Controllers/api_server/Api/VisitController.php#L27)

| Konstanta | Nilai default | Fungsi |
|-----------|---------------|--------|
| `BATAS_HARI_KERJA_LIST` | `5` | Maksimal hari kerja awal bulan boleh add call_list. Set `null` untuk disable. |
| `OVERRIDE_BULAN_LIST` | `''` | Bypass deadline untuk bulan tertentu (format `'YYYY-MM'`). |

### 1.2 `VisitApprovalController`

File: [`VisitApprovalController.php`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L49)

| Konstanta | Nilai default | Fungsi |
|-----------|---------------|--------|
| `BATAS_HARI_KERJA_LIST` | `5` | Sama dengan VisitController. |
| `OVERRIDE_BULAN_LIST` | `''` | Sama. |
| `BATAS_JAM_PLAN` | `10` | Jam batas approve plan untuk `tgl_plan = hari ini` (24-jam WIB). |
| `BATAS_HARI_ACTUAL` | `1` | Hari maksimal setelah `tgl_actual` boleh di-approve. |
| `BATAS_JAM_ACTUAL` | `10` | Jam batas pada hari terakhir yang diizinkan. |
| `NOTIFICATION_INTERVAL_MINUTES` | `1` *(testing)* | Interval polling reminder mobile. **Reset ke 30 sebelum prod.** |

> ⚠️ **Penting**: `NOTIFICATION_INTERVAL_MINUTES = 1` saat ini berarti mobile akan polling setiap 1 menit — ini hanya untuk testing. Production value yang aman: **30**.

### 1.3 `JoinVisitController`

| Konstanta | Default | Fungsi |
|-----------|---------|--------|
| `JOIN_VISIT_RADIUS_METERS` | `100` | Radius validasi GPS atasan vs MR (dipakai via `/get-app-config`). |

---

## 2. Aturan Add Call List

Berlaku di [`VisitController::saveCallList`](../app/Http/Controllers/api_server/Api/VisitController.php#L499).

### 2.1 Gate versi

`X-App-Version` header wajib. Tanpa header → HTTP 426.

### 2.2 Deadline awal bulan

Sampai hari kerja ke-`BATAS_HARI_KERJA_LIST` (5) dari tanggal 1 bulan ini. Helper:

```php
private function hitungDeadlineHariKerja(Carbon $periodeAwal, int $n): Carbon
{
    $count = 0;
    $tanggal = $periodeAwal->copy()->startOfDay();
    while (true) {
        if ($tanggal->isWeekday()) {
            $count++;
            if ($count >= $n) break;
        }
        $tanggal->addDay();
    }
    return $tanggal;
}
```

Sabtu & Minggu di-skip. Contoh: 1 Mei 2026 jatuh Jumat → hari kerja ke-5 = Kamis 7 Mei.

Bypass: kalau `now()->format('Y-m') === OVERRIDE_BULAN_LIST` → boleh add tanpa cek deadline.

### 2.3 Anti duplikasi

`(id_peg, id_mcl, periode)` harus unik. Cek dengan `count() > 0` sebelum insert.

### 2.4 Target dokter & non-dokter

Hitung row existing user di bulan tersebut:
- `count_dokter` = `segmen = 'Doctor'`
- `count_non_dokter` = `segmen = 'Non-Doctor'`

Lookup target dari `call_target_list` WHERE `(jabatan, divisi)` match `data_pegawai`. Reject jika hendak melewati `target_dokter` / `target_non_dokter`.

### 2.5 Target visit per row

Default `target_visit = 1`. Wilayah luar kota → multiplier (cek implementasi spesifik di method, biasanya 2× kalau `wilayah` di-set ke "Luar Kota").

---

## 3. Aturan Update / Delete Call List

### 3.1 Update

[`updateCallList`](../app/Http/Controllers/api_server/Api/VisitController.php#L2662):

- Hanya bisa kalau row punya `approval = 'Reject'`. State lain → tolak.
- Reset `approval = NULL` setelah update (re-trigger DM approve).
- INSERT row `call_list_history` dengan old/new value tiap kolom (audit).
- Jika `id_mcl` berubah → re-validasi target.

### 3.2 Delete

[`deleteCallList`](../app/Http/Controllers/api_server/Api/VisitController.php#L1523):

- Tolak kalau sudah ada entry di `call_plan_actual` untuk `(id_peg, id_mcl, periode)`.
- Tolak kalau `approval = 'Reject'` (harus pakai update flow).
- Otherwise → DELETE.

---

## 4. Aturan Save Actual

[`saveActual`](../app/Http/Controllers/api_server/Api/VisitController.php#L1070) & [`saveUnplanned`](../app/Http/Controllers/api_server/Api/VisitController.php#L1293).

### 4.1 Tanggal aktual = today server

`tgl_actual` **harus** = `Carbon::today('Asia/Jakarta')`. Tujuan: cegah device-time tampering.

### 4.2 Window 1 jam untuk status `Offline`

Kalau `status === 'Offline'` (mobile replay queue), backend cek:

- `updated_date` dari row asal harus ≤ 1 jam sebelum `now()`.
- Lebih lama → tolak.

Tujuan: cegah replay submission lama (yang mungkin akurasinya sudah kadaluarsa).

### 4.3 Anti duplikasi (untuk unplanned)

`(id_peg, id_mcl, tgl_actual)` harus unik di `call_plan_actual`. Tolak kalau sudah ada.

### 4.4 Join visit auto-copy

Kalau `join_visit = 1` dan `join_visit_id` non-empty:

```
For each approverPegId in CSV:
    JoinVisitController::joinVisitCopyData(actualId, approverPegId, koor_visit)
```

→ INSERT row baru `call_plan_actual` untuk atasan (lihat [§7](#7-join-visit)).

---

## 5. Deadline Approval

### 5.1 Approval Call List

Method: [`DmApprovalListSave`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L375).

- Deadline = hari kerja ke-`BATAS_HARI_KERJA_LIST` dari periode awal, jam **23:59:59**.
- Saat `now() > deadline` → return `{ success: false, error_code: 'APPROVAL_LIST_EXPIRED' }`.
- Bypass: `OVERRIDE_BULAN_LIST`.

### 5.2 Approval Call Plan

Method: [`DmApprovalPlanSave`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L719).

Per-item check (tiap `id` di payload):

| Kondisi `tgl_plan` vs hari ini | Hasil |
|-------------------------------|-------|
| `tgl_plan < today` | Expired, skip |
| `tgl_plan = today` AND `now < BATAS_JAM_PLAN` | OK |
| `tgl_plan = today` AND `now ≥ BATAS_JAM_PLAN` | Expired |
| `tgl_plan > today` | OK (preview, biasanya tidak terjadi) |

**Cascade saat Reject**: `approval_actual = 'Reject'`, `approval_actual_by`, `approval_actual_date` ke-update juga. Logikanya: kalau plan ditolak, actual yang turun dari plan itu otomatis batal.

### 5.3 Approval Call Actual

Method: [`DmApprovalActualSave`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L1133) & [`DmApprovalActualSingle`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L1293).

Cutoff hari ini = `tgl_actual + BATAS_HARI_ACTUAL` (default 1). Pada hari cutoff, batas waktu = `BATAS_JAM_ACTUAL` (10:00 WIB).

**Weekend adjustment**:

| Hari `now` | Extra grace |
|------------|-------------|
| Senin | +3 hari (untuk handle visit Jum/Sab/Min) |
| Minggu | +2 hari |
| lainnya | normal |

**Guard tambahan saat Approve**:

| Kondisi | Hasil |
|---------|-------|
| `foto IS NULL` atau empty | Reject dengan `error_code: APPROVAL_ACTUAL_NO_FOTO` |
| Lewat cutoff | Reject dengan `error_code: APPROVAL_ACTUAL_EXPIRED` |

**Side effect saat Approve**:

```sql
UPDATE call_list
SET is_visited = 1, updated_by = <approver>, updated_date = NOW()
WHERE id_mcl = <mcl> AND id_peg IN (
   SELECT rowid FROM data_pegawai WHERE id_user = <id_user pemilik actual>
)
AND YEAR(periode) = YEAR(<tgl_actual>) AND MONTH(periode) = MONTH(<tgl_actual>)
```

Dipakai untuk combo account: 1 user (1 row `users`) bisa punya banyak `data_pegawai`, dan `is_visited` di-set untuk **semua** id_peg user tersebut.

Semua dibungkus `DB::transaction()` → atomic.

---

## 6. Approval Notification

Method: [`DmApprovalNotificationSummary`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L1464).

Polling endpoint. Return: count + deadline + interval menit.

**Count rule**:
- Kalau deadline sudah lewat untuk kategori tertentu → `count = 0` (tidak tampil sebagai pending).

**Deadline rule**:
- `list_deadline` = `hitungDeadlineHariKerja(periodeAwal, BATAS_HARI_KERJA_LIST)->endOfDay()`.
- `plan_deadline` = besok jam `BATAS_JAM_PLAN` kalau hari ini sudah lewat jam itu, sebaliknya hari ini.
- `actual_deadline` = `today + 1` jam `BATAS_JAM_ACTUAL` (weekend adjusted).

**Interval**: `interval_minutes` di-respect mobile → reschedule timer setelah tiap polling.

---

## 7. Join Visit

### 7.1 Atasan eligible

[`callJoinVisit`](../app/Http/Controllers/api_server/Api/JoinVisitController.php#L21):

- Jabatan MR/PS/KAE → cari DM + RSM dari `struktur` dengan periode aktif.
- Jabatan DM → cari RSM.
- Jabatan lainnya → tidak ditangani (default ke MR path).

### 7.2 Copy data

[`joinVisitCopyData`](../app/Http/Controllers/api_server/Api/JoinVisitController.php#L249):

1. Clone row `call_plan_actual` MR.
2. Replace `id_peg`/`id_ff`/`nama_ff` dengan approver.
3. Set `join_visit = 0`, `join_visit_id = <id MR>`, `join_visit_ff = <approver rowid>`.
4. Reset semua field approval (atasan harus approve sendiri).
5. INSERT row baru.

Hasil: laporan atasan otomatis include kunjungan yang di-join.

### 7.3 Approval window

[`approvalJoinVisit`](../app/Http/Controllers/api_server/Api/JoinVisitController.php#L104) filter: `updated_date >= NOW() - INTERVAL 30 MINUTE`.

Artinya: atasan hanya bisa approve join visit dalam window 30 menit setelah MR submit. Lewat itu → tidak muncul di list pending.

> Rationale: join visit aktif/real-time. Kalau MR submit > 30 menit lalu, dianggap bukan join visit aktif.

---

## 8. Reach & Productivity Target

### 8.1 Call Reach (jumlah unique customer/bulan)

Sumber data:
- Tabel `call_target_list` (kolom `target_dokter`, `target_non_dokter`).
- Validasi saat `saveCallList`.

> Mobile **CallReachTargets** di [constants.dart](../../lib/data/constants.dart) hanya fallback. Server kontrol via tabel.

### 8.2 Call Productivity (visit/hari × hari kerja)

Endpoint: `POST /get-productivity-target`.

Formula:

```
target_dokter = target_per_day_dokter × effective_working_days
target_non_dokter = target_per_day_non_dokter × effective_working_days
effective_working_days = working_days − unvisit_count
working_days = SELECT hari_kerja FROM set_param_sum_mcr WHERE periode = '<MM-YYYY>'
unvisit_count = COUNT dari visit_tidak_kunjungan{_mr} bulan itu
```

Mobile prefer angka ini di atas konstanta `CallProductivityTargets`.

### 8.3 Frequency

`/get-report-freq` hitung per-(MR × dokter):
- `target` = `call_target_class.target` WHERE jabatan + class match.
- `actual` = count `call_plan_actual` WHERE `approval_actual = 'Approve'` di periode.
- `point = (actual >= target) ? 1 : 0`.
- Agregat → `freq_doctor`, `freq_non_doctor`.

---

## 9. Hierarchy & Data Visibility

Diturunkan dari `struktur`:

```
MM ─── (1)─(N) ─── RSM ─── (1)─(N) ─── DM ─── (1)─(N) ─── MR
                                                          MR juga bisa PS / KAE
```

Beberapa controller mem-resolve hierarchy untuk filter data:

- `doctorList`, `getCallList`, `callPlanInst`: kalau `id_peg` user adalah DM/RSM → expand ke semua MR/DM di bawah → return dokter mereka.
- `DmApprovalListName`, `DmApprovalPlanName`, `DmApprovalActualName`: query `struktur` LEFT JOIN untuk dapat list pegawai bawahan.

> **Tidak ada otorisasi explicit** — backend percaya `id_peg` yang dikirim. Mobile harus kirim `id_peg` user yang login. Risiko: kalau payload di-tamper, user bisa lihat data orang lain.

---

## 10. Combo Account

`data_pegawai` 1-to-N dengan `users`. Implikasi:

- Saat login, return **array** `id_peg` & `id_ff`. Mobile harus loop / select untuk request berikutnya.
- Saat approve actual, side-effect `call_list.is_visited = 1` di-broadcast ke semua row id_peg user tersebut (lookup via `id_user`).
- Saat compute target, gabung dari semua id_peg user (cek implementasi spesifik).

---

## 11. Foto wajib

Approve actual tanpa `foto` di row → backend tolak:

```json
{
  "success": false,
  "error_code": "APPROVAL_ACTUAL_NO_FOTO",
  "message": "Foto kunjungan wajib ada sebelum approve."
}
```

Pemeriksaan di [`DmApprovalActualSave`](../app/Http/Controllers/api_server/Api/VisitApprovalController.php#L1133) line ~1195 (cek `foto` kolom). Single approval juga sama.

Mobile harus enforce upload foto dulu sebelum submit actual; backend cuma double-check.

---

## 12. Cascade approval

Ringkasan side effect:

| Action | Cascade |
|--------|---------|
| Reject plan | `approval_actual = 'Reject'` auto-set di row yang sama |
| Approve actual | `call_list.is_visited = 1` untuk `id_peg ∈ user`-nya |
| Save actual dengan `join_visit=1` | INSERT row baru per atasan via `joinVisitCopyData` |
| Update call_list | reset `approval = NULL` + INSERT `call_list_history` |

---

## 13. Validasi yang TIDAK ada di backend (gap)

Hal-hal berikut **tidak** ter-validate di backend, jadi mobile harus enforce:

- Format `koor_visit` (`"lat,long"`) — backend cuma length max 100.
- Foto file ukurannya: backend cek max 5 MB di `/upload-photo` (`max:5120`), tapi tidak compress.
- Tanda tangan empty signature pad (canvas blank) — backend nerima file apa saja jika lulus mime check.
- Authentication / authorization (siapa yang boleh approve apa) — bisa di-bypass dengan kirim `dm_id_peg` siapa saja.
- Konsistensi `id_ff` ↔ `id_peg` — bisa kirim pair tidak valid.

Pertimbangkan untuk menambah validasi server-side untuk hal-hal di atas.

---

Lanjut ke [`07-versioning-release.md`](./07-versioning-release.md).
