/* Ambil REFRESH TOKEN Google Drive (mode OAuth) + buat folder tujuan — jalankan SEKALI di laptop:
 *   npm run drive:auth
 * Prasyarat di .env: GDRIVE_OAUTH_CLIENT_ID dan GDRIVE_OAUTH_CLIENT_SECRET
 * (OAuth Client ID tipe "Desktop app" dari Google Cloud Console → APIs & Services → Credentials).
 *
 * Scope yang diminta = drive.file (hanya file/folder yang dibuat app ini). Scope ini TIDAK
 * butuh verifikasi Google (tidak ada layar "Akses diblokir") dan refresh token-nya permanen.
 * Karena itu folder tujuan HARUS dibuat oleh app → skrip ini membuatnya dan mencetak ID-nya. */
import './load-env';
import http from 'node:http';
import { google } from 'googleapis';

const PORT = 53682;
const FOLDER_NAME = process.env.GDRIVE_FOLDER_NAME?.trim() || 'DOR Bukti Foto';
const clientId = process.env.GDRIVE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GDRIVE_OAUTH_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error('Isi dulu GDRIVE_OAUTH_CLIENT_ID dan GDRIVE_OAUTH_CLIENT_SECRET di .env');
  process.exit(1);
}
const oauth = new google.auth.OAuth2(clientId, clientSecret, `http://localhost:${PORT}/callback`);
const url = oauth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // paksa Google mengirim refresh_token walau sudah pernah consent
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

async function ensureFolder(): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: oauth });
  const q = `name = '${FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await drive.files.list({ q, fields: 'files(id,name)', pageSize: 1 });
  const existing = found.data.files?.[0];
  if (existing?.id) { console.log(`Folder "${FOLDER_NAME}" sudah ada (dibuat app ini).`); return existing.id; }
  const created = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  console.log(`Folder "${FOLDER_NAME}" dibuat di My Drive.`);
  return created.data.id!;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://localhost:${PORT}`);
  if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
  const code = u.searchParams.get('code');
  if (!code) { res.writeHead(400).end('Tidak ada code: ' + (u.searchParams.get('error') || '')); return; }
  try {
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Berhasil. Kembali ke terminal, salin 2 baris ke .env lalu tutup tab ini.</h2>');
    if (!tokens.refresh_token) {
      console.log('Refresh token kosong — cabut akses app di https://myaccount.google.com/permissions lalu ulangi.');
    } else {
      const folderId = await ensureFolder();
      console.log('\n=== SALIN KE .env ===');
      console.log(`GDRIVE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(`GDRIVE_FOLDER_ID=${folderId}`);
      console.log('=====================\n');
      console.log('Folder lama yang dibuat manual TIDAK bisa dipakai (scope drive.file) — pakai ID di atas.');
    }
  } catch (e) {
    res.writeHead(500).end('Gagal: ' + (e as Error).message);
    console.error('Gagal:', (e as Error).message);
  } finally {
    setTimeout(() => { server.close(); process.exit(0); }, 500);
  }
});

server.listen(PORT, () => {
  console.log('Buka URL ini di browser dan login dengan akun Google tempat foto akan disimpan:\n');
  console.log(url + '\n');
  console.log(`Menunggu callback di http://localhost:${PORT}/callback …`);
  import('node:child_process').then(({ exec }) => {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  });
});
