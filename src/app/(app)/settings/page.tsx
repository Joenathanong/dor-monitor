import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { SettingsTabs } from '@/components/settings/settings-tabs';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const [settings, divisions, categories, users] = await Promise.all([
    getSettings(),
    prisma.division.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { users: true, assignedFindings: true } } } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { findings: true } } } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, email: true, name: true, role: true, divisionId: true, phone: true, active: true, mustChangePassword: true, lastLoginAt: true } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="page-title">Settings</h1>
      <SettingsTabs
        initialTab={tab}
        settings={settings}
        divisions={divisions.map((d: (typeof divisions)[number]) => ({ id: d.id, code: d.code, name: d.name, description: d.description, color: d.color, isGembaTeam: d.isGembaTeam, active: d.active, sortOrder: d.sortOrder, users: d._count.users, findings: d._count.assignedFindings }))}
        categories={categories.map((c: (typeof categories)[number]) => ({ id: c.id, code: c.code, name: c.name, color: c.color, active: c.active, sortOrder: c.sortOrder, findings: c._count.findings }))}
        users={users.map((x: (typeof users)[number]) => ({ ...x, lastLoginAt: x.lastLoginAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
