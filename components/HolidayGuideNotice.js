'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMunicipalityId } from '@/lib/municipality';

/**
 * אזהרה שמוצגת מעל לוחות הכוננות הרגילים בזמן חג.
 *
 * הלוחות הרגילים בנויים על ימי השבוע, ולכן בחג שנופל ביום חול - ראש השנה
 * תשפ"ז נופל על יום ראשון - הם מציגים את משמרת יום החול. במקום לשנות את
 * התנהגותם בשקט, שהיא החלטה מסוכנת בקוד שעובד, המוקדן מופנה במפורש למקום
 * שבו יושבים כונני החג.
 */
export default function HolidayGuideNotice() {
  const [period, setPeriod] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/holiday-duty?municipality_id=${getMunicipalityId()}`);
        const json = await res.json();
        if (!alive) return;
        // רק בזמן החג עצמו. לפניו הלוח הרגיל עדיין נכון.
        setPeriod(json.success && json.isActive ? json.period : null);
      } catch {
        /* אזהרה אינה קריטית - כישלון שקט */
      }
    };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!period) return null;

  return (
    <div
      dir="rtl"
      className="bg-red-50 border-2 border-red-400 rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-2"
    >
      <span className="text-xl">⚠️</span>
      <div className="flex-1 min-w-[200px]">
        <div className="font-bold text-red-800">
          שים לב — אלה כונני השגרה, לא כונני החג
        </div>
        <div className="text-sm text-red-700">
          {period.name} · הרשימה כאן בנויה לפי ימי השבוע הרגילים ואינה תקפה בחג.
        </div>
      </div>
      <Link
        href="/holiday-duty"
        className="bg-red-600 text-white font-bold rounded-lg px-4 py-2 whitespace-nowrap"
      >
        🕯️ לכוננות החג ▸
      </Link>
    </div>
  );
}
