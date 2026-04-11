'use client';

import { useState, useEffect } from 'react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateForDB(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function OnCallQueryPage() {
  const [dutyRoster, setDutyRoster] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryDay, setQueryDay] = useState(null);
  const [queryHour, setQueryHour] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentWeekStart] = useState(() => getWeekStart(new Date()));

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  const weekDates = getWeekDates();

  // Read URL params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qd = params.get('day');
    const qh = params.get('hour');

    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));

    if (qd !== null && qh !== null) {
      const day = parseInt(qd, 10);
      const hour = parseInt(qh, 10);
      if (!isNaN(day) && day >= 0 && day <= 6 && !isNaN(hour) && hour >= 0 && hour <= 23) {
        setQueryDay(day);
        setQueryHour(hour);
      } else {
        setQueryDay(israelTime.getDay());
        setQueryHour(israelTime.getHours());
      }
    } else {
      setQueryDay(israelTime.getDay());
      setQueryHour(israelTime.getHours());
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const weekStartStr = formatDateForDB(currentWeekStart);
      const [rosterRes, contactsRes] = await Promise.all([
        fetch(`/api/duty-roster?week_start_date=${weekStartStr}`),
        fetch('/api/contacts')
      ]);

      const rosterData = await rosterRes.json();
      const contactsData = await contactsRes.json();

      if (rosterData.success) setDutyRoster(rosterData.data || []);
      if (contactsData.success) setContacts(contactsData.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  };

  const getDutiesForDayAndHour = (contactId, dayOfWeek, hour) => {
    return dutyRoster.filter(d => {
      if (d.contact_id !== contactId) return false;
      const { start_hour, end_hour } = d;

      if (d.day_of_week === dayOfWeek) {
        if (start_hour === end_hour) return true;
        if (end_hour < start_hour && end_hour !== 0) return hour >= start_hour;
        if (end_hour === 0) return hour >= start_hour;
        return hour >= start_hour && hour < end_hour;
      }

      const prevDay = (dayOfWeek + 6) % 7;
      if (d.day_of_week === prevDay && end_hour < start_hour && end_hour !== 0) {
        return hour < end_hour;
      }

      return false;
    });
  };

  const getContactsAtHour = (day, hour) => {
    const result = {};
    contacts.forEach(contact => {
      const duties = getDutiesForDayAndHour(contact.id, day, hour);
      if (duties.length > 0) {
        const deptName = contact.departments?.name || 'ללא מכלול';
        if (!result[deptName]) result[deptName] = [];
        const endHours = duties.map(d => {
          if (d.start_hour === d.end_hour) return 'קבוע 24 שעות';
          const eh = d.end_hour === 0 ? '00' : String(d.end_hour).padStart(2, '0');
          return `עד ${eh}:00`;
        });
        result[deptName].push({
          ...contact,
          endInfo: endHours.join(', '),
          isSleep: duties.some(d => d.notes?.includes('[לן]')),
          isPermanent: duties.some(d => d.notes?.includes('[קבוע]')),
        });
      }
    });
    return result;
  };

  const handleCopyLink = () => {
    if (queryDay === null || queryHour === null) return;
    const url = `${window.location.origin}/on-call-query?day=${queryDay}&hour=${queryHour}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handlePrint = () => {
    if (queryDay === null || queryHour === null) return;
    const dayName = DAYS[queryDay];
    const hourStr = String(queryHour).padStart(2, '0') + ':00';
    const filtered = getContactsAtHour(queryDay, queryHour);

    const selectedDate = weekDates[queryDay];
    const dateStr = selectedDate ? `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}` : '';

    let tableRows = '';
    Object.entries(filtered).forEach(([deptName, deptContacts]) => {
      tableRows += `<tr class="dept-row"><td colspan="4">${deptName}</td></tr>`;
      deptContacts.forEach(c => {
        const tags = [];
        if (c.isPermanent) tags.push('🔒 קבוע');
        if (c.isSleep) tags.push('🏢 לן');
        tableRows += `<tr>
          <td class="name-cell">${c.full_name}</td>
          <td class="phone-cell" dir="ltr">${c.phone || '-'}</td>
          <td>${c.endInfo}</td>
          <td>${tags.join(' ') || '-'}</td>
        </tr>`;
      });
    });

    if (!tableRows) {
      tableRows = '<tr><td colspan="4" style="text-align:center;padding:20px;">אין כוננים זמינים בשעה זו</td></tr>';
    }

    const totalCount = Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>כוננים זמינים - יום ${dayName} ${hourStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; direction: rtl; max-width: 210mm; margin: 0 auto; padding: 10mm; }
    @page { margin: 10mm; size: A4 portrait; }
    h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
    .subtitle { font-size: 13px; text-align: center; color: #333; margin-bottom: 2px; }
    .meta { font-size: 10px; color: #666; text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #eee; border: 1px solid #333; padding: 6px 8px; text-align: right; font-size: 11px; }
    td { border: 1px solid #333; padding: 5px 8px; font-size: 11px; }
    .name-cell { font-weight: bold; }
    .phone-cell { direction: ltr; text-align: left; font-family: monospace; }
    .dept-row td { background: #333; color: white; font-weight: bold; font-size: 12px; padding: 4px 8px; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>
  <h1>📋 כוננים זמינים</h1>
  <div class="subtitle">יום ${dayName} ${dateStr} | שעה ${hourStr}</div>
  <div class="meta">סה"כ ${totalCount} כוננים | הופק ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</div>
  <table>
    <thead><tr><th>שם</th><th>טלפון</th><th>זמינות</th><th>הערות</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const filtered = queryDay !== null && queryHour !== null ? getContactsAtHour(queryDay, queryHour) : {};
  const totalCount = Object.values(filtered).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-center">📋 כוננים זמינים לפי שעה</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3 animate-pulse">⏳</div>
            <p className="text-lg font-medium">טוען נתונים...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Picker */}
            <div className="bg-white rounded-xl shadow-md p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-4">בחר יום ושעה</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">יום</label>
                  <select
                    value={queryDay ?? ''}
                    onChange={(e) => setQueryDay(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:outline-none"
                  >
                    {DAYS.map((day, i) => {
                      const date = weekDates[i];
                      const dateStr = date ? ` (${date.getDate()}/${date.getMonth() + 1})` : '';
                      return (
                        <option key={i} value={i}>{day}{dateStr}</option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">שעה</label>
                  <select
                    value={queryHour ?? ''}
                    onChange={(e) => setQueryHour(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 focus:outline-none"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const now = new Date();
                    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
                    setQueryDay(israelTime.getDay());
                    setQueryHour(israelTime.getHours());
                  }}
                  className="px-4 py-2.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg text-sm font-bold transition-colors"
                >
                  📍 עכשיו
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={handlePrint}
                  disabled={queryDay === null || queryHour === null}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  הדפס
                </button>
                <button
                  onClick={handleCopyLink}
                  disabled={queryDay === null || queryHour === null}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                >
                  {linkCopied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      הועתק!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      העתק לינק
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results */}
            {queryDay !== null && queryHour !== null && (
              <div className="bg-white rounded-xl shadow-md p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">
                    📞 יום {DAYS[queryDay]} {weekDates[queryDay] && `${weekDates[queryDay].getDate()}/${weekDates[queryDay].getMonth() + 1}`} בשעה {String(queryHour).padStart(2, '0')}:00
                  </h2>
                  <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full font-bold">
                    {totalCount} כוננים
                  </span>
                </div>

                {totalCount === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">🚫</div>
                    <p className="text-lg font-medium">אין כוננים זמינים בשעה זו</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(filtered).map(([deptName, deptContacts]) => (
                      <div key={deptName}>
                        <div className="text-sm font-bold text-purple-700 mb-2 border-b-2 border-purple-200 pb-1">
                          {deptName} ({deptContacts.length})
                        </div>
                        <div className="space-y-2">
                          {deptContacts.map(c => (
                            <div key={c.id} className="flex items-center gap-3 text-sm bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
                              <div className="flex items-center gap-2 flex-1">
                                {c.isPermanent && <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded font-bold">🔒 קבוע</span>}
                                {c.isSleep && <span className="bg-orange-200 text-orange-800 text-xs px-2 py-0.5 rounded font-bold">🏢 לן</span>}
                                <span className="font-bold text-gray-900">{c.full_name}</span>
                              </div>
                              <a href={`tel:${c.phone?.replace(/[^0-9+]/g, '')}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs underline" dir="ltr">
                                {c.phone}
                              </a>
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                {c.endInfo}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-gray-400 text-xs">
        מקלטון © {new Date().getFullYear()} עיריית יהוד-מונוסון
      </footer>
    </div>
  );
}
