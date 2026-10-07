/* Reset password user dari CLI: npm run db:passwd -- email@x.com PasswordBaru */
import '../scripts/load-env';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Pakai: npm run db:passwd -- email@x.com PasswordBaru');
    process.exit(1);
  }
  await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: { passwordHash: hashPassword(password), mustChangePassword: true, sessionVersion: { increment: 1 } },
  });
  console.log('Password diganti untuk', email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
