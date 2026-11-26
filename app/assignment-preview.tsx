'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './prototype/prototype.module.css';
import WorkerAccountForm, { type WorkerChoice } from './worker-account-form';
import { assignmentRoute } from './navigation';
import { assignmentErrors, assignmentFields, emptyAssignment } from './assignment-data';

type RecordData = ReturnType<typeof emptyAssignment> & { version: number; status: string; progressPercent: number; progressNotes: string; progressUpdatedAt: string | null; progressUpdatedBy: { name: string } | null; audits: { event: string; fromStatus: string | null; toStatus: string; createdAt: string; actor: { name: string } }[] };
type Entry = { spk: { id: string; number: string; job: { title: string; installationOwner: string; installationTypeCode: string | null; capacity: string | null; capacityUnit: string; location: string } }; assignment: RecordData | null };
type ListItem = { spkId: string; spkNumber: string; title: string; agenda: string; assignment: null | { number: string; status: string; progressPercent: number; _count: { members: number } } };
const stateLabels: Record<string, string> = { ASSIGNED: 'Ditugaskan', IN_PROGRESS: 'Sedang dikerjakan', COMPLETED: 'Selesai' };
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/backend' + path, { ...options, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || `Permintaan gagal (${response.status})`, response.status);
  return data;
}
export default function AssignmentPreview({ role, active, path, navigate, onDirtyChange, onBusyChange }: {
  role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER' | 'FINANCE' | 'PEKERJA'; active: boolean; path: string;
  navigate: (path: string) => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [saved, setSaved] = useState(emptyAssignment);
  const [draft, setDraft] = useState(emptyAssignment);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'assignment' | 'preview'>('assignment');
  const [downloading, setDownloading] = useState(false);
  const paper = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [workers, setWorkers] = useState<WorkerChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountDirty, setAccountDirty] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const [reload, setReload] = useState(0);
  const [percent, setPercent] = useState('0');
  const [notes, setNotes] = useState('');
  const lock = useRef(false);
  const route = assignmentRoute(path);
  const id = route?.id || '';
  const detailPath = '/penugasan/' + encodeURIComponent(id);
  const known = !!id && !!entry && entry.spk.id === id;
  const editing = known && route?.view === 'edit' && role === 'ADMIN_PENGAJUAN';
  const progressDirty = role === 'PEKERJA' && known && (percent !== String(entry.assignment?.progressPercent ?? 0) || notes !== (entry.assignment?.progressNotes ?? ''));
  const dirty = (editing && JSON.stringify(draft) !== JSON.stringify(saved)) || progressDirty;
  const pending = busy || accountBusy || downloading;
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { onDirtyChange(active && (dirty || accountDirty)); }, [active, dirty, accountDirty, onDirtyChange]);
  useEffect(() => { onBusyChange(active && pending); }, [active, pending, onBusyChange]);
  function accept(value: Entry) {
    setEntry(value);
    const letter = value.assignment ? Object.fromEntries([...assignmentFields.map(([key]) => [key, value.assignment![key]]), ['roster', value.assignment.roster]]) as ReturnType<typeof emptyAssignment> : {
      ...emptyAssignment(), purpose: value.spk.job.title, basis: `SPK ${value.spk.number}`, owner: value.spk.job.installationOwner,
      installationType: value.spk.job.installationTypeCode || '', location: value.spk.job.location,
      capacity: [value.spk.job.capacity, value.spk.job.capacityUnit].filter(Boolean).join(' '),
    };
    setSaved(letter); setDraft(letter); setPercent(String(value.assignment?.progressPercent ?? 0)); setNotes(value.assignment?.progressNotes ?? '');
  }
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setErrors([]); setNotice(''); setAccountDirty(false); setEntry(null); setReconcile(false); setTab(route?.view === 'edit' && role === 'ADMIN_PENGAJUAN' ? 'assignment' : 'preview');
    lock.current = true; setBusy(true); heading.current?.focus();
    void (async () => {
      try {
        if (id) {
          const [value, choices] = await Promise.all([api<Entry>('/assignments/' + encodeURIComponent(id)), role === 'ADMIN_PENGAJUAN' ? api<WorkerChoice[]>('/workers') : Promise.resolve([])]);
          if (!cancelled) { accept(value); setWorkers(choices); }
        } else {
          const records = await api<ListItem[]>('/assignments'); if (!cancelled) setItems(records);
        }
      } catch (e) { if (!cancelled) setErrors([e instanceof Error ? e.message : 'Gagal memuat penugasan.']); }
      finally { if (!cancelled) { lock.current = false; setBusy(false); } }
    })();
    return () => { cancelled = true; lock.current = false; };
  }, [active, path, reload]);
  useEffect(() => { if (errors.length) alert.current?.focus(); }, [errors]);
  useEffect(() => {
    if (!active || !known || tab !== 'preview' || !entry.assignment || dirty) return;
    document.body.classList.add(styles.assignmentPrintActive);
    return () => document.body.classList.remove(styles.assignmentPrintActive);
  }, [active, known, tab, entry, dirty]);
  function go(url: string) {
    if (pending || ((dirty || accountDirty) && !window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?'))) return;
    onDirtyChange(false); setNotice(''); navigate(url);
  }
  function failure(error: unknown) {
    if (!(error instanceof ApiError) || error.status === 409 || error.status >= 500) {
      setReconcile(true); setErrors(['Hasil penyimpanan perlu diperiksa. Isian tetap tersedia; salin bila perlu lalu muat data terbaru sebelum menyimpan lagi.']);
    } else setErrors([error.message]);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editing || !entry || lock.current || reconcile || pending) return;
    const issues = assignmentErrors(draft); setErrors(issues); if (issues.length) return;
    lock.current = true; setBusy(true);
    try {
      const value = await api<Entry>('/assignments/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, version: entry.assignment?.version ?? null, roster: draft.roster.map(({ userId, occupation, role }) => ({ userId, occupation, role })) }) });
      accept(value); setNotice('Penugasan tersimpan. Buka tab Preview surat untuk mengunduh.'); onDirtyChange(false);
    } catch (e) { failure(e); }
    finally { lock.current = false; setBusy(false); }
  }
  async function saveProgress(event: React.FormEvent) {
    event.preventDefault(); if (role !== 'PEKERJA' || lock.current || pending || reconcile) return;
    if (!/^\d{1,3}$/.test(percent) || Number(percent) > 100) { setErrors(['Isi progres 0–100.']); return; }
    lock.current = true; setBusy(true); setErrors([]);
    try {
      accept(await api<Entry>('/assignments/' + encodeURIComponent(id) + '/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progressPercent: Number(percent), notes }) }));
      setNotice('Progres pekerjaan tersimpan.'); onDirtyChange(false);
    } catch (e) { failure(e); }
    finally { lock.current = false; setBusy(false); }
  }
  function removeWorker(index: number) {
    const roster = draft.roster.filter((_, row) => row !== index);
    if (!roster.length) return;
    if (!roster.some(row => row.role === 'Ketua')) roster[0] = { ...roster[0], role: 'Ketua' };
    setDraft({ ...draft, roster });
  }
  async function downloadPdf() {
    if (!paper.current || !entry?.assignment || pending || dirty || reconcile || assignmentErrors(draft).length) return;
    setDownloading(true); setErrors([]);
    try {
      const latest = await api<Entry>('/assignments/' + encodeURIComponent(id));
      if (!latest.assignment || latest.assignment.version !== entry.assignment.version) {
        setReconcile(true); throw new Error('Versi surat berubah. Muat data terbaru.');
      }
      await document.fonts.ready;
      await Promise.all(Array.from(paper.current.querySelectorAll('img')).map(image => image.decode()));
      const { default: html2pdf } = await import('html2pdf.js');
      const options = {
        filename: `Surat-Tugas-${saved.number.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`,
        margin: 0,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff', scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css'], avoid: ['[data-pdf-keep]'] },
      };
      await html2pdf().set(options).from(paper.current).save();
    } catch {
      setErrors(['PDF gagal dibuat atau akses/versi surat berubah. Periksa data terbaru sebelum mencoba lagi.']);
    } finally { setDownloading(false); }
  }
  function selectTab(next: 'assignment' | 'preview', focus = false) {
    setTab(next); setErrors([]);
    if (focus) document.getElementById(`assignment-tab-${next}`)?.focus();
  }
  function tabKey(event: React.KeyboardEvent) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      selectTab(event.key === 'Home' ? 'assignment' : event.key === 'End' ? 'preview' : tab === 'assignment' ? 'preview' : 'assignment', true);
    }
  }
  const dateLabel = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  };
  const previewDocument = <article className={styles.assignmentPaper} aria-label="Pratinjau surat perintah tugas">
    <img className={styles.assignmentLetterhead} src="/spt-kop-contoh.jpg" alt="" />
    <div className={styles.assignmentContent}>
    <h2>SURAT PERINTAH TUGAS</h2><p className={styles.assignmentNumber}>Nomor : {draft.number}</p>
    <div className={styles.letterRow}><span>Menimbang</span><span>:</span><span>{draft.consideration}</span></div>
    <div className={styles.letterRow}><span>Mengingat</span><span>:</span><span>{draft.basis}</span></div>
    <h3>MENUGASKAN :</h3>
    <div className={styles.letterRow}><span>Kepada</span><span>:</span><div>{draft.roster.map((row, index) => <div data-pdf-keep className={styles.letterWorker} key={index}><span>{index + 1}.</span><div><div className={styles.letterDetail}><span>{row.role}</span><span>:</span><span>{row.name}</span></div><div className={styles.letterDetail}><span>Okupasi Jabatan</span><span>:</span><span>{row.occupation}</span></div></div></div>)}</div></div>
    <div className={styles.letterRow}><span>Untuk</span><span>:</span><div><p>{draft.purpose}</p>{([
      ['Jenis Instalasi', draft.installationType], ['Tanggal', `${dateLabel(draft.start)} - ${dateLabel(draft.end)}`], ['Pemilik Instalasi', draft.owner], ['Alamat', draft.location], ['Daya / Kapasitas', draft.capacity],
    ] as const).map(([label, value]) => <div className={styles.letterDetail} key={label}><span>{label}</span><span>:</span><span>{value}</span></div>)}</div></div>
    <div data-pdf-keep className={styles.assignmentSignature}><div className={styles.letterDetail}><span>Ditetapkan di</span><span>:</span><span>{draft.issuePlace}</span></div><div className={styles.letterDetail}><span>Pada tanggal</span><span>:</span><span>{dateLabel(draft.issueDate)}</span></div><p className={styles.signatureSpace}>[Tanpa tanda tangan / stempel]</p><strong>{draft.signatory}</strong><p>{draft.signatoryTitle}</p></div>
    </div>
  </article>;
  return <>
    <div className={styles.topline}>Beranda / Penugasan{known ? ' / Detail' : ''}</div>
    <div className={styles.titleRow}><div><h1 ref={heading} tabIndex={-1}>{known ? 'Detail surat penugasan' : 'Daftar surat penugasan'}</h1><p className={styles.subtitle}>Kelola tim pelaksana dan surat perintah tugas terkait SPK.</p></div></div>

    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {pending && <p role="status">Memuat atau memproses data...</p>}
    {reconcile && <button disabled={pending} onClick={() => { if (window.confirm('Muat data terbaru dan ganti isian yang belum disimpan?')) setReload(value => value + 1); }}>Muat data terbaru</button>}
    {errors.length > 0 && <div ref={alert} tabIndex={-1} className={styles.error} role="alert"><strong>Periksa penugasan:</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    {route?.view === 'list' ? <section className={styles.panel}><div className={styles.listIntro}><div><h2>Daftar surat penugasan</h2><p>{role === 'PEKERJA' ? 'Pekerjaan yang ditugaskan kepada Anda.' : 'Daftar SPK terbit untuk penugasan.'}</p></div><button disabled={pending} onClick={() => setReload(value => value + 1)}>Muat ulang</button></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Daftar surat penugasan"><table className={styles.table}><thead><tr><th scope="col">Nomor surat / SPK</th><th scope="col">Pekerjaan</th><th scope="col">Tim</th><th scope="col">Progres</th><th scope="col">Aksi</th></tr></thead><tbody>{items.map(item => <tr key={item.spkId}><td>{item.assignment?.number || 'Belum diisi'}<small>{item.spkNumber}</small></td><td>{item.title}<small>{item.agenda}</small></td><td>{item.assignment?._count.members ?? 0} pekerja</td><td>{item.assignment ? `${stateLabels[item.assignment.status]} · ${item.assignment.progressPercent}%` : 'Belum ditugaskan'}</td><td>{role === 'ADMIN_PENGAJUAN' ? <button disabled={pending} className={styles.assignmentEdit} aria-label={`Edit penugasan ${item.spkNumber}`} title="Edit penugasan" onClick={() => go('/penugasan/' + encodeURIComponent(item.spkId) + '/edit')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg></button> : <button disabled={pending} onClick={() => go('/penugasan/' + encodeURIComponent(item.spkId))}>Lihat pekerjaan</button>}</td></tr>)}</tbody></table></div>{!pending && !items.length && <p>Belum ada pekerjaan yang tersedia.</p>}</section> : !known ? <section className={styles.panel}><p>{pending ? 'Memuat detail...' : 'Penugasan tidak tersedia.'}</p><button disabled={pending} onClick={() => go('/penugasan')}>Kembali ke daftar</button><button disabled={pending} onClick={() => setReload(value => value + 1)}>Coba lagi</button></section> : <>
      <div className={styles.panel}><h2>{entry.spk.job.title}</h2><p>SPK: {entry.spk.number}</p><p>{entry.assignment ? `${stateLabels[entry.assignment.status]} · ${entry.assignment.progressPercent}%` : 'Belum ditugaskan'}</p>{entry.assignment && <><p>Catatan progres: {entry.assignment.progressNotes || '—'}</p>{entry.assignment.progressUpdatedAt && <p>Diperbarui {new Date(entry.assignment.progressUpdatedAt).toLocaleString('id-ID')} oleh {entry.assignment.progressUpdatedBy?.name}</p>}</>}</div>
      {role === 'PEKERJA' && entry.assignment && <form className={styles.panel} onSubmit={saveProgress}><h2>Update pekerjaan</h2><fieldset className={styles.assignmentFormFields} disabled={pending || reconcile}><div className={styles.formGrid}><label htmlFor="assignment-percent">Progres (%)<input id="assignment-percent" type="number" min="0" max="100" step="1" required value={percent} onChange={event => setPercent(event.target.value)} /></label><label htmlFor="assignment-progress-notes">Catatan pekerjaan<textarea id="assignment-progress-notes" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label></div><p>Progres berlaku untuk pekerjaan ini dan dapat diperbarui oleh anggota tim. Pembaruan terakhir berlaku.</p><button className={styles.primary}>Simpan progres</button></fieldset></form>}
      <div className={styles.actions}><button disabled={pending} onClick={() => go('/penugasan')}>Kembali ke daftar</button>{dirty && <span className={styles.unsaved}>Belum disimpan</span>}</div>
      <div className={styles.assignmentTabs} role="tablist" aria-label="Detail penugasan">
        {(['assignment', 'preview'] as const).map(value => <button key={value} id={`assignment-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`assignment-panel-${value}`} tabIndex={tab === value ? 0 : -1} disabled={pending} onKeyDown={tabKey} onClick={() => selectTab(value)}>{value === 'assignment' ? 'Penugasan' : 'Preview surat'}</button>)}
      </div>
      <section role="tabpanel" id="assignment-panel-assignment" aria-labelledby="assignment-tab-assignment" hidden={tab !== 'assignment'} tabIndex={0}>
        {editing && <WorkerAccountForm onCreated={worker => setWorkers(current => [...current, worker])} onDirtyChange={setAccountDirty} onBusyChange={setAccountBusy} />}
        <form className={styles.panel} onSubmit={save} noValidate>
          <fieldset className={styles.assignmentFormFields} disabled={!editing || pending || reconcile}><legend className={styles.srOnly}>Form penugasan</legend>
          <h2>Tim pelaksana</h2><p>Isi siapa yang ditugaskan dan tentukan ketua tim.</p>
          <fieldset className={styles.assignmentRoster}><legend>Tim pelaksana</legend><p>Pilih akun pekerja aktif. Akun yang dipilih mendapatkan akses ke pekerjaan ini.</p>{draft.roster.map((row, index) => <div className={styles.assignmentWorker} key={index}><label htmlFor={'worker-name-' + index}>Nama pekerja {index + 1}<select id={'worker-name-' + index} required value={row.userId} onChange={event => { const worker = workers.find(value => value.id === event.target.value); setDraft({ ...draft, roster: draft.roster.map((entry, position) => position === index ? { ...entry, userId: worker?.id || '', name: worker?.name || '', occupation: worker?.occupation || '' } : entry) }); }}><option value="">Pilih akun pekerja</option>{!editing && row.userId && <option value={row.userId}>{row.name}</option>}{editing && row.userId && !workers.some(worker => worker.id === row.userId) && <option value={row.userId} disabled>{row.name} (tidak aktif)</option>}{editing && workers.map(worker => <option key={worker.id} value={worker.id} disabled={draft.roster.some((member, position) => position !== index && member.userId === worker.id)}>{worker.name} · {worker.email}</option>)}</select></label><label htmlFor={'worker-occupation-' + index}>Okupasi jabatan<input id={'worker-occupation-' + index} required maxLength={200} value={row.occupation} onChange={event => setDraft({ ...draft, roster: draft.roster.map((entry, position) => position === index ? { ...entry, occupation: event.target.value } : entry) })} /></label><label><input type="radio" name="assignment-chair" checked={row.role === 'Ketua'} onChange={() => setDraft({ ...draft, roster: draft.roster.map((entry, position) => ({ ...entry, role: position === index ? 'Ketua' : 'Anggota' })) })} /> Ketua {index + 1}</label><span>{row.role}</span><button type="button" disabled={draft.roster.length === 1} onClick={() => removeWorker(index)} aria-label={'Hapus pekerja ' + (index + 1)}>Hapus</button></div>)}
        <button type="button" disabled={draft.roster.length >= 50} onClick={() => setDraft({ ...draft, roster: [...draft.roster, { userId: '', name: '', occupation: '', role: 'Anggota' }] })}>Tambah pekerja</button></fieldset>
          <h2>Rincian surat tugas</h2><p>Data ini akan ditampilkan di tab Preview surat.</p>
          <div className={styles.formGrid}>{assignmentFields.map(([key, label]) => <label htmlFor={'assignment-' + key} key={key}>{label}{['consideration', 'basis', 'purpose', 'location', 'capacity'].includes(key) ? <textarea id={'assignment-' + key} required maxLength={key === 'number' ? 200 : 2000} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /> : <input id={'assignment-' + key} required maxLength={key === 'number' ? 200 : 2000} type={['start', 'end', 'issueDate'].includes(key) ? 'date' : 'text'} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />}</label>)}</div>
          </fieldset>
          {editing && accountDirty && <p>Lengkapi pembuatan akun pekerja atau pilih Batal sebelum menyimpan penugasan.</p>}
          {editing ? <div className={styles.formFooter}><button type="submit" disabled={pending || reconcile || accountDirty} className={styles.primary}>Simpan penugasan</button></div> : <p>Mode baca saja. Admin Pengajuan &amp; RAB mengisi penugasan.</p>}
        </form>
      </section>
      <section role="tabpanel" id="assignment-panel-preview" aria-labelledby="assignment-tab-preview" hidden={tab !== 'preview'} tabIndex={0}>
        <div className={styles.assignmentPreviewToolbar}><div><h2>Preview surat tugas</h2><p>{dirty ? 'Preview mengikuti isian terbaru. Simpan penugasan sebelum mengunduh.' : 'Surat mengikuti data penugasan yang telah disimpan.'}</p></div><div className={styles.actions}><button disabled={pending || dirty || reconcile || !entry.assignment || assignmentErrors(draft).length > 0} onClick={() => window.print()}>Cetak</button><button className={styles.primary} disabled={pending || dirty || reconcile || !entry.assignment || assignmentErrors(draft).length > 0} onClick={() => void downloadPdf()}>{downloading ? 'Menyiapkan PDF...' : 'Download PDF'}</button></div></div>
        <div className={styles.assignmentPreview}><div ref={paper} className={styles.assignmentCapture}>{assignmentErrors(draft).length ? <p>Lengkapi seluruh kolom surat dan tim pada tab Penugasan untuk melihat preview.</p> : previewDocument}</div></div>
      </section>
      {entry.assignment && <section className={styles.panel}><h2>Riwayat penugasan</h2><ul>{entry.assignment.audits.map((audit, index) => <li key={index}>{audit.event} · {audit.actor.name} · {new Date(audit.createdAt).toLocaleString('id-ID')}{audit.fromStatus !== audit.toStatus ? ` · ${audit.fromStatus || '—'} → ${audit.toStatus}` : ''}</li>)}</ul></section>}
    </>}
    {mounted && active && known && !!entry.assignment && !dirty && tab === 'preview' && createPortal(<div className={styles.assignmentPrint} aria-hidden="true">{previewDocument}</div>, window.document.body)}
  </>;
}
