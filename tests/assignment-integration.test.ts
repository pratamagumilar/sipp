import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { db } from '../server/db';
import { handleApi } from '../server/api';
import { sampleAssignment } from '../app/assignment-data';

if (process.env.ALLOW_ISOLATED_INTEGRATION_TESTS !== 'yes' || !process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes('_test')) throw new Error('Requires explicitly enabled isolated _test database');

test('akun pekerja, penugasan persisten, RBAC, konkurensi, progres, pencabutan akses dan audit', async () => {
  const suffix = Date.now().toString();
  const secret = process.env.AUTH_SECRET!;
  const origin = process.env.AUTH_URL!;
  const password = 'worker-test-password';
  const hash = await bcrypt.hash(password, 4);
  const makeUser = (name: string, role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER' | 'FINANCE' | 'PEKERJA', active = true) => db.user.create({ data: { name, email: `${name}-${suffix}@test.local`, passwordHash: hash, role, active, occupation: 'Teknisi' } });
  const admin = await makeUser('admin-assign', 'ADMIN_PENGAJUAN');
  const reviewer = await makeUser('stake-assign', 'STAKEHOLDER');
  const finance = await makeUser('finance-assign', 'FINANCE');
  const worker = await makeUser('worker-assign', 'PEKERJA');
  const other = await makeUser('other-assign', 'PEKERJA');
  const inactive = await makeUser('inactive-assign', 'PEKERJA', false);
  async function call(path: string, actor: { id: string } | null, method = 'GET', data?: unknown, requestOrigin = origin) {
    const jwt = actor ? await encode({ token: { sub: actor.id }, secret, salt: 'authjs.session-token' }) : '';
    return handleApi(new Request(origin + '/backend' + path, { method, headers: { Cookie: jwt ? `authjs.session-token=${jwt}` : '', Origin: requestOrigin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: data === undefined ? undefined : JSON.stringify(data) }), path.slice(1).split('/'));
  }
  const makeSpk = async (issued: boolean, serial: string) => {
    const job = await db.job.create({ data: { ownerId: admin.id, title: `Job-${serial}`, description: 'Job test private', status: 'APPROVED', attachments: { create: { filename: 'private', storageId: `assign-${suffix}-${serial}`, mimeType: 'text/plain', size: 1 } }, rab: { create: { status: 'RAB_APPROVED', spk: { create: { status: issued ? 'ISSUED' : 'PENDING', ...(issued ? { number: `SPK-${suffix}-${serial}`, amount: '1' } : {}) } } } } }, include: { rab: { include: { spk: true } }, attachments: true } });
    return { job, spk: job.rab!.spk! };
  };
  try {
    assert.equal((await call('/assignments', null)).status, 401);
    assert.equal((await call('/workers', worker)).status, 403);
    assert.equal((await call('/workers', finance)).status, 403);
    const account = { name: 'New worker', email: `new-worker-${suffix}@test.local`, occupation: 'Teknisi', password };
    assert.equal((await call('/workers', admin, 'POST', { ...account, role: 'ADMIN_PENGAJUAN' })).status, 422);
    assert.equal((await call('/workers', admin, 'POST', account, 'https://invalid.test')).status, 403);
    const created = await call('/workers', admin, 'POST', account); assert.equal(created.status, 201);
    const publicUser = await created.json(); assert.equal(publicUser.passwordHash, undefined);
    const stored = await db.user.findUniqueOrThrow({ where: { id: publicUser.id } });
    assert.equal(stored.role, 'PEKERJA'); assert.ok(stored.active); assert.ok(await bcrypt.compare(password, stored.passwordHash));
    assert.equal((await call('/workers', admin, 'POST', account)).status, 409);
    assert.equal((await call('/workers', admin, 'POST', { ...account, password: 'é'.repeat(37) })).status, 422);
    assert.ok((await (await call('/workers', admin)).json()).every((user: { id: string }) => user.id !== inactive.id));
    const { job, spk } = await makeSpk(true, 'one');
    const pending = await makeSpk(false, 'pending');
    const second = await makeSpk(true, 'two');
    const url = '/assignments/' + spk.id;
    assert.equal((await call('/assignments', worker)).status, 200);
    assert.deepEqual(await (await call('/assignments', worker)).json(), []);
    assert.equal((await call(url, worker)).status, 404);
    const { roster: _roster, ...letter } = sampleAssignment();
    const payload = { ...letter, number: `SPT-${suffix}-one`, version: null, roster: [{ userId: worker.id, occupation: 'Ketua pemeriksaan', role: 'Ketua' }] };
    assert.equal((await call(url, worker, 'PUT', payload)).status, 403);
    assert.equal((await call(url, finance, 'PUT', payload)).status, 403);
    assert.equal((await call(url, reviewer, 'PUT', payload)).status, 403);
    assert.equal((await call('/assignments/' + pending.spk.id, admin, 'PUT', payload)).status, 404);
    for (const invalid of [
      { ...payload, start: '2026-02-30' }, { ...payload, end: '2020-01-01' },
      { ...payload, roster: [{ userId: inactive.id, occupation: 'Teknisi', role: 'Ketua' }] },
      { ...payload, roster: [{ userId: admin.id, occupation: 'Teknisi', role: 'Ketua' }] },
      { ...payload, roster: [...payload.roster, ...payload.roster] },
      { ...payload, roster: [{ ...payload.roster[0], role: 'Anggota' }] },
      { ...payload, status: 'COMPLETED' }, { ...payload, progressPercent: 100 },
    ]) assert.equal((await call(url, admin, 'PUT', invalid)).status, 422);
    assert.equal(await db.assignment.count({ where: { spkId: spk.id } }), 0);
    const firstSaves = await Promise.all([call(url, admin, 'PUT', payload), call(url, admin, 'PUT', payload)]);
    assert.deepEqual(firstSaves.map(response => response.status).sort(), [200, 409]);
    let value = await (await call(url, admin)).json();
    const assignmentId = value.assignment.id;
    assert.equal(value.assignment.roster[0].name, worker.name);
    assert.equal(value.assignment.start, payload.start); assert.equal(value.assignment.audits.length, 1);
    assert.equal((await call('/assignments/' + second.spk.id, admin, 'PUT', payload)).status, 409);
    assert.equal((await call(url, finance)).status, 200); assert.equal((await call(url, reviewer)).status, 200);
    for (const path of ['/jobs/' + job.id, '/jobs/' + job.id + '/rab', '/jobs/' + job.id + '/spk', url]) {
      assert.equal((await call(path, worker)).status, 200, path);
      assert.equal((await call(path, other)).status, 404, path);
    }
    assert.equal((await call('/settings/spk-trigger', worker)).status, 403);
    assert.equal((await call('/jobs', worker, 'POST', {})).status, 403);
    assert.ok((await (await call('/rabs/jobs', worker)).json()).every((entry: { id: string }) => entry.id === job.id));
    assert.equal((await (await call('/spks', other)).json()).length, 0);
    assert.equal((await call(url + '/progress', admin, 'PUT', { progressPercent: 10, notes: '' })).status, 403);
    assert.equal((await call(url + '/progress', other, 'PUT', { progressPercent: 10, notes: '' })).status, 404);
    for (const progressPercent of [-1, 101, 1.5, '20']) assert.equal((await call(url + '/progress', worker, 'PUT', { progressPercent, notes: '' })).status, 422);
    for (const [progressPercent, status] of [[25, 'IN_PROGRESS'], [40, 'IN_PROGRESS'], [100, 'COMPLETED'], [50, 'IN_PROGRESS'], [0, 'ASSIGNED']] as const) {
      const response = await call(url + '/progress', worker, 'PUT', { progressPercent, notes: `Notes ${progressPercent}` }); assert.equal(response.status, 200);
      value = await response.json(); assert.equal(value.assignment.status, status); assert.equal(value.assignment.id, assignmentId); assert.equal(value.assignment.progressNotes, `Notes ${progressPercent}`);
    }
    assert.equal(value.assignment.audits.length, 5, 'same-state progress does not create history');
    assert.equal(value.assignment.version, 0, 'progress does not invalidate letter version');
    const editPayload = { ...payload, version: 0, purpose: 'Updated letter' };
    const races = await Promise.all([call(url, admin, 'PUT', editPayload), call(url, admin, 'PUT', editPayload)]);
    assert.deepEqual(races.map(response => response.status).sort(), [200, 409]);
    value = await (await call(url, admin)).json(); assert.equal(value.assignment.progressNotes, 'Notes 0');
    const progressRace = await Promise.all([80, 95].map(progressPercent => call(url + '/progress', worker, 'PUT', { progressPercent, notes: 'Concurrent progress' })));
    assert.ok(progressRace.every(response => response.status === 200));
    const currentProgress = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
    assert.ok([80, 95].includes(currentProgress.progressPercent));
    assert.equal(await db.assignment.count({ where: { spkId: spk.id } }), 1);
    const audit = await db.assignmentAudit.findFirstOrThrow({ where: { assignmentId } });
    await assert.rejects(db.assignmentAudit.update({ where: { id: audit.id }, data: { event: 'tampered' } }));
    await assert.rejects(db.assignmentAudit.delete({ where: { id: audit.id } }));
    await assert.rejects(db.assignment.update({ where: { id: assignmentId }, data: { progressPercent: 150 } }));
    await assert.rejects(db.assignmentMember.deleteMany({ where: { assignmentId } }));
    assert.equal(await db.assignmentMember.count({ where: { assignmentId } }), 1);
    const replace = await call(url, admin, 'PUT', { ...editPayload, version: 1, roster: [{ userId: other.id, occupation: 'Teknisi', role: 'Ketua' }] }); assert.equal(replace.status, 200);
    for (const path of [url, '/jobs/' + job.id, '/jobs/' + job.id + '/rab', '/jobs/' + job.id + '/spk', '/attachments/' + job.attachments[0].id]) assert.equal((await call(path, worker)).status, 404, path);
    assert.equal((await call(url + '/progress', worker, 'PUT', { progressPercent: 80, notes: 'revoked' })).status, 404);
    assert.equal((await call(url + '/progress', other, 'PUT', { progressPercent: 100, notes: 'Done' })).status, 200);
    await db.user.update({ where: { id: other.id }, data: { active: false } });
    assert.equal((await call(url, other)).status, 401);
    assert.equal((await call(url, admin, 'PUT', { ...editPayload, version: 2, roster: [{ userId: other.id, occupation: 'Teknisi', role: 'Ketua' }] })).status, 422);
    assert.equal((await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } })).progressPercent, 100);
  } finally { await db.$disconnect(); }
});
