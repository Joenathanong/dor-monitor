/* Seed awal: divisi, kategori, setting, dan admin pertama.
 * Aman dijalankan berulang (upsert) — tidak menimpa data yang sudah diubah user
 * kecuali nama/urutan master bawaan. */
import '../scripts/load-env';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

const DIVISIONS = [
  { code: 'INV-IEG', name: 'Inventory IEG', color: 'c1', isGembaTeam: false },
  { code: 'INV-EJI', name: 'Inventory EJI', color: 'c3', isGembaTeam: false },
  { code: 'FUL', name: 'Fulfilment', color: 'c2', isGembaTeam: false },
  { code: 'QAQC', name: 'QA/QC', color: 'c4', isGembaTeam: true },
  { code: 'K3', name: 'K3', color: 'c5', isGembaTeam: false },
];

const CATEGORIES = [
  { code: 'DELIVERY', name: 'Delivery', color: 'c3' },
  { code: 'QUALITY', name: 'Quality', color: 'c1' },
  { code: 'SAFETY', name: 'Safety', color: 'c4' },
  { code: 'MORAL', name: 'Moral', color: 'c2' },
  { code: 'COST', name: 'Cost', color: 'c5' },
];

const SETTINGS: Record<string, string> = {
  app_name: 'DOR IEG',
  sla_days: '2',            // batas tindak lanjut pertama (hari)
  sla_count_weekend: 'true', // true = hari kalender, false = hari kerja (Sen–Jum)
  gemba_enabled: 'true',
  max_photo_px: '1600',      // sisi terpanjang foto setelah kompresi di client
  photo_quality: '0.82',
};

async function main() {
  for (const [i, d] of DIVISIONS.entries()) {
    await prisma.division.upsert({
      where: { code: d.code },
      update: { name: d.name, sortOrder: i },
      create: { ...d, sortOrder: i },
    });
  }
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, sortOrder: i },
      create: { ...c, sortOrder: i },
    });
  }
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@ptieg.co.id').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const name = process.env.SEED_ADMIN_NAME || 'Administrator';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { email, name, role: 'ADMIN', passwordHash: hashPassword(password), mustChangePassword: true },
    });
    console.log(`Admin dibuat: ${email} / ${password} (wajib ganti password saat login pertama)`);
  } else {
    console.log(`Admin sudah ada: ${email}`);
  }
  console.log('Seed selesai.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
