import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const base = process.env.TEST_URL || 'http://localhost:3000';
if (process.env.ALLOW_ISOLATED_INTEGRATION_TESTS !== 'yes' || !process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('_test')) {
  throw new Error('Integration tests require an explicitly enabled isolated _test database and matching test servers');
}
test('login menolak password yang melampaui 72 byte meskipun karakter sedikit', async () => {
  const db = new PrismaClient();
  const email = `bcrypt-${Date.now()}@local.test`;
  const password = 'é'.repeat(36);
  const user = await db.user.create({ data: { email, name: 'Tes bcrypt', role: 'ADMIN_PENGAJUAN', passwordHash: await bcrypt.hash(password, 12) } });
  try {
    assert.ok(await login(email, password));
    await assert.rejects(login(email, password + 'a'));
  } finally { await db.user.delete({ where: { id: user.id } }); await db.$disconnect(); }
});
async function login(email: string, password: string) {
  const csrfResponse = await fetch(base + '/api/auth/csrf');
  const csrfCookie = csrfResponse.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(base + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookie, Origin: base }, body: new URLSearchParams({ csrfToken, email, password, callbackUrl: base }) });
  const cookies = response.headers.getSetCookie().map(s => s.split(';')[0]).filter(s => s.includes('session-token=')).join('; ');
  assert.ok(cookies, 'login harus menghasilkan cookie sesi');
  return cookies;
}
test('alur pengajuan, otorisasi, konkurensi, lampiran dan audit', async () => {
  const admin = await login('admin@si.com', process.env.SEED_ADMIN_PASSWORD!);
  const stakeholder = await login('stakeholder@si.com', process.env.SEED_STAKEHOLDER_PASSWORD!);
  async function call(url: string, cookie: string, method = 'GET', body?: unknown) {
    const headers: Record<string, string> = { Cookie: cookie, Origin: base };
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    return fetch(base + '/backend' + url, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  }
  assert.equal((await call('/jobs', '')).status, 401);
  assert.equal((await call('/jobs', stakeholder, 'POST', { title: 'a', description: 'b', estimatedCost: '' })).status, 403);
  const master = await (await call('/installation-types', admin)).json();
  assert.deepEqual(master.map((item: { code: string }) => item.code).sort(), ['IPTL TM', 'PLTD', 'PLTS', 'PLTMH', 'DISTEM', 'DISTER'].sort());
  const created = await call('/jobs', admin, 'POST', { title: '', description: '', estimatedCost: '' });
  assert.equal(created.status, 201); const job = await created.json(); const url = '/jobs/' + job.id;
  assert.equal((await call(url + '/transitions', admin, 'POST', { action: 'submit', version: 0 })).status, 422);
  const updated = await call(url, admin, 'PUT', { title: 'Tes integrasi', description: 'Pengujian alur', agenda: 'AG-01', applicant: 'Pemohon', installationOwner: 'Pemilik', installationTypeCode: 'PLTS', capacity: '12.3456', capacityUnit: 'kWp', location: 'Lokasi', offerValue: '250.75', estimatedCost: '120.50', version: 0 }); assert.equal(updated.status, 200);
  const saved = await updated.json();
  assert.equal(saved.agenda, 'AG-01'); assert.equal(saved.applicant, 'Pemohon'); assert.equal(saved.installationOwner, 'Pemilik'); assert.equal(saved.installationTypeCode, 'PLTS'); assert.equal(saved.capacity, '12.3456'); assert.equal(saved.capacityUnit, 'kWp'); assert.equal(saved.location, 'Lokasi'); assert.equal(saved.offerValue, '250.75'); assert.equal(saved.estimatedCost, '120.5');
  const otherEmail = `other-${Date.now()}@local.test`;
  const dbOther = new PrismaClient();
  const otherUser = await dbOther.user.create({ data: { email: otherEmail, name: 'Admin lain', role: 'ADMIN_PENGAJUAN', passwordHash: await bcrypt.hash('other-test-password', 12) } });
  const other = await login(otherEmail, 'other-test-password');
  const makeUpload = (version?: string, size = 5) => { const data = new FormData(); if (version !== undefined) data.append('version', version); data.append('file', new Blob([new Uint8Array(size)]), 'test.bin'); return data; };
  assert.equal((await call(url + '/attachments', other, 'POST', makeUpload('1'))).status, 409);
  assert.equal((await call(url + '/attachments', stakeholder, 'POST', makeUpload('1'))).status, 403);
  assert.equal((await call(url + '/attachments', admin, 'POST', makeUpload())).status, 422);
  assert.equal((await call(url + '/attachments', admin, 'POST', makeUpload(''))).status, 422);
  assert.equal((await call(url + '/attachments', admin, 'POST', makeUpload('0'))).status, 409);
  assert.equal((await call(url + '/attachments', admin, 'POST', makeUpload('1', 10 * 1024 * 1024 + 1))).status, 422);
  const form = new FormData(); form.append('version', '1'); form.append('file', new Blob(['lampiran uji']), 'uji.txt');
  const upload = await call(url + '/attachments', admin, 'POST', form); assert.equal(upload.status, 201); const attachment = await upload.json();
  assert.equal((await call('/attachments/' + attachment.id, '')).status, 401);
  assert.equal(await (await call('/attachments/' + attachment.id, stakeholder)).text(), 'lampiran uji');
  assert.equal((await call('/attachments/' + attachment.id, other)).status, 404);
  await dbOther.user.delete({ where: { id: otherUser.id } }); await dbOther.$disconnect();
  assert.equal((await call(url + '/transitions', admin, 'POST', { action: 'submit', version: 2 })).status, 200);
  assert.equal((await call(url + '/attachments', admin, 'POST', makeUpload('3'))).status, 409);
  assert.equal((await call(url, admin, 'PUT', { title: 'x', description: 'x', estimatedCost: '1', version: 3 })).status, 409);
  assert.equal((await call(url + '/transitions', stakeholder, 'POST', { action: 'reject', version: 3, reason: 'pendek' })).status, 422);
  assert.equal((await call(url + '/transitions', stakeholder, 'POST', { action: 'reject', version: 3, reason: 'Perlu rincian tambahan' })).status, 200);
  assert.equal((await call(url + '/transitions', admin, 'POST', { action: 'revise', version: 4 })).status, 200);
  assert.equal((await call(url + '/transitions', admin, 'POST', { action: 'submit', version: 5 })).status, 200);
  const results = await Promise.all([1, 2].map(() => call(url + '/transitions', stakeholder, 'POST', { action: 'approve', version: 6 })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const detail = await (await call(url, admin)).json(); assert.equal(detail.status, 'APPROVED'); assert.equal(detail.audits.length, 6);
  const db = new PrismaClient();
  try { await assert.rejects(db.auditLog.delete({ where: { id: detail.audits[0].id } })); } finally { await db.$disconnect(); }
});
