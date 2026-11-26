'use client';
import { useState } from 'react';
import styles from './prototype/prototype.module.css';
export type WorkerChoice = { id: string; name: string; email: string; occupation: string };
export default function WorkerAccountForm({ onCreated, onDirtyChange, onBusyChange }: { onCreated: (worker: WorkerChoice) => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void }) {
  const [form, setForm] = useState({ name: '', email: '', occupation: '', password: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try {
      const response = await fetch('/backend/workers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, email: form.email.trim() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Akun gagal dibuat.');
      onCreated(data); setForm({ name: '', email: '', occupation: '', password: '' }); onDirtyChange(false); setNotice('Akun pekerja dibuat. Pekerja dapat login dengan email dan password yang telah ditentukan.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Hasil pembuatan belum dapat dipastikan. Periksa daftar pekerja sebelum mencoba lagi.'); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <details className={styles.panel}><summary>Tambah akun pekerja</summary><form onSubmit={save}><fieldset disabled={busy} className={styles.assignmentFormFields}><div className={styles.formGrid}>{([['name', 'Nama pekerja'], ['email', 'Email login'], ['occupation', 'Okupasi jabatan'], ['password', 'Password awal (12–72 byte)']] as const).map(([key, label]) => <label key={key} htmlFor={`new-worker-${key}`}>{label}<input id={`new-worker-${key}`} type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} autoComplete={key === 'password' ? 'new-password' : 'off'} required maxLength={key === 'email' ? 254 : key === 'password' ? 72 : 200} value={form[key]} onChange={event => { setForm({ ...form, [key]: event.target.value }); onDirtyChange(true); }} /></label>)}</div>{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}<button type="button" onClick={() => { setForm({ name: '', email: '', occupation: '', password: '' }); onDirtyChange(false); setError(''); }}>Batal</button><button className={styles.primary}>{busy ? 'Membuat akun...' : 'Buat akun pekerja'}</button></fieldset></form></details>;
}
