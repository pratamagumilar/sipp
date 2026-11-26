import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
if (process.env.ALLOW_ISOLATED_INTEGRATION_TESTS !== 'yes' || !process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('_test')) throw new Error('Requires explicitly enabled isolated _test database');

test('pekerja login ke ruang kerja sendiri; akun nonaktif ditolak pada login dan sesi existing', async () => {
  const base = process.env.TEST_URL || 'http://localhost:3000';
  const db = new PrismaClient();
  const password = 'worker-auth-test-password';
  const suffix = Date.now();
  const worker = await db.user.create({ data: { name: 'Worker auth test', email: `worker-auth-${suffix}@test.local`, role: 'PEKERJA', passwordHash: await bcrypt.hash(password, 4) } });
  async function login() {
    const csrf = await fetch(base + '/api/auth/csrf');
    const { csrfToken } = await csrf.json();
    const cookie = csrf.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const response = await fetch(base + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Origin: base }, body: new URLSearchParams({ csrfToken, email: worker.email, password, callbackUrl: base }) });
    return response.headers.getSetCookie().filter(value => value.includes('session-token=')).map(value => value.split(';')[0]).join('; ');
  }
  try {
    const cookie = await login(); assert.ok(cookie);
    const response = await fetch(base + '/penugasan', { headers: { Cookie: cookie } });
    assert.equal(response.status, 200); const html = await response.text(); assert.match(html, /Pekerjaan saya/); assert.doesNotMatch(html, /Penyusunan &amp; Review RAB/);
    assert.equal((await fetch(base + '/backend/assignments', { headers: { Cookie: cookie } })).status, 200);
    await db.user.update({ where: { id: worker.id }, data: { active: false } });
    assert.equal(await login(), '');
    assert.equal((await fetch(base + '/backend/assignments', { headers: { Cookie: cookie } })).status, 401);
    const home = await fetch(base + '/', { redirect: 'manual', headers: { Cookie: cookie } });
    assert.equal(home.status, 307); assert.match(home.headers.get('location')!, /login/);
  } finally { await db.$disconnect(); }
});
