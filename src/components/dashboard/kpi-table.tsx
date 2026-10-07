'use client';
import { useMemo } from 'react';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { ColorDot } from '@/components/ui/primitives';
import { fmtPct } from '@/lib/utils';

type Row = { id: string; name: string; color: string | null; total: number; resolved: number; awaiting: number; active: number; overdue: number; onTime: number; late: number; pending: number; rate: number | null; pct: number; reported: number };

export function KpiTable({ rows }: { rows: Row[] }) {
  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { key: 'name', label: 'Divisi', width: 160, title: true, value: (r) => r.name, render: (r) => <span className="flex items-center gap-2"><ColorDot slot={r.color} /> {r.name}</span> },
    { key: 'rate', label: 'Tepat waktu', width: 110, align: 'right', type: 'number', value: (r) => r.rate ?? -1, render: (r) => r.rate === null ? <span className="muted">—</span> : <b style={{ color: r.rate >= 90 ? 'var(--positive)' : r.rate >= 70 ? 'var(--critical)' : 'var(--negative)' }}>{fmtPct(r.rate, 1)}</b> },
    { key: 'onTime', label: 'Tepat', width: 70, align: 'right', type: 'number', value: (r) => r.onTime },
    { key: 'late', label: 'Terlambat', width: 90, align: 'right', type: 'number', value: (r) => r.late, render: (r) => r.late ? <span className="text-negative font-semibold">{r.late}</span> : '0' },
    { key: 'pending', label: 'Dalam batas', width: 100, align: 'right', type: 'number', priority: 2, value: (r) => r.pending },
    { key: 'total', label: 'Ditugaskan', width: 100, align: 'right', type: 'number', value: (r) => r.total },
    { key: 'resolved', label: 'Closed', width: 80, align: 'right', type: 'number', value: (r) => r.resolved },
    { key: 'awaiting', label: 'Tunggu approval', width: 120, align: 'right', type: 'number', priority: 2, value: (r) => r.awaiting },
    { key: 'pct', label: '% closed', width: 90, align: 'right', type: 'number', value: (r) => r.pct, render: (r) => fmtPct(r.pct, 0) },
    { key: 'active', label: 'Aktif', width: 70, align: 'right', type: 'number', priority: 2, value: (r) => r.active },
    { key: 'overdue', label: 'Telat (aktif)', width: 100, align: 'right', type: 'number', priority: 2, value: (r) => r.overdue },
    { key: 'reported', label: 'Melaporkan', width: 100, align: 'right', type: 'number', priority: 3, value: (r) => r.reported },
  ], []);
  return <DataTable id="kpi-division" columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={100} />;
}
