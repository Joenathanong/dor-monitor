// Sengaja TANPA `import 'server-only'` supaya bisa dipakai skrip CLI (scripts/check-drive.ts).
// Modul ini hanya diimpor dari route handler / server component, jadi tetap aman.
import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/* ── Lapisan penyimpanan foto bukti ──────────────────────────────────────────
 * STORAGE_DRIVER=gdrive → Google Drive Shared Drive via Service Account.
 *   Service account TIDAK punya kuota di My Drive biasa, jadi folder HARUS
 *   berada di dalam Shared Drive (Google Workspace) dan service account
 *   ditambahkan sebagai Content manager di Shared Drive tersebut.
 * STORAGE_DRIVER=local  → ./storage/uploads (hanya untuk dev di laptop).
 * ────────────────────────────────────────────────────────────────────────── */

export type StoredFile = {
  driver: 'gdrive' | 'local';
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  webViewUrl: string | null;
};

export function storageDriver(): 'gdrive' | 'local' {
  return process.env.STORAGE_DRIVER === 'local' ? 'local' : 'gdrive';
}

let driveClient: drive_v3.Drive | null = null;

export type DriveAuthMode = 'oauth' | 'service_account';

/** oauth bila GDRIVE_OAUTH_REFRESH_TOKEN diisi, selain itu service account. */
export function driveAuthMode(): DriveAuthMode {
  return process.env.GDRIVE_OAUTH_REFRESH_TOKEN?.trim() ? 'oauth' : 'service_account';
}

function loadServiceAccount(): { client_email: string; private_key: string } {
  let raw = process.env.GDRIVE_SA_JSON?.trim();
  if (!raw && process.env.GDRIVE_SA_BASE64) {
    raw = Buffer.from(process.env.GDRIVE_SA_BASE64, 'base64').toString('utf8');
  }
  if (!raw) throw new Error('GDRIVE_SA_JSON / GDRIVE_SA_BASE64 belum diisi (atau isi GDRIVE_OAUTH_* untuk mode OAuth)');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error('Service account JSON tidak valid');
  // Vercel kadang menyimpan \n sebagai literal
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
  return sa;
}

export function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient;
  if (driveAuthMode() === 'oauth') {
    // Mode OAuth: memakai akun Google user (My Drive biasa boleh, kuota milik user).
    const clientId = process.env.GDRIVE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GDRIVE_OAUTH_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GDRIVE_OAUTH_REFRESH_TOKEN?.trim();
    if (!clientId || !clientSecret) throw new Error('GDRIVE_OAUTH_CLIENT_ID / GDRIVE_OAUTH_CLIENT_SECRET belum diisi');
    const auth = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:53682/callback');
    auth.setCredentials({ refresh_token: refreshToken });
    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
  }
  const sa = loadServiceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export function getDriveFolderId(): string {
  const id = process.env.GDRIVE_FOLDER_ID?.trim();
  if (!id) throw new Error('GDRIVE_FOLDER_ID belum diisi');
  return id;
}

function publicLinks() {
  return process.env.GDRIVE_PUBLIC_LINKS !== 'false';
}

/** Sub-folder per bulan (YYYY-MM) supaya folder Drive tidak jadi satu tumpukan ribuan file. */
const folderCache = new Map<string, string>();
async function monthFolder(drive: drive_v3.Drive, parent: string, ym: string): Promise<string> {
  const cached = folderCache.get(ym);
  if (cached) return cached;
  const q = `name = '${ym}' and mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`;
  const found = await drive.files.list({
    q,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });
  let id = found.data.files?.[0]?.id ?? null;
  if (!id) {
    const created = await drive.files.create({
      requestBody: { name: ym, mimeType: 'application/vnd.google-apps.folder', parents: [parent] },
      fields: 'id',
      supportsAllDrives: true,
    });
    id = created.data.id!;
  }
  folderCache.set(ym, id);
  return id;
}

export async function storeFile(buf: Buffer, fileName: string, mimeType: string): Promise<StoredFile> {
  if (storageDriver() === 'local') {
    const dir = path.join(process.cwd(), 'storage', 'uploads');
    await fs.mkdir(dir, { recursive: true });
    const safe = `${Date.now()}-${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
    await fs.writeFile(path.join(dir, safe), buf);
    return { driver: 'local', fileId: safe, fileName, mimeType, size: buf.length, isPublic: false, webViewUrl: null };
  }

  const drive = getDrive();
  const root = getDriveFolderId();
  const ym = new Date().toISOString().slice(0, 7);
  const parent = await monthFolder(drive, root, ym);

  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [parent] },
    media: { mimeType, body: Readable.from(buf) },
    fields: 'id,webViewLink,size',
    supportsAllDrives: true,
  });
  const fileId = created.data.id!;
  let isPublic = false;
  if (publicLinks()) {
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
      isPublic = true;
    } catch (e) {
      // Shared Drive bisa melarang link publik — foto tetap bisa dilayani via proxy.
      console.warn('Gagal memberi izin publik, pakai proxy:', (e as Error).message);
    }
  }
  return {
    driver: 'gdrive',
    fileId,
    fileName,
    mimeType,
    size: Number(created.data.size ?? buf.length),
    isPublic,
    webViewUrl: created.data.webViewLink ?? null,
  };
}

export async function deleteFile(driver: string, fileId: string) {
  if (driver === 'local') {
    await fs.rm(path.join(process.cwd(), 'storage', 'uploads', fileId), { force: true });
    return;
  }
  await getDrive().files.delete({ fileId, supportsAllDrives: true });
}

/** Stream isi file (dipakai proxy /api/attachments/[id] bila file tidak publik). */
export async function readFileStream(driver: string, fileId: string): Promise<{ body: ReadableStream | Buffer; mimeType?: string }> {
  if (driver === 'local') {
    const buf = await fs.readFile(path.join(process.cwd(), 'storage', 'uploads', fileId));
    return { body: buf };
  }
  const res = await getDrive().files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  const nodeStream = res.data as unknown as Readable;
  return { body: Readable.toWeb(nodeStream) as ReadableStream, mimeType: res.headers['content-type'] as string | undefined };
}

/** URL gambar untuk <img>. Publik → langsung ke Google (ringan untuk server kita). */
export function attachmentUrl(a: { id: string; driver: string; fileId: string; isPublic: boolean }, size: 'thumb' | 'full' = 'full') {
  if (a.driver === 'gdrive' && a.isPublic) {
    const w = size === 'thumb' ? 400 : 1600;
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(a.fileId)}&sz=w${w}`;
  }
  return `/api/attachments/${a.id}`;
}
