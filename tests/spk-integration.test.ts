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

test('SPK approval, recovery, role, exact money and concurrent idempotency', async () => {
  const db = new PrismaClient();
  const password = 'test-password-only';
  const passwordHash = await bcrypt.hash(password, 10);
  const suffix = `${Date.now()}-${Math.random()}`;
  try {
    const admin = await db.user.create({ data: { email: `admin-${suffix}@test.local`, name: 'Admin', role: 'ADMIN_PENGAJUAN', passwordHash } });
    const stakeholder = await db.user.create({ data: { email: `stake-${suffix}@test.local`, name: 'Stakeholder', role: 'STAKEHOLDER', passwordHash } });
    const finance = await db.user.create({ data: { email: `finance-${suffix}@test.local`, name: 'Finance', role: 'FINANCE', passwordHash } });
    const [a, s, f] = await Promise.all([admin, stakeholder, finance].map(user => login(user.email, password)));
    const call = (url: string, cookie: string, method = 'GET', body?: unknown) => fetch(base + '/backend' + url, { method, headers: { Cookie: cookie, Origin: base, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const job = await db.job.create({ data: { ownerId: finance.id, title: 'SPK test', description: 'private', status: 'APPROVED', rab: { create: { status: 'RAB_REVIEW', items: { create: { fixCost: '0' } } } } } });
    const url = `/jobs/${job.id}`;
    assert.equal((await call(url, f)).status, 403);
    assert.equal((await call(url + '/rab', f)).status, 403);
    const setting = await (await call('/settings/spk-trigger', a)).json();
    assert.equal((await call('/settings/spk-trigger', f, 'PUT', { trigger: 'AFTER_RAB_APPROVED', version: setting.version })).status, 403);
    const settings = await Promise.all([1, 2].map(() => call('/settings/spk-trigger', a, 'PUT', { trigger: setting.trigger === 'AFTER_RAB_APPROVED' ? 'MANUAL_FINANCE' : 'AFTER_RAB_APPROVED', version: setting.version })));
    assert.deepEqual(settings.map(response => response.status).sort(), [200, 409]);
    const current = await (await call('/settings/spk-trigger', a)).json();
    assert.equal((await call('/settings/spk-trigger', a, 'PUT', { trigger: 'AFTER_RAB_APPROVED', version: current.version })).status, 200);
    assert.equal((await call(url + '/rab/transitions', s, 'POST', { action: 'approve', version: 0 })).status, 200);
    const prepared = await (await call(url + '/spk', f)).json();
    assert.equal(prepared.trigger, 'AFTER_RAB_APPROVED'); assert.equal(prepared.preparationStatus, 'PENDING');
    assert.equal(prepared.spk.audits[0].event, 'AUTO_PREPARED');
    assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, 'APPROVED');
    assert.equal((await call(url + '/spk/issue', a, 'POST', { number: 'A', amount: '1' })).status, 403);
    assert.equal((await call(url + '/spk/ack', s, 'POST', {})).status, 409);
    for (const amount of ['', '1.001', '10000000000000000', 1]) assert.equal((await call(url + '/spk/issue', f, 'POST', { number: 'A', amount })).status, 422);
    const requests = await Promise.all([1, 2].map(() => call(url + '/spk/issue', f, 'POST', { number: `SPK-${suffix}`, amount: '9999999999999999.99' })));
    assert.deepEqual(requests.map(response => response.status), [200, 200]);
    assert.equal((await call(url + '/spk/issue', f, 'POST', { number: 'different', amount: '1' })).status, 409);
    const acks = await Promise.all([1, 2].map(() => call(url + '/spk/ack', s, 'POST', {})));
    assert.deepEqual(acks.map(response => response.status), [200, 200]);
    const final = await (await call(url + '/spk', f)).json();
    assert.equal(final.spk.amount, '9999999999999999.99');
    assert.deepEqual(final.spk.audits.map((audit: { event: string }) => audit.event), ['AUTO_PREPARED', 'ISSUED', 'ACKNOWLEDGED']);
    await assert.rejects(db.spkAudit.deleteMany({ where: { spkId: final.spk.id } }));
    const legacy = await db.job.create({ data: { ownerId: admin.id, title: 'Legacy', description: '', status: 'APPROVED', rab: { create: { status: 'RAB_APPROVED', spkTrigger: 'MANUAL_FINANCE' } } } });
    const legacyUrl = `/jobs/${legacy.id}/spk`;
    assert.equal((await (await call(legacyUrl, f)).json()).preparationStatus, 'UNPREPARED');
    const prepares = await Promise.all([1, 2].map(() => call(legacyUrl + '/prepare', f, 'POST', {})));
    assert.deepEqual(prepares.map(response => response.status), [200, 200]);
    assert.equal((await call(legacyUrl + '/issue', f, 'POST', { number: `SPK-${suffix}`, amount: '0' })).status, 409);
    const failed = await db.job.create({ data: { ownerId: admin.id, title: 'Failed preparation', description: '', status: 'APPROVED', rab: { create: { status: 'RAB_REVIEW', items: { create: { fixCost: '1' } } } } } });
    await db.$executeRawUnsafe(`CREATE FUNCTION test_spk_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_spk_failure BEFORE INSERT ON "Spk" FOR EACH ROW EXECUTE FUNCTION test_spk_failure()`);
    try {
      assert.equal((await call(`/jobs/${failed.id}/rab/transitions`, s, 'POST', { action: 'approve', version: 0 })).status, 200);
      const unprepared = await (await call(`/jobs/${failed.id}/spk`, f)).json();
      assert.equal(unprepared.preparationStatus, 'UNPREPARED');
      assert.equal(unprepared.trigger, 'AFTER_RAB_APPROVED');
      assert.equal((await db.rab.findUniqueOrThrow({ where: { jobId: failed.id } })).status, 'RAB_APPROVED');
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER test_spk_failure ON "Spk"`);
      await db.$executeRawUnsafe('DROP FUNCTION test_spk_failure()');
    }
    assert.equal((await call(`/jobs/${failed.id}/spk/prepare`, f, 'POST', {})).status, 200);
    await assert.rejects(db.$executeRaw`UPDATE "Spk" SET "amount" = 'NaN'::numeric WHERE "id" = ${final.spk.id}`);

    const racing = await db.job.create({ data: { ownerId: admin.id, title: 'Setting race', description: '', status: 'APPROVED', rab: { create: { status: 'RAB_REVIEW', items: { create: { fixCost: '1' } } } } } });
    const beforeRace = await (await call('/settings/spk-trigger', a)).json();
    const nextTrigger = beforeRace.trigger === 'MANUAL_FINANCE' ? 'AFTER_RAB_APPROVED' : 'MANUAL_FINANCE';
    const [change, approval] = await Promise.all([
      call('/settings/spk-trigger', a, 'PUT', { trigger: nextTrigger, version: beforeRace.version }),
      call(`/jobs/${racing.id}/rab/transitions`, s, 'POST', { action: 'approve', version: 0 }),
    ]);
    assert.equal(change.status, 200); assert.equal(approval.status, 200);
    const raceResult = await (await call(`/jobs/${racing.id}/spk`, f)).json();
    assert.ok([beforeRace.trigger, nextTrigger].includes(raceResult.trigger));
    assert.equal(raceResult.preparationStatus, raceResult.trigger === 'AFTER_RAB_APPROVED' ? 'PENDING' : 'UNPREPARED');
    assert.equal((await (await call('/settings/spk-trigger', a)).json()).trigger, nextTrigger);

    await db.$executeRawUnsafe(`CREATE FUNCTION test_spk_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_spk_audit_failure BEFORE INSERT ON "SpkAudit" FOR EACH ROW EXECUTE FUNCTION test_spk_audit_failure()`);
    try {
      const pending = await db.job.create({ data: { ownerId: admin.id, title: 'Audit failure', description: '', status: 'APPROVED', rab: { create: { status: 'RAB_APPROVED', spkTrigger: 'MANUAL_FINANCE' } } } });
      assert.equal((await call(`/jobs/${pending.id}/spk/prepare`, f, 'POST', {})).status, 500);
      assert.equal((await (await call(`/jobs/${pending.id}/spk`, f)).json()).preparationStatus, 'UNPREPARED');
      assert.equal((await call(legacyUrl + '/issue', f, 'POST', { number: `audit-${suffix}`, amount: '1' })).status, 500);
      assert.equal((await (await call(legacyUrl, f)).json()).preparationStatus, 'PENDING');
      assert.equal((await call(legacyUrl + '/ack', s, 'POST', {})).status, 409);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER test_spk_audit_failure ON "SpkAudit"`);
      await db.$executeRawUnsafe('DROP FUNCTION test_spk_audit_failure()');
    }
    await db.$executeRawUnsafe(`CREATE FUNCTION test_setting_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER test_setting_audit_failure BEFORE INSERT ON "SettingAudit" FOR EACH ROW EXECUTE FUNCTION test_setting_audit_failure()`);
    try {
      const settingBeforeFailure = await (await call('/settings/spk-trigger', a)).json();
      const otherTrigger = settingBeforeFailure.trigger === 'MANUAL_FINANCE' ? 'AFTER_RAB_APPROVED' : 'MANUAL_FINANCE';
      assert.equal((await call('/settings/spk-trigger', a, 'PUT', { trigger: otherTrigger, version: settingBeforeFailure.version })).status, 500);
      assert.deepEqual(await (await call('/settings/spk-trigger', a)).json(), settingBeforeFailure);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER test_setting_audit_failure ON "SettingAudit"`);
      await db.$executeRawUnsafe('DROP FUNCTION test_setting_audit_failure()');
    }
  } finally { await db.$disconnect(); }
});
