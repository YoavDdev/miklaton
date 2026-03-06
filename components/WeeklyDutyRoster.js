'use client';

import { useState, useEffect } from 'react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function WeeklyDutyRoster() {
  const [dutyRoster, setDutyRoster] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDay, setCurrentDay] = useState(0);
  const [currentHour, setCurrentHour] = useState(0);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rosterRes, contactsRes] = await Promise.all([
        fetch('/api/duty-roster'),
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
    window.print();
  };

  const getDutiesForDayAndHour = (contactId, dayOfWeek, hour) => {
    return dutyRoster.filter(d => {
      if (d.contact_id !== contactId || d.day_of_week !== dayOfWeek) {
        return false;
      }
      
      const { start_hour, end_hour } = d;
      
      // 24-hour shift (e.g., 8-8)
      if (start_hour === end_hour) {
        return true;
      }
      
      // Overnight shift ending at midnight (e.g., 16-0)
      if (end_hour === 0) {
        return hour >= start_hour || hour === 0;
      }
      
      // Normal shift
      return hour >= start_hour && hour <= end_hour;
    });
  };

  const getDutiesForDay = (contactId, dayOfWeek) => {
    return dutyRoster.filter(
      d => d.contact_id === contactId && d.day_of_week === dayOfWeek
    );
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
    <div className="roster-print-area bg-white rounded-lg shadow">
      <div className="p-6 print:p-4">
        <div className="flex items-center justify-between mb-6 print:mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 print:text-xl">כוננויות השבוע</h2>
            <p className="text-sm text-gray-600 mt-1">
              {new Date().toLocaleDateString('he-IL', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
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

        {/* Current On-Call Highlight */}
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-400 rounded-lg print:hidden">
          <h3 className="font-bold text-green-900 mb-2 flex items-center gap-2">
            <span className="text-xl">🟢</span>
            כוננים פעילים כעת - {DAYS[currentDay]} {currentHour}:00
          </h3>
          <div className="space-y-1">
            {contacts.map(contact => {
              const duties = getDutiesForDayAndHour(contact.id, currentDay, currentHour);
              if (duties.length === 0) return null;
              return (
                <div key={contact.id} className="text-sm">
                  <span className="font-semibold">{contact.full_name}</span>
                  <span className="text-gray-600"> - {contact.phone}</span>
                  <span className="text-gray-500"> ({contact.departments?.name})</span>
                </div>
              );
            })}
          </div>
        </div>

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
                          i === currentDay ? 'bg-green-100 print:bg-gray-200' : ''
                        }`}
                      >
                        {day}
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
                        const isToday = dayIndex === currentDay;
                        return (
                          <td 
                            key={dayIndex} 
                            className={`border border-gray-300 p-1 ${
                              isToday ? 'bg-green-50 print:bg-gray-100' : ''
                            }`}
                          >
                            {duties.map(duty => {
                              const isActive = getDutiesForDayAndHour(contact.id, dayIndex, currentHour).length > 0;
                              
                              // Determine display text and color
                              let displayText = '';
                              let baseColor = 'bg-blue-100 text-blue-800';
                              
                              if (duty.start_hour === duty.end_hour) {
                                // 24-hour shift
                                displayText = '24 שעות';
                                baseColor = 'bg-green-200 text-green-900';
                              } else if (duty.end_hour === 0) {
                                // Overnight shift ending at midnight
                                displayText = `${String(duty.start_hour).padStart(2, '0')}:00-חצות`;
                                baseColor = 'bg-purple-200 text-purple-900';
                              } else {
                                // Normal shift
                                displayText = `${String(duty.start_hour).padStart(2, '0')}:00-${String(duty.end_hour).padStart(2, '0')}:00`;
                              }
                              
                              return (
                                <div 
                                  key={duty.id} 
                                  className={`text-xs px-1 py-0.5 rounded mb-1 font-medium ${
                                    isActive && isToday
                                      ? 'bg-green-500 text-white font-bold print:bg-gray-800 print:text-white'
                                      : `${baseColor} print:bg-gray-300 print:text-black`
                                  }`}
                                >
                                  {displayText}
                                  {duty.notes && (
                                    <div className="text-xs opacity-75">{duty.notes}</div>
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

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4 landscape;
          }
          
          /* Hide everything on screen */
          body > * {
            display: none !important;
          }
          
          /* Show only roster content */
          .roster-print-area {
            display: block !important;
          }
          
          table {
            page-break-inside: auto;
            font-size: 10px;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
