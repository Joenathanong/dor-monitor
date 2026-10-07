import 'server-only';
import type { FindingStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type Period = { from: Date; to: Date; label: string };

export function resolvePeriod(key: string | undefined, from?: string | null, to?: string | null): Period {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  switch (key) {
    case 'today': return { from: start, to: end, label: 'Hari ini' };
    case 'week': { const s = new Date(start); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return { from: s, to: end, label: 'Minggu ini' }; }
    case '7d': { const s = new Date(start); s.setDate(s.getDate() - 6); return { from: s, to: end, label: '7 hari terakhir' }; }
    case '30d': { const s = new Date(start); s.setDate(s.getDate() - 29); return { from: s, to: end, label: '30 hari terakhir' }; }
    case 'year': return { from: new Date(now.getFullYear(), 0, 1), to: end, label: `Tahun ${now.getFullYear()}` };
    case 'all': return { from: new Date(2000, 0, 1), to: end, label: 'Semua' };
    case 'custom': {
      const f = from ? new Date(from) : start; const t = to ? new Date(to) : end; t.setHours(23, 59, 59, 999);
      return { from: f, to: t, label: `${f.toLocaleDateString('id-ID')} – ${t.toLocaleDateString('id-ID')}` };
    }
    case 'month':
    default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end, label: 'Bulan ini' };
  }
}

type Row = {
  id: string; status: FindingStatus; source: 'DOR' | 'GEMBA'; priority: string;
  reportedAt: Date; dueAt: Date; firstActionAt: Date | null; doneAt: Date | null; closedAt: Date | null;
  assignedDivisionId: string; categoryId: string;
};

export type GroupStat = { id: string; name: string; code?: string; color: string | null; total: number; resolved: number; awaiting: number; active: number; overdue: number; onTime: number; late: number; pending: number; rate: number | null; pct: number };

export type Stats = {
  period: Period;
  total: number; resolved: number; awaiting: number; active: number; open: number; inProgress: number; cancelled: number; done: number; closed: number;
  pctResolved: number; overdue: number; dueToday: number;
  kpi: { onTime: number; late: number; pending: number; rate: number | null; slaDays: number };
  avgResolutionDays: number | null; avgFirstActionHours: number | null;
  bySource: { DOR: number; GEMBA: number };
  byPriority: Record<string, number>;
  byDivision: GroupStat[];
  byCategory: GroupStat[];
  trend: { date: string; reported: number; resolved: number }[];
  activeNow: number; overdueNow: number; // tanpa filter periode (kondisi saat ini)
};

function kpiOf(rows: Row[], now: Date) {
  let onTime = 0, late = 0, pending = 0;
  for (const r of rows) {
    if (r.status === 'CANCELLED') continue;
    if (r.firstActionAt) {
      if (r.firstActionAt.getTime() <= r.dueAt.getTime()) onTime++; else late++;
    } else if (r.dueAt.getTime() < now.getTime()) late++;
    else pending++;
  }
  const judged = onTime + late;
  return { onTime, late, pending, rate: judged ? (onTime / judged) * 100 : null };
}

const isResolved = (s: FindingStatus) => s === 'CLOSED'; // hanya yang sudah di-approve pelapor
const isActive = (s: FindingStatus) => s === 'OPEN' || s === 'IN_PROGRESS';
const isOverdue = (r: Row, now: Date) => isActive(r.status) && !r.firstActionAt && r.dueAt.getTime() < now.getTime();

export async function computeStats(period: Period, opts: { divisionId?: string; slaDays: number; where?: Prisma.FindingWhereInput } = { slaDays: 2 }): Promise<Stats> {
  const now = new Date();
  const where: Prisma.FindingWhereInput = { reportedAt: { gte: period.from, lte: period.to }, ...(opts.divisionId ? { assignedDivisionId: opts.divisionId } : {}), ...(opts.where ?? {}) };
  const [rows, divisions, categories, activeNow, overdueNow] = await Promise.all([
    prisma.finding.findMany({ where, select: { id: true, status: true, source: true, priority: true, reportedAt: true, dueAt: true, firstActionAt: true, doneAt: true, closedAt: true, assignedDivisionId: true, categoryId: true } }),
    prisma.division.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.finding.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, ...(opts.divisionId ? { assignedDivisionId: opts.divisionId } : {}) } }),
    prisma.finding.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, firstActionAt: null, dueAt: { lt: now }, ...(opts.divisionId ? { assignedDivisionId: opts.divisionId } : {}) } }),
  ]);
  const data = rows as Row[];

  const total = data.length;
  const resolved = data.filter((r) => isResolved(r.status)).length;
  const cancelled = data.filter((r) => r.status === 'CANCELLED').length;
  const done = data.filter((r) => r.status === 'DONE').length;
  const closed = data.filter((r) => r.status === 'CLOSED').length;
  const open = data.filter((r) => r.status === 'OPEN').length;
  const inProgress = data.filter((r) => r.status === 'IN_PROGRESS').length;
  const active = open + inProgress;
  const overdue = data.filter((r) => isOverdue(r, now)).length;
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const dueToday = data.filter((r) => isActive(r.status) && !r.firstActionAt && r.dueAt >= now && r.dueAt <= endToday).length;
  const denominator = total - cancelled;
  const pctResolved = denominator ? (resolved / denominator) * 100 : 0;

  const resDurations = data.filter((r) => r.status === 'CLOSED' && r.closedAt).map((r) => (r.closedAt!.getTime() - r.reportedAt.getTime()) / 86400000);
  const faDurations = data.filter((r) => r.firstActionAt).map((r) => (r.firstActionAt!.getTime() - r.reportedAt.getTime()) / 3600000);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const group = (keyOf: (r: Row) => string, list: { id: string; name: string; code?: string; color: string | null }[]): GroupStat[] =>
    list.map((g) => {
      const rs = data.filter((r) => keyOf(r) === g.id);
      const k = kpiOf(rs, now);
      const t = rs.length, res = rs.filter((r) => isResolved(r.status)).length, can = rs.filter((r) => r.status === 'CANCELLED').length;
      return { id: g.id, name: g.name, code: g.code, color: g.color, total: t, resolved: res, awaiting: rs.filter((r) => r.status === 'DONE').length, active: rs.filter((r) => isActive(r.status)).length, overdue: rs.filter((r) => isOverdue(r, now)).length, ...k, pct: t - can ? (res / (t - can)) * 100 : 0 };
    }).filter((g) => g.total > 0 || list.length <= 8);

  const byPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of data) byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;

  // tren harian (maks 31 hari terakhir dari periode)
  const days: { date: string; reported: number; resolved: number }[] = [];
  const spanDays = Math.min(31, Math.max(1, Math.ceil((period.to.getTime() - period.from.getTime()) / 86400000)));
  const tStart = new Date(period.to); tStart.setHours(0, 0, 0, 0); tStart.setDate(tStart.getDate() - spanDays + 1);
  const keyOfDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  for (let i = 0; i < spanDays; i++) { const d = new Date(tStart); d.setDate(d.getDate() + i); days.push({ date: keyOfDate(d), reported: 0, resolved: 0 }); }
  const idx = new Map(days.map((d, i) => [d.date, i]));
  for (const r of data) {
    const i = idx.get(keyOfDate(r.reportedAt)); if (i !== undefined) days[i]!.reported++;
    if (r.status === 'CLOSED' && r.closedAt) { const j = idx.get(keyOfDate(r.closedAt)); if (j !== undefined) days[j]!.resolved++; }
  }

  return {
    period, total, resolved, awaiting: done, active, open, inProgress, cancelled, done, closed, pctResolved, overdue, dueToday,
    kpi: { ...kpiOf(data, now), slaDays: opts.slaDays },
    avgResolutionDays: avg(resDurations), avgFirstActionHours: avg(faDurations),
    bySource: { DOR: data.filter((r) => r.source === 'DOR').length, GEMBA: data.filter((r) => r.source === 'GEMBA').length },
    byPriority,
    byDivision: group((r) => r.assignedDivisionId, divisions),
    byCategory: group((r) => r.categoryId, categories),
    trend: days,
    activeNow, overdueNow,
  };
}
