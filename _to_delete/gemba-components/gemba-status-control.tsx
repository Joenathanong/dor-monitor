'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, CheckCircle2, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import type { GembaStatus } from '@prisma/client';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';

export function GembaStatusControl({ id, status, isAdmin }: { id: string; status: GembaStatus; isAdmin: boolean; openFindings: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function set(next: GembaStatus) {
    setBusy(true);
    try {
      await api(`/api/gemba/${id}`, { method: 'PATCH', json: { status: next } });
      toast('Status sesi diperbarui', 'positive');
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'negative');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm('Hapus sesi Gemba ini?')) return;
    setBusy(true);
    try {
      await api(`/api/gemba/${id}`, { method: 'DELETE' });
      router.push('/gemba'); router.refresh();
    } catch (e) {
      toast((e as Error).message, 'negative'); setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-2">
      <div className="card-title mb-1">Kelola sesi</div>
      {status === 'PLANNED' && <button type="button" className="btn btn-primary justify-start" disabled={busy} onClick={() => set('ONGOING')}>{busy ? <Spinner /> : <Play />} Mulai Gemba</button>}
      {status === 'ONGOING' && <button type="button" className="btn btn-primary justify-start" disabled={busy} onClick={() => set('COMPLETED')}>{busy ? <Spinner /> : <CheckCircle2 />} Selesaikan sesi</button>}
      {status === 'COMPLETED' && <button type="button" className="btn btn-secondary justify-start" disabled={busy} onClick={() => set('ONGOING')}>{busy ? <Spinner /> : <RotateCcw />} Buka kembali</button>}
      <Link href={`/gemba/${id}/edit`} className="btn btn-secondary justify-start"><Pencil /> Ubah detail sesi</Link>
      {isAdmin && <button type="button" className="btn btn-ghost justify-start text-negative" disabled={busy} onClick={remove}><Trash2 /> Hapus sesi</button>}
      <p className="help">Temuan Gemba tetap mengikuti KPI tindak lanjut divisi tujuan walau sesi sudah selesai.</p>
    </div>
  );
}
