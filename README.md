# MSF API — Monorepo

Workspace berisi **legacy** (Laravel + MariaDB, masih jalan di produksi) dan **rewrite** (Hono + Bun + PostgreSQL, work in progress).

```
D:\API-MSF\
├── legacy/                Laravel API existing + dokumentasi + DB backup
│   ├── app/               Controllers Laravel
│   ├── routes/            Route definitions
│   ├── DOCS/              Mobile project docs (Flutter side)
│   ├── DOCS-BACKEND/      Backend docs (8 file)
│   ├── db-backup/         Per-table dump dari MariaDB monitoring
│   └── .env               Laravel env (creds prod — sensitif!)
└── hono-api/              Rewrite target — Hono + Bun + PostgreSQL + Drizzle
    ├── src/db/schema/     Master (13) + Transactional (5)
    └── drizzle/           Migration files (generated)
```

---

## Status & next step

| Komponen | Status |
|----------|--------|
| Dokumentasi backend legacy | ✅ Lengkap ([`legacy/DOCS-BACKEND/`](./legacy/DOCS-BACKEND/)) |
| DB backup per-tabel | ✅ 18 file, ~186 MB ([`legacy/db-backup/`](./legacy/db-backup/)) |
| Hono+Bun+Drizzle schema | ✅ 18 tabel (mirror 13 + rewrite 5) ([`hono-api/`](./hono-api/)) |
| Cron sync MariaDB → Postgres master | ⬜ TODO |
| Hono routes rewrite | ⬜ TODO |

Detail rewrite + setup ada di [`hono-api/README.md`](./hono-api/README.md).

---

## Keamanan

- `legacy/.env` berisi kredensial DB **produksi**. Jangan commit ke remote — pastikan `.gitignore` aktif.
- `legacy/db-backup/*.sql` berisi data produksi real (password hash, info dokter, dst.). Treat as sensitive.
