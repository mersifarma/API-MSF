import { appFetch } from '../config/api';
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  SwitchPegawaiResponse,
} from '../types/api';

export function login(payload: LoginRequest) {
  return appFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function me(token: string) {
  return appFetch<MeResponse>('/api/auth/me', {
    method: 'GET',
    token,
  });
}

export function switchPegawai(token: string, id_peg: number) {
  return appFetch<SwitchPegawaiResponse>('/api/auth/switch-pegawai', {
    method: 'POST',
    body: { id_peg },
    token,
  });
}

export function logout(token: string) {
  return appFetch<{ message: string }>('/api/auth/logout', {
    method: 'POST',
    token,
  });
}
