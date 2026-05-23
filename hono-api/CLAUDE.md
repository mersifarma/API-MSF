# CLAUDE.md — hono-api (Hono + Bun + Postgres rewrite target)

This file provides guidance to Claude Code when working in this sub-project.

## Business domain — canonical spec (READ FIRST)

The **authoritative product spec** is `../Mersi_Monitoring_System_Visit.md` (repo root). It governs the entire MSF / MMS Mobile product — both this API and the React Native mobile app. Load it before designing any endpoint, schema column, validation rule, KPI computation, or constant, and align with it.

Key implications for backend work:

- **Domain terms** — use *MCL*, *Call List*, *Call Plan*, *Call Actual*, *Plan / Unplan / Non-Target Visit*, *UnVisit*, *Join Visit*, *Offline Visit*, *Daily Activity* exactly. Service names, route paths, table/column names, error codes harus konsisten dengan istilah ini.
- **Server-enforced deadlines** (jangan didelegasi ke client):
  - Call List add: 5 hari kerja awal bulan (Sat/Sun skip) — gated via `BATAS_HARI_KERJA_LIST` + override `OVERRIDE_BULAN_LIST`.
  - Call Plan approval: same-day < 10:00 WIB (`BATAS_JAM_PLAN`).
  - Call Actual approval: H+1 hingga 10:00 WIB (`BATAS_HARI_ACTUAL`, `BATAS_JAM_ACTUAL`).
  - Join Visit sync window: 30 menit pasca-visit; GPS radius `JOIN_VISIT_RADIUS_METERS = 100`.
- **Targets per (jabatan × divisi)** — `call_target_list` (master) drives Call Productivity/Reach per role; jangan hardcode di service.
- **Call Frequency target per class dokter** — beda untuk MR/PS/KAE vs DM/RSM (lihat spec §4.3); luar-kota maksimal 20% Call Plan dengan target 1x/bulan.
- **Non-Target Visit** — endpoint terpisah; hanya hitung untuk Call Productivity, **bukan** Reach/Frequency. KPI aggregation harus segregate-able.
- **Insentif Visit matrix** — kombinasi Reach × Frequency → 0/80/90/95/100%. Kalau ada endpoint estimasi insentif, gunakan persis tabel di spec §7.
- **Validity Call Actual**: tatap muka di koordinat customer + bukti foto (swafoto/lokasi/foto+ttd). Validasi koordinat & metadata foto wajib di server.

Konstanta-konstanta di atas tinggal di `src/lib/constants.ts` (server-tunable). Kalau spec berbeda dengan `legacy/` code, **angkat ke user dulu** — jangan diam-diam ikuti salah satu.

## What this is

Active **rewrite target** untuk backend MSF Mobile, menggantikan `../legacy/` (Laravel + MariaDB). Tetap men-serve client lama selama transisi via dual-write/dual-read kalau diperlukan, tapi semua kode baru ada di sini.

Stack:
- **Hono** ^4.12 + **Bun** runtime (`bun --watch`)
- **PostgreSQL 16** + **Drizzle ORM** ^0.45 + `postgres-js` driver
- **Zod** ^4 untuk validation (request + env)
- **JWT** via `hono/jwt` (HS256), cookie + Authorization header dual-mode
- Test: `bun test` dengan setup di `tests/setup.ts` (per-run unique DB, lihat root CLAUDE.md)

Lihat **`../CLAUDE.md`** untuk:
- Repository layout monorepo
- Common commands lengkap (`bun run …`, `docker compose …`, `bun run db:…`)
- Architecture flow (Route → middleware → validator → controller → service → Drizzle)
- Response/error convention (`sendSuccess`/`sendPaginated`/`sendError` + `DomainError` subclasses)
- Auth (JWT payload, `switch-pegawai`, cookie vs Bearer)
- Env validation (Zod-parsed, `process.exit(1)` on failure)
- Test isolation guard (DB name harus berakhiran `_test`)
- Schema conventions (master = INT identity, transactional = UUID + timestamptz)
- MariaDB → Postgres porting traps (`IFNULL`, `FIND_IN_SET`, `GROUP_CONCAT`, `DATE_FORMAT`, backticks)

Tidak perlu duplikasi di sini — kalau ada konflik, **root CLAUDE.md menang**.

## Module porting checklist (Laravel → Hono)

Ketika port controller Laravel ke modul baru:

1. **Baca spec di `../Mersi_Monitoring_System_Visit.md`** untuk aturan bisnis modul tsb.
2. **Baca `../legacy/app/Http/Controllers/<Controller>.php`** + `../legacy/DOCS-BACKEND/04-api-reference.md` untuk request/response shape yang mobile saat ini konsumsi.
3. **Baca `../legacy-msf-mobile/lib/data/api/`** untuk lihat call site mobile (kunci field yang dipakai).
4. Buat file di empat lapis:
   - `src/routes/<modul>.routes.ts` — route + middleware (`requireAuth`, `requireJabatan`, validator)
   - `src/validations/<modul>.validation.ts` — Zod schema (request + params + query)
   - `src/controllers/<modul>.controller.ts` — thin: `getValidJson()`/`getValidParam()`/`getValidQuery()`, panggil service, `sendSuccess()`
   - `src/services/<modul>.service.ts` — business logic, Drizzle queries, throw `DomainError` subclasses dari `src/lib/errors.ts`
5. Mount di `src/routes/index.ts` (sudah ada commented stub untuk modul yang direncanakan).
6. Surface konstanta business rule di `src/lib/constants.ts` — jangan inline angka di service.
7. Buat test di `tests/routes/<modul>.test.ts` pakai helper `request()` dari `tests/helpers/app.ts`; seed master data via `tests/helpers/seed.ts` + `resetSequence()`.

## Things to avoid

- **`c.json({error: ...}, 4xx)` langsung di service/controller** — selalu throw `DomainError` subclass; biar `errorHandler` middleware yang format response.
- **Baca `process.env.X` di luar `src/config/env.ts`** — semua env masuk ke schema Zod di sana, di-export sebagai `env` object.
- **Skip Zod validator** di route baru — semua input HTTP harus lewat `validateJson`/`validateParams`/`validateQuery`.
- **Modifikasi master tables dari runtime** (mereka read-only; populated by sync). Insert/update/delete hanya boleh dari `src/scripts/sync-master.ts` (kalau sudah ada) atau seed.
- **"Cleanup" UPPERCASE column names** di master schema — 1:1 mirror ke MariaDB legacy load-bearing untuk sync.
- **Reintroduce body field `id_peg`** di endpoint baru — sudah ada di JWT (`AuthPayload.id_peg`). Pakai `c.get('user').id_peg`. Untuk ganti pegawai, pakai `/api/auth/switch-pegawai`.
- **Pakai `bun test` tanpa `.env.test` yang DB-nya berakhiran `_test`** — setup script akan refuse jalan (safety guard terhadap dev/prod).
- **Hardcode threshold/target/cutoff** di service — semua ke `src/lib/constants.ts` (server-tunable).

## Quick commands

```bash
bun install
bun run dev                         # watch mode
bun test                            # all tests (per-run unique DB)
bun test tests/routes/auth.test.ts  # single file
bun test -t "returns 401"           # filter by name
bun run lint:fix
bun run format
docker compose up -d postgres       # start Postgres 16
bun run db:push                     # dev iter (no migration files)
bun run db:generate                 # create migration SQL from schema diff
bun run db:migrate                  # apply migrations
bun run db:seed                     # seed master fixtures (idempotent)
bun run db:reset                    # drop + push + seed
```

Detail lengkap di `../CLAUDE.md` § "Common commands".
