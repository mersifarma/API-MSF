import { appFetch, appFetchPaginated } from '../config/api';
import type {
  Customer,
  CustomerListQuery,
  CustomerListResponse,
  CustomerSummary,
} from '../types/customer';

export type Speciality = { id: number; spec: string; gelar: string | null };

function buildQuery(q: CustomerListQuery): string {
  const params = new URLSearchParams();
  if (q.search) params.set('search', q.search);
  if (q.spec) params.set('spec', q.spec);
  if (q.class) params.set('class', q.class);
  if (q.segmen !== undefined) params.set('segmen', String(q.segmen));
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  if (q.include_inactive) params.set('include_inactive', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getCustomers(
  token: string,
  query: CustomerListQuery = {},
): Promise<CustomerListResponse> {
  return appFetchPaginated<Customer>(`/api/customer${buildQuery(query)}`, {
    token,
    method: 'GET',
  });
}

export async function getCustomerSummary(token: string): Promise<CustomerSummary> {
  return appFetch<CustomerSummary>('/api/customer/summary', {
    token,
    method: 'GET',
  });
}

export async function getSpecialities(token: string): Promise<Speciality[]> {
  return appFetch<Speciality[]>('/api/master/dokter/specs', {
    token,
    method: 'GET',
  });
}
