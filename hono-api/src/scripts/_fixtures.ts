/**
 * Seed fixtures — data dummy untuk development.
 *
 * Skenario: 1 region (Region-1) → 1 RSM → 1 DM → 1 MR.
 * MR memegang 5 dokter di Rayon-A.
 *
 * Untuk testing approval flow:
 *   - MR (id_peg=1)  → buat plan/actual
 *   - DM (id_peg=2)  → approve plan
 *   - RSM (id_peg=3) → approve actual
 *
 * Password semua user dev = "password" (bcrypt cost 10, prefix $2b$).
 *
 * NOTE: pakai $2b$ (standar OpenBSD bcrypt), BUKAN $2y$ (Laravel/PHP varian) —
 * Bun.password.verify() yang dipakai auth.service.ts tidak mengenali $2y$.
 * Hash di bawah ini di-generate via Bun.password.hash('password', { algorithm: 'bcrypt', cost: 10 }).
 */

export const DEV_PASSWORD_HASH = '$2b$10$co7WTyfhJlBheRqGjO75huJWkyFgDGJUX02kLzz4ytreH7xb2nrqu';

export const seed_users = [
  {
    id: 1,
    name: 'MR Satu',
    username: 'mr01',
    status: 'ACTIVE',
    email: 'mr01@msf.local',
    password: DEV_PASSWORD_HASH,
    password_view: 'password',
  },
  {
    id: 2,
    name: 'DM Satu',
    username: 'dm01',
    status: 'ACTIVE',
    email: 'dm01@msf.local',
    password: DEV_PASSWORD_HASH,
    password_view: 'password',
  },
  {
    id: 3,
    name: 'RSM Satu',
    username: 'rsm01',
    status: 'ACTIVE',
    email: 'rsm01@msf.local',
    password: DEV_PASSWORD_HASH,
    password_view: 'password',
  },
] as const;

export const seed_data_pegawai = [
  {
    rowid: 1,
    id: 'MR0001',
    nik: '0001',
    nama: 'MR Satu',
    jabatan: 'MR',
    divisi: 'ETHICAL',
    rayon: 'Rayon-A',
    rayon_dm: 'Distrik-A',
    region: 'Region-1',
    homebase: 'Jakarta',
    status: 'ACTIVE',
    tgl_masuk: '2024-01-01',
    id_user: 1,
  },
  {
    rowid: 2,
    id: 'DM0001',
    nik: '0002',
    nama: 'DM Satu',
    jabatan: 'DM',
    divisi: 'ETHICAL',
    rayon: 'Distrik-A',
    rayon_dm: 'Distrik-A',
    region: 'Region-1',
    homebase: 'Jakarta',
    status: 'ACTIVE',
    tgl_masuk: '2024-01-01',
    id_user: 2,
  },
  {
    rowid: 3,
    id: 'RSM0001',
    nik: '0003',
    nama: 'RSM Satu',
    jabatan: 'RSM',
    divisi: 'ETHICAL',
    rayon: 'Region-1',
    rayon_dm: 'Region-1',
    region: 'Region-1',
    homebase: 'Jakarta',
    status: 'ACTIVE',
    tgl_masuk: '2024-01-01',
    id_user: 3,
  },
] as const;

export const seed_struktur = [
  {
    id: 1,
    id_mr: 'MR0001',
    id_peg_mr: 1,
    rayon_mr: 'Rayon-A',
    golongan: 'MR',
    divisi: 'ETHICAL',
    id_dm: 'DM0001',
    id_peg_dm: 2,
    rayon_dm: 'Distrik-A',
    id_rsm: 'RSM0001',
    id_peg_rsm: 3,
    region: 'Region-1',
    periode_awal: '2026-01-01',
    periode_akhir: '2026-12-31',
  },
] as const;

export const seed_app_modul = [
  { id_modul: 1, nama_modul: 'Visit', icons: 'ic_visit', color: '#FF5722' },
  { id_modul: 2, nama_modul: 'Approval', icons: 'ic_approval', color: '#4CAF50' },
  { id_modul: 3, nama_modul: 'Reports', icons: 'ic_reports', color: '#2196F3' },
  { id_modul: 4, nama_modul: 'Profile', icons: 'ic_profile', color: '#9C27B0' },
  { id_modul: 5, nama_modul: 'JoinVisit', icons: 'ic_join', color: '#FF9800' },
] as const;

// user 1 (MR): Visit, Reports, Profile
// user 2 (DM): semua
// user 3 (RSM): Visit, Approval, Reports, Profile
export const seed_app_role_menu = [
  { id_role: 1, id_menu: 1, id_modul: 1, id_user: 1 },
  { id_role: 2, id_menu: 1, id_modul: 3, id_user: 1 },
  { id_role: 3, id_menu: 1, id_modul: 4, id_user: 1 },
  { id_role: 4, id_menu: 1, id_modul: 1, id_user: 2 },
  { id_role: 5, id_menu: 1, id_modul: 2, id_user: 2 },
  { id_role: 6, id_menu: 1, id_modul: 3, id_user: 2 },
  { id_role: 7, id_menu: 1, id_modul: 4, id_user: 2 },
  { id_role: 8, id_menu: 1, id_modul: 5, id_user: 2 },
  { id_role: 9, id_menu: 1, id_modul: 1, id_user: 3 },
  { id_role: 10, id_menu: 1, id_modul: 2, id_user: 3 },
  { id_role: 11, id_menu: 1, id_modul: 3, id_user: 3 },
  { id_role: 12, id_menu: 1, id_modul: 4, id_user: 3 },
] as const;

export const seed_call_version = [
  { id: 1, version: '2.0.0', link_apk: 'https://example.com/msf-mobile.apk' },
] as const;

export const seed_data_spec_dr = [
  { id: 1, spec: 'Umum', gelar: 'dr.' },
  { id: 2, spec: 'Anak', gelar: 'dr., Sp.A' },
  { id: 3, spec: 'Penyakit Dalam', gelar: 'dr., Sp.PD' },
  { id: 4, spec: 'Kulit & Kelamin', gelar: 'dr., Sp.KK' },
  { id: 5, spec: 'THT', gelar: 'dr., Sp.THT' },
] as const;

export const seed_list_dokter_visit_new = [
  {
    ID: 1,
    ID_PEG: 1,
    ID_FF: 'MR0001',
    NAMA_FF: 'MR Satu',
    RAYON: 'Rayon-A',
    DISTRIK: 'Distrik-A',
    REGION: 'Region-1',
    DIVISI: 'ETHICAL',
    SEGMEN_MD: 1,
    ID_MCL: 1001,
    NAMA_DOKTER: 'dr. Andi Praktisi',
    SPEC: 'Umum',
    CLASS: 'A',
    KODE_OUTLET_UNION: 'OUT0001',
    INSTITUSI: 'Klinik Sehat A',
    ALAMAT_PRAKTEK: 'Jl. Mawar No. 1, Jakarta',
    KOTA: 'Jakarta',
    HARI_PRAKTEK: 'Senin,Selasa,Rabu',
    HUT: '1980-05-15',
    PROD_DETAILING_1: 'PROD-A',
    PROD_DETAILING_2: 'PROD-B',
    STATUS_MD: 'ACTIVE',
  },
  {
    ID: 2,
    ID_PEG: 1,
    ID_FF: 'MR0001',
    NAMA_FF: 'MR Satu',
    RAYON: 'Rayon-A',
    DISTRIK: 'Distrik-A',
    REGION: 'Region-1',
    DIVISI: 'ETHICAL',
    SEGMEN_MD: 1,
    ID_MCL: 1002,
    NAMA_DOKTER: 'dr. Budi Suhendar, Sp.A',
    SPEC: 'Anak',
    CLASS: 'A',
    KODE_OUTLET_UNION: 'OUT0002',
    INSTITUSI: 'RS Anak Bahagia',
    ALAMAT_PRAKTEK: 'Jl. Melati No. 2, Jakarta',
    KOTA: 'Jakarta',
    HARI_PRAKTEK: 'Senin,Rabu,Jumat',
    HUT: '1975-08-20',
    PROD_DETAILING_1: 'PROD-C',
    STATUS_MD: 'ACTIVE',
  },
  {
    ID: 3,
    ID_PEG: 1,
    ID_FF: 'MR0001',
    NAMA_FF: 'MR Satu',
    RAYON: 'Rayon-A',
    DISTRIK: 'Distrik-A',
    REGION: 'Region-1',
    DIVISI: 'ETHICAL',
    SEGMEN_MD: 2,
    ID_MCL: 1003,
    NAMA_DOKTER: 'dr. Citra Lestari, Sp.PD',
    SPEC: 'Penyakit Dalam',
    CLASS: 'B',
    KODE_OUTLET_UNION: 'OUT0003',
    INSTITUSI: 'RSUD Sentral',
    ALAMAT_PRAKTEK: 'Jl. Anggrek No. 3, Jakarta',
    KOTA: 'Jakarta',
    HARI_PRAKTEK: 'Selasa,Kamis',
    HUT: '1978-12-01',
    PROD_DETAILING_1: 'PROD-A',
    PROD_DETAILING_2: 'PROD-D',
    STATUS_MD: 'ACTIVE',
  },
  {
    ID: 4,
    ID_PEG: 1,
    ID_FF: 'MR0001',
    NAMA_FF: 'MR Satu',
    RAYON: 'Rayon-A',
    DISTRIK: 'Distrik-A',
    REGION: 'Region-1',
    DIVISI: 'ETHICAL',
    SEGMEN_MD: 2,
    ID_MCL: 1004,
    NAMA_DOKTER: 'dr. Dewi Anggraeni, Sp.KK',
    SPEC: 'Kulit & Kelamin',
    CLASS: 'B',
    KODE_OUTLET_UNION: 'OUT0004',
    INSTITUSI: 'Klinik Kulit Cantik',
    ALAMAT_PRAKTEK: 'Jl. Kenanga No. 4, Jakarta',
    KOTA: 'Jakarta',
    HARI_PRAKTEK: 'Senin,Selasa,Rabu,Kamis,Jumat',
    HUT: '1982-03-10',
    PROD_DETAILING_1: 'PROD-D',
    STATUS_MD: 'ACTIVE',
  },
  {
    ID: 5,
    ID_PEG: 1,
    ID_FF: 'MR0001',
    NAMA_FF: 'MR Satu',
    RAYON: 'Rayon-A',
    DISTRIK: 'Distrik-A',
    REGION: 'Region-1',
    DIVISI: 'ETHICAL',
    SEGMEN_MD: 3,
    ID_MCL: 1005,
    NAMA_DOKTER: 'dr. Eko Prasetyo, Sp.THT',
    SPEC: 'THT',
    CLASS: 'C',
    KODE_OUTLET_UNION: 'OUT0005',
    INSTITUSI: 'Klinik THT Sehat',
    ALAMAT_PRAKTEK: 'Jl. Dahlia No. 5, Jakarta',
    KOTA: 'Jakarta',
    HARI_PRAKTEK: 'Rabu,Jumat',
    HUT: '1985-07-25',
    PROD_DETAILING_1: 'PROD-B',
    STATUS_MD: 'ACTIVE',
  },
] as const;

export const seed_call_setting = [
  {
    id: 1,
    user: 1,
    nama: 'Default',
    bulan: '2026-05',
    input_set: 'target_visit',
    jumlah: 20,
  },
] as const;

export const seed_call_target_list = [
  {
    id: 1,
    jabatan: 'MR',
    divisi: 'ETHICAL',
    dokter: 50,
    non_dokter: 10,
    periode_awal: '2026-01-01',
    periode_akhir: '2026-12-31',
  },
  {
    id: 2,
    jabatan: 'DM',
    divisi: 'ETHICAL',
    dokter: 30,
    non_dokter: 5,
    periode_awal: '2026-01-01',
    periode_akhir: '2026-12-31',
  },
] as const;

export const seed_call_target_hari = [
  {
    id: 1,
    jabatan: 'MR',
    divisi: 'ETHICAL',
    dokter: 5,
    non_dokter: 1,
    periode_awal: '2026-01-01',
    periode_akhir: '2026-12-31',
  },
] as const;

export const seed_call_target_class = [
  { id: 1, jabatan: 'MR', class: 'A', target: 4 },
  { id: 2, jabatan: 'MR', class: 'B', target: 2 },
  { id: 3, jabatan: 'MR', class: 'C', target: 1 },
] as const;

export const seed_data_product = [
  {
    id: 1,
    id_product: 'PROD-A',
    nama_product: 'Paracetamol 500mg',
    komposisi: 'Paracetamol 500mg',
    kemasan: 'Strip @10 tablet',
    isi_box: 100,
    group_product: 'Analgesik',
    jenis_product: 'OTC',
    class_terapi: 'Analgesik',
    divisi: 'ETHICAL',
    harga: 5000,
    status: 'ACTIVE',
  },
  {
    id: 2,
    id_product: 'PROD-B',
    nama_product: 'Amoxicillin 500mg',
    komposisi: 'Amoxicillin trihydrate 500mg',
    kemasan: 'Strip @10 capsule',
    isi_box: 100,
    group_product: 'Antibiotik',
    jenis_product: 'ETHICAL',
    class_terapi: 'Antibiotik',
    divisi: 'ETHICAL',
    harga: 15000,
    status: 'ACTIVE',
  },
  {
    id: 3,
    id_product: 'PROD-C',
    nama_product: 'Cetirizine 10mg',
    komposisi: 'Cetirizine HCl 10mg',
    kemasan: 'Strip @10 tablet',
    isi_box: 100,
    group_product: 'Antihistamin',
    jenis_product: 'OTC',
    class_terapi: 'Antihistamin',
    divisi: 'ETHICAL',
    harga: 8000,
    status: 'ACTIVE',
  },
  {
    id: 4,
    id_product: 'PROD-D',
    nama_product: 'Salep Hidrokortison',
    komposisi: 'Hidrokortison 1%',
    kemasan: 'Tube @5g',
    isi_box: 50,
    group_product: 'Dermatologi',
    jenis_product: 'ETHICAL',
    class_terapi: 'Kortikosteroid topikal',
    divisi: 'ETHICAL',
    harga: 12000,
    status: 'ACTIVE',
  },
] as const;
