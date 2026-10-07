// Versi client-safe dari attachmentUrl (tanpa import server-only).
export type AttachmentLike = { id: string; driver: string; fileId: string; isPublic: boolean; fileName?: string; mimeType?: string };

export function attachmentUrl(a: AttachmentLike, size: 'thumb' | 'full' = 'full') {
  if (a.driver === 'gdrive' && a.isPublic) {
    const w = size === 'thumb' ? 400 : 1600;
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(a.fileId)}&sz=w${w}`;
  }
  return `/api/attachments/${a.id}${size === 'thumb' ? '?thumb=1' : ''}`;
}
