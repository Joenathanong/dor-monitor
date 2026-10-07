import 'server-only';
import type { FindingStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { CurrentUser } from '@/lib/auth';
import { ValidationError } from '@/lib/validate';

export const findingInclude = {
  category: true,
  reporter: { select: { id: true, name: true, email: true } },
  reporterDivision: { select: { id: true, code: true, name: true, color: true } },
  assignedDivision: { select: { id: true, code: true, name: true, color: true } },
  assignee: { select: { id: true, name: true, email: true } },
  attachments: { where: { actionId: null }, orderBy: { createdAt: 'asc' as const } },
  _count: { select: { actions: true } },
} satisfies Prisma.FindingInclude;

export type FindingRow = Prisma.FindingGetPayload<{ include: typeof findingInclude }>;

export const findingDetailInclude = {
  ...findingInclude,
  closedBy: { select: { id: true, name: true } },
  actions: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { id: true, name: true } }, attachments: { orderBy: { createdAt: 'asc' as const } } },
  },
} satisfies Prisma.FindingInclude;

export type FindingDetail = Prisma.FindingGetPayload<{ include: typeof findingDetailInclude }>;

export type ListFilter = {
  status?: FindingStatus[] | 'active' | 'awaiting' | 'resolved';
  divisionId?: string;
  categoryId?: string;
  source?: 'DOR' | 'GEMBA';
  from?: Date;
  to?: Date;
  scope?: 'all' | 'mine' | 'division';
  overdue?: boolean;
};

export function buildWhere(u: CurrentUser, f: ListFilter): Prisma.FindingWhereInput {
  const where: Prisma.FindingWhereInput = {};
  if (f.status === 'active') where.status = { in: ['OPEN', 'IN_PROGRESS'] };
  else if (f.status === 'awaiting') where.status = 'DONE';
  else if (f.status === 'resolved') where.status = 'CLOSED';
  else if (Array.isArray(f.status) && f.status.length) where.status = { in: f.status };
  if (f.divisionId) where.assignedDivisionId = f.divisionId;
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.source) where.source = f.source;
  if (f.from || f.to) where.reportedAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  if (f.overdue) {
    where.status = { in: ['OPEN', 'IN_PROGRESS'] };
    where.firstActionAt = null;
    where.dueAt = { lt: new Date() };
  }
  if (f.scope === 'mine') {
    where.OR = [{ reporterId: u.id }, { assigneeId: u.id }];
  } else if (f.scope === 'division' && u.divisionId) {
    where.OR = [{ assignedDivisionId: u.divisionId }, { reporterDivisionId: u.divisionId }];
  }
  return where;
}

export async function listFindings(u: CurrentUser, f: ListFilter, take = 1000) {
  return prisma.finding.findMany({ where: buildWhere(u, f), include: findingInclude, orderBy: [{ reportedAt: 'desc' }], take });
}

export async function getFinding(id: string) {
  return prisma.finding.findUnique({ where: { id }, include: findingDetailInclude });
}

/** Transisi status yang diizinkan + siapa yang boleh. */
export function assertTransition(u: CurrentUser, f: { status: FindingStatus; reporterId: string; assignedDivisionId: string; assigneeId: string | null }, to: FindingStatus) {
  const isAdmin = u.role === 'ADMIN';
  const isReporter = f.reporterId === u.id;
  const isOwner = f.assigneeId === u.id || (!!u.divisionId && f.assignedDivisionId === u.divisionId);
  const from = f.status;
  if (from === to) return;
  // DONE = PIC mengajukan selesai (wajib foto bukti) → pelapor APPROVE (CLOSED) atau TOLAK (IN_PROGRESS, revisi).
  const allowed: Record<FindingStatus, FindingStatus[]> = {
    OPEN: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
    IN_PROGRESS: ['DONE', 'OPEN', 'CANCELLED'],
    DONE: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: ['OPEN'],
    CANCELLED: ['OPEN'],
  };
  if (!allowed[from].includes(to)) throw new ValidationError(`Status ${from} tidak bisa diubah ke ${to}`);
  if (to === 'DONE' || (to === 'IN_PROGRESS' && from !== 'DONE')) {
    if (!(isAdmin || isOwner || isReporter)) throw new ValidationError('Hanya PIC divisi penanggung jawab yang boleh mengubah status ini');
  }
  if (to === 'CLOSED' || to === 'CANCELLED' || from === 'CLOSED' || from === 'CANCELLED') {
    if (!(isAdmin || isReporter)) throw new ValidationError('Hanya pelapor (yang meng-assign) atau Admin yang boleh approve/membatalkan/membuka kembali temuan');
  }
  if (from === 'DONE' && to === 'IN_PROGRESS') {
    if (!(isAdmin || isReporter)) throw new ValidationError('Hanya pelapor atau Admin yang boleh menolak dan meminta revisi');
  }
}
