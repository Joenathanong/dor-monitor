import type { FindingStatus } from '@prisma/client';
import { apiUser, isResponse } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { nextNumber } from '@/lib/numbering';
import { computeDueAt, getSettings } from '@/lib/settings';
import { handleApiError, oneOf, optStr, str, ValidationError, dateOrNull } from '@/lib/validate';
import { listFindings, type ListFilter } from '@/server/findings';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CLOSED', 'CANCELLED'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export async function GET(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const p = new URL(req.url).searchParams;
    const statusParam = p.get('status');
    let status: ListFilter['status'];
    if (statusParam === 'active' || statusParam === 'awaiting' || statusParam === 'resolved') status = statusParam;
    else if (statusParam) status = statusParam.split(',').filter((s): s is FindingStatus => (STATUSES as readonly string[]).includes(s));
    const f: ListFilter = {
      status,
      divisionId: p.get('divisionId') || undefined,
      categoryId: p.get('categoryId') || undefined,
      source: (p.get('source') as 'DOR' | 'GEMBA') || undefined,
      from: dateOrNull(p.get('from'), 'Dari') ?? undefined,
      to: dateOrNull(p.get('to'), 'Sampai') ?? undefined,
      scope: (p.get('scope') as ListFilter['scope']) || 'all',
      overdue: p.get('overdue') === '1',
    };
    const rows = await listFindings(u, f);
    return Response.json({ rows });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role === 'VIEWER') return Response.json({ error: 'Viewer tidak bisa membuat temuan' }, { status: 403 });
  try {
    const b = await req.json();
    const title = str(b.title, 'Judul', { min: 3, max: 200 });
    const description = str(b.description, 'Keterangan', { min: 3, max: 5000 });
    const location = optStr(b.location, 'Lokasi', 160);
    const categoryId = str(b.categoryId, 'Kategori');
    const priority = oneOf(b.priority, 'Prioritas', PRIORITIES, 'MEDIUM');
    const assignedDivisionId = str(b.assignedDivisionId, 'Divisi penanggung jawab');
    const assigneeId = optStr(b.assigneeId, 'PIC');
    const source = oneOf(b.source, 'Sumber', ['DOR', 'GEMBA'] as const, 'DOR');
    const attachmentIds: string[] = Array.isArray(b.attachmentIds) ? b.attachmentIds.filter((x: unknown) => typeof x === 'string') : [];

    const [category, division, settings] = await Promise.all([
      prisma.category.findFirst({ where: { id: categoryId, active: true } }),
      prisma.division.findFirst({ where: { id: assignedDivisionId, active: true } }),
      getSettings(),
    ]);
    if (!category) throw new ValidationError('Kategori tidak ditemukan');
    if (!division) throw new ValidationError('Divisi tidak ditemukan');
    if (assigneeId) {
      const a = await prisma.user.findFirst({ where: { id: assigneeId, active: true } });
      if (!a) throw new ValidationError('PIC tidak ditemukan');
      if (a.divisionId !== assignedDivisionId) throw new ValidationError('PIC yang dipilih bukan anggota divisi penanggung jawab');
    }
    if (source === 'GEMBA' && !settings.gembaEnabled) throw new ValidationError('Pilihan sumber Gemba dinonaktifkan di Settings');

    const reportedAt = new Date();
    const number = await nextNumber(source === 'GEMBA' ? 'GMB' : 'DOR');
    const finding = await prisma.finding.create({
      data: {
        number,
        source,
        title,
        description,
        location,
        categoryId,
        priority,
        reporterId: u.id,
        reporterDivisionId: u.divisionId,
        assignedDivisionId,
        assigneeId,
        reportedAt,
        slaDays: settings.slaDays,
        dueAt: computeDueAt(reportedAt, settings.slaDays, settings.slaCountWeekend),
      },
    });
    if (attachmentIds.length) {
      await prisma.attachment.updateMany({
        where: { id: { in: attachmentIds }, uploaderId: u.id, findingId: null, actionId: null },
        data: { findingId: finding.id },
      });
    }
    return Response.json({ id: finding.id, number: finding.number }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
