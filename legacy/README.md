# Legacy — Laravel API & Artefak

Semua artefak dari sistem **lama** (Laravel + MariaDB) yang masih jalan di produksi `https://registrasi.mersimkt.web.id/api`.

**Catatan**: kode di sini **tidak diedit lagi** kecuali untuk hotfix produksi. Pengembangan baru lanjut di [`../hono-api/`](../hono-api/).

---

## Isi folder

| Path | Isi |
|------|-----|
| [`app/`](./app/) | Laravel controllers — `MainMenuController`, `VisitController`, `VisitApprovalController`, `JoinVisitController`, `ImageController` |
| [`routes/`](./routes/) | Route definitions PROD + DEV |
| [`DOCS/`](./DOCS/) | Dokumentasi sisi **mobile** Flutter (8 file: getting started, architecture, features, API integration, offline mode, call targets, versioning, troubleshooting) |
| [`DOCS-BACKEND/`](./DOCS-BACKEND/) | Dokumentasi sisi **backend** Laravel yang saya tulis sebagai input untuk rewrite (8 file + README) |
| [`db-backup/`](./db-backup/) | Dump per-tabel dari MariaDB `monitoring` (~186 MB, 18 tabel) — diambil 2026-05-20 |
| `.env` | Kredensial Laravel — **jangan commit ke remote** |

---

## Hubungan dengan hono-api/

- **Sumber referensi**: kontrak endpoint, schema DB, business logic — semua dibaca dari sini.
- **Sumber sync**: `db-backup/*.sql` di-load awal ke Postgres lokal untuk seed master. Production sync via [`hono-api/src/scripts/sync-master.ts`](../hono-api/) (belum ada — TODO).
- **Co-existence**: legacy tetap melayani user lama selama transisi. Mobile baru pindah ke hono-api bertahap.

---

## Status produksi

- Database: `monitoring` @ `mersimkt.web.id` (MariaDB 10.3.39)
- Mobile aktif: `8.1.29` (dari `call_version`), `2.0.0+4` (dari Flutter `pubspec.yaml`)
- Backend domain: `registrasi.mersimkt.web.id`
