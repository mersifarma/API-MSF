# CLAUDE.md — mobile (React Native rewrite target)

This file provides guidance to Claude Code when working in this sub-project.

## Business domain — canonical spec (READ FIRST)

The **authoritative product spec** is `../Mersi_Monitoring_System_Visit.md` (repo root). It governs the entire MSF / MMS Mobile product — both this app and the Hono API. Load it before designing any visit-related screen, KPI widget, target/threshold UI, copy, or offline flow, and align with it.

Key implications for mobile work:

- **Domain terms** — use *MCL*, *Call List*, *Call Plan*, *Call Actual*, *Plan / Unplan / Non-Target Visit*, *UnVisit*, *Join Visit*, *Offline Visit*, *Daily Activity* exactly as defined in the spec. Don't invent labels like "kunjungan rencana" or "outside-list visit" in UI copy.
- **Tenggat waktu yang harus di-enforce / ditampilkan**:
  - Call List: 5 hari kerja awal bulan (Sat/Sun di-skip).
  - Approval Call Plan & Call Actual: sebelum 10:00 WIB.
  - Join Visit sync: ≤30 menit pasca-visit.
- **Targets bersifat per (jabatan × divisi)**, bukan global. Untuk badge/progress harian (Call Productivity) lihat tabel §4.1; untuk Call Reach (per bulan) lihat §4.2; untuk Call Frequency per dokter berdasarkan class lihat §4.3.
- **Class dokter (AA … CC)** punya semantik tetap (potensi × kontribusi sales) — kalau menampilkan class, gunakan styling/tooltip yang sejalan, jangan dianggap sebagai label opak.
- **Non-Target Visit** boleh dikunjungi tapi tidak dihitung untuk Reach/Frequency — UI harus jelas bahwa kunjungan ini di luar Call List.
- **Bukti Call Actual valid** wajib: tatap muka di koordinat customer + swafoto/foto lokasi/foto+ttd dokter — alur kamera/GPS tidak boleh memberi shortcut yang menyalahi ini.
- **Insentif matrix** (Call Reach × Call Frequency) — kalau menampilkan estimasi insentif, gunakan matrix di §7 persis.

Bila spec berbeda dengan perilaku `legacy-msf-mobile/`, **angkat ke user dulu** — jangan diam-diam mengikuti salah satu.

## What this is

The **React Native (Expo) rewrite** of `../legacy-msf-mobile/` (Flutter). Consumes the Hono backend at `../hono-api/`. Distributed as APK via EAS Build to match the existing `/app-version` → `link_apk` flow on the legacy app.

Stack:
- **Expo SDK 54** (`expo` `~54.0.33`), `react-native` `0.81.5`, `react` `19.1`
- **Expo Router** (file-based, `app/` dir, typed routes enabled)
- **TypeScript** (`strict: true`, `@/*` path alias mapped to `./*`)
- Auth storage: `expo-secure-store` via the official `useStorageState` hook
- Reactivity: React Context + `useState` (no Redux/Zustand/Tanstack until needed)
- HTTP: native `fetch` wrapped in `appFetch` (`src/config/api.ts`) — no axios

> **Expo SDK 54** introduces breaking changes. Always check the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before adding/upgrading a module. See `AGENTS.md`.

## Folder layout

```
mobile/
├── app/                     # Expo Router file-based routes
│   ├── _layout.tsx          # AuthProvider + Stack.Protected (guard token)
│   ├── login.tsx            # Login form
│   └── (tabs)/              # Authenticated tab group
│       ├── _layout.tsx      # Home + Profile tabs
│       ├── index.tsx        # Home (user info + switch pegawai)
│       └── profile.tsx      # Profile (logout)
├── src/                     # App logic (non-route)
│   ├── config/
│   │   ├── env.ts           # API_BASE_URL + APP_VERSION
│   │   └── api.ts           # appFetch wrapper + ApiError
│   ├── services/
│   │   └── auth.service.ts  # login / me / switchPegawai / logout
│   ├── store/
│   │   └── auth-context.tsx # AuthProvider + useAuth
│   ├── types/
│   │   └── api.ts           # User / Pegawai / *Response types
│   └── lib/
│       └── use-storage-state.ts  # SDK-54 official cross-platform secure-store hook
├── components/              # template UI primitives (ThemedText, IconSymbol, HapticTab)
├── hooks/                   # template hooks (useColorScheme, useThemeColor)
├── constants/theme.ts       # template Colors palette
├── assets/images/           # template icons + splash
├── app.json                 # Expo config (slug, scheme, android.package, plugins)
├── eas.json                 # Build profiles: development / preview / production
├── .env / .env.example      # EXPO_PUBLIC_API_URL only
└── tsconfig.json            # strict TS + @/* alias
```

Path alias: `@/*` → repo root. Import patterns:
- `@/src/store/auth-context` — app logic
- `@/components/themed-text` — template UI
- `@/hooks/use-color-scheme` — template hooks
- `@/constants/theme` — template colors

## Commands (from `mobile/`)

```powershell
npm run start              # Metro bundler (press 'a' for Android, 'i' for iOS, 'w' for web)
npm run android            # Start + launch Android emulator
npm run ios                # macOS only
npm run web                # Browser
npm run lint               # expo lint (ESLint 9)
npx tsc --noEmit           # Type check (no build)
npx expo install <pkg>     # Install SDK-version-matched native module — DO NOT use plain `npm install` for expo-*
```

EAS:

```powershell
# One-time, interactive (needs Expo account):
npx eas-cli login
npx eas-cli init             # generates extra.eas.projectId in app.json
# After init, builds:
npx eas-cli build --profile development --platform android
npx eas-cli build --profile preview --platform android       # APK ready to share
npx eas-cli build --profile production --platform android    # AAB for Play Store
```

## Backend contract (matches hono-api today)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/auth/login` | POST | – | ✅ LIVE |
| `/api/auth/me` | GET | Bearer | ✅ LIVE |
| `/api/auth/switch-pegawai` | POST | Bearer | ✅ LIVE |
| `/api/auth/logout` | POST | Bearer | ✅ LIVE |
| `/api/master/*` | – | – | ⬜ TODO in hono-api |
| `/api/call-list/*`, `/api/call-plan/*`, `/api/call-actual/*` | – | – | ⬜ TODO |
| `/api/approval/*`, `/api/report/*` | – | – | ⬜ TODO |
| `/server-date`, `/app-version`, `/dm-approval-notification-summary` | – | – | ⬜ TODO |

JWT goes in **`Authorization: Bearer <token>`** header. The cookie path is irrelevant on RN. `X-App-Version` is auto-injected by `appFetch` from `Application.nativeApplicationVersion` (single-sourced from `app.json` `expo.version`). CORS in hono-api already whitelists this header.

Response envelope: `{ success: true, data }` (unwrapped by `appFetch` → returns `data`) or `{ success: false, error: { message, code, details? } }` (thrown as `ApiError`).

## Dev URL conventions

Port **8001** = nilai `PORT` di `../hono-api/.env` (custom dari default 3000).

- Android **emulator** → `http://10.0.2.2:8001` (default `.env`)
- iOS **simulator** / web → `http://localhost:8001`
- **Physical device on LAN** → `http://<dev-machine-ip>:8001` (set in `.env`)
- **Staging** → `https://registrasi.mersimkt.web.id/api/dev`
- **Production** → `https://registrasi.mersimkt.web.id/api` (set in `eas.json` per profile)

Backend dev: from `../hono-api`, `bun run dev` (port dari `.env`, saat ini 8001).

## Tests user (seeded in hono-api)

`mr01` / `dm01` / `rsm01` — password `password` (see `../hono-api/src/scripts/_fixtures.ts`).

## Padanan modul → legacy Flutter

Saat menambah modul baru, lihat dulu padanan di `../legacy-msf-mobile/`:

| Modul | RN/Expo target | Flutter reference |
|-------|----------------|-------------------|
| Visit (Call List / Plan / Actual) | `app/(tabs)/visit/` | `legacy-msf-mobile/lib/views/pages/visit/` |
| Approval (DM/RSM) | `app/(tabs)/approval/` | `legacy-msf-mobile/lib/views/pages/visit/main_approval_*.dart` |
| Master customer + dokter | `app/(tabs)/visit/master/` | `legacy-msf-mobile/lib/data/api/visit_query.dart` |
| Offline write queue | `src/lib/offline/` + `expo-sqlite` | `legacy-msf-mobile/lib/data/offline/` (Hive + SQLite + PendingSyncService) |

Tabel padanan package selengkapnya: lihat **`../legacy-msf-mobile/CLAUDE.md`** section "Offline mode (critical for RN port)".

## Things to avoid

- **Reintroducing `id_peg` as a body field on every request** — sudah ada di JWT (`AuthPayload.id_peg`) di hono-api. Untuk ganti pegawai pakai `switchPegawai(id_peg)` yang re-sign token.
- **Plain `npm install expo-*`** untuk paket Expo SDK — selalu pakai `npx expo install <pkg>` supaya version-matched dengan SDK 54.
- **Mengubah `android.package` / `ios.bundleIdentifier`** dari `com.mersi.mmsmobile.rn` — sengaja beda dari APK Flutter `com.mersi.mmsmobile` yang masih produksi, supaya bisa coexist di device yang sama.
- **Commit `.env`, signing key, `node_modules/`, `.expo/`, `android/`, `ios/`** — sudah ter-ignore di `.gitignore`.
- **Decode JWT di sisi client untuk authorization** — selalu call `/api/auth/me` untuk validasi. JWT cuma payload identitas, bukan source of truth permission.

## Status setup awal

Selesai:
- ✅ Expo project scaffolded (SDK 54)
- ✅ Login flow → POST `/api/auth/login`, token disimpan di `expo-secure-store`
- ✅ Token rehydration on app start (call `/me`, invalidate on 401)
- ✅ Switch pegawai modal
- ✅ Logout (clears secure-store + best-effort POST `/logout`)
- ✅ `eas.json` dengan 3 profile (development / preview APK / production AAB)
- ✅ Type-check bersih (`npx tsc --noEmit`)

Belum:
- ⬜ `npx eas-cli login` + `npx eas-cli init` (interaktif — user jalankan sendiri saat siap)
- ⬜ Modul Visit / Approval (menunggu endpoint hono-api)
- ⬜ Offline mode (WatermelonDB / expo-sqlite + sync queue)
- ⬜ Version gate (`/app-version` belum ada di hono-api, header `X-App-Version` sudah dikirim — siap dipakai begitu endpoint hidup)
- ⬜ Push / local notifications (`expo-notifications` belum ditambahkan)
- ⬜ Production splash + adaptive icon assets Mersi (masih default Expo)
