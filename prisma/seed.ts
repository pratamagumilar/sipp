import bcrypt from 'bcryptjs';
import { db } from '../server/db';

async function main() {
  for (const code of ['IPTL TM', 'PLTD', 'PLTS', 'PLTMH', 'DISTEM', 'DISTER']) {
    await db.installationType.upsert({ where: { code }, update: { name: code }, create: { code, name: code } });
  }
  if (process.env.NODE_ENV === 'production') return;
  for (const [email, name, role, password] of [
    ['admin@si.com', 'Admin Pengajuan', 'ADMIN_PENGAJUAN', process.env.SEED_ADMIN_PASSWORD],
    ['stakeholder@si.com', 'Stakeholder', 'STAKEHOLDER', process.env.SEED_STAKEHOLDER_PASSWORD],
  ] as const) {
    if (await db.user.findUnique({ where: { email } })) continue;
    if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error(`Password seed untuk ${email} wajib 12-72 byte`);
    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash } });
  }
}
main().finally(() => db.$disconnect());
