import 'server-only';
import { prisma } from './prisma';

export const SETTING_DEFAULTS: Record<string, string> = {
  app_name: 'DOR IEG',
  sla_days: '2',
  sla_count_weekend: 'true',
  gemba_enabled: 'true',
  max_photo_px: '1600',
  photo_quality: '0.82',
};

export type Settings = {
  appName: string;
  slaDays: number;
  slaCountWeekend: boolean;
  gembaEnabled: boolean;
  maxPhotoPx: number;
  photoQuality: number;
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.appSetting.findMany();
  const map: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return {
    appName: map.app_name,
    slaDays: Math.max(0, parseInt(map.sla_days, 10) || 2),
    slaCountWeekend: map.sla_count_weekend !== 'false',
    gembaEnabled: map.gemba_enabled !== 'false',
    maxPhotoPx: parseInt(map.max_photo_px, 10) || 1600,
    photoQuality: Math.min(1, Math.max(0.3, parseFloat(map.photo_quality) || 0.82)),
  };
}

export async function setSettings(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in SETTING_DEFAULTS)) continue;
    await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

/** Hitung batas waktu dari tanggal lapor + SLA hari. Bila tidak menghitung akhir pekan,
 *  Sabtu & Minggu dilewati. Jam batas = 23:59:59 waktu server (WIB di Vercel sin1 = UTC+7 ditangani di tampilan). */
export function computeDueAt(reportedAt: Date, slaDays: number, countWeekend: boolean): Date {
  const d = new Date(reportedAt);
  if (countWeekend) {
    d.setDate(d.getDate() + slaDays);
  } else {
    let left = slaDays;
    while (left > 0) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) left--;
    }
  }
  return d;
}
