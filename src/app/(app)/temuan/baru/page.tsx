import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { FindingForm } from '@/components/findings/finding-form';

export const dynamic = 'force-dynamic';

export default async function TemuanBaruPage() {
  const u = await requireUser();
  if (u.role === 'VIEWER') redirect('/temuan');
  const [divisions, categories, users, settings] = await Promise.all([
    prisma.division.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, role: { in: ['PIC', 'ADMIN'] }, divisionId: { not: null } }, orderBy: { name: 'asc' }, select: { id: true, name: true, divisionId: true } }),
    getSettings(),
  ]);
  return (
    <div className="flex flex-col gap-4 max-w-[880px]">
      <h1 className="page-title">Temuan baru</h1>
      <p className="text-sm text-label -mt-2">Dilaporkan oleh <b className="text-ink">{u.name}</b>{u.divisionName ? ` · ${u.divisionName}` : ''}. Divisi tujuan wajib menindaklanjuti dalam {settings.slaDays} hari.</p>
      <FindingForm divisions={divisions} categories={categories} users={users} settings={settings} gembaEnabled={settings.gembaEnabled} defaultSource={u.isGembaTeam ? 'GEMBA' : 'DOR'} />
    </div>
  );
}
