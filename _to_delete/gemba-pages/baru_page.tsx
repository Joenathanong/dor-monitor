import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { GembaForm } from '@/components/gemba/gemba-form';

export const dynamic = 'force-dynamic';

export default async function GembaBaruPage() {
  const u = await requireUser();
  const settings = await getSettings();
  if (!settings.gembaEnabled || !(u.role === 'ADMIN' || u.isGembaTeam)) redirect('/gemba');
  const gembaDivisions = u.role === 'ADMIN' ? await prisma.division.findMany({ where: { active: true, isGembaTeam: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }) : [];
  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      <h1 className="page-title">Sesi Gemba baru</h1>
      <GembaForm divisions={gembaDivisions} />
    </div>
  );
}
