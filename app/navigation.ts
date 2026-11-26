export type JobRoute = { view: 'list' | 'detail' | 'edit'; id?: string };

export function jobRoute(pathname: string): JobRoute | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'pengajuan')) return { view: 'list' };
  if (parts[0] !== 'pengajuan') return null;
  if (parts.length === 2 && parts[1] === 'baru') return { view: 'edit' };
  if (parts.length === 3 && parts[1] === 'id' && parts[2] === 'baru') return { view: 'detail', id: 'baru' };
  if (parts.length === 2 || (parts.length === 3 && parts[2] === 'edit')) {
    try { return { view: parts.length === 3 ? 'edit' : 'detail', id: decodeURIComponent(parts[1]) }; } catch { return null; }
  }
  return null;
}

export function jobPath(view: JobRoute['view'], id?: string) {
  return view === 'list' ? '/pengajuan' : id ? view === 'detail' && id === 'baru' ? '/pengajuan/id/baru' : `/pengajuan/${encodeURIComponent(id)}${view === 'edit' ? '/edit' : ''}` : '/pengajuan/baru';
}

export function rabRoute(pathname: string): JobRoute | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'rab') return null;
  if (parts.length === 1) return { view: 'list' };
  if (parts.length === 2 || (parts.length === 3 && parts[2] === 'edit')) {
    try { return { view: parts.length === 3 ? 'edit' : 'detail', id: decodeURIComponent(parts[1]) }; } catch { return null; }
  }
  return null;
}

export function rabPath(view: JobRoute['view'], id?: string) {
  if (view === 'list') return '/rab';
  if (!id) throw new Error('ID pekerjaan diperlukan untuk route RAB');
  return `/rab/${encodeURIComponent(id)}${view === 'edit' ? '/edit' : ''}`;
}

export function spkRoute(pathname: string): { view: 'list' | 'settings' | 'detail'; id?: string } | null {
  const parts = pathname.split('/');
  if (parts[0] !== '' || parts[1] !== 'spk' || parts.length > 3) return null;
  if (parts.length === 2 || (parts.length === 3 && parts[2] === '')) return { view: 'list' };
  try {
    const id = decodeURIComponent(parts[2]);
    if (!id || /[\/\\\x00-\x1f\x7f]/.test(id) || id === '.' || id === '..') return null;
    return id === 'pengaturan' ? { view: 'settings' } : { view: 'detail', id };
  } catch { return null; }
}

export function assignmentRoute(pathname: string): JobRoute | null {
  const parts = pathname.split('/');
  if (parts[0] !== '' || parts[1] !== 'penugasan') return null;
  if (parts.length === 2 || (parts.length === 3 && parts[2] === '')) return { view: 'list' };
  if (parts.length !== 3 && !(parts.length === 4 && parts[3] === 'edit')) return null;
  try {
    const id = decodeURIComponent(parts[2]);
    if (!id || /[\/\\\x00-\x1f\x7f]/.test(id) || id === '.' || id === '..') return null;
    return { view: parts.length === 4 ? 'edit' : 'detail', id };
  } catch { return null; }
}
