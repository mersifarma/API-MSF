export type CustomerSegmen = 1 | 2;

export type Customer = {
  id: number;
  id_mcl: number | null;
  id_peg: number | null;
  id_ff: string | null;
  nama_ff: string | null;
  nama_dokter: string | null;
  nama_non_dokter: string | null;
  segmen_md: CustomerSegmen | null;
  spec: string | null;
  class: string | null;
  rayon: string | null;
  distrik: string | null;
  region: string | null;
  divisi: string | null;
  institusi: string | null;
  alamat_praktek: string | null;
  kota: string | null;
  wilayah: string | null;
  koordinat_institusi: string | null;
  hari_praktek: string | null;
  jam_mulai_praktek: string | null;
  jam_selesai_praktek: string | null;
  status: string | null;
};

export type CustomerListQuery = {
  search?: string;
  spec?: string;
  class?: string;
  segmen?: CustomerSegmen;
  page?: number;
  limit?: number;
  include_inactive?: boolean;
};

export type CustomerListResponse = {
  data: Customer[];
  meta: { total: number; page: number; limit: number };
};

export type CustomerSummary = {
  total: number;
  doctor: number;
  non_doctor: number;
  specialities: number;
  class_a: number;
  class_b: number;
  class_c: number;
};
