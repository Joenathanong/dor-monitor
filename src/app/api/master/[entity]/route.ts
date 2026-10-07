// Master data dinamis: divisions & categories (ADMIN untuk tulis; semua user boleh baca).
import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bool, handleApiError, int, optStr, str, ValidationError } from '@/lib/validate';
import { slugCode } from '@/lib/utils';

type Entity = 'divisions' | 'categories';
function entity(e: string): Entity {
  if (e === 'divisions' || e === 'categories') return e;
  throw new ValidationError('Entitas tidak dikenal');
}

export async function GET(req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const e = entity((await ctx.params).entity);
    const all = new URL(req.url).searchParams.get('all') === '1';
    const where = all ? {} : { active: true };
    const rows =
      e === 'divisions'
        ? await prisma.division.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { users: true, assignedFindings: true } } } })
        : await prisma.category.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { findings: true } } } });
    return Response.json({ rows });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ entity: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const e = entity((await ctx.params).entity);
    const b = await req.json();
    const name = str(b.name, 'Nama', { min: 2, max: 100 });
    const code = b.code ? slugCode(str(b.code, 'Kode', { max: 32 })) : slugCode(name);
    if (!code) throw new ValidationError('Kode tidak valid');
    const color = optStr(b.color, 'Warna', 16);
    const sortOrder = int(b.sortOrder, 'Urutan', { fallback: 0 });
    const row =
      e === 'divisions'
        ? await prisma.division.create({ data: { code, name, color, sortOrder, description: optStr(b.description, 'Deskripsi', 255), isGembaTeam: bool(b.isGembaTeam) } })
        : await prisma.category.create({ data: { code, name, color, sortOrder } });
    return Response.json(row, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
