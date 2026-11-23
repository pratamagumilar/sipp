import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addExample, simulate, type Item } from '../app/spk-simulation';

test('new examples use the active mode without changing existing examples', () => {
  const initial: Item[] = [{ id: 'contoh-1', title: 'Contoh', issued: false, ack: false, mode: 'manual' }];
  const automatic = addExample(initial, 'automatic');
  assert.deepEqual(automatic[0], initial[0]);
  assert.equal(automatic[1].mode, 'automatic');
  assert.equal(automatic[1].issued, true);
  const manual = addExample(automatic, 'manual');
  assert.deepEqual(manual.slice(0, 2), automatic);
  assert.equal(manual[2].mode, 'manual');
  assert.equal(manual[2].issued, false);
  assert.equal(manual[2].ack, false);
  assert.equal(new Set(manual.map(item => item.id)).size, manual.length);
});

test('simulated issuance and ACK are idempotent and ACK requires issuance', () => {
  const initial: Item[] = [{ id: 'contoh-1', title: 'Contoh', issued: false, ack: false, mode: 'manual' }];
  assert.deepEqual(simulate(initial, 'contoh-1', 'ack'), initial);
  const issued = simulate(initial, 'contoh-1', 'issue');
  assert.deepEqual(simulate(issued, 'contoh-1', 'issue'), issued);
  const acknowledged = simulate(issued, 'contoh-1', 'ack');
  assert.deepEqual(simulate(acknowledged, 'contoh-1', 'ack'), acknowledged);
  assert.deepEqual(simulate(initial, 'unknown', 'issue'), initial);
});
