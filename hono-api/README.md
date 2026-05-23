# MSF Hono API — Migration Project

Rewrite Laravel API MSF Mobile → **Hono + Bun + PostgreSQL** (Drizzle ORM).

Status: **Step 1 — DB schema**. App routes belum dibuat.

---

## Strategi migrasi

Mengacu pada arahan:

> Tabel **transaksi** pure rewrite dari awal di Postgres.
> Tabel **master** keep persis legacy + cron sync daily/weekly dari MariaDB.
> Mobile rewrite duluan, web (Laravel) belakangan.

### Pemisahan tabel

| Kategori | Tabel | Strategi |
|----------|-------|----------|
| **Master** (13) | `users`, `data_pegawai`, `struktur`, `app_modul`, `app_role_menu`, `call_version`, `list_dokter_visit_new`, `call_setting`, `call_target_list`, `call_target_hari`, `call_target_class`, `data_product`, `data_spec_dr` | Mirror persis MariaDB (kolom + tipe + INT id + index). Sync UPSERT by PK via cron. Hono **read-only**. |
| **Transactional** (5) | `call_list`, `call_list_history`, `call_plan_actual`, `visit_tidak_kunjungan`, `visit_tidak_kunjungan_mr` | Pure rewrite. PK UUID. FK ke master tetap INT. Self-FK (`join_visit_id`) UUID. Tambahan `created_at` / `updated_at` timestamptz. New mobile write langsung. |

### Tabel yang belum di-cover

- `report_admin_mkt.set_param_sum_mcr` — cross-DB di MariaDB, belum diambil. Perlu strategi terpisah saat reach/productivity endpoint diport.

---

## Struktur folder

```
hono-api/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── docker-compose.yml                Postgres 16 + pgAdmin (profile=ui)
├── docker/
│   └── initdb/
│       └── 01-extensions.sql         pgcrypto, citext, pg_trgm
├── .env.example
├── .gitignore
├── README.md                         ← file ini
├── src/
│   ├── index.ts                      Entry point — mount middleware + routes
│   ├── config/
│   │   ├── env.ts                    Zod-validated process.env (fail-fast)
│   │   ├── database.ts               Drizzle + postgres-js client
│   │   └── auth.ts                   JWT sign/verify + cookie config
│   ├── db/
│   │   └── schema/
│   │       ├── index.ts              Re-export
│   │       ├── master.ts             13 tabel mirror MariaDB
│   │       └── transactional.ts      5 tabel pure rewrite (UUID)
│   ├── middleware/
│   │   ├── auth.ts                   requireAuth + getCurrentUser
│   │   ├── rbac.ts                   requireJabatan / requireDivisi
│   │   ├── validator.ts              validateJson / Params / Query (Zod)
│   │   └── error-handler.ts          Global error → JSON
│   ├── validations/                  Zod schemas per modul
│   │   └── auth.validation.ts
│   ├── routes/                       Thin: middleware chain + controller
│   │   ├── index.ts                  Aggregate + /health
│   │   └── auth.routes.ts
│   ├── controllers/                  HTTP handlers
│   │   └── auth.controller.ts
│   ├── services/                     Business logic + Drizzle queries
│   │   └── auth.service.ts
│   ├── lib/
│   │   ├── errors.ts                 DomainError + subclass
│   │   └── constants.ts              MSF business constants
│   ├── utils/
│   │   └── response.ts               sendSuccess/sendError + getValidJson/...
│   └── scripts/
│       ├── migrate.ts                Programmatic migration runner
│       ├── seed.ts                   Seed master tables (dev fixtures)
│       └── _fixtures.ts              Data dummy untuk seed
└── drizzle/
    └── migrations/                   di-generate `drizzle-kit generate`
```

---

## Setup pertama kali

### 1. Install dependencies

```bash
cd D:\API-MSF\hono-api
bun install
```

### 2. Set up PostgreSQL via docker-compose

```bash
# Start Postgres saja
docker compose up -d postgres

# (Opsional) Start juga pgAdmin di http://localhost:5050
docker compose --profile ui up -d
```

Container `msf-pg` otomatis:
- Buat database `msf` (user=`msf`, pass=`msf`)
- Aktifkan extension `pgcrypto`, `citext`, `pg_trgm` via `docker/initdb/01-extensions.sql`
- Persist data di volume `msf-pg-data`
- Timezone `Asia/Jakarta`

Cek status:

```bash
docker compose ps
docker compose logs -f postgres
```

### 3. Copy env

```bash
cp .env.example .env
# Default DATABASE_URL sudah cocok dengan docker-compose.
```

### 4. Generate & apply migration

```bash
# Generate file migration .sql dari schema TS
bun run db:generate

# Apply migration via runner programmatic (recommended utk prod/CI)
bun run db:migrate

# Atau apply via drizzle-kit langsung (sama hasilnya)
bun run db:migrate:kit
```

Untuk iterasi cepat di dev, skip migration file:

```bash
bun run db:push
```

### 5. Seed data master

```bash
bun run db:seed
```

Insert minimal fixtures: 3 user (mr01/dm01/rsm01, pass `password`), 3 pegawai +
struktur, 5 modul + role_menu, 5 dokter dummy di Rayon-A, 4 produk, 3 spec, dst.
Idempotent — aman di-run berulang.

### 6. Reset penuh (nuke + migrate + seed)

```bash
bun run db:reset
```

### 7. (Opsional) Restore dev DB dari legacy SQL dump

Untuk simulasi data prod — 1044 user real, 53k dokter, 15k struktur, dst.
File dump ada di `../legacy/db-backup/*.sql` (hasil ekstrak `monitoring_*.sql`).

```bash
# 1. Opt-in eksplisit (script refuse jalan tanpa ini)
echo "ALLOW_LEGACY_RESTORE=true" >> .env

# 2. Restore — ~30 detik di mesin dev
bun run db:restore-legacy
```

Detail:
- **Scope**: hanya master tables (13 tabel). Transactional kosong — diisi dari mobile insert.
- **Password**: hash `$2y$` (PHP/Laravel) di-rewrite jadi `$2b$` (OpenBSD) supaya kompatibel dengan `Bun.password.verify`. Login pakai password prod asli akan work.
- **Konflik dev seed (id 1–3 = mr01/dm01/rsm01)**: `.onConflictDoNothing()` → dev user menang, jadi `mr01`/`dm01`/`rsm01` tetap bisa login pakai password `password`. User legacy lain (id ≥ 5) ikut terpasang.
- **Login user prod** (cek `password_view` kolom — di dev mode plaintext password disimpan untuk debugging):
  ```sql
  SELECT username, password_view FROM users WHERE id > 3 LIMIT 5;
  ```
- **Safety**: script refuse jalan kalau `NODE_ENV=production`, DB name ends with `_prod`/`_test`, atau `ALLOW_LEGACY_RESTORE` tidak diset.
- **Idempotent**: re-run aman.

### 8. Verifikasi schema

```bash
bun run db:studio
# Buka http://localhost:4983 untuk lihat schema visual
```

---

## Konvensi schema

### Master tables

- Nama tabel & kolom **persis** seperti MariaDB (termasuk UPPERCASE di `list_dokter_visit_new.ID`, `STATUS_MD`, dst).
- PK = `INTEGER GENERATED BY DEFAULT AS IDENTITY` (bisa di-override saat sync).
- Tidak ada FK antar master di Drizzle (karena sync 1:1, urutan load ditangani manual oleh sync script).
- Untuk `users.id` pakai `bigint` (legacy `bigint(20) unsigned`).

### Transactional tables

- PK = `UUID DEFAULT gen_random_uuid()`.
- FK ke master = `INTEGER references masterTable.column`.
- Self-FK (`call_plan_actual.join_visit_id`) = `UUID`.
- Kolom legacy `tinyint(1)` dipetakan ke `BOOLEAN` (untuk `is_visited`).
- Kolom legacy `smallint(6)` di `join_visit` tetap `SMALLINT` (karena bisa NULL/0/1 dan ada kemungkinan nilai > 1 — pertahankan untuk semantic safety).
- Tambahan **wajib** di tiap row: `created_at`, `updated_at` (timestamptz, default NOW()).
- `product_list`, `s3_upload_log` masih `text` (JSON string) untuk maintain backward compat — pertimbangkan ganti `jsonb` setelah migrasi penuh.

---

## Drizzle commands

| Command | Fungsi |
|---------|--------|
| `bun run db:generate` | Buat migration `.sql` dari schema TS |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:push` | Push schema langsung (skip migration files) — bagus untuk dev |
| `bun run db:studio` | UI browser untuk inspect data |
| `bun run db:check` | Validasi migration files konsisten |
| `bun run db:seed` | Seed master tables (idempotent — pakai `onConflictDoNothing`) |
| `bun run db:reset` | Drop + push schema + seed ulang (dev only) |
| `bun run db:restore-legacy` | Restore master dari `../legacy/db-backup/*.sql` (butuh `ALLOW_LEGACY_RESTORE=true`) |

---

## Cron sync (next step)

Folder yang belum dibuat: `src/scripts/sync-master.ts`.

Rancangan singkat:

```ts
// 1. Connect ke MariaDB legacy via mysql2 / postgres-js MySQL adapter.
// 2. Untuk tiap master table:
//    - SELECT * FROM <table> WHERE updated_date > last_sync OR <pk> > last_pk
//    - UPSERT ke Postgres pakai Drizzle .onConflictDoUpdate({ target: pk })
// 3. Catat last_sync timestamp ke meta table.
// 4. Schedule via cron / GitHub Actions / external scheduler.
```

Tabel yang perlu di-sync (urutan rekomendasi karena FK soft):

1. `users` (parent semua user reference)
2. `data_pegawai` (parent rowid, FK target dari transaksional)
3. `app_modul`, `data_spec_dr`, `call_version` (master-master kecil)
4. `data_product`, `list_dokter_visit_new` (master besar)
5. `struktur` (depends on data_pegawai)
6. `app_role_menu` (depends on users + app_modul)
7. `call_setting`, `call_target_list`, `call_target_hari`, `call_target_class`

---

## Initial seed dari backup

Kalau mau load data master ke Postgres lokal untuk dev (dari folder `db-backup/`):

```bash
# Pakai pgloader untuk konversi MariaDB SQL → Postgres
# (atau convert manual: ganti backtick → double quote, AUTO_INCREMENT → GENERATED, dll.)

# Quick approach pakai pgloader (perlu install dulu):
pgloader db-backup/users.sql postgres://postgres:postgres@localhost/msf
```

Atau load via Bun script (TODO: `src/scripts/seed-from-mariadb-dump.ts`).

---

## Catatan kompatibilitas MariaDB → PostgreSQL

Saat sync atau migrasi data, perhatikan beberapa hal yang TIDAK ditangani otomatis oleh Drizzle:

| Issue | Resolusi |
|-------|----------|
| Backtick `` ` `` di SQL legacy | Postgres: pakai `"` atau hilangkan |
| `IFNULL(x, y)` | `COALESCE(x, y)` |
| `FIND_IN_SET('x', csv)` | `'x' = ANY(string_to_array(csv, ','))` |
| `GROUP_CONCAT(x)` | `string_agg(x::text, ',')` |
| `DATE_FORMAT(x, '%Y-%m')` | `to_char(x, 'YYYY-MM')` |
| `NOW() - INTERVAL 30 MINUTE` | `NOW() - INTERVAL '30 minutes'` |
| `tinyint(1)` data 0/1 → bool | Cast di sync script |

---

## Next steps (urutan rekomendasi)

1. ✅ DB schema (Drizzle, master + transactional)
2. ⬜ Cron sync script (MariaDB → Postgres master tables)
3. ⬜ Hono app bootstrap (`src/index.ts`, middleware: cors, logger, error handler)
4. ⬜ Auth: rewrite `/login` (Laravel `MainMenuController` → Hono route). Tambah JWT/Session (gantikan plain `id_peg` di body).
5. ⬜ Modul-user endpoint
6. ⬜ Master data: `/doctor-list`, `/doctor-spec`, `/get-product-list`
7. ⬜ Call list (CRUD)
8. ⬜ Call plan (CRUD)
9. ⬜ Call actual + image upload (S3-ready berdasarkan kolom `s3_upload_log`)
10. ⬜ Approval flow
11. ⬜ Reports
12. ⬜ Join visit & unvisit

Lihat [`legacy/DOCS-BACKEND/04-api-reference.md`](../legacy/DOCS-BACKEND/04-api-reference.md) untuk contract endpoint yang harus dipertahankan saat rewrite.
