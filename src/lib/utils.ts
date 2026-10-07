// Util bersama (aman dipakai di client maupun server).
import type { FindingStatus, Priority, FindingSource } from '@prisma/client';

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const TZ = 'Asia/Jakarta';

export function fmtDate(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function fmtDateTime(d: Date | string | null | undefined) {
  return fmtDate(d, true);
}

/** yyyy-mm-dd (zona Jakarta) untuk input[type=date] */
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function fmtNumber(n: number) {
  return new Intl.NumberFormat('id-ID').format(n);
}

export function fmtPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return '0%';
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(n)}%`;
}

export function relativeDays(due: Date | string, now = new Date()): number {
  const d = typeof due === 'string' ? new Date(due) : due;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

export const STATUS_LABEL: Record<FindingStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'Proses',
  DONE: 'Menunggu Approval',
  CLOSED: 'Closed',
  CANCELLED: 'Batal',
};

export const STATUS_TONE: Record<FindingStatus, 'neutral' | 'informative' | 'positive' | 'critical' | 'negative' | 'brand'> = {
  OPEN: 'critical',
  IN_PROGRESS: 'informative',
  DONE: 'brand',
  CLOSED: 'positive',
  CANCELLED: 'neutral',
};

export const PRIORITY_LABEL: Record<Priority, string> = { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi' };
export const PRIORITY_TONE: Record<Priority, 'neutral' | 'critical' | 'negative'> = { LOW: 'neutral', MEDIUM: 'critical', HIGH: 'negative' };

export const SOURCE_LABEL: Record<FindingSource, string> = { DOR: 'Saat DOR', GEMBA: 'Saat Gemba' };


/** Terselesaikan = sudah DISETUJUI pelapor (Closed). DONE hanya "menunggu approval". */
export const RESOLVED_STATUSES: FindingStatus[] = ['CLOSED'];
/** Masih dikerjakan (dasar hitung keterlambatan). */
export const ACTIVE_STATUSES: FindingStatus[] = ['OPEN', 'IN_PROGRESS'];

export function isOverdue(f: { status: FindingStatus; dueAt: Date | string; firstActionAt: Date | string | null }, now = new Date()) {
  if (!ACTIVE_STATUSES.includes(f.status)) return false;
  if (f.firstActionAt) return false; // sudah ditindaklanjuti → tidak dihitung terlambat KPI
  return new Date(f.dueAt).getTime() < now.getTime();
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}

export function slugCode(s: string) {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}
