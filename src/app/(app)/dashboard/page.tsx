import Link from 'next/link';
import { Suspense } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { computeStats, resolvePeriod } from '@/server/stats';
import { PeriodPicker } from '@/components/dashboard/period-picker';
import { KpiTile, GroupBars, Ring, TrendBars, StackedStatus } from '@/components/dashboard/charts';
import { Chip, StatusChip } from '@/components/ui/primitives';
import { fmtNumber, fmtPct, fmtDate, relativeDays } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const period = resolvePeriod(sp.period, sp.from, sp.to);
  const divisionId = sp.divisionId || undefined;
  const stats = await computeStats(period, { divisionId, slaDays: settings.slaDays });
  const [divisions, urgent] = await Promise.all([
    prisma.division.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.finding.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, firstActionAt: null, ...(divisionId ? { assignedDivisionId: divisionId } : {}) },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: { assignedDivision: { select: { name: true } }, assignee: { select: { name: true } } },
    }),
  ]);
  const hasData = stats.total > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="text-sm text-label mt-1">{period.label}{divisionId ? ` · ${divisions.find((d: (typeof divisions)[number]) => d.id === divisionId)?.name ?? ''}` : ''} · SLA tindak lanjut {settings.slaDays} hari</div>
        </div>
        {u.role !== 'VIEWER' && <Link href="/temuan/baru" className="btn btn-primary"><Plus /> Temuan baru</Link>}
      </div>
      <Suspense fallback={null}><PeriodPicker divisions={divisions} /></Suspense>

      {sp.denied && <div className="alert alert-critical">Halaman itu hanya untuk Admin.</div>}

      <div className="kpi-grid">
        <KpiTile label="Total temuan" value={fmtNumber(stats.total)} sub={<>DOR {stats.bySource.DOR} · Gemba {stats.bySource.GEMBA}</>} />
        <KpiTile label="Terselesaikan (Closed)" value={fmtNumber(stats.resolved)} tone="positive" sub={`${fmtPct(stats.pctResolved, 1)} dari ${stats.total - stats.cancelled} temuan valid`} />
        <KpiTile label="Belum selesai" value={fmtNumber(stats.active + stats.awaiting)} tone={stats.active + stats.awaiting ? 'critical' : undefined} sub={`Open ${stats.open} · Proses ${stats.inProgress} · Menunggu approval ${stats.awaiting}`} />
        <KpiTile label="Terlambat ditindaklanjuti" value={fmtNumber(stats.overdue)} tone={stats.overdue ? 'negative' : undefined} sub={stats.dueToday ? `${stats.dueToday} jatuh tempo hari ini` : 'belum ada TL lewat batas'} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card flex flex-col gap-3">
          <div className="card-title">Penyelesaian</div>
          <div className="flex items-center gap-4 flex-wrap">
            <Ring pct={stats.pctResolved} label="Terselesaikan" />
            <div className="flex-1 min-w-[160px]">
              <StackedStatus open={stats.open} inProgress={stats.inProgress} done={stats.done} closed={stats.closed} cancelled={stats.cancelled} />
              <div className="text-xs text-label mt-3">Rata-rata penyelesaian: <b className="text-ink">{stats.avgResolutionDays === null ? '—' : `${stats.avgResolutionDays.toFixed(1)} hari`}</b></div>
            </div>
          </div>
        </div>
        <div className="card flex flex-col gap-3">
          <div className="card-title">KPI tindak lanjut ≤ {settings.slaDays} hari</div>
          <div className="flex items-center gap-4 flex-wrap">
            <Ring pct={stats.kpi.rate ?? 0} color={stats.kpi.rate === null ? 'var(--c-other)' : stats.kpi.rate >= 90 ? 'var(--c2)' : stats.kpi.rate >= 70 ? 'var(--c5)' : 'var(--c4)'} label="Tepat waktu" />
            <div className="flex-1 min-w-[160px] text-sm flex flex-col gap-1">
              <div className="flex justify-between"><span className="text-label">Tepat waktu</span><b className="tabular text-positive">{stats.kpi.onTime}</b></div>
              <div className="flex justify-between"><span className="text-label">Terlambat</span><b className="tabular text-negative">{stats.kpi.late}</b></div>
              <div className="flex justify-between"><span className="text-label">Masih dalam batas</span><b className="tabular">{stats.kpi.pending}</b></div>
              <div className="text-xs text-label mt-2">Rata-rata TL pertama: <b className="text-ink">{stats.avgFirstActionHours === null ? '—' : stats.avgFirstActionHours < 48 ? `${stats.avgFirstActionHours.toFixed(1)} jam` : `${(stats.avgFirstActionHours / 24).toFixed(1)} hari`}</b></div>
              <Link href="/kpi" className="text-primary text-xs mt-1">Lihat KPI per divisi →</Link>
            </div>
          </div>
        </div>
        <div className="card flex flex-col gap-3 md:col-span-2 xl:col-span-1">
          <div className="card-title">Tren harian</div>
          {hasData ? <TrendBars data={stats.trend} /> : <div className="text-sm text-label">Belum ada temuan di periode ini.</div>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card flex flex-col gap-3">
          <div className="card-title">Per divisi penanggung jawab</div>
          <GroupBars rows={stats.byDivision} href={(id) => `/dashboard?period=${sp.period || 'month'}&divisionId=${id}`} />
        </div>
        <div className="card flex flex-col gap-3">
          <div className="card-title">Per kategori</div>
          <GroupBars rows={stats.byCategory} />
          <div className="flex gap-2 flex-wrap text-xs text-label mt-1">
            <span>Prioritas:</span>
            <Chip tone="negative">Tinggi {stats.byPriority.HIGH ?? 0}</Chip>
            <Chip tone="critical">Sedang {stats.byPriority.MEDIUM ?? 0}</Chip>
            <Chip tone="neutral">Rendah {stats.byPriority.LOW ?? 0}</Chip>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="card-title flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-critical" /> Perlu tindak lanjut segera</div>
          <Link href="/temuan?status=active" className="text-primary text-sm">Semua aktif ({stats.activeNow}) →</Link>
        </div>
        {urgent.length === 0 ? (
          <div className="text-sm text-label">Semua temuan aktif sudah ditindaklanjuti. 🎉</div>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {urgent.map((f: (typeof urgent)[number]) => {
              const d = relativeDays(f.dueAt);
              return (
                <li key={f.id} className="py-2 flex items-center gap-3 flex-wrap">
                  <Link href={`/temuan/${f.id}`} className="font-mono text-xs text-primary">{f.number}</Link>
                  <Link href={`/temuan/${f.id}`} className="flex-1 min-w-[160px] truncate font-medium">{f.title}</Link>
                  <span className="text-xs text-label">{f.assignedDivision.name}{f.assignee ? ` · ${f.assignee.name}` : ''}</span>
                  <StatusChip status={f.status} />
                  <Chip tone={d < 0 ? 'negative' : d === 0 ? 'critical' : 'informative'}>{d < 0 ? `Telat ${-d} hr` : d === 0 ? 'Hari ini' : `${d} hr lagi`} · {fmtDate(f.dueAt)}</Chip>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
