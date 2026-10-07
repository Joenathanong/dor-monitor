import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { bool, email as parseEmail, handleApiError, oneOf, optStr, str, ValidationError } from '@/lib/validate';

const ROLES = ['ADMIN', 'PIC', 'VIEWER'] as const;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const { id } = await ctx.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return Response.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.email !== undefined) data.email = parseEmail(b.email);
    if (b.name !== undefined) data.name = str(b.name, 'Nama', { min: 2, max: 120 });
    if (b.role !== undefined) data.role = oneOf(b.role, 'Peran', ROLES);
    if (b.divisionId !== undefined) data.divisionId = optStr(b.divisionId, 'Divisi');
    if (b.phone !== undefined) data.phone = optStr(b.phone, 'Telepon', 32);
    if (b.active !== undefined) {
      data.active = bool(b.active, true);
      if (!data.active && id === u.id) throw new ValidationError('Tidak bisa menonaktifkan akun sendiri');
    }
    if (b.password) {
      const weak = validatePasswordStrength(String(b.password));
      if (weak) throw new ValidationError(weak);
      data.passwordHash = hashPassword(String(b.password));
      data.mustChangePassword = true;
      data.sessionVersion = { increment: 1 };
    }
    if (b.forceLogout) data.sessionVersion = { increment: 1 };
    const role = (data.role as string) ?? target.role;
    const divisionId = b.divisionId !== undefined ? (data.divisionId as string | null) : target.divisionId;
    if (role === 'PIC' && !divisionId) throw new ValidationError('PIC harus punya divisi');
    if (role !== 'ADMIN' && id === u.id) throw new ValidationError('Tidak bisa menurunkan peran akun sendiri');
    await prisma.user.update({ where: { id }, data });
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
    if (id === u.id) throw new ValidationError('Tidak bisa menghapus akun sendiri');
    const used = await prisma.finding.count({ where: { OR: [{ reporterId: id }, { assigneeId: id }] } });
    const acts = await prisma.findingAction.count({ where: { userId: id } });
    if (used || acts) throw new ValidationError('Pengguna punya riwayat temuan — nonaktifkan saja, jangan dihapus');
    await prisma.user.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
