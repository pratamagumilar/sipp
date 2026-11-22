import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const base = process.env.TEST_URL || 'http://localhost:3000';
if (process.env.ALLOW_ISOLATED_INTEGRATION_TESTS !== 'yes' || !process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('_test')) throw new Error('Requires explicitly enabled isolated _test database');

async function login(email: string, password: string) {
  const csrf = await fetch(base + '/api/auth/csrf');
  const cookie = csrf.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const { csrfToken } = await csrf.json();
  const response = await fetch(base + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Origin: base }, body: new URLSearchParams({ csrfToken, email, password, callbackUrl: base }) });
  const session = response.headers.getSetCookie().map(value => value.split(';')[0]).filter(value => value.includes('session-token=')).join('; ');
  assert.ok(session);
  return session;
}

test('RAB manual: akses, presisi, konkurensi, transisi dan audit immutable', async () => {
  const db = new PrismaClient();
  const password = 'test-password-only';
  const hash = await bcrypt.hash(password, 10);
  const suffix = `${Date.now()}-${Math.random()}`;
  const owner = await db.user.create({ data: { email: `owner-${suffix}@test.local`, name: 'Owner', role: 'ADMIN_PENGAJUAN', passwordHash: hash } });
  const other = await db.user.create({ data: { email: `other-${suffix}@test.local`, name: 'Other', role: 'ADMIN_PENGAJUAN', passwordHash: hash } });
  const reviewer = await db.user.create({ data: { email: `review-${suffix}@test.local`, name: 'Reviewer', role: 'STAKEHOLDER', passwordHash: hash } });
  try {
    const [ownerCookie, otherCookie, reviewerCookie] = await Promise.all([owner, other, reviewer].map(user => login(user.email, password)));
    const call = (url: string, cookie: string, method = 'GET', body?: unknown) => fetch(base + '/backend' + url, { method, headers: { Cookie: cookie, Origin: base, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const job = await db.job.create({ data: { ownerId: owner.id, title: 'Tes RAB', description: 'private', offerValue: '42.25', status: 'DRAFT', attachments: { create: { filename: 'private', storageId: `private-${suffix}`, mimeType: 'application/octet-stream', size: 0 } } }, include: { attachments: true } });
    const url = `/jobs/${job.id}`;
    assert.equal((await call(url, otherCookie)).status, 404);
    assert.equal((await call(url + '/rab', otherCookie, 'POST', {})).status, 404);
    assert.equal((await call(url + '/rab', otherCookie)).status, 404);
    assert.ok(!(await (await call('/rabs/jobs', otherCookie)).json()).some((entry: { id: string }) => entry.id === job.id));
    await db.job.update({ where: { id: job.id }, data: { status: 'APPROVED' } });
    const listed = (await (await call('/rabs/jobs', otherCookie)).json()).find((entry: { id: string }) => entry.id === job.id);
    assert.equal(listed.offerValue, '42.25'); assert.equal(listed.rab, null);
    assert.equal(listed.description, undefined); assert.equal(listed.attachments, undefined);
    assert.equal((await call(url, otherCookie)).status, 404);
    assert.equal((await call('/attachments/' + job.attachments[0].id, otherCookie)).status, 404);
    assert.equal((await call(url + '/rab', reviewerCookie, 'POST', {})).status, 403);
    const creates = await Promise.all([1, 2].map(() => call(url + '/rab', otherCookie, 'POST', {})));
    assert.deepEqual(creates.map(response => response.status).sort(), [201, 409]);
    const initial = await (await call(url + '/rab', ownerCookie)).json();
    assert.equal(initial.job.offerValue, '42.25'); assert.equal(initial.audits.length, 1);
    const items = Object.fromEntries(['fixCost', 'sppjTransport', 'nidi', 'izinEsdm', 'lhpp', 'pnbp', 'verifikator', 'sewaAlat', 'variabelCost', 'ppn', 'jumlahNilaiPekerjaan', 'biayaOperasional', 'rencanaMargin'].map(key => [key, null]));
    const emptySubmit = await call(url + '/rab/transitions', ownerCookie, 'POST', { action: 'submit', version: 0 });
    assert.equal(emptySubmit.status, 422); assert.match((await emptySubmit.json()).error, /kolom biaya/);
    const stillDraft = await (await call(url + '/rab', ownerCookie)).json();
    assert.equal(stillDraft.status, 'RAB_DRAFT'); assert.equal(stillDraft.version, 0); assert.equal(stillDraft.audits.length, 1);
    assert.equal((await call(url + '/rab', ownerCookie, 'PUT', { version: 0, items, notes: '' })).status, 200);
    assert.equal((await call(url + '/rab/transitions', ownerCookie, 'POST', { action: 'submit', version: 1 })).status, 422);
    assert.equal((await call(url + '/rab', ownerCookie, 'PUT', { version: 1, items: { ...items, fixCost: '0' }, notes: '' })).status, 200);
    assert.equal((await call(url + '/rab/transitions', ownerCookie, 'POST', { action: 'submit', version: 2 })).status, 200);
    assert.equal((await call(url + '/rab/transitions', reviewerCookie, 'POST', { action: 'revise', version: 3, reason: 'Perlu rincian lagi' })).status, 200);
    const race = await Promise.all([
      call(url + '/rab', otherCookie, 'PUT', { version: 4, items, notes: '' }),
      call(url + '/rab/transitions', ownerCookie, 'POST', { action: 'submit', version: 4 }),
    ]);
    assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
    const raced = await (await call(url + '/rab', ownerCookie)).json();
    if (raced.status === 'RAB_REVIEW') {
      assert.equal(raced.items.fixCost, '0');
      assert.equal((await call(url + '/rab/transitions', reviewerCookie, 'POST', { action: 'revise', version: 5, reason: 'Perlu rincian lagi' })).status, 200);
    } else {
      assert.equal(raced.items.fixCost, null);
      assert.equal((await call(url + '/rab/transitions', ownerCookie, 'POST', { action: 'submit', version: 5 })).status, 422);
    }
    const baseVersion = raced.status === 'RAB_REVIEW' ? 6 : 5;
    const payload = { version: baseVersion, items: { ...items, fixCost: '9999999999999999.99', ppn: '0.01' }, notes: 'Manual' };
    assert.equal((await call(url + '/rab', otherCookie, 'PUT', { ...payload, items: { ...items, fixCost: 1 } })).status, 422);
    assert.equal((await call(url + '/rab', otherCookie, 'PUT', { ...payload, items: { ...items, fixCost: '1.001' } })).status, 422);
    assert.equal((await call(url + '/rab', otherCookie, 'PUT', { ...payload, offerValue: '1' })).status, 422);
    const saves = await Promise.all([1, 2].map(() => call(url + '/rab', otherCookie, 'PUT', payload)));
    assert.deepEqual(saves.map(response => response.status).sort(), [200, 409]);
    const saved = await (await call(url + '/rab', otherCookie)).json();
    assert.equal(saved.items.fixCost, '9999999999999999.99'); assert.equal(saved.items.ppn, '0.01'); assert.equal(saved.items.nidi, null);
    assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).offerValue?.toString(), '42.25');
    assert.equal((await call(url + '/rab/transitions', reviewerCookie, 'POST', { action: 'submit', version: baseVersion + 1 })).status, 403);
    assert.equal((await call(url + '/rab/transitions', otherCookie, 'POST', { action: 'submit', version: baseVersion + 1 })).status, 200);
    assert.equal((await call(url + '/rab', otherCookie, 'PUT', { ...payload, version: baseVersion + 2 })).status, 409);
    assert.equal((await call(url + '/rab/transitions', reviewerCookie, 'POST', { action: 'revise', version: baseVersion + 2, reason: 'pendek' })).status, 422);
    assert.equal((await call(url + '/rab/transitions', reviewerCookie, 'POST', { action: 'revise', version: baseVersion + 2, reason: 'Perlu rincian lagi' })).status, 200);
    assert.equal((await call(url + '/rab/transitions', ownerCookie, 'POST', { action: 'submit', version: baseVersion + 3 })).status, 200);
    const approvals = await Promise.all([1, 2].map(() => call(url + '/rab/transitions', reviewerCookie, 'POST', { action: 'approve', version: baseVersion + 4 })));
    assert.deepEqual(approvals.map(response => response.status).sort(), [200, 409]);
    const final = await (await call(url + '/rab', otherCookie)).json();
    assert.equal(final.status, 'RAB_APPROVED'); assert.equal(final.audits.length, raced.status === 'RAB_REVIEW' ? 9 : 7);
    const audit = await db.rabAudit.findFirstOrThrow({ where: { rabId: final.id } });
    await assert.rejects(db.rabAudit.update({ where: { id: audit.id }, data: { reason: 'tampered' } }));
    await assert.rejects(db.rabAudit.delete({ where: { id: audit.id } }));
  } finally { await db.$disconnect(); }
});
