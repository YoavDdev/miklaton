'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getMunicipalityId } from '@/lib/municipality';
import HolidayDutyBoard from '@/components/HolidayDutyBoard';

export default function HolidayDutyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/holiday-duty?municipality_id=${getMunicipalityId()}`);
        const json = await res.json();
        if (!alive) return;
        if (json.success) {
          setData(json);
          if (json.period?.share_url) setShareUrl(json.period.share_url);
        } else setError(json.error || 'שגיאה בטעינת הלוח');
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

  const fullShareUrl = shareUrl
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${shareUrl}`
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      toast.success('הקישור הועתק');
    } catch {
      toast.error('לא הצלחתי להעתיק - סמן והעתק ידנית');
    }
  };

  const whatsappHref = () => {
    const text = `לוח כוננות חג - ${data?.period?.name}\n${fullShareUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

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
      {/* בהדפסה נשארים רק הלוח עצמו והכותרת; הכפתורים והניווט יורדים */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 8px;
            font-size: 11px;
          }
          .no-print,
          nav,
          header {
            display: none !important;
          }
          /* כרטיס נושא לא נחתך בין עמודים */
          .print-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          a[href^='tel:'] {
            color: #000 !important;
            text-decoration: none;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>

      <div id="holiday-board">
        <HolidayDutyBoard period={data.period} topics={data.topics} isActive={data.isActive} />
      </div>

      {data.period && (
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 min-w-[130px] py-3 rounded-xl bg-slate-800 text-white font-bold"
          >
            🖨️ הדפס / PDF
          </button>
          <button
            onClick={copyLink}
            disabled={!fullShareUrl}
            className="flex-1 min-w-[130px] py-3 rounded-xl bg-gray-100 text-gray-800 font-bold disabled:opacity-40"
          >
            🔗 העתק קישור
          </button>
          <a
            href={whatsappHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[130px] py-3 rounded-xl bg-emerald-600 text-white font-bold text-center"
          >
            💬 שלח בוואטסאפ
          </a>
        </div>
      )}

      {fullShareUrl && (
        <p className="no-print text-xs text-gray-500 mt-2 break-all">
          הקישור נפתח גם למי שאין לו חשבון במערכת, ומכיל את שמות הכוננים והטלפונים שלהם.
        </p>
      )}
    </div>
  );
}
