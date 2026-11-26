export const assignmentFields = [
  ['number', 'Nomor surat'], ['consideration', 'Menimbang'], ['basis', 'Mengingat'],
  ['purpose', 'Maksud / tujuan tugas'], ['installationType', 'Jenis instalasi'],
  ['start', 'Mulai pelaksanaan'], ['end', 'Selesai pelaksanaan'],
  ['owner', 'Pemilik instalasi'], ['location', 'Lokasi'], ['capacity', 'Kapasitas dan satuan'],
  ['issuePlace', 'Tempat terbit'], ['issueDate', 'Tanggal terbit'],
  ['signatory', 'Nama penandatangan'], ['signatoryTitle', 'Jabatan penandatangan'],
] as const;
export type AssignmentField = typeof assignmentFields[number][0];
export type Assignment = Record<AssignmentField, string> & { roster: { userId: string; name: string; occupation: string; role: 'Ketua' | 'Anggota' }[] };
export function emptyAssignment(): Assignment {
  return { ...Object.fromEntries(assignmentFields.map(([key]) => [key, ''])) as Record<AssignmentField, string>, roster: [{ userId: '', name: '', occupation: '', role: 'Ketua' }] };
}
export function sampleAssignment(): Assignment {
  return {
    number: 'SIMULASI/SPT/001/2026', consideration: 'Kebutuhan pemeriksaan instalasi contoh untuk latihan alur penugasan.',
    basis: 'SPK SIMULASI/SPK/001/2026; bukan dasar hukum atau dokumen nyata.', purpose: 'Melaksanakan pemeriksaan instalasi contoh dan menyusun laporan simulasi.',
    installationType: 'Instalasi listrik contoh', start: '2026-12-01', end: '2026-12-03',
    owner: 'Organisasi Fiktif Contoh', location: 'Lokasi Fiktif Contoh', capacity: '100 kVA (contoh)',
    issuePlace: 'Kota Contoh', issueDate: '2026-11-24', signatory: 'Penandatangan Fiktif', signatoryTitle: 'Kepala Unit Contoh',
    roster: [{ userId: 'contoh-a', name: 'Petugas Contoh A', occupation: 'Pemeriksa instalasi (simulasi)', role: 'Ketua' }],
  };
}
export function assignmentErrors(value: Assignment): string[] {
  const errors: string[] = [];
  for (const [key, label] of assignmentFields) {
    if (!value[key].trim()) errors.push(`${label} wajib diisi.`);
    else if (value[key].length > (key === 'number' ? 200 : 2000)) errors.push(`${label} maksimal ${key === 'number' ? 200 : 2000} karakter.`);
  }
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date.slice(0, 4) !== '0000' && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  for (const key of ['start', 'end', 'issueDate'] as const) if (!validDate(value[key])) errors.push(`${assignmentFields.find(([field]) => field === key)![1]} harus berupa tanggal yang valid.`);
  if (validDate(value.start) && validDate(value.end) && value.end < value.start) errors.push('Selesai pelaksanaan tidak boleh sebelum mulai pelaksanaan.');
  if (value.roster.length > 50) errors.push('Maksimal 50 pekerja.');
  if (value.roster.some(row => !row.userId.trim())) errors.push('Pilih akun pekerja untuk setiap anggota.');
  if (new Set(value.roster.map(row => row.userId)).size !== value.roster.length) errors.push('Akun pekerja tidak boleh duplikat.');
  if (!value.roster.length) errors.push('Minimal satu pekerja wajib ditugaskan.');
  if (value.roster.filter(row => row.role === 'Ketua').length !== 1) errors.push('Harus ada tepat satu Ketua.');
  if (value.roster.some(row => !row.name.trim() || !row.occupation.trim())) errors.push('Nama dan okupasi setiap pekerja wajib diisi.');
  if (value.roster.some(row => row.name.length > 200 || row.occupation.length > 200)) errors.push('Nama dan okupasi pekerja maksimal 200 karakter.');
  if (value.roster.some(row => !['Ketua', 'Anggota'].includes(row.role))) errors.push('Pilih peran pekerja yang valid.');
  return errors;
}
