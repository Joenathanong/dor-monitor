import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dateOrNull, handleApiError, oneOf, optStr, str, ValidationError } from '@/lib/validate';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const { id } = await ctx.params;
    const s = await prisma.gembaSession.findUnique({ where: { id } });
    if (!s) return Response.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
    if (!(u.role === 'ADMIN' || s.leaderId === u.id || (u.isGembaTeam && u.divisionId === s.divisionId))) {
      throw new ValidationError('Tidak punya akses ke sesi ini');
    }
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.title !== undefined) data.title = str(b.title, 'Judul', { min: 3, max: 160 });
    if (b.area !== undefined) data.area = str(b.area, 'Area', { min: 2, max: 160 });
    if (b.scheduledAt !== undefined) data.scheduledAt = dateOrNull(b.scheduledAt, 'Jadwal') ?? s.scheduledAt;
    if (b.participants !== undefined) data.participants = optStr(b.participants, 'Peserta', 512);
    if (b.notes !== undefined) data.notes = optStr(b.notes, 'Catatan', 5000);
    if (b.status !== undefined) {
      const st = oneOf(b.status, 'Status', ['PLANNED', 'ONGOING', 'COMPLETED'] as const);
      data.status = st;
      if (st === 'ONGOING' && !s.startedAt) data.startedAt = new Date();
      if (st === 'COMPLETED') data.completedAt = new Date();
      if (st !== 'COMPLETED') data.completedAt = null;
    }
    await prisma.gembaSession.update({ where: { id }, data });
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const { id } = await ctx.params;
    const n = await prisma.finding.count({ where: { gembaSessionId: id } });
    if (n > 0) throw new ValidationError(`Sesi masih punya ${n} temuan — tidak bisa dihapus`);
    await prisma.gembaSession.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
