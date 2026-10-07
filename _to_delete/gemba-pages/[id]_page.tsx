import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { Chip } from '@/components/ui/primitives';
import { FindingsTable } from '@/components/findings/findings-table';
import { GembaStatusControl } from '@/components/gemba/gemba-status-control';
import { fmtDateTime, GEMBA_STATUS_LABEL, GEMBA_STATUS_TONE } from '@/lib/utils';
import type { GembaStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function GembaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const [s, settings, divisions] = await Promise.all([
    prisma.gembaSession.findUnique({ where: { id }, include: { leader: { select: { id: true, name: true } }, division: { select: { id: true, name: true } }, _count: { select: { findings: true } } } }),
    getSettings(),
    prisma.division.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!s) notFound();
  const canManage = u.role === 'ADMIN' || s.leaderId === u.id || (u.isGembaTeam && u.divisionId === s.divisionId);
  const canAddFinding = settings.gembaEnabled && canManage && s.status !== 'COMPLETED';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/gemba" className="btn btn-ghost btn-icon btn-sm" aria-label="Kembali"><ArrowLeft /></Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono text-label">{s.number}</div>
          <h1 className="page-title !text-lg md:!text-2xl">{s.title}</h1>
        </div>
        <Chip tone={GEMBA_STATUS_TONE[s.status as GembaStatus]}>{GEMBA_STATUS_LABEL[s.status as GembaStatus]}</Chip>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="card grid gap-3 sm:grid-cols-2 text-sm">
            <div><div className="text-xs text-label">Area</div><div className="font-semibold">{s.area}</div></div>
            <div><div className="text-xs text-label">Jadwal</div><div>{fmtDateTime(s.scheduledAt)}</div></div>
            <div><div className="text-xs text-label">Tim / pemimpin</div><div>{s.division.name} · {s.leader.name}</div></div>
            <div><div className="text-xs text-label">Peserta</div><div>{s.participants || '—'}</div></div>
            {s.startedAt && <div><div className="text-xs text-label">Mulai</div><div>{fmtDateTime(s.startedAt)}</div></div>}
            {s.completedAt && <div><div className="text-xs text-label">Selesai</div><div>{fmtDateTime(s.completedAt)}</div></div>}
            {s.notes && <div className="sm:col-span-2"><div className="text-xs text-label">Catatan</div><p className="whitespace-pre-wrap">{s.notes}</p></div>}
          </div>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Temuan sesi ini ({s._count.findings})</h2>
            {canAddFinding && <Link href={`/gemba/${s.id}/temuan`} className="btn btn-primary"><Plus /> Catat temuan</Link>}
          </div>
          <FindingsTable divisions={divisions} canCreate={false} hasDivision={!!u.divisionId} initialStatus="all" fixedQuery={{ gembaSessionId: s.id }} tableId="gemba-findings" />
        </div>
        <aside className="flex flex-col gap-4">
          {canManage && <GembaStatusControl id={s.id} status={s.status} isAdmin={u.role === 'ADMIN'} openFindings={0} />}
        </aside>
      </div>
    </div>
  );
}
