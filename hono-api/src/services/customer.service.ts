/**
 * Service untuk endpoint Customer (alias semantik dari MCL / list_dokter_visit_new).
 *
 * Delegate ke `listDokter` di master.service.ts untuk hindari duplikasi logic
 * hierarki (`getVisibleIdPeg`). Plus `getCustomerSummary` untuk agregasi counts.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { list_dokter_visit_new } from '../db/schema/master';
import { listDokter, type DokterListOpts } from './master.service';
import { getVisibleIdPeg } from './struktur.service';

export type CustomerListOpts = DokterListOpts;
export const listCustomers = listDokter;

export type CustomerSummary = {
  total: number;
  doctor: number;
  non_doctor: number;
  specialities: number;
  class_a: number;
  class_b: number;
  class_c: number;
};

export async function getCustomerSummary(
  viewerIdPeg: number,
  viewerJabatan: string,
): Promise<CustomerSummary> {
  const visibleIds = await getVisibleIdPeg(viewerIdPeg, viewerJabatan);

  if (visibleIds.length === 0) {
    return {
      total: 0,
      doctor: 0,
      non_doctor: 0,
      specialities: 0,
      class_a: 0,
      class_b: 0,
      class_c: 0,
    };
  }

  const rows = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      doctor: sql<number>`COUNT(*) FILTER (WHERE ${list_dokter_visit_new.SEGMEN_MD} = 1)::int`,
      non_doctor: sql<number>`COUNT(*) FILTER (WHERE ${list_dokter_visit_new.SEGMEN_MD} = 2)::int`,
      specialities: sql<number>`COUNT(DISTINCT ${list_dokter_visit_new.SPEC}) FILTER (WHERE ${list_dokter_visit_new.SPEC} IS NOT NULL)::int`,
      class_a: sql<number>`COUNT(*) FILTER (WHERE ${list_dokter_visit_new.CLASS} LIKE 'A%')::int`,
      class_b: sql<number>`COUNT(*) FILTER (WHERE ${list_dokter_visit_new.CLASS} LIKE 'B%')::int`,
      class_c: sql<number>`COUNT(*) FILTER (WHERE ${list_dokter_visit_new.CLASS} LIKE 'C%')::int`,
    })
    .from(list_dokter_visit_new)
    .where(
      and(
        inArray(list_dokter_visit_new.ID_PEG, visibleIds),
        eq(list_dokter_visit_new.STATUS_MD, 'ACTIVE'),
      ),
    );

  const r = rows[0];
  return {
    total: r?.total ?? 0,
    doctor: r?.doctor ?? 0,
    non_doctor: r?.non_doctor ?? 0,
    specialities: r?.specialities ?? 0,
    class_a: r?.class_a ?? 0,
    class_b: r?.class_b ?? 0,
    class_c: r?.class_c ?? 0,
  };
}
