// ponytail: Nominal RAB nonnegatif dengan maksimal 16 digit dan 2 desimal; perluas bersama kontrak API jika batas berubah.
export function parseRabMoney(value: string): string | null {
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const [integer, fraction] = value.split(',');
  const digits = integer.replaceAll('.', '');
  if (digits.length > 16) return null;
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized + (fraction === undefined ? '' : '.' + fraction);
}

export function formatRabMoney(value: string): string {
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value)) return value;
  const [integer, fraction = ''] = value.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + fraction.padEnd(2, '0');
}
