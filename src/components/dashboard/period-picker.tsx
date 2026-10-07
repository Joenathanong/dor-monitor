'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const PERIODS: Array<[string, string]> = [['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini'], ['30d', '30 hari'], ['year', 'Tahun ini'], ['all', 'Semua']];

export function PeriodPicker({ divisions, showDivision = true }: { divisions?: { id: string; name: string }[]; showDivision?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const period = sp.get('period') || 'month';
  const divisionId = sp.get('divisionId') || '';
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    router.replace(`${pathname}?${p}`);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="seg overflow-x-auto max-w-full" role="tablist" aria-label="Periode">
        {PERIODS.map(([k, l]) => (
          <button key={k} type="button" className={period === k ? 'is-active' : ''} onClick={() => update({ period: k, from: '', to: '' })} role="tab" aria-selected={period === k}>{l}</button>
        ))}
        <button type="button" className={period === 'custom' ? 'is-active' : ''} onClick={() => update({ period: 'custom' })}>Pilih tanggal</button>
      </div>
      {period === 'custom' && (
        <div className="flex gap-2 items-center">
          <input type="date" className="input !w-auto !h-9 !text-sm" value={from} onChange={(e) => update({ from: e.target.value })} aria-label="Dari" />
          <span className="text-label">–</span>
          <input type="date" className="input !w-auto !h-9 !text-sm" value={to} onChange={(e) => update({ to: e.target.value })} aria-label="Sampai" />
        </div>
      )}
      {showDivision && divisions && (
        <select className="select !w-auto !h-9 !text-sm" value={divisionId} onChange={(e) => update({ divisionId: e.target.value })} aria-label="Divisi">
          <option value="">Semua divisi</option>
          {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
    </div>
  );
}
