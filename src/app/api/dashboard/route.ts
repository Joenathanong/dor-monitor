import { apiUser, isResponse } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { computeStats, resolvePeriod } from '@/server/stats';
import { handleApiError } from '@/lib/validate';

export async function GET(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  try {
    const p = new URL(req.url).searchParams;
    const period = resolvePeriod(p.get('period') || 'month', p.get('from'), p.get('to'));
    const settings = await getSettings();
    const stats = await computeStats(period, { divisionId: p.get('divisionId') || undefined, slaDays: settings.slaDays });
    return Response.json(stats);
  } catch (e) {
    return handleApiError(e);
  }
}
