'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, UserCog, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Spinner } from '@/components/ui/primitives';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

type Opt = { id: string; name: string; divisionId?: string | null };

export function FindingAdminActions({ finding, divisions, users, categories, canEdit, isAdmin }: {
  finding: { id: string; title: string; description: string; location: string | null; categoryId: string; priority: string; assignedDivisionId: string; assigneeId: string | null; rootCause: string | null; resolution: string | null; status: string };
  divisions: Opt[]; users: Opt[]; categories: Opt[]; canEdit: boolean; isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<null | 'edit' | 'assign' | 'resolve'>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: finding.title, description: finding.description, location: finding.location ?? '', categoryId: finding.categoryId, priority: finding.priority,
    assignedDivisionId: finding.assignedDivisionId, assigneeId: finding.assigneeId ?? '', rootCause: finding.rootCause ?? '', resolution: finding.resolution ?? '',
  });
  const pics = useMemo(() => users.filter((x) => x.divisionId === form.assignedDivisionId), [users, form.assignedDivisionId]);
  const closed = finding.status === 'CLOSED' || finding.status === 'CANCELLED';
  if (closed && !isAdmin) return null;

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/api/findings/${finding.id}`, { method: 'PATCH', json: payload });
      toast('Tersimpan', 'positive');
      setMode(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'negative');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Hapus temuan ini beserta seluruh riwayatnya? Tidak bisa dibatalkan.')) return;
    setBusy(true);
    try {
      await api(`/api/findings/${finding.id}`, { method: 'DELETE' });
      toast('Temuan dihapus');
      router.push('/temuan');
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'negative');
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-2">
      <div className="card-title mb-1">Kelola</div>
      {canEdit && !closed && <button type="button" className="btn btn-secondary justify-start" onClick={() => setMode('edit')}><Pencil /> Ubah isi temuan</button>}
      {!closed && <button type="button" className="btn btn-secondary justify-start" onClick={() => setMode('assign')}><UserCog /> Alihkan penanggung jawab</button>}
      {!closed && <button type="button" className="btn btn-secondary justify-start" onClick={() => setMode('resolve')}><Pencil /> Akar masalah & resolusi</button>}
      {isAdmin && <button type="button" className="btn btn-ghost justify-start text-negative" onClick={remove} disabled={busy}><Trash2 /> Hapus temuan</button>}

      <Modal open={mode === 'edit'} onClose={() => setMode(null)} title="Ubah isi temuan" footer={<><button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>Batal</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => save({ title: form.title, description: form.description, location: form.location, categoryId: form.categoryId, priority: form.priority })}>{busy && <Spinner />} Simpan</button></>}>
        <div className="flex flex-col gap-3 py-2">
          <Field label="Judul" htmlFor="e-title"><input id="e-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Keterangan" htmlFor="e-desc"><textarea id="e-desc" className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Lokasi" htmlFor="e-loc"><input id="e-loc" className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Kategori" htmlFor="e-cat"><select id="e-cat" className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Prioritas" htmlFor="e-pri"><select id="e-pri" className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="LOW">Rendah</option><option value="MEDIUM">Sedang</option><option value="HIGH">Tinggi</option></select></Field>
        </div>
      </Modal>

      <Modal open={mode === 'assign'} onClose={() => setMode(null)} title="Alihkan penanggung jawab" footer={<><button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>Batal</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => save({ assignedDivisionId: form.assignedDivisionId, assigneeId: form.assigneeId || null })}>{busy && <Spinner />} Alihkan</button></>}>
        <div className="flex flex-col gap-3 py-2">
          <Field label="Divisi" htmlFor="a-div"><select id="a-div" className="select" value={form.assignedDivisionId} onChange={(e) => setForm({ ...form, assignedDivisionId: e.target.value, assigneeId: '' })}>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="PIC" htmlFor="a-pic"><select id="a-pic" className="select" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}><option value="">— semua PIC divisi —</option>{pics.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        </div>
      </Modal>

      <Modal open={mode === 'resolve'} onClose={() => setMode(null)} title="Akar masalah & resolusi" footer={<><button type="button" className="btn btn-secondary" onClick={() => setMode(null)}>Batal</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => save({ rootCause: form.rootCause, resolution: form.resolution })}>{busy && <Spinner />} Simpan</button></>}>
        <div className="flex flex-col gap-3 py-2">
          <Field label="Akar masalah (root cause)" htmlFor="r-rc"><textarea id="r-rc" className="textarea" value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} placeholder="Mengapa terjadi? (5 why)" /></Field>
          <Field label="Resolusi / tindakan pencegahan" htmlFor="r-res"><textarea id="r-res" className="textarea" value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
