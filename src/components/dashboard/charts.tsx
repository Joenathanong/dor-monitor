// Komponen chart ringan tanpa library — mengikuti palet chart design-ocs §4
// (warna seri = entitas, bukan peringkat; satu sumbu; label langsung ≤4 seri).
import { fmtNumber, fmtPct } from '@/lib/utils';

const SLOT = (slot?: string | null, fallback = 'var(--c-other)') => (slot && /^c[1-6]$/.test(slot) ? `var(--${slot})` : fallback);

export function KpiTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'positive' | 'negative' | 'critical' | 'informative' }) {
  const color = tone ? `var(--${tone})` : 'var(--ink)';
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-label mt-1">{sub}</div>}
    </div>
  );
}

/** Bar horizontal per kelompok: total vs selesai (dua segmen), label nilai langsung. */
export function GroupBars({ rows, href }: { rows: { id: string; name: string; color: string | null; total: number; resolved: number; awaiting?: number; active: number; overdue: number; pct: number }[]; href?: (id: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <div className="text-sm text-label">Belum ada data.</div>;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const w = (r.total / max) * 100;
        const wRes = r.total ? (r.resolved / r.total) * w : 0;
        const label = href ? <a href={href(r.id)} className="truncate text-primary">{r.name}</a> : <span className="truncate">{r.name}</span>;
        return (
          <div key={r.id} className="bar-row">
            <span className="flex items-center gap-2 min-w-0 text-[13px]"><span className="dot" style={{ background: SLOT(r.color) }} />{label}</span>
            <div className="bar-track relative" title={`${r.resolved} selesai dari ${r.total}`}>
              <div className="bar-fill absolute left-0 top-0" style={{ width: `${w}%`, background: SLOT(r.color), opacity: 0.28 }} />
              <div className="bar-fill absolute left-0 top-0" style={{ width: `${wRes}%`, background: SLOT(r.color) }} />
            </div>
            <span className="tabular text-xs text-label whitespace-nowrap"><b className="text-ink">{fmtNumber(r.resolved)}</b>/{fmtNumber(r.total)} · {fmtPct(r.pct, 0)}{r.awaiting ? <span className="text-primary"> · {r.awaiting} approval</span> : null}{r.overdue ? <span className="text-negative"> · {r.overdue} telat</span> : null}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Ring({ pct, color = 'var(--c2)', label, size = 120 }: { pct: number; color?: string; label?: string; size?: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <div className="ring" style={{ ['--p' as string]: p, ['--ring-color' as string]: color, width: size, height: size }} />
        <div className="ring-label">{fmtPct(p, 0)}</div>
      </div>
      {label && <div className="text-xs text-label text-center">{label}</div>}
    </div>
  );
}

/** Tren harian: dua seri (dilaporkan vs selesai) sebagai bar berdampingan. Maks 2 seri di HP. */
export function TrendBars({ data }: { data: { date: string; reported: number; resolved: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.reported, d.resolved)));
  const show = data.length > 16 ? data.slice(-16) : data;
  return (
    <div>
      <div className="flex items-end gap-[3px] h-[140px] md:h-[160px] border-b border-strong">
        {show.map((d) => (
          <div key={d.date} className="flex-1 min-w-0 flex items-end gap-[2px] h-full" title={`${d.date}: ${d.reported} dilaporkan, ${d.resolved} selesai`}>
            <div className="flex-1 rounded-t-sm" style={{ height: `${(d.reported / max) * 100}%`, background: 'var(--c1)', minHeight: d.reported ? 2 : 0 }} />
            <div className="flex-1 rounded-t-sm" style={{ height: `${(d.resolved / max) * 100}%`, background: 'var(--c2)', minHeight: d.resolved ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {show.map((d, i) => (
          <div key={d.date} className="flex-1 min-w-0 text-[10px] text-center text-label tabular truncate">{i % 2 === 0 || show.length <= 8 ? d.date.slice(8) : ''}</div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-label">
        <span className="flex items-center gap-1"><span className="dot" style={{ background: 'var(--c1)' }} /> Dilaporkan</span>
        <span className="flex items-center gap-1"><span className="dot" style={{ background: 'var(--c2)' }} /> Closed</span>
      </div>
    </div>
  );
}

export function StackedStatus({ open, inProgress, done, closed, cancelled }: { open: number; inProgress: number; done: number; closed: number; cancelled: number }) {
  const total = open + inProgress + done + closed + cancelled || 1;
  const segs: Array<[string, number, string]> = [['Open', open, 'var(--critical-solid)'], ['Proses', inProgress, 'var(--informative)'], ['Menunggu approval', done, 'var(--accent-violet)'], ['Closed', closed, 'var(--positive-solid)'], ['Batal', cancelled, 'var(--border-strong)']];
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--chart-track)]">
        {segs.map(([l, n, c]) => n > 0 && <div key={l} style={{ width: `${(n / total) * 100}%`, background: c }} title={`${l}: ${n}`} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-label">
        {segs.map(([l, n, c]) => <span key={l} className="flex items-center gap-1"><span className="dot" style={{ background: c }} /> {l} <b className="text-ink tabular">{n}</b></span>)}
      </div>
    </div>
  );
}
