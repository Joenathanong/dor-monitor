import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/shell/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  // Badge: temuan aktif yang menjadi tanggung jawab divisi/user ini (admin: semua)
  const openCount = await prisma.finding.count({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      ...(user.role === 'ADMIN'
        ? {}
        : { OR: [{ assigneeId: user.id }, ...(user.divisionId ? [{ assignedDivisionId: user.divisionId }] : []), { reporterId: user.id }] }),
    },
  });

  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, role: user.role, divisionName: user.divisionName, isGembaTeam: user.isGembaTeam }}
      appName={settings.appName}
      openCount={openCount}
    >
      {children}
    </AppShell>
  );
}
