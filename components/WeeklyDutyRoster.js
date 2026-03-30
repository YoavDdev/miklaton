'use client';

import { useState, useEffect } from 'react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Get week start date (Sunday) for a given date
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Format date for DB (YYYY-MM-DD) in local timezone
function formatDateForDB(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function WeeklyDutyRoster() {
  const [dutyRoster, setDutyRoster] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(0);
  const [currentHour, setCurrentHour] = useState(0);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  // Check if viewing the current week
  const isCurrentWeek = formatDateForDB(currentWeekStart) === formatDateForDB(getWeekStart(new Date()));

  // Get week dates for display
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  const weekDates = getWeekDates();

  const getWeekRangeString = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.getDate()}.${start.getMonth() + 1} - ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  };

  useEffect(() => {
    fetchData();
    
    // Update current time every minute
    const interval = setInterval(() => {
      const now = new Date();
      const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      setCurrentDay(israelTime.getDay());
      setCurrentHour(israelTime.getHours());
    }, 60000);

    // Set initial time
    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    setCurrentDay(israelTime.getDay());
    setCurrentHour(israelTime.getHours());

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

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
      console.error('Failed to fetch duty roster:', error);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
    const contactsByDeptForPrint = {};
    contacts.forEach(contact => {
      const deptName = contact.departments?.name || 'ללא מכלול';
      if (!contactsByDeptForPrint[deptName]) contactsByDeptForPrint[deptName] = [];
      contactsByDeptForPrint[deptName].push(contact);
    });

    let tablesHtml = '';
    Object.entries(contactsByDeptForPrint).forEach(([deptName, deptContacts]) => {
      let rows = deptContacts.map(contact => {
        let dayCells = DAY_NAMES.map((_, dayIndex) => {
          const duties = dutyRoster.filter(d => d.contact_id === contact.id && d.day_of_week === dayIndex);
          let cellContent = duties.map(duty => {
            if (duty.start_hour === duty.end_hour) return '24 שעות';
            const sh = String(duty.start_hour).padStart(2,'0');
            const eh = duty.end_hour === 0 ? '00' : String(duty.end_hour).padStart(2,'0');
            return `${sh}:00-${eh}:00`;
          }).join('<br>');
          return `<td>${cellContent || '-'}</td>`;
        }).join('');
        return `<tr>
          <td class="name-cell">${contact.full_name}<br><span class="phone">${contact.phone || ''}</span></td>
          ${dayCells}
        </tr>`;
      }).join('');

      let dayHeaders = DAY_NAMES.map(d => `<th>${d}</th>`).join('');
      
      tablesHtml += `
        <div class="dept">
          <div class="dept-title">${deptName}</div>
          <table>
            <thead><tr><th class="name-col">שם / טלפון</th>${dayHeaders}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>כוננויות השבוע</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: Arial, sans-serif; 
      direction: rtl; 
      width: 257mm;
      margin: 0 auto;
      padding: 5mm;
    }
    @page { 
      margin: 8mm; 
      size: 297mm 210mm;
    }
    
    h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
    .date { font-size: 9px; color: #666; text-align: center; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #000; }
    
    .dept { margin-bottom: 8px; }
    .dept-title { font-size: 10px; font-weight: bold; background: #333; color: white; padding: 2px 6px; }
    
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .name-col { width: 15%; }
    th { background: #eee; border: 1px solid #333; padding: 2px 1px; text-align: center; font-size: 7px; }
    td { border: 1px solid #333; padding: 2px 1px; text-align: center; font-size: 7px; }
    .name-cell { text-align: right; font-weight: bold; font-size: 7px; padding-right: 3px; }
    .phone { font-weight: normal; color: #555; font-size: 6px; direction: ltr; display: inline-block; }
    
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .dept { page-break-inside: avoid; }
  </style>
</head>
<body>
  <h1>כוננויות השבוע</h1>
  <div class="date">${new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  ${tablesHtml}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const getDutiesForDayAndHour = (contactId, dayOfWeek, hour) => {
    return dutyRoster.filter(d => {
      if (d.contact_id !== contactId) return false;
      
      const { start_hour, end_hour } = d;
      
      // Same-day duty
      if (d.day_of_week === dayOfWeek) {
        // 24-hour shift (e.g., 8-8)
        if (start_hour === end_hour) return true;
        
        // Overnight shift (e.g., 23-08): on the start day, active from start to midnight
        if (end_hour < start_hour && end_hour !== 0) {
          return hour >= start_hour;
        }
        
        // Overnight ending at midnight (e.g., 16-0)
        if (end_hour === 0) {
          return hour >= start_hour;
        }
        
        // Normal shift
        return hour >= start_hour && hour < end_hour;
      }
      
      // Previous day's overnight duty spilling into this day
      const prevDay = (dayOfWeek + 6) % 7;
      if (d.day_of_week === prevDay && end_hour < start_hour && end_hour !== 0) {
        return hour < end_hour;
      }
      
      return false;
    });
  };

  const getDutiesForDay = (contactId, dayOfWeek) => {
    // Same-day duties
    const sameDayDuties = dutyRoster.filter(
      d => d.contact_id === contactId && d.day_of_week === dayOfWeek
    );
    // Previous day's overnight duties that spill into this day
    const prevDay = (dayOfWeek + 6) % 7;
    const overnightFromPrev = dutyRoster.filter(d => {
      if (d.contact_id !== contactId || d.day_of_week !== prevDay) return false;
      return d.end_hour < d.start_hour && d.end_hour !== 0;
    });
    return [...sameDayDuties, ...overnightFromPrev];
  };

  const isCurrentSlot = (dayOfWeek, hour) => {
    return dayOfWeek === currentDay && hour === currentHour;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-center text-gray-500">טוען כוננויות...</p>
      </div>
    );
  }

  // Group contacts by department
  const contactsByDept = {};
  contacts.forEach(contact => {
    const deptName = contact.departments?.name || 'ללא מכלול';
    if (!contactsByDept[deptName]) {
      contactsByDept[deptName] = [];
    }
    contactsByDept[deptName].push(contact);
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 print:p-4">
        <div className="flex items-center justify-between mb-4 print:mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 print:text-xl">כוננויות שבועיות</h2>
          </div>
          <button
            onClick={handlePrint}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors print:hidden flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            הדפס
          </button>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 print:hidden">
          <button
            onClick={goToPreviousWeek}
            className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-bold transition-all text-sm"
          >
            → שבוע קודם
          </button>
          
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{getWeekRangeString()}</div>
            {isCurrentWeek && (
              <span className="text-xs text-green-600 font-medium">📍 השבוע הנוכחי</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button
                onClick={goToCurrentWeek}
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-bold transition-all text-sm"
              >
                📍 היום
              </button>
            )}
            <button
              onClick={goToNextWeek}
              className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-bold transition-all text-sm"
            >
              שבוע הבא ←
            </button>
          </div>
        </div>

        {/* Current On-Call Highlight - only show on current week */}
        {isCurrentWeek && <div className="mb-6 p-4 bg-green-50 border-2 border-green-400 rounded-lg print:hidden">
          <h3 className="font-bold text-green-900 mb-2 flex items-center gap-2">
            <span className="text-xl">🟢</span>
            כוננים פעילים כעת - {DAYS[currentDay]} {currentHour}:00
          </h3>
          <div className="space-y-1">
            {contacts.map(contact => {
              const duties = getDutiesForDayAndHour(contact.id, currentDay, currentHour);
              if (duties.length === 0) return null;
              const isSleep = duties.some(d => d.notes?.includes('[לן]'));
              return (
                <div key={contact.id} className={`text-sm flex items-center gap-1 ${isSleep ? 'text-orange-800' : ''}`}>
                  {isSleep && <span className="bg-orange-200 text-orange-800 text-xs px-1.5 py-0.5 rounded font-bold">🏢 לן</span>}
                  <span className="font-semibold">{contact.full_name}</span>
                  <span className="text-gray-600"> - {contact.phone}</span>
                  <span className="text-gray-500"> ({contact.departments?.name})</span>
                </div>
              );
            })}
          </div>
        </div>}

        {/* Weekly Table by Department */}
        {Object.entries(contactsByDept).map(([deptName, deptContacts]) => (
          <div key={deptName} className="mb-8 print:mb-6 print:break-inside-avoid">
            <h3 className="text-lg font-bold text-purple-700 mb-3 print:text-base">{deptName}</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm print:text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-right font-semibold">איש קשר</th>
                    {DAYS.map((day, i) => (
                      <th 
                        key={i} 
                        className={`border border-gray-300 p-2 font-semibold ${
                          isCurrentWeek && i === currentDay ? 'bg-green-100 print:bg-gray-200' : ''
                        }`}
                      >
                        <div>{day}</div>
                        <div className="text-xs font-normal text-gray-500">
                          {weekDates[i] && `${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deptContacts.map(contact => (
                    <tr key={contact.id}>
                      <td className="border border-gray-300 p-2">
                        <div className="font-semibold">{contact.full_name}</div>
                        <div className="text-xs text-gray-600">{contact.phone}</div>
                        {contact.role && (
                          <div className="text-xs text-gray-500">{contact.role}</div>
                        )}
                      </td>
                      {DAYS.map((_, dayIndex) => {
                        const duties = getDutiesForDay(contact.id, dayIndex);
                        const isToday = isCurrentWeek && dayIndex === currentDay;
                        return (
                          <td 
                            key={dayIndex} 
                            className={`border border-gray-300 p-1 ${
                              isToday ? 'bg-green-50 print:bg-gray-100' : ''
                            }`}
                          >
                            {duties.map(duty => {
                              const isActive = getDutiesForDayAndHour(contact.id, dayIndex, currentHour).length > 0;
                              const isSleep = duty.notes?.includes('[לן]');
                              
                              // Determine display text and color
                              let displayText = '';
                              let baseColor = isSleep
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : 'bg-blue-100 text-blue-800';
                              
                              const isOvernightFromPrev = duty.day_of_week !== dayIndex;
                              const isPermanent = duty.notes?.includes('[קבוע]');

                              if (isPermanent) {
                                displayText = '🔒 קבוע 24/7';
                                baseColor = 'bg-amber-200 text-amber-900 border border-amber-400';
                              } else if (isOvernightFromPrev) {
                                // This is a spill-over from previous day
                                displayText = `🌙 00:00-${String(duty.end_hour).padStart(2, '0')}:00`;
                                baseColor = isSleep ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-indigo-100 text-indigo-800';
                              } else if (duty.start_hour === duty.end_hour) {
                                // 24-hour shift
                                displayText = '24 שעות';
                                if (!isSleep) baseColor = 'bg-green-200 text-green-900';
                              } else if (duty.end_hour < duty.start_hour && duty.end_hour !== 0) {
                                // Overnight shift crossing midnight
                                displayText = `🌙 ${String(duty.start_hour).padStart(2, '0')}:00-${String(duty.end_hour).padStart(2, '0')}:00+`;
                                if (!isSleep) baseColor = 'bg-indigo-200 text-indigo-900';
                              } else if (duty.end_hour === 0) {
                                // Shift ending at midnight
                                displayText = `${String(duty.start_hour).padStart(2, '0')}:00-חצות`;
                                if (!isSleep) baseColor = 'bg-purple-200 text-purple-900';
                              } else {
                                // Normal shift
                                displayText = `${String(duty.start_hour).padStart(2, '0')}:00-${String(duty.end_hour).padStart(2, '0')}:00`;
                              }

                              // Clean notes for display (remove type tags)
                              const cleanNotes = duty.notes
                                ?.replace(/\[לן\]/g, '')
                                .replace(/\[כונן\]/g, '')
                                .replace(/\[קבוע\]/g, '')
                                .replace(/^\s*\|\s*/, '')
                                .trim();
                              
                              return (
                                <div 
                                  key={duty.id} 
                                  className={`text-xs px-1 py-0.5 rounded mb-1 font-medium ${
                                    isActive && isToday
                                      ? isSleep
                                        ? 'bg-orange-500 text-white font-bold print:bg-gray-800 print:text-white'
                                        : 'bg-green-500 text-white font-bold print:bg-gray-800 print:text-white'
                                      : `${baseColor} print:bg-gray-300 print:text-black`
                                  }`}
                                >
                                  {isSleep && <span>🏢 </span>}
                                  {displayText}
                                  {isSleep && <span className="text-xs font-bold"> לן</span>}
                                  {cleanNotes && (
                                    <div className="text-xs opacity-75">{cleanNotes}</div>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-semibold">אין כוננויות מוגדרות</p>
            <p className="text-sm mt-2">פנה למנהל להגדרת כוננויות</p>
          </div>
        )}
      </div>

    </div>
  );
}
