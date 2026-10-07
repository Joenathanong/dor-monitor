import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { computeStats, resolvePeriod } from '@/server/stats';
import { PeriodPicker } from '@/components/dashboard/period-picker';
import { KpiTile, Ring } from '@/components/dashboard/charts';
import { KpiTable } from '@/components/dashboard/kpi-table';
import { fmtNumber, fmtPct } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function KpiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const period = resolvePeriod(sp.period, sp.from, sp.to);
  const stats = await computeStats(period, { slaDays: settings.slaDays });
  // KPI per divisi juga sebagai PELAPOR (keaktifan menemukan)
  const reporterCounts = await prisma.finding.groupBy({ by: ['reporterDivisionId'], where: { reportedAt: { gte: period.from, lte: period.to } }, _count: { _all: true } });
  const reportedBy = new Map<string, number>(reporterCounts.map((r: (typeof reporterCounts)[number]) => [r.reporterDivisionId ?? '', r._count._all] as const));
  const rows = stats.byDivision.map((d) => ({ ...d, reported: reportedBy.get(d.id) ?? 0 }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="page-title">KPI</h1>
        <div className="text-sm text-label mt-1">{period.label} · Target: setiap temuan ditindaklanjuti ≤ {settings.slaDays} hari{settings.slaCountWeekend ? ' kalender' : ' kerja'}</div>
      </div>
      <Suspense fallback={null}><PeriodPicker showDivision={false} /></Suspense>

      <div className="kpi-grid">
        <KpiTile label="Tingkat tepat waktu" value={stats.kpi.rate === null ? '—' : fmtPct(stats.kpi.rate, 1)} tone={stats.kpi.rate === null ? undefined : stats.kpi.rate >= 90 ? 'positive' : stats.kpi.rate >= 70 ? 'critical' : 'negative'} sub={`${stats.kpi.onTime} tepat · ${stats.kpi.late} terlambat`} />
        <KpiTile label="Tingkat penyelesaian" value={fmtPct(stats.pctResolved, 1)} tone="positive" sub={`${fmtNumber(stats.resolved)} dari ${fmtNumber(stats.total - stats.cancelled)}`} />
        <KpiTile label="Rata-rata TL pertama" value={stats.avgFirstActionHours === null ? '—' : stats.avgFirstActionHours < 48 ? `${stats.avgFirstActionHours.toFixed(1)} jam` : `${(stats.avgFirstActionHours / 24).toFixed(1)} hr`} />
        <KpiTile label="Rata-rata penyelesaian" value={stats.avgResolutionDays === null ? '—' : `${stats.avgResolutionDays.toFixed(1)} hr`} />
      </div>

      <div className="card">
        <div className="card-title mb-3">Per divisi</div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-4">
          {rows.filter((r) => r.total > 0).map((r) => (
            <Ring key={r.id} pct={r.rate ?? 0} size={96} color={r.rate === null ? 'var(--c-other)' : r.rate >= 90 ? 'var(--c2)' : r.rate >= 70 ? 'var(--c5)' : 'var(--c4)'} label={`${r.name} (${r.onTime}/${r.onTime + r.late})`} />
          ))}
        </div>
        <KpiTable rows={rows} />
      </div>

      <div className="card text-sm text-label">
        <div className="card-title text-ink mb-2">Cara hitung</div>
        <p><b className="text-ink">Tepat waktu</b> = tindak lanjut pertama dicatat sebelum batas (tanggal lapor + SLA). <b className="text-ink">Terlambat</b> = tindak lanjut pertama lewat batas, atau belum ada tindak lanjut padahal batas sudah lewat. <b className="text-ink">Masih dalam batas</b> = belum ada tindak lanjut tapi batas belum lewat (tidak masuk pembagi). Temuan yang dibatalkan tidak dihitung. Batas waktu disimpan pada setiap temuan saat dibuat, jadi mengubah SLA di Settings hanya berlaku untuk temuan baru.</p>
      </div>
    </div>
  );
}
