export type User = {
  id: number;
  name: string;
  username: string;
  email?: string | null;
};

export type Pegawai = {
  rowid: number;
  id_peg: string;
  nama_peg: string;
  jabatan: string;
  divisi: string | null;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  user: User;
  pegawai: Pegawai | null;
  pegawaiList: Pegawai[];
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
};

export type MeResponse = {
  user: User;
  pegawai: Pegawai | null;
  pegawaiList: Pegawai[];
};

export type SwitchPegawaiResponse = {
  user: User;
  pegawai: Pegawai;
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
};

export type ApiSuccess<T> = { success: true; data: T };
export type ApiPaginated<T> = {
  success: true;
  data: T[];
  meta: { total: number; page: number; limit: number };
};
export type ApiErrorBody = {
  success: false;
  error: { message: string; code: string; details?: unknown };
};
