import { apiUser, isResponse, canManageFinding } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, oneOf, optStr, str, ValidationError } from '@/lib/validate';
import { getFinding } from '@/server/findings';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  const { id } = await ctx.params;
  const f = await getFinding(id);
  if (!f) return Response.json({ error: 'Temuan tidak ditemukan' }, { status: 404 });
  return Response.json(f);
}

/** Edit data temuan (bukan status — status lewat /actions). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const { id } = await ctx.params;
    const f = await prisma.finding.findUnique({ where: { id } });
    if (!f) return Response.json({ error: 'Temuan tidak ditemukan' }, { status: 404 });
    const isAdmin = u.role === 'ADMIN';
    const isReporter = f.reporterId === u.id;
    if (!canManageFinding(u, f)) return Response.json({ error: 'Tidak punya akses' }, { status: 403 });

    const b = await req.json();
    const data: Record<string, unknown> = {};
    // Pelapor/admin boleh mengubah isi temuan
    if (isAdmin || isReporter) {
      if (b.title !== undefined) data.title = str(b.title, 'Judul', { min: 3, max: 200 });
      if (b.description !== undefined) data.description = str(b.description, 'Keterangan', { min: 3, max: 5000 });
      if (b.location !== undefined) data.location = optStr(b.location, 'Lokasi', 160);
      if (b.categoryId !== undefined) {
        const c = await prisma.category.findFirst({ where: { id: str(b.categoryId, 'Kategori'), active: true } });
        if (!c) throw new ValidationError('Kategori tidak ditemukan');
        data.categoryId = c.id;
      }
      if (b.priority !== undefined) data.priority = oneOf(b.priority, 'Prioritas', PRIORITIES);
    }
    // Reassign: admin, pelapor, atau divisi penanggung jawab saat ini
    if (b.assignedDivisionId !== undefined || b.assigneeId !== undefined) {
      const divId = b.assignedDivisionId !== undefined ? str(b.assignedDivisionId, 'Divisi') : f.assignedDivisionId;
      const d = await prisma.division.findFirst({ where: { id: divId, active: true } });
      if (!d) throw new ValidationError('Divisi tidak ditemukan');
      const assigneeId = b.assigneeId !== undefined ? optStr(b.assigneeId, 'PIC') : f.assigneeId;
      if (assigneeId) {
        const a = await prisma.user.findFirst({ where: { id: assigneeId, active: true } });
        if (!a || a.divisionId !== divId) throw new ValidationError('PIC bukan anggota divisi tersebut');
      }
      const changed = divId !== f.assignedDivisionId || assigneeId !== f.assigneeId;
      data.assignedDivisionId = divId;
      data.assigneeId = assigneeId;
      if (changed) {
        await prisma.findingAction.create({
          data: { findingId: id, userId: u.id, type: 'REASSIGN', note: `Dialihkan ke ${d.name}${assigneeId ? ' (PIC ditentukan)' : ''}` },
        });
      }
    }
    // Root cause & resolusi boleh diisi divisi penanggung jawab
    if (b.rootCause !== undefined) data.rootCause = optStr(b.rootCause, 'Akar masalah', 5000);
    if (b.resolution !== undefined) data.resolution = optStr(b.resolution, 'Resolusi', 5000);

    const updated = await prisma.finding.update({ where: { id }, data });
    return Response.json({ ok: true, id: updated.id });
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
    const actions = await prisma.findingAction.findMany({ where: { findingId: id }, select: { id: true } });
    await prisma.attachment.deleteMany({ where: { OR: [{ findingId: id }, { actionId: { in: actions.map((a: (typeof actions)[number]) => a.id) } }] } });
    await prisma.findingAction.deleteMany({ where: { findingId: id } });
    await prisma.finding.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
