'use client';

import { useEffect } from 'react';

export default function RestoreCheck() {
  useEffect(() => {
    function check(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener('pageshow', check);
    return () => window.removeEventListener('pageshow', check);
  }, []);
  return null;
}
