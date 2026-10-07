import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FindingsTable } from '@/components/findings/findings-table';

export const dynamic = 'force-dynamic';

export default async function TemuanPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const divisions = await prisma.division.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
  const status = (['active', 'overdue', 'awaiting', 'resolved', 'all'].includes(sp.status || '') ? sp.status : 'active') as 'active' | 'overdue' | 'awaiting' | 'resolved' | 'all';
  const scope = (['all', 'mine', 'division'].includes(sp.scope || '') ? sp.scope : 'all') as 'all' | 'mine' | 'division';
  const canCreate = u.role !== 'VIEWER';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">Temuan</h1>
        {canCreate && <Link href="/temuan/baru" className="btn btn-primary md:hidden"><Plus /> Baru</Link>}
      </div>
      <FindingsTable divisions={divisions} canCreate={canCreate} hasDivision={!!u.divisionId} initialStatus={status} initialScope={scope} />
    </div>
  );
}
