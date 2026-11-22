export function submissionErrors(job: { title: string; description: string; estimate: string }): string[] {
  const errors: string[] = [];
  if (!job.title.trim()) errors.push('Judul pekerjaan wajib diisi.');
  if (!job.description.trim()) errors.push('Deskripsi wajib diisi.');
  const estimate = job.estimate.trim();
  if (!estimate || !Number.isFinite(Number(estimate)) || Number(estimate) <= 0) errors.push('Estimasi biaya wajib berupa angka lebih dari 0.');
  return errors;
}

export function hasRabCost(values: (string | null)[]): boolean {
  return values.some(value => (value ?? '').trim() !== '');
}
