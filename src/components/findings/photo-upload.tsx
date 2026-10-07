'use client';
/* Unggah foto bukti: kompres di browser (canvas) → POST /api/upload → Google Drive.
 * Kompresi di client penting: foto HP 4–8 MB melebihi batas body Vercel (4,5 MB)
 * dan memboroskan kuota Drive. Default 1600px / kualitas 0.82 (dari Settings). */
import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { Spinner } from '@/components/ui/primitives';
import { attachmentUrl, type AttachmentLike } from '@/lib/attachment-url';
import { useToast } from '@/components/ui/toast';
import { CameraModal } from './camera-modal';

export type UploadedPhoto = AttachmentLike & { previewUrl?: string };

async function compressImage(file: File, maxPx: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { blob: file, width: 0, height: 0 };
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, width: bitmap.width, height: bitmap.height };
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return { blob: blob ?? file, width: w, height: h };
}

export function PhotoUpload({ value, onChange, maxPx = 1600, quality = 0.82, max = 8, disabled }: {
  value: UploadedPhoto[];
  onChange: (next: UploadedPhoto[]) => void;
  maxPx?: number;
  quality?: number;
  max?: number;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(0);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [camOpen, setCamOpen] = useState(false);
  // Layar sentuh (HP/PDT) → aplikasi kamera bawaan lewat <input capture>; laptop → webcam di dalam app.
  const [useNativeCamera, setUseNativeCamera] = useState(true);
  useEffect(() => { setUseNativeCamera(matchMedia('(pointer:coarse)').matches || !navigator.mediaDevices?.getUserMedia); }, []);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    const list = Array.from(files).slice(0, Math.max(0, max - value.length));
    if (list.length < files.length) toast(`Maksimal ${max} foto`, 'negative');
    let current = value;
    for (const f of list) {
      if (!f.type.startsWith('image/')) { toast(`${f.name} bukan gambar`, 'negative'); continue; }
      setBusy((b) => b + 1);
      try {
        const { blob, width, height } = await compressImage(f, maxPx, quality);
        const fd = new FormData();
        fd.append('file', blob, f.name.replace(/\.[^.]+$/, '') + '.jpg');
        if (width) fd.append('width', String(width));
        if (height) fd.append('height', String(height));
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload gagal');
        const previewUrl = URL.createObjectURL(blob);
        current = [...current, { ...data, previewUrl }];
        onChange(current);
      } catch (e) {
        toast((e as Error).message, 'negative');
      } finally {
        setBusy((b) => b - 1);
      }
    }
  }

  async function remove(p: UploadedPhoto) {
    onChange(value.filter((x) => x.id !== p.id));
    fetch(`/api/attachments/${p.id}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <div>
      <div className="photo-grid mb-2">
        {value.map((p) => (
          <div key={p.id} className="relative">
            <button type="button" className="w-full" onClick={() => window.open(p.previewUrl || attachmentUrl(p, 'full'), '_blank')} aria-label="Lihat foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl || attachmentUrl(p, 'thumb')} alt={p.fileName || 'foto'} loading="lazy" />
            </button>
            {!disabled && (
              <button type="button" className="photo-rm" onClick={() => remove(p)} aria-label="Hapus foto"><X className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        {busy > 0 && (
          <div className="grid place-items-center aspect-square rounded-lg border border-dashed border-strong text-label">
            <Spinner className="w-5 h-5" />
          </div>
        )}
      </div>
      {!disabled && value.length < max && (
        <div className="flex gap-2 flex-wrap">
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className="btn btn-secondary" onClick={() => (useNativeCamera ? camRef.current?.click() : setCamOpen(true))}><Camera /> Kamera</button>
          <button type="button" className="btn btn-secondary" onClick={() => galRef.current?.click()}><ImagePlus /> Galeri</button>
        </div>
      )}
      <div className="help">Foto dikompresi otomatis (maks {maxPx}px) lalu disimpan ke Google Drive.</div>
      <CameraModal open={camOpen} onClose={() => setCamOpen(false)} onCapture={(blob) => handleFiles([new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' })])} />
    </div>
  );
}

export function PhotoGrid({ photos }: { photos: AttachmentLike[] }) {
  if (!photos.length) return null;
  return (
    <div className="photo-grid">
      {photos.map((p) => (
        <a key={p.id} href={attachmentUrl(p, 'full')} target="_blank" rel="noopener noreferrer" aria-label="Buka foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={attachmentUrl(p, 'thumb')} alt={p.fileName || 'foto'} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
