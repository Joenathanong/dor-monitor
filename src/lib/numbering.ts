import 'server-only';
import { prisma } from './prisma';

/** Nomor berurutan per prefix per tahun: DOR-2026-0001.
 *  Sengaja TANPA interactive transaction — $transaction pada baris counter yang
 *  sama mudah memicu write conflict di TiDB. Pola: pastikan baris ada → update
 *  atomik increment → baca nilai, dengan 3x retry. */
export async function nextNumber(prefix: 'DOR' | 'GMB' | 'GEMBA', year = new Date().getFullYear()): Promise<string> {
  const key = `${prefix}-${year}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const existing = await prisma.counter.findUnique({ where: { key } });
      if (!existing) {
        try {
          await prisma.counter.create({ data: { key, value: 0 } });
        } catch {
          /* dibuat proses lain — lanjut */
        }
      }
      const updated = await prisma.counter.update({ where: { key }, data: { value: { increment: 1 } } });
      return `${key}-${String(updated.value).padStart(4, '0')}`;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  throw new Error('Gagal membuat nomor');
}
