# Dokumentasi Lengkap: Mersi Monitoring System – Visit

> **Mersi Marketing** — Sistem Monitoring Kunjungan (Visit) Field Force Marketing
> URL Sistem: `https://monitoring.mersimkt.web.id/Visit`

---

## Daftar Isi

1. [Pendahuluan](#1-pendahuluan)
2. [Struktur Menu Sistem](#2-struktur-menu-sistem)
3. [Definisi dan Istilah dalam Visit](#3-definisi-dan-istilah-dalam-visit)
4. [Jenis-Jenis Call Report](#4-jenis-jenis-call-report)
   - [4.1 Call Productivity](#41-call-productivity)
   - [4.2 Call Reach](#42-call-reach)
   - [4.3 Call Frequency](#43-call-frequency)
5. [Ketentuan MCL (Master Customer List)](#5-ketentuan-mcl-master-customer-list)
6. [Ketentuan Call Report](#6-ketentuan-call-report)
7. [Ketentuan Insentif Visit](#7-ketentuan-insentif-visit)
8. [Daily Activity](#8-daily-activity)
9. [Keterangan Class Dokter/Customer](#9-keterangan-class-doktercustomer)
10. [Data Populasi Dokter per Spesialisasi](#10-data-populasi-dokter-per-spesialisasi)
11. [Distribusi Jumlah Dokter per Class](#11-distribusi-jumlah-dokter-per-class)
12. [Ringkasan Cepat (Quick Reference)](#12-ringkasan-cepat-quick-reference)

---

## 1. Pendahuluan

**Mersi Monitoring System – Visit** adalah modul dalam aplikasi **Mersi Marketing** yang digunakan untuk memantau (monitoring) dan mengevaluasi aktivitas kunjungan (*visit*) yang dilakukan oleh **Field Force (FF) Marketing** kepada customer (dokter maupun non-dokter).

Sistem ini bertujuan untuk:

- Memastikan setiap kunjungan terdata, terverifikasi, dan dapat dipertanggungjawabkan.
- Mengukur kinerja FF Marketing melalui tiga indikator utama: **Call Productivity**, **Call Reach**, dan **Call Frequency**.
- Menjadi dasar perhitungan **insentif visit** bagi FF Marketing.
- Mendukung pengambilan keputusan berbasis data (jumlah populasi dokter, class dokter, dan capaian kunjungan).

Sistem ini diakses melalui web dan terintegrasi dengan **MSF Mobile** (aplikasi mobile untuk input Call List, Call Plan, dan Call Actual oleh FF di lapangan).

### Level Jabatan / Field Force

Sistem mengenal beberapa level jabatan yang masing-masing memiliki target kunjungan berbeda:

| Singkatan | Keterangan |
|-----------|------------|
| MR | Medical Representative |
| PS | (Product/Professional Sales) |
| KAE | Key Account Executive |
| DM | District Manager |
| RSM | Regional Sales Manager |
| MM | Marketing Manager |
| PE/PM | Product Executive / Product Manager |

### Divisi

Target kunjungan dibedakan berdasarkan divisi:

- **Divisi Jupiter & Mercury** — fokus pada kunjungan ke dokter.
- **Divisi Neptune** — kombinasi kunjungan dokter dan non-dokter (outlet).

---

## 2. Struktur Menu Sistem

Sidebar navigasi sistem terdiri dari menu-menu berikut:

- **Dashboard** — halaman utama monitoring Visit.
- **Master Data**
  - Data Customer List (New) — daftar master customer.
- **Call Report**
  - Report MR — laporan kunjungan level Medical Representative.
  - Report DM — laporan kunjungan level District Manager.
  - Report RSM — laporan kunjungan level Regional Sales Manager.

Sistem juga menyediakan fitur ekspor data ke format **CSV** dan **Excel** pada tabel laporan.

---

## 3. Definisi dan Istilah dalam Visit

Berikut definisi istilah-istilah kunci yang digunakan dalam sistem:

1. **Master Customer List (MCL)** — daftar seluruh customer dari tiap-tiap rayon sesuai wilayah kerja masing-masing field force, baik berupa dokter maupun non-dokter, yang memuat informasi lengkap customer sebagai acuan dalam membuat rencana kunjungan.

2. **Call List** — daftar customer yang dibuat oleh tiap-tiap FF Marketing sebagai target customer dalam satu bulan.

3. **Call Plan** — daftar rencana kunjungan dari customer yang dibuat oleh tiap-tiap FF Marketing sesuai dengan data yang terdapat dalam Call List.

4. **Call Actual** — realisasi kunjungan dari customer yang dibuat oleh tiap-tiap FF Marketing sesuai dengan data yang terdapat dalam Call Plan / Call List / MCL.

5. **Call Report** — laporan kunjungan ke customer yang sudah dilakukan oleh FF Marketing.

6. **Plan Visit (Planned)** — realisasi kunjungan yang sudah direalisasikan sesuai dengan rencana kunjungan yang sudah dibuat sebelumnya.

7. **Unplan Visit (Unplanned)** — realisasi kunjungan yang sudah direalisasikan tetapi tidak sesuai dengan rencana kunjungan yang dibuat sebelumnya, namun customer masih ada dalam Call List.

8. **Non Target Visit (kunjungan di luar data Call List)** — realisasi kunjungan ke customer yang tidak tercantum dalam Call List yang sudah dibuat sebelumnya.

9. **UnVisit (tidak ada kunjungan)** — rencana kunjungan sudah dibuat sebelumnya tetapi tidak terealisasi karena alasan tertentu, misal: Sakit, Izin, dan Cuti.

---

## 4. Jenis-Jenis Call Report

Terdapat **3 (tiga) jenis** Call Report yang menjadi indikator kinerja kunjungan FF Marketing.

### 4.1 Call Productivity

Ketentuan:

- Call Productivity Report dihitung berdasarkan **total jumlah visit vs target visit (per bulan)**.
- Minimal pencapaian (ach) Call Productivity adalah **80%**.
- Target Call Productivity disesuaikan dengan level jabatan masing-masing.

**Target Call per Hari — Divisi Jupiter dan Mercury**

| Jabatan | Dokter/User | Outlet |
|---------|:-----------:|:------:|
| MR/PS/KAE | 10 | 2 |
| DM | 4 | 1 |
| RSM | 2 | 1 |

**Target Call per Hari — Divisi Neptune**

| Jabatan | Dokter/User | Outlet |
|---------|:-----------:|:------:|
| MR/PS/KAE | 4 | 6 |
| DM | 2 | 4 |
| RSM | 2 | 2 |

---

### 4.2 Call Reach

Ketentuan:

- Call Reach dihitung berdasarkan **jumlah dokter yang berhasil dikunjungi** dibandingkan dengan **jumlah total Call List per bulan**.
- Setiap kunjungan ke dokter yang terdapat dalam Call List akan dihitung **1 kali kunjungan**.
- Minimal pencapaian Call Reach adalah **80%**.

**Call Plan dari Masing-Masing Divisi**

| Jabatan | Jupiter & Mercury | Neptune |
|---------|-------------------|---------|
| MR/PS | 60 Dokter | 20 Dokter + 40 Non Dokter |
| KAE | – | 10 Dokter + 50 Non Dokter |
| DM | 40 Dokter | 15 Dokter + 25 Non Dokter |
| RSM | 20 Dokter | 5 Dokter + 15 Non Dokter |

---

### 4.3 Call Frequency

Ketentuan:

- Call Frequency Report dihitung berdasarkan **berapa kali melakukan kunjungan** dalam periode tertentu, dibandingkan dengan **target kunjungan per dokter** sesuai class dokter yang telah ditetapkan.
- Minimal total pencapaian Call Frequency adalah **60%**.
- Jika actual kunjungan **melebihi** target yang ditetapkan, maka Call Frequency dokter tersebut dihitung sesuai **maksimal target** kunjungan.
  - *Contoh:* target dokter class AA adalah 4x sebulan; jika dikunjungi lebih dari 4x sebulan, ach Call Frequency tetap dihitung **100%**.
- Jika actual kunjungan **kurang dari** target yang ditetapkan, maka Call Frequency dokter tersebut **tidak dihitung (0%)**.
  - *Contoh:* target dokter class AA adalah 4x sebulan; jika hanya dikunjungi 3x sebulan, ach Call Frequency dokter itu adalah **0%**.

**Target Kunjungan per Dokter/Customer (per bulan) sesuai Class — untuk MR/PS/KAE**

| Class User | Target | Class User | Target | Class User | Target |
|:----------:|:------:|:----------:|:------:|:----------:|:------:|
| AA | 4 | BA | 4 | CA | 2 |
| AB | 4 | BB | 3 | CB | 2 |
| AC | 4 | BC | 2 | CC | 2 |

**Target Kunjungan per Dokter/Customer (per bulan) sesuai Class — untuk DM/RSM**

| Class User | Target | Class User | Target | Class User | Target |
|:----------:|:------:|:----------:|:------:|:----------:|:------:|
| AA | 2 | BA | 2 | CA | 1 |
| AB | 2 | BB | 1 | CB | 1 |
| AC | 2 | BC | 1 | CC | 1 |

> **Catatan:** Bagi FF yang mempunyai dokter dengan wilayah praktek di luar kota, maka target frequency kunjungan untuk dokter tersebut adalah **1x sebulan**, dengan maksimal jumlah dokter dalam Call Plan sebesar **20% dari total Call Plan**.

---

## 5. Ketentuan MCL (Master Customer List)

a. MR/PS/KAE (existing) **wajib membuat data MCL** sesuai dengan daftar customer yang ada di wilayah kerjanya masing-masing, dan wajib diperiksa serta diverifikasi oleh atasannya masing-masing secara berjenjang.

b. Khusus rayon yang **vacant**, maka pembuatan data MCL otomatis menjadi tanggung jawab atasannya langsung dan seterusnya.

c. Proses perubahan data MCL dilakukan **setiap kuartal**, atau jika terdapat perubahan struktur di rayon yang mengalami perubahan saja.

d. Mekanisme penambahan atau perubahan data MCL **disentralisasi** prosesnya melalui Marketing Support Pusat.

e. Data MCL dari tiap-tiap MR/PS/KAE secara otomatis menjadi data MCL dari atasannya dan seterusnya secara berjenjang sesuai dengan struktur dan masing-masing wilayah kerjanya.

---

## 6. Ketentuan Call Report

a. Seluruh **MR/DM/RSM wajib membuat Call List** setiap awal bulan melalui MSF Mobile (maksimal **5 hari kerja**).

b. Seluruh **MR/DM/RSM wajib membuat Call Plan dan Call Actual setiap hari** melalui MSF Mobile dan di-approve oleh atasan masing-masing **sebelum pukul 10:00 WIB**.

c. Dokter/customer yang sudah masuk ke dalam Call List dan sudah mendapat approval oleh atasan langsung adalah dokter/customer yang bisa dikunjungi.

d. Customer yang tidak masuk dalam Call List masih dapat dikunjungi menggunakan menu **Non Target Visit**, tetapi **tidak diperhitungkan** dalam Call Reach dan Call Frequency — hanya diperhitungkan dalam pencapaian **Call Productivity** saja.

e. Daftar target non-dokter untuk Divisi Neptune adalah untuk target kunjungan ke outlet, yang artinya **1 outlet = 1 non-dokter**.

f. **Call Actual yang dianggap valid** dan dapat diperhitungkan sebagai Call Report adalah:
   1. Call Actual yang sudah di-**approved** oleh atasan langsung (sesuai ketentuan).
   2. Call Actual ke customer yang dilakukan secara **tatap muka** (bukan berupa bukti chat/telepon/email), sesuai lokasi koordinat customer yang sudah didaftarkan.
   3. Call Actual yang mempunyai **bukti swafoto** dengan customer yang dikunjungi, bukti foto lokasi praktek, atau bukti foto customer dan tanda tangan dokter/customer.
   4. Seluruh bukti foto harus **jelas dan bukan hasil manipulasi** rekayasa teknologi digital. Dilarang mengambil bukti foto dari media/perangkat lain.

g. **Join Visit** dapat dilakukan apabila ada kebutuhan kunjungan bersama yang dilakukan oleh MR, DM, RSM ke customer yang sama dalam satu waktu. Batas waktu proses sinkronisasi bukti Join Visit adalah **30 menit** setelah kunjungan selesai.

h. **Offline Visit** dapat digunakan apabila dalam proses Call Actual terdapat kendala jaringan internet di lokasi kunjungan. Proses sinkronisasi bukti Offline Visit dapat dilakukan pada lokasi yang tidak jauh dari titik lokasi kunjungan dengan kondisi jaringan yang stabil.

---

## 7. Ketentuan Insentif Visit

Insentif Visit ditentukan berdasarkan kombinasi pencapaian **Call Reach** dan **Call Frequency**:

| Call Reach | Call Frequency | Insentif Visit |
|:----------:|:--------------:|:--------------:|
| 90% | 80% | **100%** |
| 90% | 70% – < 80% | **95%** |
| 90% | 60% – < 70% | **90%** |
| 80% – < 90% | < 60% | **80%** |
| < 80% | < 60% | **0%** |

> Semakin tinggi capaian Call Reach dan Call Frequency, semakin besar persentase insentif yang diperoleh. Capaian Call Reach di bawah 80% dengan Call Frequency di bawah 60% mengakibatkan insentif visit **0%**.

---

## 8. Daily Activity

- Aktivitas harian yang sudah dilakukan oleh level **DM, RSM, MM, dan PE/PM wajib di-input ke dalam sistem** agar dapat dimonitor dan dievaluasi oleh atasannya masing-masing secara berjenjang.
- Aktivitas yang di-input contohnya:
  - Kegiatan administrasi di kantor
  - Morning session dengan tim
  - Training
  - Meeting
  - Kunjungan ke customer
  - Interview calon karyawan
  - Event dan kegiatan lainnya yang rutin dilakukan sehari-hari

---

## 9. Keterangan Class Dokter/Customer

Class dokter/customer terdiri dari **dua huruf**. Huruf pertama menggambarkan **potensi/volume**, sedangkan huruf kedua menggambarkan **kontribusi sales**.

### Huruf Pertama (Potensi)

| Kode | Keterangan |
|:----:|------------|
| **A** | Jumlah pasien ≥ 10 pasien per hari **DAN/ATAU** potensi sales ≥ Rp10.000.000 per bulan serta status ekonomi pasien |
| **B** | Jumlah pasien 4 – 9 pasien per hari **DAN/ATAU** potensi sales ≥ Rp5.000.000 s/d Rp9.999.999 per bulan serta status ekonomi pasien |
| **C** | Jumlah pasien < 4 pasien per hari **DAN/ATAU** potensi sales < Rp5.000.000 per bulan serta status ekonomi pasien |

### Huruf Kedua (Kontribusi Sales)

| Kode | Keterangan |
|:----:|------------|
| **A** | Kontribusi sales dokter dengan persentase ≥ 70% dari potensi sales |
| **B** | Kontribusi sales dokter dengan persentase ≥ 50% s/d < 70% dari potensi sales |
| **C** | Kontribusi sales dokter dengan persentase < 50% dari potensi sales |

> **Contoh:** Class **AA** = dokter dengan potensi tinggi (≥10 pasien/hari atau ≥Rp10 juta/bulan) **dan** kontribusi sales tinggi (≥70%). Class **CC** = potensi rendah dan kontribusi sales rendah.

---

## 10. Data Populasi Dokter per Spesialisasi

Data berikut menunjukkan jumlah dokter yang tercakup (**Total**) dibandingkan dengan **Jumlah Populasi** nasional per spesialisasi, beserta persentase cakupannya.

| Specialist | Total | Jumlah Populasi | % |
|------------|------:|----------------:|:---:|
| PSYCHIATRIST | 1.591 | 1.625 | **98%** |
| NEUROLOGIST | 2.653 | 2.834 | **94%** |
| NEUROSURGEON | 355 | 564 | **63%** |
| ANAESTHESIOLOGIST | 1.310 | 3.692 | **35%** |
| INTERNIST | 2.675 | 6.308 | **42%** |
| PEDIATRICIAN | 936 | 5.563 | **17%** |
| CARDIOLOGIST | 567 | 2.046 | **28%** |
| PULMONOLOGIST | 177 | 1.777 | **10%** |
| SURGEON | 278 | 4.004 | **7%** |
| OBGYN | 195 | 5.754 | **3%** |
| GENERAL PRACTIONER | 1.615 | 171.372 | **1%** |
| OTHER SPESIALISASI | 330 | 0 | **–** |

> *Note: Jumlah Populasi Dokter berdasarkan data dari [https://kki.go.id/](https://kki.go.id/)*

---

## 11. Distribusi Jumlah Dokter per Class

Distribusi jumlah dokter berdasarkan kombinasi class (huruf pertama × huruf kedua):

| Class Dokter | Jumlah |
|:------------:|-------:|
| AA | 711 |
| AB | 1.057 |
| AC | 1.546 |
| BA | 595 |
| BB | 1.957 |
| BC | 5.170 |
| CA | 325 |
| CB | 194 |
| CC | 1.126 |

---

## 12. Ringkasan Cepat (Quick Reference)

### Indikator Kinerja & Threshold Minimal

| Indikator | Dasar Perhitungan | Minimal Pencapaian |
|-----------|-------------------|:------------------:|
| **Call Productivity** | Total visit vs target visit per bulan | **80%** |
| **Call Reach** | Jumlah dokter dikunjungi vs total Call List per bulan | **80%** |
| **Call Frequency** | Jumlah kunjungan vs target kunjungan per class dokter | **60%** |

### Tenggat Waktu Penting

| Aktivitas | Tenggat Waktu |
|-----------|---------------|
| Pembuatan Call List | Maksimal 5 hari kerja di awal bulan |
| Approval Call Plan & Call Actual | Setiap hari sebelum pukul 10:00 WIB |
| Sinkronisasi bukti Join Visit | Maksimal 30 menit setelah kunjungan selesai |
| Perubahan data MCL | Setiap kuartal (atau saat ada perubahan struktur) |

### Syarat Call Actual yang Valid

1. Sudah di-approve atasan langsung.
2. Dilakukan tatap muka, sesuai koordinat lokasi customer.
3. Disertai bukti swafoto / foto lokasi praktek / foto + tanda tangan customer.
4. Bukti foto jelas dan asli (bukan manipulasi/rekayasa digital).

---

*Dokumen ini disusun berdasarkan halaman **Mersi Monitoring System – Visit** pada aplikasi Mersi Marketing.*
