'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { StatusChip, PriorityChip, Chip, Spinner } from '@/components/ui/primitives';
import { api } from '@/lib/api-client';
import { fmtDate, isOverdue, relativeDays, SOURCE_LABEL } from '@/lib/utils';
import type { FindingStatus, Priority } from '@prisma/client';

export type FindingListRow = {
  id: string; number: string; source: 'DOR' | 'GEMBA'; title: string; location: string | null; priority: Priority; status: FindingStatus;
  reportedAt: string; dueAt: string; firstActionAt: string | null; doneAt: string | null;
  category: { id: string; name: string; color: string | null };
  reporter: { id: string; name: string };
  reporterDivision: { id: string; name: string; code: string } | null;
  assignedDivision: { id: string; name: string; code: string; color: string | null };
  assignee: { id: string; name: string } | null;
  attachments: { id: string }[];
  _count: { actions: number };
};

type Scope = 'all' | 'mine' | 'division';
type StatusFilter = 'active' | 'awaiting' | 'resolved' | 'overdue' | 'all';

export function FindingsTable({ divisions, canCreate, hasDivision, initialStatus = 'active', initialScope = 'all', fixedQuery, tableId = 'findings' }: {
  divisions: { id: string; name: string }[];
  canCreate: boolean;
  hasDivision: boolean;
  initialStatus?: StatusFilter;
  initialScope?: Scope;
  fixedQuery?: Record<string, string>;
  tableId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FindingListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [divisionId, setDivisionId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const p = new URLSearchParams({ ...(fixedQuery || {}) });
    if (status === 'overdue') p.set('overdue', '1'); else if (status !== 'all') p.set('status', status);
    if (scope !== 'all') p.set('scope', scope);
    if (divisionId) p.set('divisionId', divisionId);
    api<{ rows: FindingListRow[] }>(`/api/findings?${p}`)
      .then((d) => { if (alive) { setRows(d.rows); setErr(null); } })
      .catch((e) => { if (alive) setErr((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status, scope, divisionId, fixedQuery]);

  const columns = useMemo<ColumnDef<FindingListRow>[]>(() => [
    { key: 'number', label: 'Nomor', width: 130, mono: true, hideInCard: true, value: (r) => r.number, render: (r) => <Link href={`/temuan/${r.id}`} className="text-primary font-semibold" onClick={(e) => e.stopPropagation()}>{r.number}</Link> },
    { key: 'title', label: 'Judul', width: 280, title: true, value: (r) => r.title, render: (r) => (
      <span className="flex items-center gap-2 min-w-0">
        <span className="truncate">{r.title}</span>
        <span className="md:hidden text-xs font-mono text-label">{r.number}</span>
      </span>
    ) },
    { key: 'status', label: 'Status', width: 110, value: (r) => r.status, render: (r) => (
      <span className="flex gap-1 flex-wrap">
        <StatusChip status={r.status} />
        {isOverdue(r) && <Chip tone="negative">Terlambat {Math.abs(relativeDays(r.dueAt))} hr</Chip>}
      </span>
    ) },
    { key: 'division', label: 'Divisi PJ', width: 140, value: (r) => r.assignedDivision.name },
    { key: 'assignee', label: 'PIC', width: 140, priority: 2, value: (r) => r.assignee?.name ?? '' },
    { key: 'category', label: 'Kategori', width: 110, value: (r) => r.category.name },
    { key: 'priority', label: 'Prioritas', width: 100, priority: 2, value: (r) => ({ HIGH: 3, MEDIUM: 2, LOW: 1 }[r.priority]), type: 'number', render: (r) => <PriorityChip priority={r.priority} /> },
    { key: 'reportedAt', label: 'Dilaporkan', width: 120, type: 'date', mono: true, value: (r) => r.reportedAt, render: (r) => fmtDate(r.reportedAt) },
    { key: 'dueAt', label: 'Batas TL', width: 120, type: 'date', mono: true, value: (r) => r.dueAt, render: (r) => fmtDate(r.dueAt) },
    { key: 'source', label: 'Sumber', width: 90, priority: 3, value: (r) => SOURCE_LABEL[r.source] },
    { key: 'reporter', label: 'Pelapor', width: 140, priority: 3, value: (r) => r.reporter.name },
    { key: 'location', label: 'Lokasi', width: 140, priority: 3, value: (r) => r.location ?? '' },
    { key: 'actions', label: 'TL', width: 60, priority: 3, align: 'right', type: 'number', value: (r) => r._count.actions },
  ], []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="seg" role="tablist" aria-label="Status">
          {([['active', 'Aktif'], ['overdue', 'Terlambat'], ['awaiting', 'Tunggu approval'], ['resolved', 'Closed'], ['all', 'Semua']] as const).map(([k, l]) => (
            <button key={k} type="button" className={status === k ? 'is-active' : ''} onClick={() => setStatus(k)} role="tab" aria-selected={status === k}>{l}</button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="Cakupan">
          <button type="button" className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>Semua</button>
          <button type="button" className={scope === 'mine' ? 'is-active' : ''} onClick={() => setScope('mine')}>Saya</button>
          {hasDivision && <button type="button" className={scope === 'division' ? 'is-active' : ''} onClick={() => setScope('division')}>Divisi saya</button>}
        </div>
        <select className="select !w-auto !h-9 !text-sm" value={divisionId} onChange={(e) => setDivisionId(e.target.value)} aria-label="Filter divisi">
          <option value="">Semua divisi PJ</option>
          {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {loading && <Spinner className="w-4 h-4 text-label" />}
        {canCreate && (
          <Link href="/temuan/baru" className="btn btn-primary ml-auto hidden md:inline-flex"><Plus /> Temuan baru</Link>
        )}
      </div>
      {err && <div className="alert alert-negative">{err}</div>}
      <DataTable id={tableId} columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/temuan/${r.id}`)} emptyText={loading ? 'Memuat…' : 'Tidak ada temuan'} />
    </div>
  );
}
