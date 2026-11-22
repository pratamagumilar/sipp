import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsavedChanges } from '../app/editor-state';

test('mendeteksi perubahan field dan lampiran', () => {
  const original = { title: 'Judul', description: 'Uraian', cost: '12.50' };
  const current = { ...original, file: null };
  assert.equal(hasUnsavedChanges(current, original), false);
  for (const key of ['title', 'description', 'cost'] as const) assert.equal(hasUnsavedChanges({ ...current, [key]: original[key] + 'x' }, original), true);
  assert.equal(hasUnsavedChanges({ ...current, file: new File(['x'], 'x.txt') }, original), true);
});
