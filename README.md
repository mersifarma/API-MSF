# MSF API — Monorepo

Workspace berisi **legacy backend** (Laravel + MariaDB, masih jalan di produksi), **legacy mobile** (Flutter, ship via direct APK), dan **rewrite** (Hono + Bun + PostgreSQL untuk backend, Expo/React Native untuk mobile — keduanya work in progress).

```
D:\API-MSF\
├── legacy/                Laravel API existing + dokumentasi + DB backup
│   ├── app/               Controllers Laravel
│   ├── routes/            Route definitions
│   ├── DOCS/              Mobile project docs (Flutter side)
│   ├── DOCS-BACKEND/      Backend docs (8 file)
│   ├── db-backup/         Per-table dump dari MariaDB monitoring
│   └── .env               Laravel env (creds prod — sensitif!)
├── legacy-msf-mobile/     Flutter app existing (Android, com.mersi.mmsmobile)
│   ├── lib/               Source Dart (views/ + data/api + data/offline)
│   ├── DOCS/              8 dokumen arsitektur, fitur, offline, versioning
│   └── CLAUDE.md          Panduan rewrite ke RN/Expo + tabel padanan package
├── mobile/                Rewrite target mobile — Expo SDK 54 + Expo Router + TS
│   ├── app/               File-based routes (login + (tabs)/Home/Profile)
│   ├── src/               config, services, store (AuthProvider), types
│   └── eas.json           Build profiles: development / preview (APK) / production (AAB)
└── hono-api/              Rewrite target backend — Hono + Bun + PostgreSQL + Drizzle
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
| Legacy Flutter app + DOCS | ✅ Tersedia sebagai read-only reference ([`legacy-msf-mobile/`](./legacy-msf-mobile/)) |
| RN/Expo mobile scaffold | ✅ Setup awal (auth login/me/switch/logout + EAS config) ([`mobile/`](./mobile/)) |
| Cron sync MariaDB → Postgres master | ⬜ TODO |
| Hono routes rewrite (modul fitur) | ⬜ TODO |
| Mobile: modul Visit/Approval/Offline | ⬜ TODO (menunggu endpoint hono-api) |

Detail rewrite backend + setup ada di [`hono-api/README.md`](./hono-api/README.md). Mobile dev: [`mobile/README.md`](./mobile/README.md) + [`mobile/CLAUDE.md`](./mobile/CLAUDE.md). Spec UX & fitur (sumber kontrak) tetap di [`legacy-msf-mobile/DOCS/`](./legacy-msf-mobile/DOCS/).

---

## Keamanan

- `legacy/.env` berisi kredensial DB **produksi**. Jangan commit ke remote — pastikan `.gitignore` aktif.
- `legacy/db-backup/*.sql` berisi data produksi real (password hash, info dokter, dst.). Treat as sensitive.
- `legacy-msf-mobile/` adalah **read-only reference** — jangan edit kecuali hotfix yang disetujui owner. Build output (`build/`, `.apk`, `.aab`) dan signing key tidak boleh di-commit.
