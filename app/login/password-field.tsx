'use client';

import { useState } from 'react';

export default function PasswordField({ defaultValue }: { defaultValue?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="password">
    <input id="password" name="password" type={visible ? 'text' : 'password'} required autoComplete="current-password" defaultValue={defaultValue} />
    <button type="button" aria-label={visible ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'} aria-controls="password" aria-pressed={visible} onClick={() => setVisible(current => !current)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {visible && <path d="m3 3 18 18" />}
      </svg>
    </button>
  </div>;
}
