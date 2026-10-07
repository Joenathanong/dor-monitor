import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { GembaTable } from '@/components/gemba/gemba-table';

export const dynamic = 'force-dynamic';

export default async function GembaPage() {
  const u = await requireUser();
  const settings = await getSettings();
  const canCreate = settings.gembaEnabled && (u.role === 'ADMIN' || u.isGembaTeam);
  const rows = await prisma.gembaSession.findMany({
    orderBy: { scheduledAt: 'desc' },
    include: {
      leader: { select: { id: true, name: true } },
      division: { select: { id: true, name: true, code: true } },
      findings: { select: { status: true } },
    },
    take: 500,
  });
  const data = rows.map((r: (typeof rows)[number]) => ({
    id: r.id, number: r.number, title: r.title, area: r.area, status: r.status, scheduledAt: r.scheduledAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null,
    leader: r.leader.name, division: r.division.name, participants: r.participants,
    total: r.findings.length, open: r.findings.filter((f: { status: string }) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length,
  }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Gemba</h1>
        {canCreate && <Link href="/gemba/baru" className="btn btn-primary"><Plus /> Sesi baru</Link>}
      </div>
      {!settings.gembaEnabled && <div className="alert alert-critical">Modul Gemba dinonaktifkan di Settings.</div>}
      <p className="text-sm text-label -mt-2">Gemba dilakukan tim QA/QC (divisi bertanda “tim Gemba”). Ketidaksesuaian yang ditemukan di lapangan dicatat sebagai temuan dan ditujukan ke divisi/PIC terkait.</p>
      <GembaTable rows={data} />
    </div>
  );
}
