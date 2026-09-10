'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMunicipalityId } from '@/lib/municipality';

/**
 * מופיע רק כשיש חג פעיל, או חג שמתחיל בתוך 48 שעות. שאר הזמן אינו מרנדר
 * כלום - באנר שתמיד שם מפסיק להיקרא.
 */
export default function HolidayBanner() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/holiday-duty?municipality_id=${getMunicipalityId()}`);
        const json = await res.json();
        if (!alive || !json.success || !json.period) return;

        // לפי חלון הכוננות שמנהל המוקד קבע, לא לפי שעת כניסת החג.
        if (json.isActive || json.period.duty_starts_in_days <= 2) {
          setState({ period: json.period, isActive: json.isActive });
        }
      } catch {
        /* באנר אינו קריטי - כישלון שקט */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  const { period, isActive } = state;
  return (
    <Link
      href="/holiday-duty"
      dir="rtl"
      className={`block rounded-xl px-4 py-3 mb-3 text-white ${
        isActive ? 'bg-amber-600' : 'bg-slate-700'
      }`}
    >
      <span className="font-bold">
        🕯️ {isActive ? 'מצב חג' : 'חג מתקרב'} — {period.name}
      </span>
      <span className="text-white/85 text-sm mr-2">
        כוננות {fmtDate(period.duty_start)} עד {fmtDate(period.duty_end)}
        {isActive ? '' : ` · כניסת החג ${fmt(period.starts_at)}`}
      </span>
      <span className="text-white/70 text-sm mr-2">· לוח הכוננות ▸</span>
    </Link>
  );
}

function fmtDate(isoDate) {
  return new Date(`${isoDate}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });
}

function fmt(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
