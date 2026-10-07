'use client';
/* Panel tindak lanjut dengan alur:
 *  PIC divisi PJ : "Progres" (catatan + foto opsional) → "Ajukan selesai" (WAJIB foto bukti) → status DONE (menunggu approval)
 *  Pelapor/Admin : saat DONE → "Setujui → Closed" atau "Tolak, minta revisi" (alasan wajib) → kembali IN_PROGRESS
 *  Siapa pun     : komentar */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, CheckCheck, Undo2, MessageSquare, Wrench, PackageCheck, Ban, RotateCcw } from 'lucide-react';
import type { FindingStatus } from '@prisma/client';
import { Field, Spinner } from '@/components/ui/primitives';
import { PhotoUpload, type UploadedPhoto } from './photo-upload';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { STATUS_LABEL, cn } from '@/lib/utils';

type Mode = 'progress' | 'done' | 'approve' | 'reject' | 'comment' | 'cancel' | 'reopen';

const MODES: Record<Mode, { label: string; icon: React.ReactNode; title: string; placeholder: string; toStatus?: FindingStatus; type: 'ACTION' | 'COMMENT'; needPhoto?: boolean; cls?: string }> = {
  progress: { label: 'Progres', icon: <Wrench />, title: 'Apa yang sudah dilakukan?', placeholder: 'Tindakan perbaikan, siapa, kapan…', type: 'ACTION' },
  done: { label: 'Ajukan selesai', icon: <PackageCheck />, title: 'Perbaikan selesai — lampirkan bukti', placeholder: 'Ringkasan perbaikan yang sudah dilakukan…', toStatus: 'DONE', type: 'ACTION', needPhoto: true, cls: 'btn-primary' },
  approve: { label: 'Setujui → Closed', icon: <CheckCheck />, title: 'Setujui penyelesaian', placeholder: 'Catatan verifikasi (opsional, mis. sudah dicek di lapangan)…', toStatus: 'CLOSED', type: 'COMMENT', cls: 'btn-primary' },
  reject: { label: 'Tolak, minta revisi', icon: <Undo2 />, title: 'Belum bisa Closed — apa yang harus direvisi?', placeholder: 'Jelaskan kekurangan perbaikan yang harus diperbaiki lagi…', toStatus: 'IN_PROGRESS', type: 'COMMENT', cls: 'btn-danger' },
  comment: { label: 'Komentar', icon: <MessageSquare />, title: 'Komentar / klarifikasi', placeholder: 'Pertanyaan atau klarifikasi…', type: 'COMMENT' },
  cancel: { label: 'Batalkan temuan', icon: <Ban />, title: 'Batalkan temuan (bukan temuan valid)', placeholder: 'Alasan pembatalan…', toStatus: 'CANCELLED', type: 'COMMENT' },
  reopen: { label: 'Buka kembali', icon: <RotateCcw />, title: 'Buka kembali temuan', placeholder: 'Alasan dibuka kembali…', toStatus: 'OPEN', type: 'COMMENT' },
};

export function ActionForm({ findingId, status, canAct, canVerify, settings }: {
  findingId: string;
  status: FindingStatus;
  canAct: boolean;     // PIC divisi PJ / assignee / admin / pelapor
  canVerify: boolean;  // pelapor (yang meng-assign) / admin
  settings: { maxPhotoPx: number; photoQuality: number };
}) {
  const router = useRouter();
  const { toast } = useToast();

  // Mode yang tersedia sesuai status & peran
  const available: Mode[] = [];
  if (status === 'OPEN' || status === 'IN_PROGRESS') {
    if (canAct) available.push('progress', 'done');
    available.push('comment');
    if (canVerify) available.push('cancel');
  } else if (status === 'DONE') {
    if (canVerify) available.push('approve', 'reject');
    available.push('comment');
  } else if (canVerify) {
    available.push('reopen');
  }

  const [mode, setMode] = useState<Mode>(available[0] ?? 'comment');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const m = MODES[available.includes(mode) ? mode : (available[0] ?? 'comment')];
  const noteRequired = m.toStatus !== 'CLOSED';

  if (available.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Temuan sudah {STATUS_LABEL[status]}</div>
        <div className="text-sm text-label mt-1">Hubungi pelapor atau Admin untuk membuka kembali.</div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (m.needPhoto && photos.length === 0) { toast('Lampirkan minimal 1 foto bukti perbaikan', 'negative'); return; }
    setBusy(true);
    try {
      const res = await api<{ status: FindingStatus }>(`/api/findings/${findingId}/actions`, {
        method: 'POST',
        json: { type: m.type, note: note.trim() || (m.toStatus === 'CLOSED' ? 'Disetujui, temuan ditutup.' : ''), toStatus: m.toStatus, attachmentIds: photos.map((p) => p.id) },
      });
      toast(m.toStatus ? `Status → ${STATUS_LABEL[res.status]}` : 'Tersimpan', 'positive');
      setNote(''); setPhotos([]);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'negative');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <div className="card-title">{status === 'DONE' && canVerify ? 'Approval penyelesaian' : 'Tindak lanjut'}</div>
      <div className="flex flex-wrap gap-2">
        {available.map((k) => (
          <button key={k} type="button" className={cn('btn btn-sm', mode === k ? (MODES[k].cls ?? 'btn-primary') : 'btn-secondary')} onClick={() => setMode(k)} aria-pressed={mode === k}>
            {MODES[k].icon} {MODES[k].label}
          </button>
        ))}
      </div>
      {m.needPhoto && <div className="alert alert-informative">Pengajuan selesai <b>wajib</b> disertai foto bukti perbaikan. Setelah diajukan, pelapor akan memeriksa dan menyetujui (Closed) atau meminta revisi.</div>}
      {mode === 'reject' && <div className="alert alert-critical">Temuan dikembalikan ke PIC dengan status <b>Proses</b>. Tuliskan jelas apa yang harus diperbaiki.</div>}
      <Field label={m.title} htmlFor="note" required={noteRequired}>
        <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} required={noteRequired} minLength={noteRequired ? 2 : 0} maxLength={5000} placeholder={m.placeholder} />
      </Field>
      {(m.type === 'ACTION' || mode === 'reject' || mode === 'comment') && (
        <div>
          <span className="label">{m.needPhoto ? 'Foto bukti perbaikan (wajib)' : 'Foto (opsional)'}</span>
          <PhotoUpload value={photos} onChange={setPhotos} maxPx={settings.maxPhotoPx} quality={settings.photoQuality} max={6} />
        </div>
      )}
      <div className="btn-group flex justify-end">
        <button type="submit" className={cn('btn', m.cls ?? 'btn-primary')} disabled={busy || (noteRequired && !note.trim()) || (m.needPhoto && photos.length === 0)}>
          {busy ? <Spinner /> : m.toStatus ? m.icon : <Send />} {m.toStatus ? m.label : 'Kirim'}
        </button>
      </div>
    </form>
  );
}
