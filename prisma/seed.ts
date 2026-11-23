import bcrypt from 'bcryptjs';
import { db } from '../server/db';

async function main() {
  const accounts = [
    ['admin@si.com', 'Admin Pengajuan', 'ADMIN_PENGAJUAN', process.env.SEED_ADMIN_PASSWORD],
    ['stakeholder@si.com', 'Stakeholder', 'STAKEHOLDER', process.env.SEED_STAKEHOLDER_PASSWORD],
    ['finance@si.com', 'Finance', 'FINANCE', process.env.SEED_FINANCE_PASSWORD],
  ] as const;
  const pending: { email: string; name: string; role: typeof accounts[number][2]; passwordHash: string }[] = [];
  if (process.env.NODE_ENV !== 'production') for (const [email, name, role, password] of accounts) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (role === 'FINANCE' && existing.role !== role) throw new Error(`Akun ${email} sudah ada dengan role ${existing.role}, bukan FINANCE; tidak ada akun yang diubah`);
      continue;
    }
    if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error(`Password seed untuk ${email} wajib 12-72 byte`);
    pending.push({ email, name, role, passwordHash: await bcrypt.hash(password, 12) });
  }
  await db.$transaction(async tx => {
    for (const code of ['IPTL TM', 'PLTD', 'PLTS', 'PLTMH', 'DISTEM', 'DISTER']) {
      await tx.installationType.upsert({ where: { code }, update: { name: code }, create: { code, name: code } });
    }
    for (const account of pending) {
      const user = await tx.user.upsert({ where: { email: account.email }, update: {}, create: account });
      if (account.role === 'FINANCE' && user.role !== 'FINANCE') throw new Error(`Akun ${account.email} sudah ada dengan role ${user.role}, bukan FINANCE; transaksi dibatalkan`);
    }
  });
}
main().finally(() => db.$disconnect());
