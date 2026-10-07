import { apiUser, isResponse } from '@/lib/auth';
import { getSettings, setSettings } from '@/lib/settings';
import { handleApiError, int, str, bool, ValidationError } from '@/lib/validate';

export async function GET() {
  const u = await apiUser();
  if (isResponse(u)) return u;
  return Response.json(await getSettings());
}

export async function PUT(req: Request) {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });
  try {
    const b = await req.json();
    const values: Record<string, string> = {};
    if (b.appName !== undefined) values.app_name = str(b.appName, 'Nama aplikasi', { min: 2, max: 60 });
    if (b.slaDays !== undefined) values.sla_days = String(int(b.slaDays, 'SLA (hari)', { min: 0, max: 60 }));
    if (b.slaCountWeekend !== undefined) values.sla_count_weekend = String(bool(b.slaCountWeekend, true));
    if (b.gembaEnabled !== undefined) values.gemba_enabled = String(bool(b.gembaEnabled, true));
    if (b.maxPhotoPx !== undefined) values.max_photo_px = String(int(b.maxPhotoPx, 'Ukuran foto (px)', { min: 640, max: 4000 }));
    if (b.photoQuality !== undefined) {
      const q = Number(b.photoQuality);
      if (!Number.isFinite(q) || q < 0.3 || q > 1) throw new ValidationError('Kualitas foto 0.3–1.0');
      values.photo_quality = String(q);
    }
    await setSettings(values);
    return Response.json(await getSettings());
  } catch (e) {
    return handleApiError(e);
  }
}
