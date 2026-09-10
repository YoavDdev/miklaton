'use client';

import { useEffect, useState } from 'react';
import { getMunicipalityId } from '@/lib/municipality';
import HolidayDutyBoard from '@/components/HolidayDutyBoard';

export default function HolidayDutyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/holiday-duty?municipality_id=${getMunicipalityId()}`);
        const json = await res.json();
        if (!alive) return;
        if (json.success) setData(json);
        else setError(json.error || 'שגיאה בטעינת הלוח');
      } catch {
        if (alive) setError('שגיאה בטעינת הלוח');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-red-600" dir="rtl">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4" dir="rtl">
      <HolidayDutyBoard period={data.period} topics={data.topics} isActive={data.isActive} />
    </div>
  );
}
