import type { FindingStatus } from '@prisma/client';
import { apiUser, isResponse, canManageFinding } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, oneOf, str, ValidationError } from '@/lib/validate';
import { assertTransition } from '@/server/findings';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CLOSED', 'CANCELLED'] as const;

/** Tambah tindak lanjut / komentar / perubahan status. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role === 'VIEWER') return Response.json({ error: 'Viewer hanya bisa melihat' }, { status: 403 });
  try {
    const { id } = await ctx.params;
    const f = await prisma.finding.findUnique({ where: { id } });
    if (!f) return Response.json({ error: 'Temuan tidak ditemukan' }, { status: 404 });

    const b = await req.json();
    const type = oneOf(b.type, 'Jenis', ['ACTION', 'COMMENT'] as const, 'ACTION');
    const note = str(b.note, 'Catatan', { min: 2, max: 5000 });
    const toStatus = b.toStatus ? oneOf(b.toStatus, 'Status', STATUSES) : null;
    const attachmentIds: string[] = Array.isArray(b.attachmentIds) ? b.attachmentIds.filter((x: unknown) => typeof x === 'string') : [];

    // Komentar boleh oleh siapa saja yang login; tindak lanjut hanya pihak terkait
    if (type === 'ACTION' && !canManageFinding(u, f)) {
      throw new ValidationError('Hanya PIC divisi penanggung jawab, pelapor, atau Admin yang boleh menambah tindak lanjut');
    }
    if (f.status === 'CLOSED' || f.status === 'CANCELLED') {
      if (!(toStatus === 'OPEN')) throw new ValidationError('Temuan sudah ditutup. Buka kembali dulu untuk menambah tindak lanjut.');
    }

    if (toStatus === 'DONE' && attachmentIds.length === 0) {
      throw new ValidationError('Untuk mengajukan selesai, lampirkan minimal 1 foto bukti perbaikan');
    }
    if (toStatus === 'IN_PROGRESS' && f.status === 'DONE' && note.trim().length < 5) {
      throw new ValidationError('Tuliskan alasan penolakan / apa yang harus direvisi');
    }

    let finalStatus: FindingStatus = f.status;
    if (toStatus) {
      assertTransition(u, f, toStatus);
      finalStatus = toStatus;
    } else if (type === 'ACTION' && f.status === 'OPEN') {
      finalStatus = 'IN_PROGRESS'; // tindak lanjut pertama otomatis → Proses
    }

    const now = new Date();
    const action = await prisma.findingAction.create({
      data: {
        findingId: id,
        userId: u.id,
        type: toStatus && toStatus !== f.status && type !== 'ACTION' ? 'STATUS' : type,
        note,
        fromStatus: finalStatus !== f.status ? f.status : null,
        toStatus: finalStatus !== f.status ? finalStatus : null,
      },
    });
    if (attachmentIds.length) {
      await prisma.attachment.updateMany({
        where: { id: { in: attachmentIds }, uploaderId: u.id, findingId: null, actionId: null },
        data: { actionId: action.id, findingId: id },
      });
    }

    const data: Record<string, unknown> = { status: finalStatus };
    const countsAsFollowUp = type === 'ACTION' || (toStatus && ['IN_PROGRESS', 'DONE'].includes(toStatus));
    if (countsAsFollowUp && !f.firstActionAt) data.firstActionAt = now;
    if (finalStatus === 'DONE' && f.status !== 'DONE') data.doneAt = now;
    if (finalStatus === 'CLOSED') { data.closedAt = now; data.closedById = u.id; if (!f.doneAt) data.doneAt = now; }
    if (finalStatus === 'CANCELLED') { data.closedAt = now; data.closedById = u.id; }
    if (finalStatus === 'OPEN' && (f.status === 'CLOSED' || f.status === 'CANCELLED')) { data.closedAt = null; data.closedById = null; data.doneAt = null; }
    if (finalStatus === 'IN_PROGRESS' && f.status === 'DONE') data.doneAt = null;
    await prisma.finding.update({ where: { id }, data });

    return Response.json({ ok: true, actionId: action.id, status: finalStatus }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
