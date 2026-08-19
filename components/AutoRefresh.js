'use client';

import { useEffect, useRef } from 'react';

export default function AutoRefresh() {
  const currentHash = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version?_=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        if (!data.success || !data.hash) return;

        if (currentHash.current === null) {
          currentHash.current = data.hash;
          return;
        }

        if (currentHash.current !== data.hash) {
          // eslint-disable-next-line no-console -- לוג תפעולי של הקיוסק, מכוון
          console.log('New version detected, reloading...');
          window.location.reload();
        }
      } catch (err) {
        console.error('Auto refresh check failed:', err);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000); // every 1 minute

    return () => clearInterval(interval);
  }, []);

  return null;
}
