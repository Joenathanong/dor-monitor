import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { FindingForm } from '@/components/findings/finding-form';

export const dynamic = 'force-dynamic';

export default async function GembaTemuanBaruPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const [s, settings] = await Promise.all([prisma.gembaSession.findUnique({ where: { id } }), getSettings()]);
  if (!s) notFound();
  const canManage = u.role === 'ADMIN' || s.leaderId === u.id || (u.isGembaTeam && u.divisionId === s.divisionId);
  if (!settings.gembaEnabled || !canManage || s.status === 'COMPLETED') redirect(`/gemba/${id}`);
  const [divisions, categories, users] = await Promise.all([
    prisma.division.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ['PIC', 'ADMIN'] }, divisionId: { not: null } }, orderBy: { name: 'asc' }, select: { id: true, name: true, divisionId: true } }),
  ]);
  return (
    <div className="flex flex-col gap-4 max-w-[880px]">
      <div>
        <div className="text-xs font-mono text-label">{s.number} · {s.area}</div>
        <h1 className="page-title">Catat temuan Gemba</h1>
      </div>
      <p className="text-sm text-label -mt-2">Ketidaksesuaian yang ditemukan di lapangan. Pilih divisi/PIC yang harus menindaklanjuti; batas {settings.slaDays} hari berlaku sejak dicatat.</p>
      <FindingForm divisions={divisions} categories={categories} users={users} settings={settings} source="GEMBA" gembaSessionId={s.id} defaults={{ location: s.area }} onCancelHref={`/gemba/${s.id}`} />
    </div>
  );
}
