import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatRabMoney, parseRabMoney } from '../app/rab-money';

test('nominal Indonesia mempertahankan presisi dan nol', () => {
  for (const [input, canonical, formatted] of [
    ['0', '0', '0,00'], ['0,01', '0.01', '0,01'], ['000,00', '0.00', '0,00'],
    ['5.050.500,00', '5050500.00', '5.050.500,00'],
    ['9999999999999999,99', '9999999999999999.99', '9.999.999.999.999.999,99'],
    ['1,2', '1.2', '1,20'],
  ]) {
    assert.equal(parseRabMoney(input), canonical);
    assert.equal(formatRabMoney(canonical), formatted);
    assert.equal(parseRabMoney(formatted), formatted === '1,20' ? '1.20' : canonical === '0' ? '0.00' : canonical);
  }
});

test('paste dan input tidak valid tidak ditafsirkan ulang', () => {
  for (const input of ['', '1.', '1,', ',5', '1.23', '1.234.56', '1,234', '1,2,3', '1.234,56.78', ' 1', '-1', 'Rp 1.000', '10000000000000000', '1e3']) {
    assert.equal(parseRabMoney(input), null, input);
  }
  assert.equal(parseRabMoney('1.234'), '1234');
  assert.equal(formatRabMoney('not a number'), 'not a number');
});
