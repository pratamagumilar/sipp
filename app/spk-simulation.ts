export type Mode = 'automatic' | 'manual';
export type Item = { id: string; title: string; issued: boolean; ack: boolean; mode: Mode };

// ponytail: local simulation only; replace with authorized transactional issuance in phase 2.
export function addExample(items: Item[], mode: Mode): Item[] {
  const id = `contoh-${items.length + 1}`;
  return [...items, { id, title: `Contoh pekerjaan ${id}`, mode, issued: mode === 'automatic', ack: false }];
}

export function simulate(items: Item[], id: string, action: 'issue' | 'ack'): Item[] {
  return items.map(item => item.id !== id ? item : action === 'issue' ? { ...item, issued: true } : item.issued ? { ...item, ack: true } : item);
}
