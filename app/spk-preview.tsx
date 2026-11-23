'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './prototype/prototype.module.css';
import { formatRabMoney, parseRabMoney } from './rab-money';

type Trigger = 'AFTER_RAB_APPROVED' | 'MANUAL_FINANCE';
type Setting = { trigger: Trigger; version: number };
type Entry = { job: { id: string; title: string | null; agenda: string | null; applicant: string | null }; trigger: Trigger; preparationStatus: 'UNPREPARED' | 'PENDING' | 'ISSUED'; spk: null | { number: string | null; amount: string | null; acknowledgedAt: string | null; acknowledgedBy: { name: string } | null; audits: { event: string; createdAt: string; actor: { name: string } }[] } };
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/backend' + path, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new ApiError(body.error || `Permintaan gagal (${response.status})`, response.status); }
  return response.json();
}
const endpoint = (id: string) => '/jobs/' + encodeURIComponent(id) + '/spk';
const modeLabel = (trigger: Trigger) => trigger === 'AFTER_RAB_APPROVED' ? 'Persiapan otomatis' : 'Manual Finance';
const statusLabel = (entry: Entry) => entry.preparationStatus === 'ISSUED' ? 'Diterbitkan' : entry.preparationStatus === 'PENDING' ? 'Menunggu nomor dan nominal' : entry.trigger === 'AFTER_RAB_APPROVED' ? 'Persiapan otomatis belum tersedia' : 'Menunggu persiapan Finance';

export default function SpkPreview({ role, active, path, navigate, onDirtyChange, onBusyChange }: {
  role: 'ADMIN_PENGAJUAN' | 'STAKEHOLDER' | 'FINANCE'; active: boolean; path: string; navigate: (path: string) => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Entry[]>([]);
  const [item, setItem] = useState<Entry | null>(null);
  const [setting, setSetting] = useState<Setting | null>(null);
  const [trigger, setTrigger] = useState<Trigger>('MANUAL_FINANCE');
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconcile, setReconcile] = useState(false);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const settings = path === '/spk/pengaturan';
  let id = '';
  try { if (!settings && path.startsWith('/spk/')) id = decodeURIComponent(path.slice(5)); } catch { id = ''; }
  const dirty = settings ? !!setting && trigger !== setting.trigger : !!number || !!amount;
  useEffect(() => { onDirtyChange(active && dirty); }, [active, dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(active && busy); }, [active, busy, onBusyChange]);
  useEffect(() => { if (active) heading.current?.focus(); }, [active, path]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setItem(null); setSetting(null); setNumber(''); setAmount(''); setError(''); setNotice(''); setReconcile(false);
    lock.current = true; setBusy(true);
    void (async () => {
      try {
        if (settings) { const value = await api<Setting>('/settings/spk-trigger'); if (!cancelled) { setSetting(value); setTrigger(value.trigger); } }
        else if (id) { const value = await api<Entry>(endpoint(id)); if (!cancelled) setItem(value); }
        else { const value = await api<Entry[]>('/spks'); if (!cancelled) setItems(value); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat data'); }
      finally { if (!cancelled) { lock.current = false; setBusy(false); } }
    })();
    return () => { cancelled = true; lock.current = false; };
  }, [active, path]);
  function go(url: string) {
    if (lock.current || (dirty && !window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?'))) return;
    navigate(url);
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (settings) { const value = await api<Setting>('/settings/spk-trigger'); if (!setting || (!dirty && !reconcile)) setTrigger(value.trigger); setSetting(value); setReconcile(false); setNotice('Pengaturan terbaru dimuat. Periksa pilihan sebelum menyimpan.'); }
      else if (id) { const value = await api<Entry>(endpoint(id)); setItem(value); setReconcile(false); setNotice('Status terbaru dimuat. Periksa hasil sebelum melanjutkan.'); }
      else setItems(await api<Entry[]>('/spks'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat data'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function mutate(action: 'setting' | 'prepare' | 'issue' | 'ack') {
    if (lock.current || reconcile) return;
    const parsed = parseRabMoney(amount);
    if (action === 'issue' && (!number.trim() || number.trim().length > 200 || parsed === null)) { setError('Isi nomor (maksimal 200 karakter) dan nominal yang valid. Nilai 0 diperbolehkan.'); return; }
    if (action === 'setting' && !setting) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'setting') {
        const value = await api<Setting>('/settings/spk-trigger', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger, version: setting!.version }) });
        setSetting(value); setTrigger(value.trigger); setNotice('Pengaturan tersimpan.');
      } else {
        const value = await api<Entry>(endpoint(id) + '/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'issue' ? { number: number.trim(), amount: parsed } : {}) });
        setItem(value); if (action === 'issue') { setNumber(''); setAmount(''); }
        setNotice(action === 'prepare' ? 'SPK disiapkan.' : action === 'issue' ? 'SPK diterbitkan.' : 'ACK tercatat.');
      }
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 409 || e.status >= 500) { setReconcile(true); setError('Hasil atau status terbaru perlu diperiksa. Input tetap tersedia; muat ulang sebelum mencoba lagi.'); }
      else setError(e.message);
    } finally { lock.current = false; setBusy(false); }
  }
  return <>
    <div className={styles.topline}>Beranda / SPK / PO{settings ? ' / Pengaturan' : id ? ' / Detail' : ''}</div>
    <div className={styles.titleRow}><div><h1 ref={heading} tabIndex={-1}>{settings ? 'Pengaturan pemicu' : id ? 'Detail SPK / PO' : 'SPK / PO'}</h1><p className={styles.subtitle}>SPK / PO untuk RAB yang telah disetujui.</p></div>{role === 'ADMIN_PENGAJUAN' && !settings && <button disabled={busy} onClick={() => go('/spk/pengaturan')}>Pengaturan pemicu</button>}</div>
    {error && <div className={styles.error} role="alert">{error} <button disabled={busy} onClick={() => void reload()}>{reconcile ? 'Muat status terbaru' : 'Muat ulang'}</button></div>}
    {notice && <div className={styles.notice} role="status">{notice}</div>}
    {(settings || id) && <button className={styles.back} disabled={busy} onClick={() => go('/spk')}>← Daftar SPK / PO</button>}
    {busy && <p role="status">Memuat atau memproses data...</p>}
    {settings && setting && <section className={styles.panel}><h2>Pemicu persiapan SPK / PO</h2><p>Mode tersimpan: {modeLabel(setting.trigger)}. Mode dicatat saat RAB disetujui dan tidak mengubah pekerjaan sebelumnya. Mode otomatis hanya menyiapkan SPK; Finance tetap melengkapi nomor dan nominal sebelum menerbitkan.</p><fieldset disabled={busy || role !== 'ADMIN_PENGAJUAN'}><legend>Pilih pemicu</legend><label><input type="radio" name="trigger" checked={trigger === 'AFTER_RAB_APPROVED'} onChange={() => setTrigger('AFTER_RAB_APPROVED')} /> Persiapan otomatis setelah RAB disetujui</label><br /><label><input type="radio" name="trigger" checked={trigger === 'MANUAL_FINANCE'} onChange={() => setTrigger('MANUAL_FINANCE')} /> Manual oleh Finance</label></fieldset>{role === 'ADMIN_PENGAJUAN' && <div className={styles.actions}><button disabled={busy || !dirty} onClick={() => setTrigger(setting.trigger)}>Batal</button><button className={styles.primary} disabled={busy || !dirty || reconcile} onClick={() => void mutate('setting')}>Simpan pengaturan</button></div>}</section>}
    {!settings && id && item && <section className={styles.panel}><div className={styles.sectionHead}><div><h2>{item.job.title || 'Tanpa judul'}</h2><p>{item.job.agenda || 'Agenda belum diisi'} · {modeLabel(item.trigger)}</p></div><span className={styles.status}>{statusLabel(item)}</span></div><dl className={styles.details}><div><dt>Nomor SPK / PO</dt><dd>{item.spk?.number || 'Belum tersedia'}</dd></div><div><dt>Nominal SPK / PO</dt><dd>{item.spk?.amount != null ? 'Rp ' + formatRabMoney(item.spk.amount) : 'Belum tersedia'}</dd></div><div><dt>ACK</dt><dd>{item.spk?.acknowledgedAt ? `${item.spk.acknowledgedBy?.name || 'Stakeholder'} · ${new Date(item.spk.acknowledgedAt).toLocaleString('id-ID')}` : item.preparationStatus === 'ISSUED' ? 'Belum di-ACK' : 'Menunggu penerbitan'}</dd></div></dl>
      {item.preparationStatus === 'UNPREPARED' && role === 'FINANCE' && <div className={styles.actions}><button className={styles.primary} disabled={busy || reconcile} onClick={() => void mutate('prepare')}>{item.trigger === 'AFTER_RAB_APPROVED' ? 'Siapkan / pulihkan SPK' : 'Siapkan SPK'}</button></div>}
      {item.preparationStatus === 'PENDING' && role === 'FINANCE' && <form onSubmit={event => { event.preventDefault(); void mutate('issue'); }}><fieldset disabled={busy || reconcile}><legend>Terbitkan SPK / PO</legend><p id="spk-money-help">Nominal menggunakan titik untuk ribuan dan koma untuk desimal, maksimal 16 digit dan 2 desimal. Nilai 0 diperbolehkan.</p><label htmlFor="spk-number">Nomor SPK / PO</label><input id="spk-number" value={number} maxLength={200} required onChange={event => setNumber(event.target.value)} /><label htmlFor="spk-amount">Nominal (IDR)</label><input id="spk-amount" value={amount} inputMode="decimal" required aria-describedby="spk-money-help" onChange={event => setAmount(event.target.value)} onBlur={() => { const value = parseRabMoney(amount); if (value !== null) setAmount(formatRabMoney(value)); }} /><div className={styles.actions}><button className={styles.primary}>Terbitkan SPK / PO</button></div></fieldset></form>}
      {item.preparationStatus !== 'PENDING' && dirty && role === 'FINANCE' && <div><p>Input yang belum dipastikan tersimpan tetap tersedia untuk dibandingkan dengan data di atas:</p><dl className={styles.details}><div><dt>Nomor input</dt><dd>{number || '—'}</dd></div><div><dt>Nominal input</dt><dd>{amount || '—'}</dd></div></dl><button onClick={() => { setNumber(''); setAmount(''); }}>Buang input</button></div>}
      {item.preparationStatus === 'ISSUED' && role === 'STAKEHOLDER' && !item.spk?.acknowledgedAt && <div className={styles.actions}><button className={styles.primary} disabled={busy || reconcile} onClick={() => void mutate('ack')}>ACK SPK / PO</button></div>}
      {item.spk && <><h3>Riwayat SPK / PO</h3><ul>{item.spk.audits.map((audit, index) => <li key={index}>{audit.event === 'AUTO_PREPARED' ? 'Persiapan otomatis dipicu oleh persetujuan' : audit.event === 'MANUAL_PREPARED' ? 'Disiapkan Finance' : audit.event === 'ISSUED' ? 'Diterbitkan' : audit.event === 'ACKNOWLEDGED' ? 'ACK' : audit.event} · {audit.actor.name} · {new Date(audit.createdAt).toLocaleString('id-ID')}</li>)}</ul></>}
    </section>}
    {!settings && !id && <section className={styles.panel}><div className={styles.listIntro}><div><h2>RAB disetujui</h2><p>{items.length} pekerjaan</p></div></div><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Daftar SPK"><table className={styles.table}><thead><tr><th scope="col">Pekerjaan</th><th scope="col">Status</th><th scope="col">ACK</th><th scope="col">Aksi</th></tr></thead><tbody>{items.map(entry => <tr key={entry.job.id}><td>{entry.job.title || 'Tanpa judul'}<small>{entry.job.agenda || 'Agenda belum diisi'}</small></td><td>{statusLabel(entry)}</td><td>{entry.spk?.acknowledgedAt ? 'Sudah di-ACK' : entry.preparationStatus === 'ISSUED' ? 'Belum di-ACK' : 'Belum terbit'}</td><td><button disabled={busy} onClick={() => go('/spk/' + encodeURIComponent(entry.job.id))}>Lihat detail</button></td></tr>)}</tbody></table></div>{!busy && !items.length && !error && <p>Belum ada RAB disetujui.</p>}</section>}
  </>;
}
