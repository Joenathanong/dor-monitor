import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GembaForm } from '@/components/gemba/gemba-form';

export const dynamic = 'force-dynamic';

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default async function GembaEditPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const s = await prisma.gembaSession.findUnique({ where: { id } });
  if (!s) notFound();
  if (!(u.role === 'ADMIN' || s.leaderId === u.id || (u.isGembaTeam && u.divisionId === s.divisionId))) redirect(`/gemba/${id}`);
  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      <h1 className="page-title">Ubah sesi {s.number}</h1>
      <GembaForm id={s.id} divisions={[]} initial={{ title: s.title, area: s.area, scheduledAt: toLocalInput(s.scheduledAt), participants: s.participants ?? '', notes: s.notes ?? '' }} />
    </div>
  );
}
