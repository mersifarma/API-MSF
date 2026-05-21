-- Extensions yang dibutuhkan oleh schema MSF.
-- pgcrypto: untuk gen_random_uuid() di tabel transactional (call_list, call_plan_actual, dst).
-- citext   : kalau nanti perlu case-insensitive text (opsional, dipasang awal biar gampang).
-- pg_trgm  : trigram index untuk LIKE/ILIKE search (nama dokter, dst).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
