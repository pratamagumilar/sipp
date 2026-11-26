'use client';
import { useEffect, useRef, useState } from 'react';
import AssignmentPreview from './assignment-preview';
import { assignmentRoute } from './navigation';
import styles from './prototype/prototype.module.css';

export default function WorkerWorkspace({ name, logout }: { name: string; logout: () => Promise<void> }) {
  const [path, setPath] = useState('/penugasan');
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const current = useRef('/penugasan'); const index = useRef(0); const restoring = useRef(false);
  function leave() { return !busy && (!dirty || window.confirm('Perubahan belum disimpan. Tinggalkan halaman ini?')); }
  function navigate(url: string) {
    index.current += 1; current.current = url;
    window.history.pushState({ ...window.history.state, knIndex: index.current }, '', url); setPath(url);
  }
  useEffect(() => {
    const url = assignmentRoute(window.location.pathname) ? window.location.pathname : '/penugasan';
    current.current = url; window.history.replaceState({ ...window.history.state, knIndex: 0 }, '', url); setPath(url);
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    const pop = (event: PopStateEvent) => {
      if (restoring.current) { restoring.current = false; return; }
      const nextIndex = event.state?.knIndex;
      if (!leave()) {
        if (typeof nextIndex === 'number' && nextIndex !== index.current) { restoring.current = true; window.history.go(index.current - nextIndex); }
        else window.history.pushState({ ...window.history.state, knIndex: index.current }, '', current.current);
        return;
      }
      index.current = typeof nextIndex === 'number' ? nextIndex : 0;
      const url = assignmentRoute(window.location.pathname) ? window.location.pathname : '/penugasan';
      current.current = url; setPath(url);
    };
    window.addEventListener('beforeunload', warn); window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('popstate', pop); };
  }, [dirty, busy]);
  return <div className={styles.prototype}><header className={styles.header}><div className={styles.brand}><strong>KerjaNyata</strong><span className={styles.headerSub}>PEKERJAAN SAYA</span></div><div className={styles.account}><span>{name}<small>Pekerja</small></span><form action={logout} onSubmit={event => { if (!leave()) event.preventDefault(); }}><button disabled={busy}>Keluar</button></form></div></header><div className={styles.workspace}><aside className={styles.sidebar}><p>MENU UTAMA</p><nav><button disabled={busy} aria-current="page" onClick={() => { if (leave()) { setDirty(false); navigate('/penugasan'); } }}>Pekerjaan saya</button></nav></aside><main className={styles.main}><AssignmentPreview role="PEKERJA" active path={path} navigate={navigate} onDirtyChange={setDirty} onBusyChange={setBusy} /></main></div></div>;
}
