import type { Context } from 'hono';
import { getCurrentUser } from '../middleware/auth';
import { getCustomerSummary, listCustomers } from '../services/customer.service';
import { getValidQuery, sendPaginated, sendSuccess } from '../utils/response';
import type { CustomerListQuery } from '../validations/customer.validation';

// GET /api/customer
export async function getCustomers(c: Context) {
  const payload = getCurrentUser(c);
  const q = getValidQuery<CustomerListQuery>(c);
  const { rows, total } = await listCustomers({
    viewerIdPeg: payload.id_peg,
    viewerJabatan: payload.jabatan,
    search: q.search,
    spec: q.spec,
    class: q.class,
    segmen: q.segmen,
    page: q.page,
    limit: q.limit,
    includeInactive: q.include_inactive,
  });
  return sendPaginated(c, rows, { total, page: q.page, limit: q.limit });
}

// GET /api/customer/summary
export async function getSummary(c: Context) {
  const payload = getCurrentUser(c);
  const data = await getCustomerSummary(payload.id_peg, payload.jabatan);
  return sendSuccess(c, data);
}
