'use client';
/* Kamera di dalam app (getUserMedia) — dipakai di laptop/desktop, karena atribut
 * <input capture> hanya dipahami browser HP. Di HP tetap memakai aplikasi kamera bawaan. */
import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X } from 'lucide-react';
import { Spinner } from '@/components/ui/primitives';

export function CameraModal({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr(null); setReady(false);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Browser tidak mendukung kamera');
        const constraints: MediaStreamConstraints = {
          video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setReady(true);
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === 'videoinput'));
      } catch (e) {
        const name = (e as DOMException).name;
        setErr(name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di ikon gembok/kamera pada address bar, lalu coba lagi.' : name === 'NotFoundError' ? 'Kamera tidak ditemukan di perangkat ini.' : (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing, deviceId]);

  useEffect(() => {
    if (!open) return;
    const main = document.getElementById('main');
    if (main) main.style.overflowY = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { if (main) main.style.overflowY = 'auto'; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) { onCapture(b); onClose(); } }, 'image/jpeg', 0.92);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 grid place-items-center p-3" style={{ background: 'var(--overlay)', zIndex: 'var(--z-modal)' }} role="dialog" aria-modal="true" aria-label="Kamera">
      <div className="card w-full max-w-[720px] flex flex-col gap-3 !p-3">
        <div className="flex items-center gap-2">
          <span className="card-title flex-1">Ambil foto</span>
          {devices.length > 1 && (
            <select className="select !w-auto !h-9 !text-sm" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} aria-label="Pilih kamera">
              <option value="">Kamera otomatis</option>
              {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${i + 1}`}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => { setDeviceId(''); setFacing((f) => (f === 'user' ? 'environment' : 'user')); }} aria-label="Ganti kamera depan/belakang" title="Ganti kamera"><RefreshCw /></button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Tutup"><X /></button>
        </div>
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video grid place-items-center">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-contain" />
          {!ready && !err && <Spinner className="absolute w-6 h-6 text-white" />}
          {err && <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white">{err}</div>}
        </div>
        <div className="btn-group flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={snap} disabled={!ready}><Camera /> Ambil foto</button>
        </div>
      </div>
    </div>
  );
}
