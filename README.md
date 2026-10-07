# DOR IEG — Daily Operation Review

Web app review operasional harian PT Inovasi Eka Gemilang: temuan lintas divisi, tindak lanjut dengan batas waktu (KPI), sesi Gemba tim QA/QC, dan dashboard.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind 3 · Prisma 6 · TiDB Serverless · Google Drive (Shared Drive, service account) · Vercel.
**UI:** IEG Design System v3.1 (`INV IEG/design-ocs.md`) — tema Morning/Evening, sidebar 3 mode, basis desain 360px (PDT Zebra), tabel → kartu di HP.

---

## 1. Fitur

| Modul | Isi |
|---|---|
| **Temuan** | Nomor otomatis `DOR-2026-0001` / `GMB-…`, kategori & prioritas, divisi penanggung jawab + PIC opsional, foto bukti, batas tindak lanjut dari SLA, riwayat tindak lanjut (timeline), status `Open → Proses → Selesai → Ditutup`, pengalihan, akar masalah & resolusi. |
| **Sumber temuan** | Saat membuat temuan, pilih **Saat DOR** (nomor `DOR-…`) atau **Saat Gemba** (nomor `GMB-…`). Divisi bertanda *tim Gemba* (QA/QC) otomatis terpilih Gemba. Tidak ada entitas sesi Gemba. |
| **Dashboard** | Total, terselesaikan (Closed), belum selesai (+%), menunggu approval, terlambat, ring penyelesaian, KPI tepat waktu, tren harian, per divisi, per kategori, daftar “perlu tindak lanjut segera”. Filter periode & divisi. |
| **KPI** | % tindak lanjut pertama ≤ SLA hari, per divisi, rata-rata waktu TL pertama & penyelesaian. |
| **Settings (Admin)** | SLA hari (dinamis, hari kalender/kerja), pilihan sumber Gemba on/off, ukuran & kualitas foto, **divisi** (dinamis, tanda tim Gemba), **kategori** (dinamis), **pengguna** (Admin / PIC / Viewer, PIC per divisi bisa banyak). |

### Peran
- **ADMIN** — semua akses, kelola master & pengguna, boleh menutup temuan siapa pun.
- **PIC** — buat temuan, assign ke divisi lain, menindaklanjuti temuan yang ditujukan ke divisinya/dirinya, **mengajukan selesai (wajib foto bukti)**; pelapor yang meng-assign **menyetujui (Closed)** atau **menolak (revisi)**.
- **VIEWER** — hanya melihat.

### Aturan status (alur approval)
`OPEN → IN_PROGRESS` otomatis saat tindak lanjut pertama · PIC **Ajukan selesai** (wajib ≥1 foto bukti perbaikan) `→ DONE` (*Menunggu Approval*) · pelapor/Admin **Setujui** `→ CLOSED` atau **Tolak, minta revisi** `→ IN_PROGRESS` (alasan wajib) · `CANCELLED` / buka kembali hanya pelapor/Admin. **Terselesaikan di dashboard = CLOSED saja.**

### KPI “tindak lanjut ≤ N hari”
Saat temuan dibuat, `dueAt = reportedAt + SLA` disimpan di baris temuan (snapshot). **Tepat waktu** = tindak lanjut pertama ≤ `dueAt`. **Terlambat** = TL pertama > `dueAt`, atau belum ada TL padahal sudah lewat. **Masih dalam batas** tidak masuk pembagi. Mengubah SLA di Settings hanya memengaruhi temuan baru.

---

## 2. Setup lokal (laptop)

```bash
npm install
copy .env.example .env     # lalu isi
npm run db:push            # buat tabel di TiDB
npm run db:collation       # WAJIB: ubah collation ke case-insensitive (ulangi tiap tambah tabel)
npm run db:seed            # divisi, kategori, setting, admin pertama
npm run dev                # http://localhost:3000
```
Login awal: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` dari `.env` (bawaan `admin@ptieg.co.id` / `Admin123!`) — wajib ganti password saat login pertama.
Untuk dev tanpa Google Drive: `STORAGE_DRIVER=local` (foto masuk `./storage/uploads`). Di Vercel **harus** `gdrive`.

Reset password dari CLI: `npm run db:passwd -- email@x.com PasswordBaru`.

---

## 3. TiDB Serverless

1. Buat cluster di [tidbcloud.com](https://tidbcloud.com) (region `ap-southeast-1`), database `dor`.
2. Connect → **Prisma** → salin `DATABASE_URL` (harus ada `?sslaccept=strict`).
3. Jebakan yang sudah ditangani di schema: `relationMode="prisma"` (setiap FK punya `@@index`), tidak ada scalar list, kolom panjang pakai `@db.Text`, penomoran tanpa interactive transaction (hindari write conflict).

---

## 4. Google Drive

Ada dua cara autentikasi — pilih salah satu di `.env`:

### A. OAuth akun Google biasa (My Drive) — paling mudah
Memakai scope `drive.file` (app hanya menyentuh file/folder yang dibuat app sendiri) → **tidak perlu verifikasi Google**, tidak ada layar "Akses diblokir", refresh token permanen.
1. Google Cloud Console → **Enable Google Drive API**.
2. **OAuth consent screen** → External → isi nama app & email → Save. Tambahkan email Anda di *Test users*, lalu **Publish app** (status *In production*). Tidak perlu submit verifikasi.
3. **Credentials → Create credentials → OAuth client ID** → tipe **Desktop app**. Salin ke `.env`: `GDRIVE_OAUTH_CLIENT_ID`, `GDRIVE_OAUTH_CLIENT_SECRET`.
4. `npm run drive:auth` → browser terbuka → login → Allow. Skrip **membuat folder** `GDRIVE_FOLDER_NAME` (bawaan "DOR Bukti Foto") di My Drive dan mencetak `GDRIVE_OAUTH_REFRESH_TOKEN` + `GDRIVE_FOLDER_ID` → tempel keduanya ke `.env`. Folder yang dibuat manual **tidak bisa dipakai** (di luar jangkauan scope `drive.file`).
5. `npm run check:drive` → harus *Mode auth: OAuth* dan *Upload OK*.

### B. Service Account (folder HARUS di Shared Drive)
Service account **tidak punya kuota** di My Drive, jadi folder harus di **Shared Drive** (Google Workspace; admin mungkin perlu mengizinkan pembuatan Shared Drive di admin.google.com → Apps → Drive and Docs → Sharing settings).
1. IAM & Admin → **Service Accounts** → Create → **Key (JSON)**.
2. Drive → **Shared drives** → buat/pilih → *Manage members* → tambahkan email service account sebagai **Content manager**.
3. Buat folder di dalam Shared Drive → `GDRIVE_FOLDER_ID`.
4. `GDRIVE_SA_BASE64=` hasil `base64 -w0 service-account.json` (atau `GDRIVE_SA_JSON=` satu baris).
5. `npm run check:drive` → harus menampilkan `driveId` dan *Upload OK*.

### Umum
`GDRIVE_PUBLIC_LINKS=true` → foto diberi izin *anyone with link (reader)* sehingga `<img>` memuat langsung dari `drive.google.com/thumbnail` **tanpa lewat server** (ringan). Jika kebijakan Workspace melarang link publik, set `false` → foto dilayani lewat `/api/attachments/[id]`.
Foto dikompresi **di browser** (maks 1600px, JPEG 0.82 — bisa diubah di Settings) sebelum diunggah, lalu disimpan ke sub-folder `YYYY-MM` di Drive.

---

## 5. Deploy ke Vercel

1. Push folder ini ke repo GitHub (`.env` dan `service-account.json` sudah di `.gitignore`).
2. Vercel → New Project → import repo. Framework terdeteksi Next.js; region `sin1` sudah di `vercel.json`.
3. Environment Variables (Production + Preview):
   `DATABASE_URL`, `AUTH_SECRET` (≥32 karakter acak), `AUTH_SESSION_DAYS`, `STORAGE_DRIVER=gdrive`, `GDRIVE_FOLDER_ID`, `GDRIVE_PUBLIC_LINKS`, dan kredensial Drive sesuai mode: `GDRIVE_OAUTH_CLIENT_ID` + `GDRIVE_OAUTH_CLIENT_SECRET` + `GDRIVE_OAUTH_REFRESH_TOKEN` (mode A) atau `GDRIVE_SA_BASE64` (mode B).
4. Deploy. Build menjalankan `prisma generate && next build`.
5. Jalankan sekali dari laptop (menunjuk DB produksi): `npm run db:push && npm run db:collation && npm run db:seed`.
6. Cek `https://<app>.vercel.app/api/health` → `{"ok":true,"db":"up"}`.

---

## 6. Struktur

```
prisma/schema.prisma      8 model: divisions, categories, users, findings, finding_actions,
                          attachments, app_settings, counters
src/middleware.ts         proteksi rute + paksa ganti password
src/lib/                  auth (cookie JWT jose + scrypt), drive (Google Drive/local), settings, numbering, validate
src/server/               findings (include/transisi status), stats (dashboard & KPI)
src/app/api/              auth, findings, findings/[id]/actions, upload, attachments, master, users, settings, dashboard
src/app/(app)/            dashboard, temuan, kpi, settings, akun  (shell + sidebar)
src/components/ui/        data-table (sort/filter/resize/kartu), modal (dialog/bottom sheet), toast, chip, theme-toggle
src/components/findings/  photo-upload (kompresi + Drive), camera-modal (webcam di laptop; HP pakai kamera bawaan), action-form (alur approval)
src/app/globals.css       seluruh token IEG Design System v3.1 (Morning/Evening)
scripts-dev/              hanya untuk verifikasi di lingkungan tanpa engine Prisma — tidak dipakai produksi
```

### Catatan untuk sesi pengembangan berikutnya
- Semua tabel memakai `DataTable` (`src/components/ui/data-table.tsx`): sort (shift+klik bertingkat), filter per kolom (9 operator, `;` multi nilai, wildcard `*`), lebar kolom ditarik (pointer events, `<col>`), tampilan tersimpan di `localStorage['ieg-grid:<id>']`, kartu di <768px dengan `data-label`.
- Jangan tulis hex di komponen — pakai token `var(--…)` / kelas Tailwind yang sudah dipetakan.
- `@tailwind utilities` sengaja ditaruh **di akhir** `globals.css` supaya utilitas (`hidden`, `md:inline-flex`, `!h-9`) menang atas kelas komponen.
