import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { bool, email as parseEmail, handleApiError, oneOf, optStr, str, ValidationError } from '@/lib/validate';

const ROLES = ['ADMIN', 'PIC', 'VIEWER'] as const;

/** Daftar pengguna. Non-admin hanya mendapat daftar ringkas PIC aktif (untuk assign). */
export async function GET(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  const divisionId = new URL(req.url).searchParams.get('divisionId') || undefined;
  if (u.role === 'ADMIN' && !divisionId) {
    const rows = await prisma.user.findMany({
      orderBy: [{ name: 'asc' }],
      select: { id: true, email: true, name: true, role: true, divisionId: true, phone: true, active: true, mustChangePassword: true, lastLoginAt: true, createdAt: true, division: { select: { id: true, name: true, code: true } } },
    });
    return Response.json({ rows });
  }
  const rows = await prisma.user.findMany({
    where: { active: true, role: { in: ['ADMIN', 'PIC'] }, ...(divisionId ? { divisionId } : {}) },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, divisionId: true, role: true },
  });
  return Response.json({ rows });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const b = await req.json();
    const email = parseEmail(b.email);
    const name = str(b.name, 'Nama', { min: 2, max: 120 });
    const role = oneOf(b.role, 'Peran', ROLES, 'PIC');
    const divisionId = optStr(b.divisionId, 'Divisi');
    const phone = optStr(b.phone, 'Telepon', 32);
    const password = str(b.password, 'Password', { max: 200 });
    const weak = validatePasswordStrength(password);
    if (weak) throw new ValidationError(weak);
    if (divisionId) {
      const d = await prisma.division.findUnique({ where: { id: divisionId } });
      if (!d) throw new ValidationError('Divisi tidak ditemukan');
    }
    if (role === 'PIC' && !divisionId) throw new ValidationError('PIC harus punya divisi');
    const row = await prisma.user.create({
      data: { email, name, role, divisionId, phone, passwordHash: hashPassword(password), mustChangePassword: bool(b.mustChangePassword, true) },
      select: { id: true, email: true, name: true, role: true },
    });
    return Response.json(row, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
