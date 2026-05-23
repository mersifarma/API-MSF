/**
 * Service untuk endpoint READ master tables.
 *
 * Catatan: master tables di-sync 1:1 dari MariaDB legacy via `sync-master.ts`.
 * Endpoint ini hanya membaca; tidak boleh INSERT/UPDATE/DELETE.
 */

import { and, asc, desc, eq, ilike, inArray, ne, or, type SQL } from 'drizzle-orm';
import { db } from '../config/database';
import {
  app_modul,
  app_role_menu,
  call_version,
  data_pegawai,
  data_product,
  data_spec_dr,
  list_dokter_visit_new,
} from '../db/schema/master';
import { NotFoundError } from '../lib/errors';
import { getVisibleIdPeg } from './struktur.service';

// ---------------------------------------------------------------------------
// App version & config
// ---------------------------------------------------------------------------

export async function getLatestAppVersion() {
  const [row] = await db.select().from(call_version).orderBy(desc(call_version.id)).limit(1);
  if (!row) {
    throw new NotFoundError('App version belum ter-set di call_version');
  }
  return {
    version: row.version,
    link_apk: row.link_apk,
  };
}

// ---------------------------------------------------------------------------
// Modul user
// ---------------------------------------------------------------------------

export async function getModulesForUser(userId: number) {
  return db
    .select({
      id_modul: app_modul.id_modul,
      nama_modul: app_modul.nama_modul,
      icons: app_modul.icons,
      icons2: app_modul.icons2,
      color: app_modul.color,
    })
    .from(app_role_menu)
    .innerJoin(app_modul, eq(app_role_menu.id_modul, app_modul.id_modul))
    .where(eq(app_role_menu.id_user, userId))
    .orderBy(asc(app_modul.id_modul));
}

// ---------------------------------------------------------------------------
// Spesialisasi dokter
// ---------------------------------------------------------------------------

export async function listDokterSpecs() {
  return db
    .select({
      id: data_spec_dr.id,
      spec: data_spec_dr.spec,
      gelar: data_spec_dr.gelar,
    })
    .from(data_spec_dr)
    .orderBy(asc(data_spec_dr.spec));
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductListOpts = {
  search?: string;
  divisi?: string;
  includeInactive?: boolean;
};

export async function listProducts(opts: ProductListOpts) {
  const conds: SQL[] = [];
  if (opts.divisi) {
    conds.push(eq(data_product.divisi, opts.divisi));
  }
  if (!opts.includeInactive) {
    conds.push(eq(data_product.status, 'ACTIVE'));
  }
  if (opts.search) {
    conds.push(ilike(data_product.nama_product, `%${opts.search}%`));
  }
  return db
    .select({
      id: data_product.id,
      id_product: data_product.id_product,
      nama_product: data_product.nama_product,
      komposisi: data_product.komposisi,
      kemasan: data_product.kemasan,
      group_product: data_product.group_product,
      jenis_product: data_product.jenis_product,
      class_terapi: data_product.class_terapi,
      divisi: data_product.divisi,
      harga: data_product.harga,
    })
    .from(data_product)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(data_product.nama_product));
}

// ---------------------------------------------------------------------------
// Pegawai lookup
// ---------------------------------------------------------------------------

export async function lookupPegawai(idPeg: number) {
  const [row] = await db
    .select({
      rowid: data_pegawai.rowid,
      id: data_pegawai.id,
      nama: data_pegawai.nama,
      jabatan: data_pegawai.jabatan,
      divisi: data_pegawai.divisi,
      rayon: data_pegawai.rayon,
      region: data_pegawai.region,
      status: data_pegawai.status,
    })
    .from(data_pegawai)
    .where(eq(data_pegawai.rowid, idPeg))
    .limit(1);
  if (!row) {
    throw new NotFoundError(`Pegawai dengan id_peg ${idPeg} tidak ditemukan`);
  }
  return row;
}

// ---------------------------------------------------------------------------
// Dokter list (hierarchy-aware)
// ---------------------------------------------------------------------------

export type DokterListOpts = {
  viewerIdPeg: number;
  viewerJabatan: string;
  search?: string;
  spec?: string;
  class?: string;
  segmen?: number;
  page: number;
  limit: number;
  includeInactive: boolean;
};

export async function listDokter(opts: DokterListOpts) {
  const visibleIds = await getVisibleIdPeg(opts.viewerIdPeg, opts.viewerJabatan);

  const conds: SQL[] = [inArray(list_dokter_visit_new.ID_PEG, visibleIds)];
  if (!opts.includeInactive) {
    conds.push(eq(list_dokter_visit_new.STATUS_MD, 'ACTIVE'));
  }
  if (opts.search) {
    const pat = `%${opts.search}%`;
    const orCond = or(
      ilike(list_dokter_visit_new.NAMA_DOKTER, pat),
      ilike(list_dokter_visit_new.NAMA_NON_DOKTER, pat),
      ilike(list_dokter_visit_new.INSTITUSI, pat),
    );
    if (orCond) conds.push(orCond);
  }
  if (opts.spec) {
    conds.push(eq(list_dokter_visit_new.SPEC, opts.spec));
  }
  if (opts.class) {
    conds.push(eq(list_dokter_visit_new.CLASS, opts.class));
  }
  if (opts.segmen !== undefined) {
    conds.push(eq(list_dokter_visit_new.SEGMEN_MD, opts.segmen));
  }

  const where = and(...conds);
  const offset = (opts.page - 1) * opts.limit;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: list_dokter_visit_new.ID,
        id_mcl: list_dokter_visit_new.ID_MCL,
        id_peg: list_dokter_visit_new.ID_PEG,
        id_ff: list_dokter_visit_new.ID_FF,
        nama_ff: list_dokter_visit_new.NAMA_FF,
        nama_dokter: list_dokter_visit_new.NAMA_DOKTER,
        nama_non_dokter: list_dokter_visit_new.NAMA_NON_DOKTER,
        segmen_md: list_dokter_visit_new.SEGMEN_MD,
        spec: list_dokter_visit_new.SPEC,
        class: list_dokter_visit_new.CLASS,
        rayon: list_dokter_visit_new.RAYON,
        distrik: list_dokter_visit_new.DISTRIK,
        region: list_dokter_visit_new.REGION,
        divisi: list_dokter_visit_new.DIVISI,
        institusi: list_dokter_visit_new.INSTITUSI,
        alamat_praktek: list_dokter_visit_new.ALAMAT_PRAKTEK,
        kota: list_dokter_visit_new.KOTA,
        wilayah: list_dokter_visit_new.WILAYAH,
        koordinat_institusi: list_dokter_visit_new.KOORDINAT_INSTITUSI,
        hari_praktek: list_dokter_visit_new.HARI_PRAKTEK,
        jam_mulai_praktek: list_dokter_visit_new.JAM_MULAI_PRAKTEK,
        jam_selesai_praktek: list_dokter_visit_new.JAM_SELESAI_PRAKTEK,
        status: list_dokter_visit_new.STATUS_MD,
      })
      .from(list_dokter_visit_new)
      .where(where)
      .orderBy(asc(list_dokter_visit_new.NAMA_DOKTER))
      .limit(opts.limit)
      .offset(offset),
    db.select({ id: list_dokter_visit_new.ID }).from(list_dokter_visit_new).where(where),
  ]);

  return { rows, total: totalRows.length };
}

// ---------------------------------------------------------------------------
// Dokter non-target (untuk unplanned visit)
// ---------------------------------------------------------------------------

export type DokterNonTargetOpts = {
  viewerIdPeg: number;
  search?: string;
  limit: number;
};

export async function listDokterNonTarget(opts: DokterNonTargetOpts) {
  // Non-target = dokter yang BUKAN milik viewer (ID_PEG != viewerIdPeg).
  // Dipakai untuk dropdown unplanned visit ("ngunjungin dokter di luar list saya").
  const conds: SQL[] = [
    eq(list_dokter_visit_new.STATUS_MD, 'ACTIVE'),
    ne(list_dokter_visit_new.ID_PEG, opts.viewerIdPeg),
  ];
  if (opts.search) {
    const pat = `%${opts.search}%`;
    const orCond = or(
      ilike(list_dokter_visit_new.NAMA_DOKTER, pat),
      ilike(list_dokter_visit_new.INSTITUSI, pat),
    );
    if (orCond) conds.push(orCond);
  }

  return db
    .select({
      id: list_dokter_visit_new.ID,
      id_mcl: list_dokter_visit_new.ID_MCL,
      nama_dokter: list_dokter_visit_new.NAMA_DOKTER,
      spec: list_dokter_visit_new.SPEC,
      class: list_dokter_visit_new.CLASS,
      institusi: list_dokter_visit_new.INSTITUSI,
      alamat_praktek: list_dokter_visit_new.ALAMAT_PRAKTEK,
      kota: list_dokter_visit_new.KOTA,
      koordinat_institusi: list_dokter_visit_new.KOORDINAT_INSTITUSI,
    })
    .from(list_dokter_visit_new)
    .where(and(...conds))
    .orderBy(asc(list_dokter_visit_new.NAMA_DOKTER))
    .limit(opts.limit);
}
