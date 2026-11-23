import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

if (process.env.ALLOW_ISOLATED_INTEGRATION_TESTS !== 'yes' || !process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('_test')) throw new Error('Requires explicitly enabled isolated _test database');

test('seed menolak role Finance salah sebelum penulisan', async () => {
  const db = new PrismaClient();
  try {
    assert.equal(await db.user.count({ where: { email: { in: ['finance@si.com', 'admin@si.com', 'stakeholder@si.com'] } } }), 0);
    await db.user.create({ data: { email: 'finance@si.com', name: 'Existing', role: 'STAKEHOLDER', passwordHash: 'existing-hash' } });
    await db.installationType.update({ where: { code: 'PLTD' }, data: { name: 'unchanged sentinel' } });
    const result = spawnSync('npx', ['tsx', 'prisma/seed.ts'], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'development', SEED_ADMIN_PASSWORD: 'admin-test-password', SEED_STAKEHOLDER_PASSWORD: 'stakeholder-test-password', SEED_FINANCE_PASSWORD: 'finance-test-password' } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /finance@si\.com.*STAKEHOLDER.*FINANCE/);
    assert.equal((await db.installationType.findUniqueOrThrow({ where: { code: 'PLTD' } })).name, 'unchanged sentinel');
    assert.equal(await db.user.count({ where: { email: { in: ['admin@si.com', 'stakeholder@si.com'] } } }), 0);
    const existing = await db.user.findUniqueOrThrow({ where: { email: 'finance@si.com' } });
    assert.equal(existing.role, 'STAKEHOLDER'); assert.equal(existing.passwordHash, 'existing-hash');
  } finally { await db.$disconnect(); }
});
