'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X } from 'lucide-react';
import { Field, Spinner } from '@/components/ui/primitives';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

function nowLocal() {
  const d = new Date(); d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function GembaForm({ divisions, initial, id }: { divisions: { id: string; name: string }[]; initial?: { title: string; area: string; scheduledAt: string; participants: string; notes: string }; id?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: initial?.title ?? '', area: initial?.area ?? '', scheduledAt: initial?.scheduledAt ?? nowLocal(), participants: initial?.participants ?? '', notes: initial?.notes ?? '', divisionId: divisions[0]?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const payload = { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() };
      if (id) {
        await api(`/api/gemba/${id}`, { method: 'PATCH', json: payload });
        toast('Sesi diperbarui', 'positive');
        router.push(`/gemba/${id}`);
      } else {
        const res = await api<{ id: string; number: string }>('/api/gemba', { method: 'POST', json: payload });
        toast(`Sesi ${res.number} dibuat`, 'positive');
        router.push(`/gemba/${res.id}`);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {err && <div className="alert alert-negative">{err}</div>}
      <div className="card flex flex-col gap-4">
        <Field label="Judul sesi" htmlFor="g-title" required><input id="g-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} placeholder="mis. Gemba pagi area Inbound" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area yang dikunjungi" htmlFor="g-area" required><input id="g-area" className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required maxLength={160} placeholder="mis. Gudang A – Inbound & Rak 1–10" /></Field>
          <Field label="Jadwal" htmlFor="g-sched" required><input id="g-sched" className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required /></Field>
          {divisions.length > 0 && (
            <Field label="Tim pelaksana" htmlFor="g-div"><select id="g-div" className="select" value={form.divisionId} onChange={(e) => setForm({ ...form, divisionId: e.target.value })}>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          )}
          <Field label="Peserta" htmlFor="g-part" hint="Nama peserta, pisahkan dengan koma"><input id="g-part" className="input" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} maxLength={512} /></Field>
        </div>
        <Field label="Catatan" htmlFor="g-notes"><textarea id="g-notes" className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={5000} /></Field>
      </div>
      <div className="fab-bar btn-group">
        <a href={id ? `/gemba/${id}` : '/gemba'} className="btn btn-secondary"><X /> Batal</a>
        <button type="submit" className="btn btn-primary flex-1 md:flex-none" disabled={busy}>{busy ? <Spinner /> : <Save />} {id ? 'Simpan' : 'Buat sesi'}</button>
      </div>
    </form>
  );
}
