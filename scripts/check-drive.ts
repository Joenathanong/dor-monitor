/* Uji koneksi Google Drive: npm run check:drive
 * Mengunggah file teks kecil ke GDRIVE_FOLDER_ID lalu menghapusnya lagi. */
import './load-env';

async function main() {
  const { getDrive, resolveRootFolder, driveAuthMode } = await import('../src/lib/drive');
  const mode = driveAuthMode();
  console.log('Mode auth:', mode === 'oauth' ? 'OAuth (akun Google user — My Drive boleh)' : 'Service account (folder HARUS di Shared Drive)');
  const drive = getDrive();
  const root = await resolveRootFolder(drive);
  const folderId = root.id;
  if (root.source !== 'env') console.log(`!! GDRIVE_FOLDER_ID tidak bisa dipakai — app memakai folder miliknya: GDRIVE_FOLDER_ID=${folderId}`);
  const meta = await drive.files.get({ fileId: folderId, fields: 'id,name,driveId,mimeType', supportsAllDrives: true });
  console.log('Folder:', meta.data.name, '| driveId:', meta.data.driveId ?? (mode === 'oauth' ? '(My Drive — OK untuk mode OAuth)' : '(BUKAN Shared Drive — upload akan gagal kuota!)'));
  const up = await drive.files.create({
    requestBody: { name: `dor-check-${Date.now()}.txt`, parents: [folderId] },
    media: { mimeType: 'text/plain', body: 'ok' },
    fields: 'id',
    supportsAllDrives: true,
  });
  console.log('Upload OK, id =', up.data.id);
  await drive.files.delete({ fileId: up.data.id!, supportsAllDrives: true });
  console.log('Hapus OK. Google Drive siap dipakai.');
}

main().catch((e) => {
  const msg = e?.response?.data?.error?.message ?? e?.message ?? e;
  console.error('GAGAL:', msg);
  if (/storageQuotaExceeded|quota/i.test(String(msg))) console.error('→ Folder bukan di Shared Drive. Pindahkan ke Shared Drive, atau pakai mode OAuth: isi GDRIVE_OAUTH_* lalu `npm run drive:auth`.');
  if (/File not found|notFound/i.test(String(msg))) console.error('→ GDRIVE_FOLDER_ID salah, atau service account belum diberi akses ke Shared Drive.');
  if (/invalid_grant|DECODER|PEM/i.test(String(msg))) console.error('→ GDRIVE_SA_JSON / GDRIVE_SA_BASE64 tidak valid (private_key rusak). Coba pakai BASE64.');
  process.exit(1);
});
