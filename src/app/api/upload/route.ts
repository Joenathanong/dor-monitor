import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { storeFile } from '@/lib/drive';
import { handleApiError, ValidationError } from '@/lib/validate';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 6 * 1024 * 1024; // client sudah mengompresi ke ±≤1.5 MB; ini pagar terakhir

/** Unggah 1 foto → Google Drive → baris Attachment (belum terhubung ke temuan).
 *  Client menghubungkannya saat membuat temuan / tindak lanjut lewat attachmentIds. */
export async function POST(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role === 'VIEWER') return Response.json({ error: 'Viewer tidak bisa mengunggah' }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ValidationError('File tidak ditemukan');
    if (!ALLOWED.has(file.type)) throw new ValidationError('Hanya JPG, PNG, atau WebP');
    if (file.size > MAX_BYTES) throw new ValidationError('Ukuran foto maksimal 6 MB');
    const width = Number(form.get('width')) || null;
    const height = Number(form.get('height')) || null;

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `DOR_${stamp}_${u.name.replace(/[^A-Za-z0-9]+/g, '').slice(0, 12)}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const stored = await storeFile(buf, fileName, file.type);
    const att = await prisma.attachment.create({
      data: {
        uploaderId: u.id,
        driver: stored.driver,
        fileId: stored.fileId,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        size: stored.size,
        width,
        height,
        isPublic: stored.isPublic,
        webViewUrl: stored.webViewUrl,
      },
    });
    return Response.json({ id: att.id, driver: att.driver, fileId: att.fileId, isPublic: att.isPublic, fileName: att.fileName, mimeType: att.mimeType, size: att.size }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message || '';
    if (/GDRIVE_|Service account|storageQuotaExceeded|insufficient/i.test(msg)) {
      console.error('Upload Drive gagal:', msg);
      return Response.json({ error: `Google Drive belum siap: ${msg}` }, { status: 502 });
    }
    return handleApiError(e);
  }
}
