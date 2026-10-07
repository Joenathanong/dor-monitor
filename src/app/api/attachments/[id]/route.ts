import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile, readFileStream } from '@/lib/drive';
import { handleApiError } from '@/lib/validate';

export const runtime = 'nodejs';

/** Proxy foto bila file tidak publik (atau driver local). File publik dilayani langsung dari Drive. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  const { id } = await ctx.params;
  const a = await prisma.attachment.findUnique({ where: { id } });
  if (!a) return new Response('Not found', { status: 404 });
  if (a.driver === 'gdrive' && a.isPublic) {
    const thumb = new URL(req.url).searchParams.get('thumb');
    return Response.redirect(`https://drive.google.com/thumbnail?id=${encodeURIComponent(a.fileId)}&sz=w${thumb ? 400 : 1600}`, 302);
  }
  try {
    const { body, mimeType } = await readFileStream(a.driver, a.fileId);
    return new Response(body as BodyInit, {
      headers: {
        'Content-Type': mimeType || a.mimeType,
        'Cache-Control': 'private, max-age=86400',
        'Content-Disposition': `inline; filename="${a.fileName}"`,
      },
    });
  } catch (e) {
    return new Response(`Gagal membaca file: ${(e as Error).message}`, { status: 502 });
  }
}

/** Hapus lampiran yang belum terhubung (saat user membatalkan form) atau oleh admin/pengunggah. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const { id } = await ctx.params;
    const a = await prisma.attachment.findUnique({ where: { id } });
    if (!a) return Response.json({ ok: true });
    if (!(u.role === 'ADMIN' || a.uploaderId === u.id)) return Response.json({ error: 'Tidak punya akses' }, { status: 403 });
    if (a.findingId && u.role !== 'ADMIN' && a.uploaderId !== u.id) return Response.json({ error: 'Tidak punya akses' }, { status: 403 });
    await prisma.attachment.delete({ where: { id } });
    deleteFile(a.driver, a.fileId).catch((e) => console.warn('Hapus file Drive gagal:', (e as Error).message));
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
