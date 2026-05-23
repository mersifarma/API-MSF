# MSF Mobile — React Native (Expo)

Aplikasi mobile MSF / MMS — **rewrite target React Native** dari `../legacy-msf-mobile/` (Flutter). Konsumsi backend `../hono-api/` (Hono + Bun + Postgres).

**Status:** setup awal selesai — login berfungsi, token tersimpan di secure-store, 2 tab placeholder (Home / Profile). Modul Visit/Approval menyusul setelah endpoint hono-api hidup.

---

## Prerequisite (sekali setup)

### 1. Node.js + npm

Sudah ada (datang dari install Expo / RN). Cek: `node --version` ≥ 20.

### 2. Android Studio + Android SDK

Install **Android Studio** dari https://developer.android.com/studio. Saat install, pastikan komponen berikut ter-include (default-nya iya):

- Android SDK Platform (API 34+ atau lebih baru)
- Android SDK Platform-Tools (`adb`, `fastboot`)
- Android Emulator
- Setidaknya **1 AVD** (Android Virtual Device) — buat via Android Studio → **Tools → Device Manager → Create Device**

Lokasi default SDK di Windows: `C:\Users\<user>\AppData\Local\Android\Sdk`

### 3. Set `ANDROID_HOME` + tambah `adb` ke PATH (permanent)

**WAJIB** — kalau tidak, `npx expo start --android` tidak akan ketemu emulator. Jalankan di PowerShell sekali:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdk, 'User')
$paths = [Environment]::GetEnvironmentVariable('Path', 'User') -split ';' | Where-Object { $_ }
$paths += "$sdk\platform-tools"
$paths += "$sdk\emulator"
[Environment]::SetEnvironmentVariable('Path', ($paths -join ';'), 'User')
Write-Output "Done. TUTUP & buka ulang terminal supaya env baru aktif."
```

Verifikasi setelah restart terminal:

```powershell
adb --version          # harus print versi
emulator -list-avds    # harus list AVD-mu (mis. msf_test)
```

---

## Quick start (run app)

Urutan ini reproducible dari nol:

### 1. Pastikan backend hono-api hidup (port 8001)

Di terminal lain:

```powershell
cd D:\API-MSF\hono-api
docker compose up -d postgres        # sekali, kalau Postgres belum running
bun run db:reset                     # sekali, kalau DB belum seeded
bun run dev                          # http://localhost:8001
```

Test backend:

```powershell
curl http://localhost:8001/health
# expected: {"success":true,"data":{"status":"ok","ts":...}}
```

> **Port 8001** dipakai oleh `hono-api/.env` (`PORT=8001`). Kalau di environment-mu beda, sesuaikan `EXPO_PUBLIC_API_URL` di `mobile/.env`.

### 2. Launch Android emulator

**Opsi A — via Android Studio:** buka **Tools → Device Manager** → klik tombol ▶ di AVD yang mau dipakai.

**Opsi B — via command line (lebih cepat):**

```powershell
emulator -list-avds              # lihat AVD yang ada
emulator -avd msf_test           # ganti msf_test dengan nama AVD-mu
```

Tunggu emulator boot complete (home screen kelihatan). Verifikasi:

```powershell
adb devices
# harus tampilkan:
# List of devices attached
# emulator-5554   device
```

### 3. Install dependencies mobile (sekali)

```powershell
cd D:\API-MSF\mobile
npm install
```

### 4. Buat `.env` (sekali)

```powershell
Copy-Item .env.example .env
# default sudah point ke http://10.0.2.2:8001 — biarkan kalau pakai emulator
```

Mapping URL per skenario:

| Skenario | EXPO_PUBLIC_API_URL |
|----------|---------------------|
| Android emulator | `http://10.0.2.2:8001` (host loopback dari emulator) |
| iOS simulator / web | `http://localhost:8001` |
| HP fisik via LAN | `http://<IP-laptop>:8001` (cek dengan `ipconfig`) |
| Staging | `https://registrasi.mersimkt.web.id/api/dev` |
| Production | `https://registrasi.mersimkt.web.id/api` |

### 5. Start Metro + buka di emulator

```powershell
npm run android
# atau setara: npx expo start --android
```

Yang terjadi:
- Metro bundler start di port 8081
- Expo Go di-install otomatis ke emulator (pertama kali ~1-2 menit)
- App auto-launch, masuk ke layar **Login**

### 6. Login dengan user seed

| Username | Password | Role |
|----------|----------|------|
| `mr01`   | `password` | Medical Representative |
| `dm01`   | `password` | District Manager |
| `rsm01`  | `password` | Regional Sales Manager |

Seed user ada di `../hono-api/src/scripts/_fixtures.ts`.

---

## Shortcut keys (di terminal Metro)

Setelah `npm run android` jalan, tekan tombol ini di terminal:

| Key | Fungsi |
|-----|--------|
| `a` | Buka di Android (re-launch app) |
| `r` | Reload app |
| `j` | Buka debugger (Chrome DevTools) |
| `m` | Toggle dev menu di app |
| `Shift+r` | Clear cache + reload |
| `?` | Show all commands |

---

## EAS Build (APK untuk distribusi)

```powershell
npm install -g eas-cli           # atau pakai npx eas-cli setiap kali
eas login                        # interaktif, butuh akun Expo
eas init                         # link project, generate projectId ke app.json
eas build --profile preview --platform android    # APK siap dibagikan
eas build --profile production --platform android # AAB untuk Play Store
```

Profile config ada di [`eas.json`](./eas.json). `preview` → APK direct download (cocok dengan flow `/app-version` → `link_apk` legacy). `production` → AAB untuk Play Store.

---

## Troubleshooting

### `adb` is not recognized

`ANDROID_HOME` belum di-set atau `adb` belum di PATH. Jalankan ulang langkah Prerequisite #3, restart terminal.

### `adb devices` kosong tapi emulator window ada

```powershell
adb kill-server; adb start-server; adb devices
```

Kalau masih kosong, restart emulator (close window, `emulator -avd <name>` lagi).

### Login gagal "Network request failed"

1. Cek backend hidup: `curl http://localhost:8001/health`
2. Cek `EXPO_PUBLIC_API_URL` di `.env` benar (emulator pakai `10.0.2.2`, BUKAN `localhost`)
3. Restart Metro dengan `--clear` supaya `.env` baru ke-read: `npx expo start --android --clear`

### Port 8081 already in use (Metro)

Process Metro lama belum mati. Cari & kill:

```powershell
Get-NetTCPConnection -LocalPort 8081 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Expo Go di emulator menampilkan splash terus

Cache busted. Coba:

```powershell
npx expo start --android --clear
```

Atau di emulator: uninstall Expo Go (long-press → Uninstall) lalu `npm run android` lagi.

### `npx expo start --android` tidak buka app, hanya Metro

Emulator tidak terdeteksi sebelum Expo connect. Pastikan `adb devices` print emulator-5554, lalu tekan `a` di terminal Metro.

---

## Dokumentasi lengkap

- Panduan dev + arsitektur: **[CLAUDE.md](./CLAUDE.md)**
- Spec fitur (warisan Flutter): **[../legacy-msf-mobile/DOCS/](../legacy-msf-mobile/DOCS/)** (8 dokumen)
- Backend contract: **[../hono-api/README.md](../hono-api/README.md)**
- Monorepo overview: **[../README.md](../README.md)**
