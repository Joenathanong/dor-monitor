'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X } from 'lucide-react';
import { Field, Spinner } from '@/components/ui/primitives';
import { PhotoUpload, type UploadedPhoto } from './photo-upload';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

export type Option = { id: string; name: string; code?: string; divisionId?: string | null };

export function FindingForm({ divisions, categories, users, defaults, settings, gembaEnabled = true, defaultSource = 'DOR', onCancelHref = '/temuan' }: {
  divisions: Option[];
  categories: Option[];
  users: Option[]; // PIC aktif (id, name, divisionId)
  defaults?: Partial<{ title: string; description: string; location: string; categoryId: string; priority: string; assignedDivisionId: string; assigneeId: string }>;
  settings: { maxPhotoPx: number; photoQuality: number; slaDays: number };
  gembaEnabled?: boolean;
  defaultSource?: 'DOR' | 'GEMBA';
  onCancelHref?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: defaults?.title ?? '',
    description: defaults?.description ?? '',
    location: defaults?.location ?? '',
    categoryId: defaults?.categoryId ?? categories[0]?.id ?? '',
    priority: defaults?.priority ?? 'MEDIUM',
    assignedDivisionId: defaults?.assignedDivisionId ?? '',
    assigneeId: defaults?.assigneeId ?? '',
  });
  const [source, setSource] = useState<'DOR' | 'GEMBA'>(gembaEnabled ? defaultSource : 'DOR');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const picOptions = useMemo(() => users.filter((u) => u.divisionId === form.assignedDivisionId), [users, form.assignedDivisionId]);
  useEffect(() => {
    if (form.assigneeId && !picOptions.some((p) => p.id === form.assigneeId)) setForm((f) => ({ ...f, assigneeId: '' }));
  }, [picOptions, form.assigneeId]);

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.assignedDivisionId) { setErr('Pilih divisi penanggung jawab'); return; }
    setBusy(true);
    try {
      const res = await api<{ id: string; number: string }>('/api/findings', {
        method: 'POST',
        json: { ...form, source, attachmentIds: photos.map((p) => p.id) },
      });
      toast(`Temuan ${res.number} dibuat`, 'positive');
      router.push(`/temuan/${res.id}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {err && <div className="alert alert-negative" role="alert">{err}</div>}
      <div className="card flex flex-col gap-4">
        {gembaEnabled && (
          <div>
            <span className="label">Temuan ditemukan saat</span>
            <div className="seg" role="radiogroup" aria-label="Sumber temuan">
              <button type="button" role="radio" aria-checked={source === 'DOR'} className={source === 'DOR' ? 'is-active' : ''} onClick={() => setSource('DOR')}>Daily Operation Review</button>
              <button type="button" role="radio" aria-checked={source === 'GEMBA'} className={source === 'GEMBA' ? 'is-active' : ''} onClick={() => setSource('GEMBA')}>Gemba (jalan ke lapangan)</button>
            </div>
            <div className="help">{source === 'GEMBA' ? 'Nomor temuan berawalan GMB-. Ketidaksesuaian yang ditemukan saat Gemba, ditujukan ke divisi/PIC terkait.' : 'Nomor temuan berawalan DOR-.'}</div>
          </div>
        )}
        <Field label="Judul temuan" htmlFor="title" required>
          <input id="title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} placeholder="Ringkas, mis. Pallet menghalangi jalur evakuasi" />
        </Field>
        <Field label="Keterangan" htmlFor="description" required hint="Apa yang ditemukan, di mana, dampaknya.">
          <textarea id="description" className="textarea" value={form.description} onChange={(e) => set('description', e.target.value)} required maxLength={5000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lokasi / area" htmlFor="location">
            <input id="location" className="input" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={160} placeholder="mis. Rak A-12, Dock 3" />
          </Field>
          <Field label="Kategori" htmlFor="categoryId" required>
            <select id="categoryId" className="select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Prioritas" htmlFor="priority">
            <select id="priority" className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="LOW">Rendah</option>
              <option value="MEDIUM">Sedang</option>
              <option value="HIGH">Tinggi</option>
            </select>
          </Field>
          <Field label="Divisi penanggung jawab" htmlFor="assignedDivisionId" required hint={`Batas tindak lanjut: ${settings.slaDays} hari sejak dilaporkan`}>
            <select id="assignedDivisionId" className="select" value={form.assignedDivisionId} onChange={(e) => set('assignedDivisionId', e.target.value)} required>
              <option value="">— pilih divisi —</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="PIC (opsional)" htmlFor="assigneeId" hint={form.assignedDivisionId && !picOptions.length ? 'Divisi ini belum punya PIC terdaftar' : 'Kosongkan bila untuk semua PIC divisi'}>
            <select id="assigneeId" className="select" value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)} disabled={!picOptions.length}>
              <option value="">— semua PIC divisi —</option>
              {picOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <div className="card">
        <div className="card-title mb-3">Foto bukti</div>
        <PhotoUpload value={photos} onChange={setPhotos} maxPx={settings.maxPhotoPx} quality={settings.photoQuality} />
      </div>
      <div className="fab-bar btn-group">
        <a href={onCancelHref} className="btn btn-secondary"><X /> Batal</a>
        <button type="submit" className="btn btn-primary flex-1 md:flex-none" disabled={busy}>{busy ? <Spinner /> : <Save />} Simpan temuan</button>
      </div>
    </form>
  );
}
