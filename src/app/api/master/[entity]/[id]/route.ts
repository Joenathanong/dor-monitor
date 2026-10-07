import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bool, handleApiError, int, optStr, str, ValidationError } from '@/lib/validate';
import { slugCode } from '@/lib/utils';

export async function PATCH(req: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const { entity, id } = await ctx.params;
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = str(b.name, 'Nama', { min: 2, max: 100 });
    if (b.code !== undefined) data.code = slugCode(str(b.code, 'Kode', { max: 32 }));
    if (b.color !== undefined) data.color = optStr(b.color, 'Warna', 16);
    if (b.sortOrder !== undefined) data.sortOrder = int(b.sortOrder, 'Urutan', { fallback: 0 });
    if (b.active !== undefined) data.active = bool(b.active, true);
    if (entity === 'divisions') {
      if (b.description !== undefined) data.description = optStr(b.description, 'Deskripsi', 255);
      if (b.isGembaTeam !== undefined) data.isGembaTeam = bool(b.isGembaTeam);
      await prisma.division.update({ where: { id }, data });
    } else if (entity === 'categories') {
      await prisma.category.update({ where: { id }, data });
    } else throw new ValidationError('Entitas tidak dikenal');
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const { entity, id } = await ctx.params;
    if (entity === 'divisions') {
      const used = await prisma.finding.count({ where: { OR: [{ assignedDivisionId: id }, { reporterDivisionId: id }] } });
      const users = await prisma.user.count({ where: { divisionId: id } });
      if (used || users) throw new ValidationError('Divisi masih dipakai (temuan/pengguna). Nonaktifkan saja.');
      await prisma.division.delete({ where: { id } });
    } else if (entity === 'categories') {
      const used = await prisma.finding.count({ where: { categoryId: id } });
      if (used) throw new ValidationError('Kategori masih dipakai temuan. Nonaktifkan saja.');
      await prisma.category.delete({ where: { id } });
    } else throw new ValidationError('Entitas tidak dikenal');
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
