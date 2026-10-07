'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Save, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Chip, Spinner, ColorDot } from '@/components/ui/primitives';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { fmtDateTime } from '@/lib/utils';

type Division = { id: string; code: string; name: string; description: string | null; color: string | null; isGembaTeam: boolean; active: boolean; sortOrder: number; users: number; findings: number };
type Category = { id: string; code: string; name: string; color: string | null; active: boolean; sortOrder: number; findings: number };
type User = { id: string; email: string; name: string; role: 'ADMIN' | 'PIC' | 'VIEWER'; divisionId: string | null; phone: string | null; active: boolean; mustChangePassword: boolean; lastLoginAt: string | null };
type Settings = { appName: string; slaDays: number; slaCountWeekend: boolean; gembaEnabled: boolean; maxPhotoPx: number; photoQuality: number };

const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
const TABS = [['umum', 'Umum & KPI'], ['divisi', 'Divisi'], ['kategori', 'Kategori'], ['pengguna', 'Pengguna']] as const;

export function SettingsTabs({ initialTab, settings, divisions, categories, users }: { initialTab?: string; settings: Settings; divisions: Division[]; categories: Category[]; users: User[] }) {
  const [tab, setTab] = useState<string>(TABS.some((t) => t[0] === initialTab) ? initialTab! : 'umum');
  return (
    <div className="flex flex-col gap-4">
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'is-active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'umum' && <GeneralTab settings={settings} />}
      {tab === 'divisi' && <DivisionTab rows={divisions} />}
      {tab === 'kategori' && <CategoryTab rows={categories} />}
      {tab === 'pengguna' && <UserTab rows={users} divisions={divisions} />}
    </div>
  );
}

function GeneralTab({ settings }: { settings: Settings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api('/api/settings', { method: 'PUT', json: f }); toast('Pengaturan disimpan', 'positive'); router.refresh(); }
    catch (err) { toast((err as Error).message, 'negative'); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="card flex flex-col gap-4 max-w-[640px]">
      <Field label="Nama aplikasi" htmlFor="s-name"><input id="s-name" className="input" value={f.appName} onChange={(e) => setF({ ...f, appName: e.target.value })} maxLength={60} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SLA tindak lanjut (hari)" htmlFor="s-sla" hint="Setiap temuan wajib ada tindak lanjut pertama dalam N hari. Berlaku untuk temuan baru.">
          <input id="s-sla" className="input" type="number" min={0} max={60} inputMode="numeric" value={f.slaDays} onChange={(e) => setF({ ...f, slaDays: Number(e.target.value) })} />
        </Field>
        <Field label="Hitung akhir pekan?" htmlFor="s-wk">
          <select id="s-wk" className="select" value={f.slaCountWeekend ? '1' : '0'} onChange={(e) => setF({ ...f, slaCountWeekend: e.target.value === '1' })}>
            <option value="1">Ya — hari kalender</option>
            <option value="0">Tidak — hari kerja (Sen–Jum)</option>
          </select>
        </Field>
        <Field label="Pilihan sumber “Saat Gemba” di form temuan" htmlFor="s-gemba">
          <select id="s-gemba" className="select" value={f.gembaEnabled ? '1' : '0'} onChange={(e) => setF({ ...f, gembaEnabled: e.target.value === '1' })}>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </Field>
        <Field label="Ukuran foto maks (px sisi terpanjang)" htmlFor="s-px" hint="Dikompresi di HP sebelum diunggah ke Google Drive.">
          <input id="s-px" className="input" type="number" min={640} max={4000} step={80} inputMode="numeric" value={f.maxPhotoPx} onChange={(e) => setF({ ...f, maxPhotoPx: Number(e.target.value) })} />
        </Field>
        <Field label="Kualitas JPEG (0.3–1.0)" htmlFor="s-q">
          <input id="s-q" className="input" type="number" min={0.3} max={1} step={0.02} inputMode="decimal" value={f.photoQuality} onChange={(e) => setF({ ...f, photoQuality: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="flex justify-end"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : <Save />} Simpan</button></div>
    </form>
  );
}

function DivisionTab({ rows }: { rows: Division[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const empty = { code: '', name: '', description: '', color: 'c1', isGembaTeam: false, active: true, sortOrder: rows.length };
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!edit) return; setBusy(true);
    try {
      if (edit.id) await api(`/api/master/divisions/${edit.id}`, { method: 'PATCH', json: edit });
      else await api('/api/master/divisions', { method: 'POST', json: edit });
      toast('Divisi disimpan', 'positive'); setEdit(null); router.refresh();
    } catch (e) { toast((e as Error).message, 'negative'); } finally { setBusy(false); }
  }
  async function remove(d: Division) {
    if (!confirm(`Hapus divisi ${d.name}?`)) return;
    try { await api(`/api/master/divisions/${d.id}`, { method: 'DELETE' }); toast('Dihapus'); router.refresh(); }
    catch (e) { toast((e as Error).message, 'negative'); }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="text-sm text-label">Divisi bertanda <b>tim Gemba</b> (QA/QC): saat membuat temuan, sumber otomatis terpilih “Saat Gemba”.</p>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({ ...empty })}><Plus /> Divisi baru</button>
      </div>
      <MasterList
        rows={rows}
        render={(d) => (
          <>
            <ColorDot slot={d.color} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2 flex-wrap">{d.name} <span className="font-mono text-xs text-label">{d.code}</span>{d.isGembaTeam && <Chip tone="brand">Tim Gemba</Chip>}{!d.active && <Chip tone="neutral">Nonaktif</Chip>}</div>
              <div className="text-xs text-label">{d.users} PIC · {d.findings} temuan{d.description ? ` · ${d.description}` : ''}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Ubah" onClick={() => setEdit({ id: d.id, code: d.code, name: d.name, description: d.description ?? '', color: d.color ?? 'c1', isGembaTeam: d.isGembaTeam, active: d.active, sortOrder: d.sortOrder })}><Pencil /></button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon text-negative" aria-label="Hapus" onClick={() => remove(d)}><Trash2 /></button>
          </>
        )}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah divisi' : 'Divisi baru'} footer={<><button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Batal</button><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Simpan</button></>}>
        {edit && (
          <div className="flex flex-col gap-3 py-2">
            <Field label="Nama" htmlFor="d-name" required><input id="d-name" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Kode" htmlFor="d-code" hint="Kosongkan untuk otomatis dari nama"><input id="d-code" className="input font-mono" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} maxLength={32} /></Field>
            <Field label="Deskripsi" htmlFor="d-desc"><input id="d-desc" className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={255} /></Field>
            <ColorPicker value={edit.color} onChange={(c) => setEdit({ ...edit, color: c })} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Urutan" htmlFor="d-sort"><input id="d-sort" className="input" type="number" inputMode="numeric" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></Field>
              <Field label="Tim Gemba" htmlFor="d-gemba"><select id="d-gemba" className="select" value={edit.isGembaTeam ? '1' : '0'} onChange={(e) => setEdit({ ...edit, isGembaTeam: e.target.value === '1' })}><option value="0">Bukan</option><option value="1">Ya</option></select></Field>
              <Field label="Status" htmlFor="d-active"><select id="d-active" className="select" value={edit.active ? '1' : '0'} onChange={(e) => setEdit({ ...edit, active: e.target.value === '1' })}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CategoryTab({ rows }: { rows: Category[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const empty = { code: '', name: '', color: 'c1', active: true, sortOrder: rows.length };
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!edit) return; setBusy(true);
    try {
      if (edit.id) await api(`/api/master/categories/${edit.id}`, { method: 'PATCH', json: edit });
      else await api('/api/master/categories', { method: 'POST', json: edit });
      toast('Kategori disimpan', 'positive'); setEdit(null); router.refresh();
    } catch (e) { toast((e as Error).message, 'negative'); } finally { setBusy(false); }
  }
  async function remove(c: Category) {
    if (!confirm(`Hapus kategori ${c.name}?`)) return;
    try { await api(`/api/master/categories/${c.id}`, { method: 'DELETE' }); toast('Dihapus'); router.refresh(); }
    catch (e) { toast((e as Error).message, 'negative'); }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="text-sm text-label">Kategori isu (Delivery, Quality, Safety, Moral, Cost, …) bisa ditambah kapan saja.</p>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({ ...empty })}><Plus /> Kategori baru</button>
      </div>
      <MasterList
        rows={rows}
        render={(c) => (
          <>
            <ColorDot slot={c.color} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2 flex-wrap">{c.name} <span className="font-mono text-xs text-label">{c.code}</span>{!c.active && <Chip tone="neutral">Nonaktif</Chip>}</div>
              <div className="text-xs text-label">{c.findings} temuan</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Ubah" onClick={() => setEdit({ id: c.id, code: c.code, name: c.name, color: c.color ?? 'c1', active: c.active, sortOrder: c.sortOrder })}><Pencil /></button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon text-negative" aria-label="Hapus" onClick={() => remove(c)}><Trash2 /></button>
          </>
        )}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah kategori' : 'Kategori baru'} footer={<><button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Batal</button><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Simpan</button></>}>
        {edit && (
          <div className="flex flex-col gap-3 py-2">
            <Field label="Nama" htmlFor="c-name" required><input id="c-name" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Kode" htmlFor="c-code" hint="Kosongkan untuk otomatis"><input id="c-code" className="input font-mono" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} maxLength={32} /></Field>
            <ColorPicker value={edit.color} onChange={(c) => setEdit({ ...edit, color: c })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Urutan" htmlFor="c-sort"><input id="c-sort" className="input" type="number" inputMode="numeric" value={edit.sortOrder} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} /></Field>
              <Field label="Status" htmlFor="c-active"><select id="c-active" className="select" value={edit.active ? '1' : '0'} onChange={(e) => setEdit({ ...edit, active: e.target.value === '1' })}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UserTab({ rows, divisions }: { rows: User[]; divisions: Division[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const empty = { email: '', name: '', role: 'PIC' as User['role'], divisionId: divisions[0]?.id ?? '', phone: '', password: '', active: true };
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const divName = (id: string | null) => divisions.find((d) => d.id === id)?.name ?? '—';
  async function save() {
    if (!edit) return; setBusy(true);
    try {
      const payload = { ...edit, divisionId: edit.divisionId || null, password: edit.password || undefined };
      if (edit.id) await api(`/api/users/${edit.id}`, { method: 'PATCH', json: payload });
      else await api('/api/users', { method: 'POST', json: payload });
      toast('Pengguna disimpan', 'positive'); setEdit(null); router.refresh();
    } catch (e) { toast((e as Error).message, 'negative'); } finally { setBusy(false); }
  }
  async function toggleActive(x: User) {
    try { await api(`/api/users/${x.id}`, { method: 'PATCH', json: { active: !x.active } }); router.refresh(); }
    catch (e) { toast((e as Error).message, 'negative'); }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <p className="text-sm text-label">PIC harus punya divisi; satu divisi boleh punya banyak PIC. Pengguna baru wajib ganti password saat login pertama.</p>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({ ...empty })}><Plus /> Pengguna baru</button>
      </div>
      <MasterList
        rows={rows}
        render={(x) => (
          <>
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-2 flex-wrap">{x.name} <Chip tone={x.role === 'ADMIN' ? 'brand' : x.role === 'VIEWER' ? 'neutral' : 'informative'}>{x.role}</Chip>{!x.active && <Chip tone="negative">Nonaktif</Chip>}{x.mustChangePassword && x.active && <Chip tone="critical">Belum ganti password</Chip>}</div>
              <div className="text-xs text-label truncate">{x.email} · {divName(x.divisionId)}{x.phone ? ` · ${x.phone}` : ''} · login terakhir {x.lastLoginAt ? fmtDateTime(x.lastLoginAt) : '—'}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(x)}>{x.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Ubah" onClick={() => setEdit({ id: x.id, email: x.email, name: x.name, role: x.role, divisionId: x.divisionId ?? '', phone: x.phone ?? '', password: '', active: x.active })}><Pencil /></button>
          </>
        )}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Ubah pengguna' : 'Pengguna baru'} footer={<><button type="button" className="btn btn-secondary" onClick={() => setEdit(null)}>Batal</button><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy && <Spinner />} Simpan</button></>}>
        {edit && (
          <div className="flex flex-col gap-3 py-2">
            <Field label="Nama" htmlFor="u-name" required><input id="u-name" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email" htmlFor="u-email" required><input id="u-email" className="input" type="email" inputMode="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Peran" htmlFor="u-role"><select id="u-role" className="select" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as User['role'] })}><option value="PIC">PIC</option><option value="ADMIN">Admin</option><option value="VIEWER">Viewer (lihat saja)</option></select></Field>
              <Field label="Divisi" htmlFor="u-div"><select id="u-div" className="select" value={edit.divisionId} onChange={(e) => setEdit({ ...edit, divisionId: e.target.value })}><option value="">— tanpa divisi —</option>{divisions.filter((d) => d.active || d.id === edit.divisionId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            </div>
            <Field label="No. HP / WhatsApp" htmlFor="u-phone"><input id="u-phone" className="input" inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label={edit.id ? 'Password baru (kosongkan bila tidak diganti)' : 'Password awal'} htmlFor="u-pw" required={!edit.id} hint="Min. 8 karakter, huruf + angka. Pengguna diminta mengganti saat login.">
              <div className="flex gap-2">
                <input id="u-pw" className="input" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} autoComplete="new-password" />
                <button type="button" className="btn btn-secondary btn-icon" aria-label="Buat acak" title="Buat password acak" onClick={() => setEdit({ ...edit, password: 'Dor' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10) })}><KeyRound /></button>
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MasterList<T extends { id: string }>({ rows, render }: { rows: T[]; render: (r: T) => React.ReactNode }) {
  if (!rows.length) return <div className="card text-sm text-label">Belum ada data.</div>;
  return (
    <ul className="card !p-0 divide-y divide-[var(--border-subtle)]">
      {rows.map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-3 min-h-[var(--tap)]">{render(r)}</li>)}
    </ul>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <span className="label">Warna (untuk grafik)</span>
      <div className="flex gap-2">
        {COLORS.map((c) => (
          <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onChange(c)} className="w-9 h-9 rounded-full grid place-items-center border-2" style={{ background: `var(--${c})`, borderColor: value === c ? 'var(--ink)' : 'transparent' }} />
        ))}
      </div>
    </div>
  );
}
