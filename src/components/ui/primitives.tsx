'use client';
import { cn } from '@/lib/utils';
import { Check, Clock, Loader2, AlertTriangle, XCircle, CircleDot, Minus, Flame, ArrowDown, Hourglass, CheckCheck } from 'lucide-react';
import type { FindingStatus, Priority } from '@prisma/client';
import { STATUS_LABEL, STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE } from '@/lib/utils';

export type Tone = 'positive' | 'critical' | 'negative' | 'informative' | 'neutral' | 'brand';

export function Chip({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn('chip', `chip-${tone}`, className)}>
      {icon}
      {children}
    </span>
  );
}

const STATUS_ICON: Record<FindingStatus, React.ReactNode> = {
  OPEN: <CircleDot />,
  IN_PROGRESS: <Clock />,
  DONE: <Hourglass />,
  CLOSED: <CheckCheck />,
  CANCELLED: <XCircle />,
};

export function StatusChip({ status }: { status: FindingStatus }) {
  return (
    <Chip tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>
      {STATUS_LABEL[status]}
    </Chip>
  );
}

const PRIORITY_ICON: Record<Priority, React.ReactNode> = { LOW: <ArrowDown />, MEDIUM: <Minus />, HIGH: <Flame /> };

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <Chip tone={PRIORITY_TONE[priority]} icon={PRIORITY_ICON[priority]}>
      {PRIORITY_LABEL[priority]}
    </Chip>
  );
}

export function OverdueChip({ days }: { days: number }) {
  return (
    <Chip tone="negative" icon={<AlertTriangle />}>
      Terlambat {days} hari
    </Chip>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} aria-hidden />;
}

export function Field({ label, htmlFor, hint, error, children, required }: { label: string; htmlFor?: string; hint?: string; error?: string | null; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label} {required && <span className="text-negative" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <div className="error-text">{error}</div> : hint ? <div className="help">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-base font-semibold">{title}</div>
      {hint && <div className="text-sm text-label mt-1">{hint}</div>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('');
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {ini}
    </span>
  );
}

export function ColorDot({ slot }: { slot?: string | null }) {
  const v = slot && /^c[1-6]$/.test(slot) ? `var(--${slot})` : 'var(--c-other)';
  return <span className="dot" style={{ background: v }} aria-hidden />;
}
