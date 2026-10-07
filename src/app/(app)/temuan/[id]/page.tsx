import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Tag, Users, Calendar } from 'lucide-react';
import { requireUser, canManageFinding } from '@/lib/auth';
import { getFinding } from '@/server/findings';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { StatusChip, PriorityChip, Chip, Avatar } from '@/components/ui/primitives';
import { PhotoGrid } from '@/components/findings/photo-upload';
import { ActionForm } from '@/components/findings/action-form';
import { FindingAdminActions } from '@/components/findings/finding-admin-actions';
import { fmtDateTime, fmtDate, isOverdue, relativeDays, SOURCE_LABEL, STATUS_LABEL } from '@/lib/utils';
import type { FindingSource, FindingStatus, ActionType } from '@prisma/client';

export const dynamic = 'force-dynamic';

const TYPE_LABEL = { ACTION: 'Tindak lanjut', COMMENT: 'Komentar', STATUS: 'Status', REASSIGN: 'Pengalihan' } as const;

export default async function TemuanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const [f, settings] = await Promise.all([getFinding(id), getSettings()]);
  if (!f) notFound();
  const canAct = u.role !== 'VIEWER' && canManageFinding(u, f);
  const canVerify = u.role === 'ADMIN' || f.reporterId === u.id;
  const overdue = isOverdue(f);
  const daysLeft = relativeDays(f.dueAt);
  const [divisions, users] = canAct
    ? await Promise.all([
        prisma.division.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
        prisma.user.findMany({ where: { active: true, role: { in: ['PIC', 'ADMIN'] }, divisionId: { not: null } }, orderBy: { name: 'asc' }, select: { id: true, name: true, divisionId: true } }),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 flex-wrap">
        <Link href="/temuan" className="btn btn-ghost btn-icon btn-sm" aria-label="Kembali"><ArrowLeft /></Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono text-label">{f.number} · {SOURCE_LABEL[f.source as FindingSource]}</div>
          <h1 className="page-title !text-lg md:!text-2xl">{f.title}</h1>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <StatusChip status={f.status} />
          <PriorityChip priority={f.priority} />
          {overdue && <Chip tone="negative">Terlambat {Math.abs(daysLeft)} hari</Chip>}
          {!overdue && (f.status === 'OPEN' || f.status === 'IN_PROGRESS') && !f.firstActionAt && <Chip tone={daysLeft <= 0 ? 'critical' : 'informative'}>{daysLeft <= 0 ? 'Jatuh tempo hari ini' : `Sisa ${daysLeft} hari`}</Chip>}
        </div>
      </div>

      {f.status === 'DONE' && (
        <div className={`alert ${canVerify ? 'alert-informative' : 'alert-critical'}`}>
          {canVerify
            ? <><b>Menunggu approval Anda.</b> PIC sudah mengajukan selesai dengan bukti perbaikan. Periksa foto di riwayat, lalu <b>Setujui (Closed)</b> atau <b>Tolak &amp; minta revisi</b> di panel tindak lanjut.</>
            : <><b>Menunggu approval pelapor</b> ({f.reporter.name}). Temuan akan Closed setelah disetujui.</>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="card">
            <div className="card-title mb-2">Keterangan</div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{f.description}</p>
            {f.attachments.length > 0 && (
              <div className="mt-4">
                <div className="label">Foto bukti ({f.attachments.length})</div>
                <PhotoGrid photos={f.attachments} />
              </div>
            )}
            {(f.rootCause || f.resolution) && (
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                {f.rootCause && <div><div className="label">Akar masalah</div><p className="whitespace-pre-wrap text-sm">{f.rootCause}</p></div>}
                {f.resolution && <div><div className="label">Resolusi</div><p className="whitespace-pre-wrap text-sm">{f.resolution}</p></div>}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title mb-3">Riwayat tindak lanjut ({f.actions.length})</div>
            {f.actions.length === 0 ? (
              <div className="text-sm text-label">Belum ada tindak lanjut.</div>
            ) : (
              <div className="timeline">
                {f.actions.map((a: (typeof f.actions)[number], i: number) => (
                  <div key={a.id} className="tl-item">
                    <div className="tl-dot">{i + 1}</div>
                    <div className="tl-body">
                      <div className="tl-meta">
                        <b className="text-ink">{a.user.name}</b>
                        <span>·</span>
                        <span>{fmtDateTime(a.createdAt)}</span>
                        <Chip tone={a.type === 'ACTION' ? 'positive' : a.type === 'STATUS' ? 'informative' : 'neutral'}>{TYPE_LABEL[a.type as ActionType]}</Chip>
                        {a.toStatus && <span className="text-xs">{a.fromStatus ? STATUS_LABEL[a.fromStatus as FindingStatus] : ''} → <b>{STATUS_LABEL[a.toStatus as FindingStatus]}</b></span>}
                      </div>
                      <p className="whitespace-pre-wrap text-sm mt-1">{a.note}</p>
                      {a.attachments.length > 0 && <div className="mt-2"><PhotoGrid photos={a.attachments} /></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {u.role !== 'VIEWER' && (
            <ActionForm findingId={f.id} status={f.status} canAct={canAct} canVerify={canVerify} settings={settings} />
          )}
        </div>

        <aside className="flex flex-col gap-4 min-w-0">
          <div className="card flex flex-col gap-3 text-sm">
            <div className="card-title">Info</div>
            <Row icon={<Users />} label="Penanggung jawab">
              <div className="font-semibold">{f.assignedDivision.name}</div>
              <div className="text-label">{f.assignee ? f.assignee.name : 'Semua PIC divisi'}</div>
            </Row>
            <Row icon={<Calendar />} label="Dilaporkan">
              <div>{fmtDateTime(f.reportedAt)}</div>
              <div className="text-label flex items-center gap-2"><Avatar name={f.reporter.name} size={20} /> {f.reporter.name}{f.reporterDivision ? ` · ${f.reporterDivision.name}` : ''}</div>
            </Row>
            <Row icon={<Calendar />} label={`Batas tindak lanjut (${f.slaDays} hari)`}>
              <div className={overdue ? 'text-negative font-semibold' : ''}>{fmtDate(f.dueAt)}</div>
              {f.firstActionAt && <div className="text-label">TL pertama: {fmtDateTime(f.firstActionAt)} {f.firstActionAt <= f.dueAt ? <Chip tone="positive">tepat waktu</Chip> : <Chip tone="negative">terlambat</Chip>}</div>}
            </Row>
            <Row icon={<Tag />} label="Kategori"><div>{f.category.name}</div></Row>
            {f.location && <Row icon={<MapPin />} label="Lokasi"><div>{f.location}</div></Row>}
            {f.doneAt && <Row icon={<Calendar />} label="Diajukan selesai"><div>{fmtDateTime(f.doneAt)}</div></Row>}
            {f.closedAt && <Row icon={<Calendar />} label={f.status === 'CANCELLED' ? 'Dibatalkan' : 'Closed (disetujui)'}><div>{fmtDateTime(f.closedAt)}{f.closedBy ? ` · ${f.closedBy.name}` : ''}</div></Row>}
          </div>
          {canAct && (
            <FindingAdminActions
              finding={{ id: f.id, title: f.title, description: f.description, location: f.location, categoryId: f.categoryId, priority: f.priority, assignedDivisionId: f.assignedDivisionId, assigneeId: f.assigneeId, rootCause: f.rootCause, resolution: f.resolution, status: f.status }}
              divisions={divisions}
              users={users}
              categories={await prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })}
              canEdit={canVerify}
              isAdmin={u.role === 'ADMIN'}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-label mt-0.5 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-label">{label}</div>
        {children}
      </div>
    </div>
  );
}
