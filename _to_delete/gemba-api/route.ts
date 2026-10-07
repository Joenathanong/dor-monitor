import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { nextNumber } from '@/lib/numbering';
import { getSettings } from '@/lib/settings';
import { dateOrNull, handleApiError, optStr, str, ValidationError } from '@/lib/validate';

export async function GET() {
  const u = await apiUser();
  if (isResponse(u)) return u;
  const rows = await prisma.gembaSession.findMany({
    orderBy: { scheduledAt: 'desc' },
    include: { leader: { select: { id: true, name: true } }, division: { select: { id: true, name: true, code: true } }, _count: { select: { findings: true } } },
    take: 500,
  });
  return Response.json({ rows });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const settings = await getSettings();
    if (!settings.gembaEnabled) throw new ValidationError('Modul Gemba dinonaktifkan');
    if (!(u.role === 'ADMIN' || u.isGembaTeam)) throw new ValidationError('Hanya tim Gemba (QA/QC) yang boleh membuat sesi Gemba');
    const b = await req.json();
    const title = str(b.title, 'Judul', { min: 3, max: 160 });
    const area = str(b.area, 'Area', { min: 2, max: 160 });
    const scheduledAt = dateOrNull(b.scheduledAt, 'Jadwal') ?? new Date();
    const participants = optStr(b.participants, 'Peserta', 512);
    const notes = optStr(b.notes, 'Catatan', 5000);
    let divisionId = u.divisionId;
    if (u.role === 'ADMIN' && b.divisionId) divisionId = str(b.divisionId, 'Divisi');
    if (!divisionId) {
      const d = await prisma.division.findFirst({ where: { isGembaTeam: true, active: true }, orderBy: { sortOrder: 'asc' } });
      if (!d) throw new ValidationError('Belum ada divisi bertanda tim Gemba di Settings');
      divisionId = d.id as string;
    }
    const number = await nextNumber('GEMBA');
    const s = await prisma.gembaSession.create({
      data: { number, title, area, scheduledAt, participants, notes, leaderId: u.id, divisionId },
    });
    return Response.json({ id: s.id, number: s.number }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
