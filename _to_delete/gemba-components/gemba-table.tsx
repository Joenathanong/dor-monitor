'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Chip } from '@/components/ui/primitives';
import { fmtDateTime, GEMBA_STATUS_LABEL, GEMBA_STATUS_TONE } from '@/lib/utils';
import type { GembaStatus } from '@prisma/client';

export type GembaRow = { id: string; number: string; title: string; area: string; status: GembaStatus; scheduledAt: string; completedAt: string | null; leader: string; division: string; participants: string | null; total: number; open: number };

export function GembaTable({ rows }: { rows: GembaRow[] }) {
  const router = useRouter();
  const columns = useMemo<ColumnDef<GembaRow>[]>(() => [
    { key: 'number', label: 'Nomor', width: 140, mono: true, hideInCard: true, value: (r) => r.number, render: (r) => <Link href={`/gemba/${r.id}`} className="text-primary font-semibold" onClick={(e) => e.stopPropagation()}>{r.number}</Link> },
    { key: 'title', label: 'Judul', width: 260, title: true, value: (r) => r.title, render: (r) => <span className="flex items-center gap-2 min-w-0"><span className="truncate">{r.title}</span><span className="md:hidden text-xs font-mono text-label">{r.number}</span></span> },
    { key: 'status', label: 'Status', width: 110, value: (r) => r.status, render: (r) => <Chip tone={GEMBA_STATUS_TONE[r.status]}>{GEMBA_STATUS_LABEL[r.status]}</Chip> },
    { key: 'scheduledAt', label: 'Jadwal', width: 150, type: 'date', mono: true, value: (r) => r.scheduledAt, render: (r) => fmtDateTime(r.scheduledAt) },
    { key: 'area', label: 'Area', width: 160, value: (r) => r.area },
    { key: 'total', label: 'Temuan', width: 80, align: 'right', type: 'number', value: (r) => r.total },
    { key: 'open', label: 'Belum selesai', width: 110, align: 'right', type: 'number', value: (r) => r.open, render: (r) => r.open ? <span className="text-negative font-semibold">{r.open}</span> : '0' },
    { key: 'leader', label: 'Pemimpin', width: 140, priority: 2, value: (r) => r.leader },
    { key: 'division', label: 'Tim', width: 110, priority: 3, value: (r) => r.division },
    { key: 'participants', label: 'Peserta', width: 200, priority: 3, value: (r) => r.participants ?? '' },
  ], []);
  return <DataTable id="gemba" columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/gemba/${r.id}`)} emptyText="Belum ada sesi Gemba" />;
}
