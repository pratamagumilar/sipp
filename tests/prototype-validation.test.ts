import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { hasRabCost, submissionErrors } from '../app/prototype/validation';

test('validasi pengiriman hanya menerima judul, deskripsi, dan estimasi positif', () => {
  assert.equal(submissionErrors({ title: ' ', description: '', estimate: '' }).length, 3);
  for (const estimate of ['0', '-1', 'abc', 'Infinity']) {
    assert.equal(submissionErrors({ title: 'Judul', description: 'Deskripsi', estimate }).length, 1);
  }
  assert.deepEqual(submissionErrors({ title: 'Judul', description: 'Deskripsi', estimate: '0.5' }), []);
});

test('review RAB memerlukan nilai biaya, termasuk nol eksplisit', () => {
  assert.equal(hasRabCost(Array(13).fill(null)), false);
  assert.equal(hasRabCost(['', '  ', null]), false);
  assert.equal(hasRabCost([null, '0']), true);
  assert.equal(hasRabCost(['0.00']), true);
  assert.equal(hasRabCost([null, '12.50']), true);
});
