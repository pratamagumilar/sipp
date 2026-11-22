import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { jobPath, jobRoute, rabPath, rabRoute } from '../app/navigation';

test('route pengajuan round trip dan menolak jalur tidak valid', () => {
  assert.deepEqual(jobRoute('/'), { view: 'list' });
  assert.deepEqual(jobRoute(jobPath('list')), { view: 'list' });
  assert.deepEqual(jobRoute(jobPath('edit')), { view: 'edit' });
  assert.deepEqual(jobRoute(jobPath('detail', 'baru')), { view: 'detail', id: 'baru' });
  assert.deepEqual(jobRoute(jobPath('edit', 'baru')), { view: 'edit', id: 'baru' });
  for (const view of ['detail', 'edit'] as const) {
    assert.deepEqual(jobRoute(jobPath(view, 'id dengan / karakter')), { view, id: 'id dengan / karakter' });
  }
  assert.equal(jobRoute('/pengajuan/x/lain'), null);
  assert.equal(jobRoute('/pengajuan/%ZZ'), null);
});

test('route RAB mendukung daftar, detail dan edit berdasarkan pekerjaan', () => {
  assert.deepEqual(rabRoute(rabPath('list')), { view: 'list' });
  for (const view of ['detail', 'edit'] as const) {
    assert.deepEqual(rabRoute(rabPath(view, 'id / pekerjaan')), { view, id: 'id / pekerjaan' });
  }
  assert.equal(rabRoute('/rab/x/lain'), null);
  assert.equal(rabRoute('/rab/%ZZ'), null);
  assert.equal(rabRoute('/pengajuan'), null);
  assert.throws(() => rabPath('edit'));
});
