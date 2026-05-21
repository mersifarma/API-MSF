# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two distinct sub-projects:

- **`legacy/`** — Laravel + MariaDB API, still serving production at `https://registrasi.mersimkt.web.id/api`. **Read-only reference**, not edited except for hotfixes. Source of truth for endpoint contracts that the rewrite must preserve. The Laravel controllers (`MainMenuController`, `VisitController`, `VisitApprovalController`, `JoinVisitController`, `ImageController`) and `legacy/DOCS-BACKEND/` are the authoritative spec.
- **`hono-api/`** — active rewrite target (Hono + Bun + PostgreSQL + Drizzle ORM). All new code goes here.

Active development happens in `hono-api/`. Run all `bun run …` / `docker compose …` commands from that directory.

## Migration strategy (critical context)

The database split is intentional and shapes how schema is modeled:

- **Master tables** (13, in `src/db/schema/master.ts`): mirror MariaDB legacy **exactly** — same column names (including UPPERCASE like `list_dokter_visit_new.ID`, `STATUS_MD`), same INT identity PKs, same nullability. These are **read-only** from the Hono app; data is populated by a cron sync (`src/scripts/sync-master.ts` — TODO, not yet built) that UPSERTs from MariaDB by PK.
- **Transactional tables** (5, in `src/db/schema/transactional.ts`): pure rewrite. PK = `UUID DEFAULT gen_random_uuid()`. FKs to master stay INTEGER. Mandatory `created_at` / `updated_at` (`timestamptz`, default `NOW()`). New mobile writes go straight here.

Do not "clean up" UPPERCASE column names or add normalization to master tables — the 1:1 mirror is load-bearing for the sync.

## Common commands (run from `hono-api/`)

```bash
bun install                 # install deps
bun run dev                 # watch mode dev server (src/index.ts)
bun run start               # production-style run
bun test                    # run all tests (see "Test isolation" below)
bun test --watch            # watch mode
bun test tests/routes/auth.test.ts   # single file
bun test -t "returns 401"   # filter by test name
bun run lint                # eslint
bun run lint:fix
bun run format              # prettier write
bun run format:check
```

Database (Drizzle):

```bash
docker compose up -d postgres       # start Postgres 16 + pgcrypto/citext/pg_trgm (init script)
docker compose --profile ui up -d   # also start pgAdmin at :5050
bun run db:generate                 # generate SQL migrations from TS schema
bun run db:migrate                  # apply migrations (programmatic runner — use for prod/CI)
bun run db:migrate:kit              # same, via drizzle-kit
bun run db:push                     # push schema directly (dev iteration, skips migration files)
bun run db:studio                   # browser UI at :4983
bun run db:seed                     # seed master fixtures (idempotent, onConflictDoNothing)
bun run db:reset                    # drop + push + seed
```

Seed user accounts (from `src/scripts/_fixtures.ts`): `mr01` / `dm01` / `rsm01`, password `password`.

## Architecture

Layered request flow (`src/app.ts` → routes → validation → controller → service → Drizzle):

```
Route (src/routes/*.routes.ts)
  → middleware chain: requireAuth → requireJabatan/requireDivisi (RBAC)
  → validateJson / validateParams / validateQuery (Zod)
  → Controller (src/controllers/*.controller.ts) — thin: extract via getValidJson/Param/Query, call service, sendSuccess
  → Service (src/services/*.service.ts) — business logic + Drizzle queries, throws DomainError subclasses
  → DB (src/config/database.ts → drizzle + postgres-js pool, max=10)
```

Mount new modules in `src/routes/index.ts` (the file already lists the planned modules as commented stubs).

### Response & error convention

Every JSON response uses one of three shapes from `src/utils/response.ts`:
- `{ success: true, data }` (`sendSuccess`)
- `{ success: true, data, meta: { total, page, limit } }` (`sendPaginated`)
- `{ success: false, error: { message, code, details? } }` (`sendError`)

Services throw `DomainError` subclasses from `src/lib/errors.ts` (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`, `DeadlinePassedError`) — never `c.json({error: ...}, 4xx)` directly. The global `errorHandler` in `src/middleware/error-handler.ts` converts them. `HTTPException` from Hono is also handled.

Validation errors (Zod failures via `src/middleware/validator.ts`) become 422 `VALIDATION_ERROR` with `details.issues` containing the Zod issue array.

### Auth

JWT via `hono/jwt` (HS256), signed in `src/config/auth.ts`. Token is set as an httpOnly cookie `auth_token` **and** returned in the response body as `access_token` so mobile clients can send it via `Authorization: Bearer …`. `extractToken()` in `src/middleware/auth.ts` accepts either.

The JWT payload (`AuthPayload`) embeds `sub` (user id), `id_peg` (currently-selected pegawai rowid), `jabatan`, `divisi`. A user can own multiple `data_pegawai` rows; `POST /api/auth/switch-pegawai` re-signs a token bound to a different `id_peg`. This replaces the legacy "send plain `id_peg` in every request body" pattern — do not reintroduce that pattern in new endpoints.

Hono context types live in `src/types/app-env.ts` (`AppEnv.Variables = { user, requestId }`). Type new Hono instances/middleware as `Hono<AppEnv>` / `MiddlewareHandler<AppEnv>` so `c.get('user')` is typed.

Passwords are verified with `Bun.password.verify` (argon2id-compatible). The seed fixture password `password` is pre-hashed in `_fixtures.ts`.

### Env validation

`src/config/env.ts` parses `process.env` through a Zod schema at module load and `process.exit(1)` on failure. New required env vars go there — do not read `process.env.X` directly elsewhere. `JWT_SECRET` requires ≥16 chars.

## Test isolation (important)

`bun test` is preloaded with `tests/setup.ts` (configured in `bunfig.toml`). Per test run:

1. Loads `.env.test`.
2. **Refuses to run** if `DATABASE_URL` base DB name doesn't end with `_test` (safety guard against hitting dev/prod).
3. Connects to the `postgres` admin DB and `CREATE DATABASE msf_test_{timestamp}_{pid}` — a unique DB per run.
4. Overrides `process.env.DATABASE_URL` to the unique DB **before** any `src/*` module is imported (this is why module-level `env` parsing works and why test files import via `await import` indirectly).
5. Runs migrations + minimal master seed (`users`, `data_pegawai`, `struktur` only).
6. `afterAll` + `beforeExit` + SIGINT/SIGTERM handlers all call `DROP DATABASE … WITH (FORCE)`.

Test files needing additional master data (`app_modul`, dokter, products, etc.) call helpers from `tests/helpers/seed.ts` in their `beforeAll`. After any `INSERT` with explicit IDs the helper calls `resetSequence(...)` — keep this pattern when adding new seeds, otherwise subsequent unspecified-ID inserts collide.

HTTP tests use `tests/helpers/app.ts` `request()`, which calls `app.request()` directly (no port binding). The `createApp()` factory in `src/app.ts` skips the `logger()` middleware when `NODE_ENV === 'test'` to keep test output clean.

## Schema / migration conventions

- Master tables: PK = `INTEGER GENERATED BY DEFAULT AS IDENTITY` (override-able during sync). No FKs *between* masters in Drizzle — the sync script enforces load order manually. `users.id` is `bigint` (legacy `bigint(20) unsigned`).
- Transactional: PK = `uuid().defaultRandom()`. FKs to master = `integer().references(() => masterTable.column)`. Self-FK (`call_plan_actual.join_visit_id`) = `uuid`. `is_visited` is `boolean` (legacy `tinyint(1)`). `product_list` / `s3_upload_log` stay as `text` (JSON string) for backward compat — flag a separate task before switching to `jsonb`.
- MariaDB → Postgres porting traps (see `hono-api/README.md` "Catatan kompatibilitas"): `IFNULL` → `COALESCE`, `FIND_IN_SET` → `ANY(string_to_array(...))`, `GROUP_CONCAT` → `string_agg`, `DATE_FORMAT('%Y-%m')` → `to_char(…, 'YYYY-MM')`, `NOW() - INTERVAL 30 MINUTE` → `NOW() - INTERVAL '30 minutes'`, backticks → double quotes or remove.

## Business rules to preserve when porting endpoints

Legacy constants documented in `legacy/DOCS-BACKEND/06-business-logic.md`. When porting a Laravel controller to Hono, surface these as server-tunable constants (likely in `src/lib/constants.ts`, currently stubbed):

- Call list add: gated by working-day deadline (`BATAS_HARI_KERJA_LIST = 5` working days from month start; Sat/Sun skipped). Override-able via `OVERRIDE_BULAN_LIST = 'YYYY-MM'`. Uniqueness `(id_peg, id_mcl, periode)`. Target enforced from `call_target_list` by `(jabatan, divisi)`.
- Call plan approval cutoff: `BATAS_JAM_PLAN = 10` (WIB) on same-day plans.
- Call actual approval: `BATAS_HARI_ACTUAL = 1` day, until `BATAS_JAM_ACTUAL = 10` (WIB).
- Notification polling: `NOTIFICATION_INTERVAL_MINUTES` — legacy currently set to `1` (testing); production must be `30`.
- Join visit: GPS radius `JOIN_VISIT_RADIUS_METERS = 100`.
- Mobile version gate: legacy requires header `X-App-Version`, returns HTTP 426 `VERSION_OUTDATED` if missing. CORS in `src/app.ts` already allows this header — preserve the gate when porting `/server-date` and visit endpoints.

For endpoint contracts (request/response shapes) the spec is `legacy/DOCS-BACKEND/04-api-reference.md`; mobile is the primary consumer and contract changes need explicit coordination.

## Misc

- Path: when adding new tables/routes, `src/db/schema/index.ts` re-exports everything — no need to register manually as long as the file is in `src/db/schema/`.
- `legacy/.env` and `legacy/db-backup/*.sql` contain production credentials and real customer/doctor data — never commit and never paste contents into PRs/issues.
- The `hono-api/docs/01-ARCHITECTURE.md` diagram references "MPMS" — that's a stale name from an earlier scaffold; the project is MSF / MMS Mobile.
