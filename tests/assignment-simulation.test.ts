import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { assignmentErrors, assignmentFields, sampleAssignment } from '../app/assignment-data';
import { assignmentRoute } from '../app/navigation';

test('surat tugas simulasi validates required fields, dates and the entered team', () => {
  const value = sampleAssignment();
  assert.deepEqual(assignmentErrors(value), []);
  for (const [key] of assignmentFields) assert.ok(assignmentErrors({ ...value, [key]: ' ' }).length, key);
  for (const [start, end] of [['2026-02-30', '2026-12-03'], ['2026-12-04', '2026-12-03'], ['invalid', 'invalid']]) assert.ok(assignmentErrors({ ...value, start, end }).length);
  assert.ok(assignmentErrors({ ...value, issueDate: '0000-01-01' }).length);
  assert.deepEqual(assignmentErrors({ ...value, end: value.start }), []);
  assert.ok(assignmentErrors({ ...value, roster: [] }).length);
  assert.ok(assignmentErrors({ ...value, roster: [{ userId: 'contoh-a', name: 'Petugas A', occupation: 'Teknisi', role: 'Anggota' }] }).length);
  assert.ok(assignmentErrors({ ...value, roster: [{ userId: 'contoh-a', name: ' ', occupation: 'Teknisi', role: 'Ketua' }] }).length);
  assert.ok(assignmentErrors({ ...value, roster: [{ userId: 'contoh-a', name: 'Petugas A', occupation: ' ', role: 'Ketua' }] }).length);
  assert.ok(assignmentErrors({ ...value, roster: [...value.roster, { userId: 'contoh-b', name: 'Petugas B', occupation: 'Teknisi', role: 'Ketua' }] }).length);
  assert.ok(assignmentErrors({ ...value, roster: [...value.roster, { userId: 'contoh-a', name: 'petugas contoh a', occupation: 'Teknisi', role: 'Anggota' }] }).length);
  assert.deepEqual(assignmentErrors({ ...value, roster: [...value.roster, { userId: 'contoh-b', name: 'Petugas B', occupation: 'Teknisi', role: 'Anggota' }] }), []);
});

test('assignment routes support deep links and reject malformed paths', () => {
  assert.deepEqual(assignmentRoute('/penugasan'), { view: 'list' });
  assert.deepEqual(assignmentRoute('/penugasan/spt-contoh'), { view: 'detail', id: 'spt-contoh' });
  assert.deepEqual(assignmentRoute('/penugasan/spt-contoh/edit'), { view: 'edit', id: 'spt-contoh' });
  for (const path of ['/penugasan/%zz', '/penugasan/%2f', '/penugasan/%5c', '/penugasan/%00', '/penugasan/%2e%2e', '/penugasan/a/other', '/penugasan//edit', '/penugasan/a/edit/extra']) assert.equal(assignmentRoute(path), null, path);
});
