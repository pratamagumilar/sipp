'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './prototype/prototype.module.css';
import { submissionErrors } from './prototype/validation';
import RabPreview from './rab-preview';
import SpkPreview from './spk-preview';
import { jobPath, jobRoute, rabPath, rabRoute, spkRoute, type JobRoute } from './navigation';

type Status = 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED';
type User = { name: string; role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER' | 'FINANCE' };
type Fields = { title: string; description: string; agenda: string; applicant: string; installationOwner: string; installationTypeCode: string; capacity: string; capacityUnit: string; location: string; offerValue: string; estimatedCost: string };
type Job = { id: string; version: number; status: Status; rejectionReason: string | null; owner: { name: string }; attachments?: { id: string; filename: string; size: number }[]; audits?: { id: string; fromStatus: Status | null; toStatus: Status; reason: string | null; createdAt: string; actor: { name: string } }[] } & { [K in keyof Fields]: string | null };
type InstallationType = { code: string; name: string };
const labels: Record<Status, string> = { DRAFT: 'Draf', SUBMITTED: 'Menunggu persetujuan', REJECTED: 'Ditolak', APPROVED: 'Disetujui' };
const fields: { key: keyof Fields; label: string; hint?: string }[] = [
  { key: 'title', label: 'Judul pekerjaan' }, { key: 'description', label: 'Deskripsi' }, { key: 'agenda', label: 'Nomor agenda' }, { key: 'applicant', label: 'Pemohon' }, { key: 'installationOwner', label: 'Pemilik instalasi' }, { key: 'installationTypeCode', label: 'Jenis instalasi' }, { key: 'capacity', label: 'Kapasitas' }, { key: 'capacityUnit', label: 'Satuan kapasitas', hint: 'Satuan tidak dikonversi otomatis.' }, { key: 'location', label: 'Lokasi' }, { key: 'offerValue', label: 'Nilai penawaran', hint: 'Diisi manual; bukan tarif standar.' }, { key: 'estimatedCost', label: 'Estimasi biaya', hint: 'Terpisah dari nilai penawaran.' },
];
const blank = (): Fields => ({ title: '', description: '', agenda: '', applicant: '', installationOwner: '', installationTypeCode: '', capacity: '', capacityUnit: '', location: '', offerValue: '', estimatedCost: '' });
function formFields(job: Job): Fields { return Object.fromEntries(fields.map(({ key }) => [key, job[key] ?? ''])) as Fields; }
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/backend' + url, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new ApiError(body.error || `Permintaan gagal (${response.status})`, response.status); }
  return response.json();
}

export default function Simulation({ user, logout }: { user: User; logout: () => Promise<void> }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [types, setTypes] = useState<InstallationType[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [draft, setDraft] = useState<Fields>(blank);
  const [file, setFile] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertainCreate, setUncertainCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [module, setModule] = useState<'jobs' | 'rab' | 'spk'>(user.role === 'FINANCE' ? 'spk' : 'jobs');
  const [spkPath, setSpkPath] = useState('/spk');
  const [spkDirty, setSpkDirty] = useState(false);
  const [spkBusy, setSpkBusy] = useState(false);
  const [rabDirty, setRabDirty] = useState(false);
  const [rabBusy, setRabBusy] = useState(false);
  const [rabTarget, setRabTarget] = useState<{ route: JobRoute; sequence: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const initialView = useRef(true);
  const historyIndex = useRef(0);
  const currentUrl = useRef('');
  const restoring = useRef(false);
  const routeRequest = useRef(0);
  const listRequest = useRef(0);
  const roleLabel = user.role === 'STAKEHOLDER' ? 'Stakeholder' : user.role === 'FINANCE' ? 'Finance' : 'Admin Pengajuan & RAB';

  useEffect(() => {
    if (!dirty && !file && !reason && !rabDirty && !spkDirty && !busy && !rabBusy && !spkBusy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, file, reason, rabDirty, spkDirty, busy, rabBusy, spkBusy]);
  useEffect(() => { if (initialView.current) { initialView.current = false; return; } if (module === 'jobs') heading.current?.focus(); }, [view, job?.id, module]);
  useEffect(() => { if (user.role !== 'FINANCE') void load(); }, []);

  function pushUrl(url: string) {
    if (window.location.pathname === url) return;
    historyIndex.current += 1;
    window.history.pushState({ ...window.history.state, knIndex: historyIndex.current }, '', url);
    currentUrl.current = url;
  }
  function pushRoute(route: JobRoute) { pushUrl(jobPath(route.view, route.id)); }
  function navigateRab(route: JobRoute, replace = false) {
    const url = rabPath(route.view, route.id);
    if (replace) { window.history.replaceState(window.history.state, '', url); currentUrl.current = url; }
    else pushUrl(url);
  }
  function applyLocation(pathname: string) {
    if (spkRoute(pathname)) {
      ++routeRequest.current; setBusy(false); setDirty(false); setFile(null); setReason(''); setJob(null); setView('list');
      setSpkPath(pathname); setModule('spk'); return;
    }
    if (user.role === 'FINANCE') { window.history.replaceState(window.history.state, '', '/spk'); currentUrl.current = '/spk'; setSpkPath('/spk'); setModule('spk'); return; }
    const rab = rabRoute(pathname);
    if (rab) {
      ++routeRequest.current;
      setBusy(false); setDirty(false); setFile(null); setReason(''); setJob(null); setView('list');
      setModule('rab'); setRabTarget(previous => ({ route: rab, sequence: (previous?.sequence ?? 0) + 1 }));
      return;
    }
    const route = jobRoute(pathname);
    if (route) void applyRoute(route);
  }
  async function applyRoute(route: JobRoute) {
    const request = ++routeRequest.current;
    setModule('jobs'); setDirty(false); setFile(null); setReason(''); setError(''); setUncertainCreate(false);
    if (!route.id) {
      setJob(null); setDraft(blank()); setView(route.view === 'edit' && user.role !== 'ADMIN_PENGAJUAN' ? 'list' : route.view);
      if (route.view === 'edit' && user.role !== 'ADMIN_PENGAJUAN') { window.history.replaceState(window.history.state, '', jobPath('list')); currentUrl.current = window.location.pathname; setError('Anda tidak dapat membuat pengajuan.'); }
      if (route.view === 'list') void load();
      return;
    }
    setJob(null); setDraft(blank()); setView('detail'); setBusy(true);
    try {
      const item = await api<Job>('/jobs/' + encodeURIComponent(route.id));
      if (request !== routeRequest.current) return;
      if (route.view === 'edit' && (user.role !== 'ADMIN_PENGAJUAN' || item.status !== 'DRAFT')) {
        setError('Pengajuan ini tidak dapat diedit.'); setView('detail');
        window.history.replaceState(window.history.state, '', jobPath('detail', item.id)); currentUrl.current = window.location.pathname;
      }
      setJob(item); setDraft(formFields(item));
      if (route.view === 'edit' && user.role === 'ADMIN_PENGAJUAN' && item.status === 'DRAFT') setView('edit');
    } catch (e) { if (request === routeRequest.current) setError(e instanceof Error ? e.message : 'Gagal memuat detail'); }
    finally { if (request === routeRequest.current) setBusy(false); }
  }
  useEffect(() => {
    historyIndex.current = 0;
    currentUrl.current = window.location.pathname + window.location.search + window.location.hash;
    window.history.replaceState({ ...window.history.state, knIndex: 0 }, '', currentUrl.current);
    applyLocation(window.location.pathname);
  }, []);
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (restoring.current) { restoring.current = false; return; }
      const target = jobRoute(window.location.pathname) || rabRoute(window.location.pathname) || spkRoute(window.location.pathname);
      const nextIndex = event.state?.knIndex;
      if (busy || rabBusy || spkBusy || !leave()) {
        if (typeof nextIndex === 'number' && nextIndex !== historyIndex.current) {
          restoring.current = true; window.history.go(historyIndex.current - nextIndex);
        } else {
          window.history.pushState({ ...window.history.state, knIndex: historyIndex.current }, '', currentUrl.current);
        }
        return;
      }
      if (!target) { currentUrl.current = window.location.pathname + window.location.search + window.location.hash; return; }
      historyIndex.current = typeof nextIndex === 'number' ? nextIndex : 0;
      currentUrl.current = window.location.pathname + window.location.search + window.location.hash;
      window.history.replaceState({ ...window.history.state, knIndex: historyIndex.current }, '', currentUrl.current);
      applyLocation(window.location.pathname);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dirty, file, reason, rabDirty, spkDirty, busy, rabBusy, spkBusy]);

  async function load() {
    const request = ++listRequest.current;
    setLoading(true); setError('');
    try { const [list, master] = await Promise.all([api<Job[]>('/jobs'), api<InstallationType[]>('/installation-types')]); if (request === listRequest.current) { setJobs(list); setTypes(master); } }
    catch (e) { if (request === listRequest.current) setError(e instanceof Error ? e.message : 'Gagal memuat data'); }
    finally { if (request === listRequest.current) setLoading(false); }
  }
  function leave() { return (!dirty && !file && !reason && !rabDirty && !spkDirty) || window.confirm('Perubahan formulir, lampiran, catatan, atau pengaturan belum disimpan. Tinggalkan halaman ini?'); }
  function switchModule(next: 'jobs' | 'rab' | 'spk') { if (next === module || busy || rabBusy || spkBusy || !leave()) return; if (next === 'rab') { navigateRab({ view: 'list' }); setRabTarget(previous => ({ route: { view: 'list' }, sequence: (previous?.sequence ?? 0) + 1 })); } else if (next === 'spk') { pushUrl('/spk'); setSpkPath('/spk'); } else pushRoute({ view: 'list' }); setDirty(false); setFile(null); setReason(''); setRabDirty(false); setSpkDirty(false); setJob(null); setView('list'); setModule(next); }
  function list() { if (busy || rabBusy || !leave()) return; pushRoute({ view: 'list' }); setDirty(false); setFile(null); setReason(''); setError(''); setJob(null); setView('list'); void load(); }
  async function detail(id: string) {
    if (busy || rabBusy || !leave()) return;
    setBusy(true); setError('');
    try { const item = await api<Job>('/jobs/' + encodeURIComponent(id)); pushRoute({ view: 'detail', id }); setJob(item); setDirty(false); setFile(null); setReason(''); setView('detail'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat detail'); }
    finally { setBusy(false); }
  }
  function edit(current: Job | null) { if (busy || rabBusy || !leave()) return; pushRoute({ view: 'edit', id: current?.id }); setJob(current); setDraft(current ? formFields(current) : blank()); setFile(null); setDirty(false); setUncertainCreate(false); setError(''); setView('edit'); }
  function showError(e: unknown) { setError(e instanceof ApiError && e.status === 409 ? `${e.message} Data formulir dan alasan tetap tersedia. Salin perubahan sebelum kembali dan memuat ulang data terbaru.` : e instanceof Error ? e.message : 'Terjadi kesalahan'); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (uncertainCreate) { setError('Hasil pembuatan sebelumnya tidak diketahui. Salin isi formulir dan periksa daftar sebelum membuat ulang.'); return; }
    ++listRequest.current; setLoading(false);
    setBusy(true); setError(''); setNotice('');
    try {
      let saved: Job;
      try { saved = await api<Job>(job ? '/jobs/' + encodeURIComponent(job.id) : '/jobs', { method: job ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, ...(job ? { version: job.version } : {}) }) }); }
      catch (e) { if (!job && !(e instanceof ApiError)) { setUncertainCreate(true); throw new Error('Hasil pembuatan tidak diketahui. Salin isi formulir, lalu periksa daftar sebelum membuat ulang agar tidak terjadi duplikasi.'); } throw e; }
      // Preserve the newly assigned ID and version even if the subsequent upload fails.
      setJob(saved); setDirty(false);
      if (!job) { const url = jobPath('edit', saved.id); window.history.replaceState(window.history.state, '', url); currentUrl.current = url; }
      if (file) {
        const form = new FormData(); form.append('file', file); form.append('version', String(saved.version));
        try { await api('/jobs/' + encodeURIComponent(saved.id) + '/attachments', { method: 'POST', body: form }); setFile(null); }
        catch (e) { setNotice('Draf tersimpan. Hasil unggahan belum dapat dipastikan; salin perubahan bila perlu dan periksa lampiran di detail sebelum mencoba ulang.'); throw e; }
      }
      setNotice('Draf tersimpan.');
      try { setJob(await api<Job>('/jobs/' + encodeURIComponent(saved.id))); pushRoute({ view: 'detail', id: saved.id }); setView('detail'); }
      catch { pushRoute({ view: 'list' }); setView('list'); setJob(null); void load(); setError('Draf tersimpan, tetapi detail gagal dimuat. Muat ulang daftar.'); }
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  }
  async function transition(action: 'submit' | 'approve' | 'reject' | 'revise') {
    if (!job) return;
    if (action === 'submit') { const errors = submissionErrors({ title: job.title || '', description: job.description || '', estimate: job.estimatedCost || '' }); if (errors.length) { setError(errors.join(' ')); return; } }
    if (action === 'reject' && reason.trim().length < 10) { setError('Masukkan alasan penolakan minimal 10 karakter.'); return; }
    if (action === 'approve' && reason && !window.confirm('Alasan yang telah diisi tidak akan disimpan saat menyetujui. Lanjutkan?')) return;
    ++listRequest.current; setLoading(false); setBusy(true); setError('');
    try {
      await api('/jobs/' + encodeURIComponent(job.id) + '/transitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, version: job.version, ...(action === 'reject' ? { reason } : {}) }) });
      setReason(''); setNotice('Status pengajuan berhasil diperbarui.');
      try { setJob(await api<Job>('/jobs/' + encodeURIComponent(job.id))); }
      catch { pushRoute({ view: 'list' }); setJob(null); setView('list'); void load(); setError('Status diperbarui, tetapi detail gagal dimuat. Muat ulang daftar.'); }
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  }
  const filtered = jobs.filter(item => (statusFilter === 'all' || item.status === statusFilter) && `${item.title || ''} ${item.agenda || ''} ${item.applicant || ''} ${item.installationOwner || ''} ${item.location || ''} ${labels[item.status] || ''}`.toLowerCase().includes(search.toLowerCase()));
  const cards = [{ label: 'Total pekerjaan', count: jobs.length }, ...(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as Status[]).map(status => ({ label: labels[status], count: jobs.filter(item => item.status === status).length }))];

  return <div className={styles.prototype}>
    <header className={styles.header}><div className={styles.brand}><strong>KerjaNyata</strong><span className={styles.headerSub}>RUANG KERJA</span></div><div className={styles.account}><span>{user.name}<small>{roleLabel}</small></span><form action={logout} onSubmit={event => { if (busy || rabBusy || spkBusy || !leave()) event.preventDefault(); }}><button type="submit" disabled={busy || rabBusy || spkBusy}>Keluar</button></form></div></header>
    <div className={styles.workspace}><aside className={styles.sidebar}><p>MENU UTAMA</p><nav aria-label="Menu utama">{user.role !== 'FINANCE' && <><button aria-current={module === 'jobs' ? 'page' : undefined} onClick={() => module === 'jobs' ? list() : switchModule('jobs')} disabled={busy || spkBusy}>Pengajuan</button><button aria-current={module === 'rab' ? 'page' : undefined} onClick={() => switchModule('rab')} disabled={busy || spkBusy}>Penyusunan &amp; Review RAB</button></>}<button aria-current={module === 'spk' ? 'page' : undefined} onClick={() => switchModule('spk')} disabled={busy || spkBusy}>SPK / PO</button><span className={styles.navHeading}>MODUL MENDATANG</span><button disabled>Penugasan</button><button disabled>Invoice</button><button disabled>Monitoring</button></nav><p className={styles.sidebarNote}>KerjaNyata<br />Ruang kerja internal</p></aside>
    <main className={styles.main}>
      {user.role !== 'FINANCE' && <div hidden={module !== 'rab'}><RabPreview role={user.role} active={module === 'rab'} onDirtyChange={setRabDirty} onBusyChange={setRabBusy} target={rabTarget} onNavigate={navigateRab} /></div>}
      <div hidden={module !== 'spk'}><SpkPreview role={user.role} active={module === 'spk'} path={spkPath} onDirtyChange={setSpkDirty} onBusyChange={setSpkBusy} navigate={url => { pushUrl(url); setSpkPath(url); }} /></div>
      <div hidden={module !== 'jobs'}>
      <div className={styles.topline}><span>Beranda / Pengajuan{view !== 'list' ? ' / Detail' : ''}</span></div>
      <div className={styles.titleRow}><div><h1 ref={heading} tabIndex={-1}>{view === 'list' ? 'Pengajuan pekerjaan' : view === 'edit' ? 'Form pengajuan' : 'Detail pekerjaan'}</h1><p className={styles.subtitle}>Telusuri pengajuan dan proses review dalam satu alur.</p></div>{view === 'list' && user.role === 'ADMIN_PENGAJUAN' && <button className={styles.primary} disabled={busy || loading || !types.length} onClick={() => edit(null)}>+ Buat pengajuan</button>}</div>
      {notice && <div className={styles.notice} role="status">{notice} <button onClick={() => setNotice('')} aria-label="Tutup pemberitahuan">×</button></div>}
      {error && <div className={styles.error} role="alert">{error} {view === 'list' && <button disabled={busy || loading} onClick={() => void load()}>Coba lagi</button>}</div>}
      {view !== 'list' && <button className={styles.back} disabled={busy} onClick={() => view === 'edit' && job ? void detail(job.id) : list()}>← {view === 'edit' && job ? 'Detail pekerjaan' : 'Daftar pengajuan'}</button>}
      {view === 'list' && <><div className={styles.metrics} aria-label="Ringkasan status">{cards.map(card => <div className={styles.metric} key={card.label}><span>{card.label}</span><strong>{loading ? '—' : card.count}</strong><small>pekerjaan</small></div>)}</div><section className={styles.panel} aria-label="Daftar pengajuan"><div className={styles.listIntro}><div><h2>Daftar pekerjaan</h2><p>{loading ? 'Memuat pekerjaan...' : `${filtered.length} dari ${jobs.length} pekerjaan`}</p></div><div className={styles.filters}><label>Cari pekerjaan<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Judul, agenda, atau nama" /></label><label>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as Status | 'all')}><option value="all">Semua status</option>{(Object.keys(labels) as Status[]).map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></label></div></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tabel pekerjaan, gulir horizontal untuk melihat seluruh kolom"><table className={styles.table}><thead><tr><th scope="col">Agenda / pekerjaan</th><th scope="col">Pemohon</th><th scope="col">Pemilik</th><th scope="col">Jenis / kapasitas</th><th scope="col">Lokasi</th><th scope="col">Nilai</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><strong>{item.title || 'Pengajuan tanpa judul'}</strong><small>{item.agenda || 'Agenda belum diisi'}</small></td><td>{item.applicant || '—'}</td><td>{item.installationOwner || '—'}</td><td>{types.find(type => type.code === item.installationTypeCode)?.name || item.installationTypeCode || '—'}<small>{[item.capacity, item.capacityUnit].filter(Boolean).join(' ') || 'Kapasitas belum diisi'}</small></td><td>{item.location || '—'}</td><td><small>Penawaran: {item.offerValue || '—'}</small><small>Estimasi: {item.estimatedCost || '—'}</small></td><td><span className={styles.status}>{labels[item.status] || item.status}</span></td><td><button disabled={busy} onClick={() => void detail(item.id)}>Lihat detail →</button></td></tr>)}</tbody></table></div>{!loading && !error && filtered.length === 0 && <p>Belum ada pengajuan yang cocok.</p>}</section></>}
      {view === 'detail' && job && <div className={styles.detailGrid}><section className={styles.panel}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>RINGKASAN PEKERJAAN</p><h2>{job.title || 'Pengajuan tanpa judul'}</h2><p>{job.agenda || 'Nomor agenda belum diisi'}</p></div><span className={styles.status}>{labels[job.status] || job.status}</span></div><dl className={styles.details}>{fields.slice(1).map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.key === 'installationTypeCode' ? types.find(type => type.code === job.installationTypeCode)?.name || job.installationTypeCode || '—' : job[field.key] || '—'}</dd></div>)}<div><dt>Dibuat oleh</dt><dd>{job.owner?.name || '—'}</dd></div><div><dt>Lampiran</dt><dd>{job.attachments?.length ? job.attachments.map(attachment => <div key={attachment.id}><a href={'/backend/attachments/' + encodeURIComponent(attachment.id)}>{attachment.filename}</a> ({attachment.size} byte)</div>) : 'Tidak ada lampiran'}</dd></div></dl><div className={styles.actions}>{user.role === 'ADMIN_PENGAJUAN' && job.status === 'DRAFT' && <><button disabled={busy} onClick={() => edit(job)}>Edit pengajuan</button><button className={styles.primary} disabled={busy} onClick={() => void transition('submit')}>Kirim pengajuan</button></>}{user.role === 'ADMIN_PENGAJUAN' && job.status === 'REJECTED' && <button className={styles.primary} disabled={busy} onClick={() => void transition('revise')}>Revisi pengajuan</button>}</div>
        {user.role === 'STAKEHOLDER' && job.status === 'SUBMITTED' && <div className={styles.decision}><h3>Keputusan pengajuan</h3><label htmlFor="reason">Alasan penolakan</label><textarea id="reason" disabled={busy} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Isi alasan jika menolak" /><div className={styles.actions}><button disabled={busy} onClick={() => void transition('reject')}>Tolak pengajuan</button><button className={styles.primary} disabled={busy} onClick={() => void transition('approve')}>Setujui pengajuan</button></div></div>}</section><aside className={styles.aside}><p className={styles.eyebrow}>AKTIVITAS</p><h2>Riwayat aktivitas</h2>{job.audits ? job.audits.length ? <ol>{job.audits.map(entry => <li key={entry.id}>{entry.actor.name}: {entry.fromStatus ? `${labels[entry.fromStatus] || entry.fromStatus} → ` : ''}{labels[entry.toStatus] || entry.toStatus} · {new Date(entry.createdAt).toLocaleString('id-ID')}{entry.reason ? ` — ${entry.reason}` : ''}</li>)}</ol> : <p>Belum ada riwayat.</p> : <p>Riwayat tidak tersedia.</p>}{job.rejectionReason && <div><h3>Catatan keputusan</h3><p>{job.rejectionReason}</p></div>}</aside></div>}
      {view === 'edit' && <form className={styles.panel} onSubmit={save}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>PENGEDITAN</p><h2>Informasi pengajuan</h2><p>Draf boleh kosong. Saat dikirim, judul, deskripsi, dan estimasi biaya lebih dari 0 wajib diisi.</p></div>{(dirty || file) && <span className={styles.unsaved}>Belum disimpan</span>}</div><fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><div className={styles.formGrid}>{fields.map(field => <label key={field.key}>{field.label}{field.key === 'description' ? <textarea value={draft[field.key]} onChange={event => { setDraft({ ...draft, [field.key]: event.target.value }); setDirty(true); }} /> : field.key === 'installationTypeCode' ? <select value={draft.installationTypeCode} onChange={event => { setDraft({ ...draft, installationTypeCode: event.target.value }); setDirty(true); }}><option value="">Belum dipilih</option>{types.map(type => <option key={type.code} value={type.code}>{type.name}</option>)}</select> : <input value={draft[field.key]} inputMode={['capacity', 'offerValue', 'estimatedCost'].includes(field.key) ? 'decimal' : undefined} onChange={event => { setDraft({ ...draft, [field.key]: event.target.value }); setDirty(true); }} />}{field.hint && <small>{field.hint}</small>}</label>)}<label>Lampiran opsional<input type="file" onChange={event => setFile(event.target.files?.[0] || null)} /><small>Maksimum 10 MB per lampiran. Lampiran yang sudah tersimpan tidak dapat dihapus di MVP ini.</small></label></div><div className={styles.formFooter}><button type="button" onClick={() => job ? void detail(job.id) : list()}>Batal</button><button className={styles.primary}>{busy ? 'Menyimpan...' : 'Simpan draf'}</button></div></fieldset></form>}
      <footer className={styles.footer}>KERJANYATA / RUANG KERJA</footer>
      </div>
    </main></div>
  </div>;
}
