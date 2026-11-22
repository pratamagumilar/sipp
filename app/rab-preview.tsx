'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './prototype/prototype.module.css';
import { hasRabCost } from './prototype/validation';
import { formatRabMoney, parseRabMoney } from './rab-money';
import type { JobRoute } from './navigation';

type Status = 'RAB_DRAFT' | 'RAB_REVIEW' | 'RAB_APPROVED';
type Job = { id: string; title: string | null; agenda: string | null; applicant: string | null; installationOwner: string | null; installationTypeCode: string | null; capacity: string | null; capacityUnit: string | null; location: string | null; offerValue: string | null; createdAt: string; rab?: { status: Status; version: number } | null };
const fields = [
  ['fixCost', 'Fix Cost'], ['sppjTransport', 'SPPJ dan Transport'], ['nidi', 'NIDI'], ['izinEsdm', 'Izin ESDM'], ['lhpp', 'LHPP'], ['pnbp', 'PNBP'], ['verifikator', 'Verifikator'], ['sewaAlat', 'Sewa Alat'], ['variabelCost', 'Variabel Cost'], ['ppn', 'PPN'], ['jumlahNilaiPekerjaan', 'Jumlah Nilai Pekerjaan'], ['biayaOperasional', 'Biaya Operasional'], ['rencanaMargin', 'Rencana Margin'],
] as const;
type Key = typeof fields[number][0];
type Items = Record<Key, string | null>;
const editItems = (items: Items): Items => Object.fromEntries(fields.map(([key]) => [key, items[key] === null ? null : formatRabMoney(items[key])])) as Items;
type Rab = { id: string; jobId: string; status: Status; version: number; notes: string | null; items: Items; job: Job; audits: { fromStatus: Status | null; toStatus: Status; reason: string | null; createdAt: string; actor: { name: string } }[] };
const labels: Record<Status, string> = { RAB_DRAFT: 'Draf RAB', RAB_REVIEW: 'Menunggu review', RAB_APPROVED: 'RAB disetujui' };
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/backend' + path, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new ApiError(body.error || `Permintaan gagal (${response.status})`, response.status); }
  return response.json();
}
const path = (id: string) => '/jobs/' + encodeURIComponent(id) + '/rab';

export default function RabPreview({ role, active, onDirtyChange, onBusyChange, target, onNavigate }: { role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER'; active: boolean; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void; target: { route: JobRoute; sequence: number } | null; onNavigate: (route: JobRoute, replace?: boolean) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [rab, setRab] = useState<Rab | null>(null);
  const [view, setView] = useState<'list' | 'detail' | 'edit'>('list');
  const [draft, setDraft] = useState<Items | null>(null);
  const [checked, setChecked] = useState<Partial<Record<Key, boolean>>>({});
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const appliedTarget = useRef(0);
  const listRequest = useRef(0);
  const isDirty = dirty || !!reason;
  useEffect(() => { onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => { onBusyChange(busy || loading); }, [busy, loading, onBusyChange]);
  useEffect(() => { if (active) void load(); }, [active]);
  useEffect(() => { if (!active) { setSelected(null); setRab(null); setDirty(false); setReason(''); setUncertain(false); setView('list'); } }, [active]);
  useEffect(() => {
    if (!active || !target || target.sequence === appliedTarget.current) return;
    appliedTarget.current = target.sequence;
    let cancelled = false;
    const route = target.route;
    setSelected(null); setRab(null); setDirty(false); setReason(''); setUncertain(false); setError(''); setView(route.view);
    if (!route.id) return;
    lock.current = true; setBusy(true);
    void (async () => {
      try {
        const list = await api<Job[]>('/rabs/jobs');
        const item = list.find(entry => entry.id === route.id);
        if (!item) throw new Error('Pekerjaan tidak ditemukan atau tidak dapat diakses.');
        const result = item.rab ? await api<Rab>(path(item.id)) : null;
        if (cancelled) return;
        setSelected(item); setRab(result);
        if (route.view === 'edit') {
          if (role !== 'ADMIN_PENGAJUAN' || !result || result.status !== 'RAB_DRAFT') {
            setView('detail'); onNavigate({ view: 'detail', id: item.id }, true); setError('RAB ini tidak dapat diedit.');
          } else { setDraft(editItems(result.items)); setChecked({}); setNotes(result.notes || ''); }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat RAB'); }
      finally { if (!cancelled) { lock.current = false; setBusy(false); } }
    })();
    return () => { cancelled = true; lock.current = false; appliedTarget.current = 0; };
  }, [active, target]);
  useEffect(() => { if (active) heading.current?.focus(); }, [active, view]);
  function begin() { if (lock.current) return false; ++listRequest.current; setLoading(false); lock.current = true; setBusy(true); setError(''); setNotice(''); return true; }
  function end() { lock.current = false; setBusy(false); }
  function leave() { return !isDirty || window.confirm('Perubahan RAB atau catatan belum disimpan. Tinggalkan halaman ini?'); }
  async function load() {
    const request = ++listRequest.current;
    setLoading(true); setError('');
    try { const result = await api<Job[]>('/rabs/jobs'); if (request === listRequest.current) setJobs(result); }
    catch (e) { if (request === listRequest.current) { setJobs([]); setError(e instanceof Error ? e.message : 'Gagal memuat pekerjaan'); } }
    finally { if (request === listRequest.current) setLoading(false); }
  }
  function list() {
    if (lock.current || !leave()) return;
    onNavigate({ view: 'list' }); setSelected(null); setRab(null); setDirty(false); setReason(''); setUncertain(false); setView('list'); void load();
  }
  async function open(job: Job) {
    if (lock.current || !leave() || !begin()) return;
    try {
      const result = job.rab ? await api<Rab>(path(job.id)) : null;
      onNavigate({ view: 'detail', id: job.id }); setSelected(job); setRab(result); setDirty(false); setReason(''); setUncertain(false); setView('detail');
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat RAB'); }
    finally { end(); }
  }
  async function create(job: Job | null = selected) {
    if (!job || uncertain || !begin()) return;
    try {
      const result = await api<Rab>(path(job.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setSelected(job); setRab(result); setDraft(editItems(result.items)); setChecked({}); setNotes(result.notes || ''); setDirty(false);
      onNavigate({ view: 'edit', id: job.id }); setView('edit'); setNotice('Draf RAB dibuat. Isi biaya lalu simpan.');
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 409 || e.status >= 500) { setSelected(job); onNavigate({ view: 'detail', id: job.id }); setView('detail'); setUncertain(true); setError('RAB mungkin sudah dibuat. Periksa RAB terbaru sebelum mencoba kembali.'); }
      else setError(e.message);
    } finally { end(); }
  }
  async function reconcile() {
    if (!selected || !begin()) return;
    try { setRab(await api<Rab>(path(selected.id))); setUncertain(false); setNotice('RAB yang tersimpan berhasil dimuat.'); }
    catch (e) {
      if (e instanceof ApiError && e.status === 404) { setUncertain(false); setError('RAB tidak ditemukan. Anda dapat mencoba membuatnya kembali jika pekerjaan masih tersedia.'); }
      else setError(e instanceof Error ? e.message : 'Gagal memeriksa RAB');
    } finally { end(); }
  }
  function edit() { if (!rab || lock.current) return; onNavigate({ view: 'edit', id: rab.jobId }); setDraft(editItems(rab.items)); setChecked({}); setNotes(rab.notes || ''); setDirty(false); setError(''); setView('edit'); }
  function cancelEdit() { if (lock.current || !rab || !leave()) return; onNavigate({ view: 'detail', id: rab.jobId }); setDirty(false); setView('detail'); }
  function failure(e: unknown) { setError(e instanceof ApiError && e.status === 409 ? 'Data atau status telah berubah. Input tetap tersedia; salin perubahan sebelum kembali dan memuat data terbaru.' : !(e instanceof ApiError) || e.status >= 500 ? 'Hasil permintaan belum pasti. Input tetap tersedia; salin perubahan dan periksa data terbaru sebelum mencoba lagi.' : e.message); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!rab || !draft) return;
    if (fields.some(([key]) => draft[key] !== null && draft[key] !== '' && parseRabMoney(draft[key]!) === null)) { setChecked(Object.fromEntries(fields.map(([key]) => [key, true]))); setError('Periksa format pada kolom biaya yang ditandai.'); return; }
    const items = Object.fromEntries(fields.map(([key]) => [key, draft[key] === null || draft[key] === '' ? draft[key] : parseRabMoney(draft[key]!)]));
    if (!begin()) return;
    try {
      const result = await api<Rab>(path(rab.jobId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: rab.version, items, notes }) });
      setRab(result); setDirty(false); onNavigate({ view: 'detail', id: rab.jobId }); setView('detail'); setNotice('Draf RAB tersimpan.');
    } catch (e) { failure(e); }
    finally { end(); }
  }
  async function transition(action: 'submit' | 'approve' | 'revise') {
    if (!rab) return;
    if (action === 'submit' && !hasRabCost(fields.map(([key]) => rab.items[key]))) { setNotice(''); setError('Isi dan simpan minimal satu kolom biaya sebelum mengirim untuk review. Nilai 0 diperbolehkan; nilai penawaran tidak dihitung.'); return; }
    if (action === 'revise' && reason.trim().length < 10) { setError('Alasan revisi minimal 10 karakter.'); return; }
    if (action === 'approve' && reason && !window.confirm('Catatan revisi tidak akan disimpan saat menyetujui. Lanjutkan?')) return;
    if (!begin()) return;
    try {
      setRab(await api<Rab>(path(rab.jobId) + '/transitions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: rab.version, action, ...(action === 'revise' ? { reason: reason.trim() } : {}) }) }));
      setReason(''); setNotice('Status RAB diperbarui.');
    } catch (e) { failure(e); }
    finally { end(); }
  }
  const job = rab?.job || selected;
  return <>
    <div className={styles.topline}>Beranda / RAB{view !== 'list' ? ' / ' + (view === 'edit' ? 'Edit' : 'Detail') : ''}</div>
    <div className={styles.titleRow}><div><h1 ref={heading} tabIndex={-1}>{view === 'list' ? 'Penyusunan & Review RAB' : view === 'edit' ? 'Edit RAB' : 'Detail RAB'}</h1><p className={styles.subtitle}>RAB untuk pengajuan yang telah disetujui.</p></div></div>
    {error && <div className={styles.error} role="alert">{error} {view === 'list' && <button disabled={loading || busy} onClick={() => void load()}>Coba lagi</button>}</div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {view !== 'list' && <button className={styles.back} disabled={busy || loading} onClick={() => view === 'edit' && rab ? cancelEdit() : list()}>← {view === 'edit' && rab ? 'Detail RAB' : 'Daftar RAB'}</button>}
    {view === 'list' && <section className={styles.panel}><div className={styles.listIntro}><div><h2>Pengajuan disetujui</h2><p>{loading ? 'Memuat pekerjaan...' : `${jobs.length} pekerjaan`}</p></div></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Daftar pekerjaan disetujui"><table className={styles.table}><thead><tr><th scope="col">Pekerjaan</th><th scope="col">Pemohon</th><th scope="col">Status RAB</th><th scope="col">Aksi</th></tr></thead><tbody>{jobs.map(item => <tr key={item.id}><td><strong>{item.title || 'Tanpa judul'}</strong><small>{item.agenda || 'Agenda belum diisi'}</small></td><td>{item.applicant || '—'}</td><td>{item.rab ? labels[item.rab.status] : 'Belum dibuat'}</td><td>{!item.rab && role === 'ADMIN_PENGAJUAN' ? <button className={styles.primary} disabled={busy || loading} onClick={() => void create(item)}>Buat RAB</button> : <button disabled={busy || loading} onClick={() => void open(item)}>Lihat detail</button>}</td></tr>)}</tbody></table></div>{!loading && !jobs.length && !error && <p>Belum ada pengajuan disetujui.</p>}</section>}
    {view !== 'list' && job && <div className={styles.rabLayout}><section className={styles.panel}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>PENGAJUAN DISETUJUI</p><h2>{job.title || 'Tanpa judul'}</h2></div></div>
      <h3>Konteks pengajuan</h3><dl className={styles.details}>{[['Agenda', job.agenda], ['Pemohon', job.applicant], ['Pemilik instalasi', job.installationOwner], ['Jenis instalasi', job.installationTypeCode], ['Kapasitas', [job.capacity, job.capacityUnit].filter(Boolean).join(' ')], ['Lokasi', job.location], ['Nilai penawaran pengajuan', job.offerValue === null ? null : formatRabMoney(job.offerValue)], ['Nilai SPK/PO', 'Belum tersedia hingga MVP 3']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
      </section><section className={styles.panel} aria-label="Rincian RAB">
      {!rab && <div className={styles.actions}>{role === 'ADMIN_PENGAJUAN' && <button className={styles.primary} disabled={busy || uncertain} onClick={() => void create()}>Buat RAB</button>}{uncertain && <button disabled={busy} onClick={() => void reconcile()}>Periksa RAB terbaru</button>}</div>}
      {rab && view === 'detail' && <><p>Nilai biaya diisi manual, tanpa perhitungan otomatis.</p><dl className={styles.rabDetails}>{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{rab.items[key] === null ? '—' : formatRabMoney(rab.items[key])}</dd></div>)}</dl><h3>Keterangan</h3><p>{rab.notes || '—'}</p><div className={styles.actions}>{role === 'ADMIN_PENGAJUAN' && rab.status === 'RAB_DRAFT' && <><p id="rab-submit-help">Simpan minimal satu kolom biaya sebelum mengirim untuk review; nilai 0 diperbolehkan.</p><button disabled={busy} onClick={edit}>Edit RAB</button><button className={styles.primary} disabled={busy} aria-describedby="rab-submit-help" onClick={() => void transition('submit')}>Kirim untuk review</button></>}</div>{role === 'STAKEHOLDER' && rab.status === 'RAB_REVIEW' && <div className={styles.decision}><h3>Keputusan review</h3><label htmlFor="rab-reason">Alasan revisi (minimal 10 karakter)</label><textarea id="rab-reason" disabled={busy} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} /><div className={styles.actions}><button disabled={busy} onClick={() => void transition('revise')}>Minta revisi</button><button className={styles.primary} disabled={busy} onClick={() => void transition('approve')}>Setujui RAB</button></div></div>}</>}
      {rab && view === 'edit' && draft && <form onSubmit={save}><div className={styles.sectionHead}><div><h3>Rincian RAB</h3><p>Semua nilai opsional dan diisi manual, tanpa rumus otomatis.</p><p id="rab-money-help">Gunakan koma untuk desimal dan titik untuk ribuan, misalnya 5.050.500,00. Maksimal 16 digit dan 2 desimal.</p></div>{dirty && <span className={styles.unsaved}>Belum disimpan</span>}</div><fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><div className={styles.formGrid}>{fields.map(([key, label]) => {
        const invalid = !!checked[key] && !!draft[key] && parseRabMoney(draft[key]!) === null;
        return <label key={key} htmlFor={`rab-${key}`}>{label}<input id={`rab-${key}`} type="text" inputMode="decimal" value={draft[key] ?? ''} aria-invalid={invalid || undefined} aria-describedby={`rab-money-help${invalid ? ` rab-${key}-error` : ''}`} onFocus={() => { const value = draft[key]; if (value && parseRabMoney(value) !== null) setDraft(current => current && { ...current, [key]: value.replaceAll('.', '') }); }} onChange={event => { setDraft({ ...draft, [key]: event.target.value }); setDirty(true); }} onBlur={() => { setChecked(current => ({ ...current, [key]: true })); const value = draft[key]; const parsed = value ? parseRabMoney(value) : null; if (parsed !== null) setDraft(current => current && { ...current, [key]: formatRabMoney(parsed) }); }} />{invalid && <span id={`rab-${key}-error`}>Format tidak valid. Gunakan angka, titik ribuan lengkap, dan maksimal dua angka setelah koma.</span>}</label>;
      })}<label>Keterangan<textarea value={notes} maxLength={2000} onChange={event => { setNotes(event.target.value); setDirty(true); }} /></label></div><div className={styles.formFooter}><button type="button" onClick={cancelEdit}>Batal</button><button className={styles.primary}>{busy ? 'Menyimpan...' : 'Simpan RAB'}</button></div></fieldset></form>}
    </section><section className={`${styles.panel} ${styles.rabHistory}`}><p className={styles.eyebrow}>AKTIVITAS</p><h2>Riwayat RAB</h2>{rab?.audits?.length ? <ol>{rab.audits.map((entry, index) => <li key={index}>{entry.actor.name}: {entry.fromStatus ? `${labels[entry.fromStatus]} → ` : ''}{labels[entry.toStatus]} · {new Date(entry.createdAt).toLocaleString('id-ID')}{entry.reason ? ` — ${entry.reason}` : ''}</li>)}</ol> : <p>Belum ada riwayat.</p>}</section></div>}
    <footer className={styles.footer}>KERJANYATA / RAB</footer>
  </>;
}
