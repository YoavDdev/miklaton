'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnCallPage() {
  const router = useRouter();
  const [departmentContacts, setDepartmentContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      
      if (data.success) {
        const depts = data.data
          .filter(dept => dept.contacts && dept.contacts.length > 0)
          .map(dept => ({
            name: dept.name,
            contacts: dept.contacts.map(contact => ({
              id: contact.id,
              name: contact.full_name,
              phone: contact.phone,
              shift: contact.role || 'תורן',
              active: contact.active
            }))
          }));
        
        setDepartmentContacts(depts);
        setLastUpdated(new Date().toLocaleDateString('he-IL'));
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
    setLoading(false);
  };

  const copyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 10px;
            font-size: 10px;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header - Hidden in print */}
      <header className="bg-gradient-to-l from-slate-800 to-slate-900 text-white shadow-xl no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">� ספר טלפונים</h1>
          <button
            onClick={handlePrint}
            className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
          >
            🖨️ הדפס
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Print Header - Only visible in print */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">📞 אנשי קשר - רשימת כל המחלקות</h1>
          <p className="text-sm text-gray-600">עודכן: {lastUpdated}</p>
          <p className="text-xs text-gray-500">תאריך הדפסה: {new Date().toLocaleDateString('he-IL')}</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">טוען אנשי קשר...</p>
          </div>
        ) : departmentContacts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">אין אנשי קשר מוגדרים</p>
            <p className="text-gray-400 text-sm mt-2">פנה למנהל להוספת אנשי קשר</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Info Banner */}
          <div className="bg-gradient-to-l from-slate-700 to-slate-800 px-6 py-4 no-print">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                <div className="text-right">
                  <h3 className="text-xl font-bold text-white">רשימת אנשי קשר לפי מחלקה</h3>
                  <p className="text-sm text-slate-300">📅 {lastUpdated}</p>
                </div>
              </div>
              <span className="text-white text-lg font-semibold">
                סה״כ: {departmentContacts.reduce((acc, dept) => acc + dept.contacts.length, 0)} אנשי קשר
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">מחלקה</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">שם</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">משמרת</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">טלפון</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 no-print">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {departmentContacts.map((dept, deptIdx) => (
                  dept.contacts.map((contact, contactIdx) => (
                    <tr 
                      key={contact.id} 
                      className="border-b border-gray-200 hover:bg-slate-50 transition-colors"
                    >
                      {contactIdx === 0 && (
                        <td 
                          className="px-4 py-3 font-semibold text-gray-900 bg-slate-50 border-l-4 border-slate-500"
                          rowSpan={dept.contacts.length}
                        >
                          <div className="flex items-center gap-2">
                            <span>🏢</span>
                            <span>{dept.name}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-900">{contact.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">
                          ⏰ {contact.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700" dir="ltr">{contact.phone}</td>
                      <td className="px-4 py-3 text-center no-print">
                        <button
                          onClick={() => copyPhone(contact.phone)}
                          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
                          title="לחץ להעתקת מספר"
                        >
                          📞 העתק
                        </button>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Footer - Only visible in print */}
        <div className="hidden print:block mt-4 text-center text-xs text-gray-500">
          <p>מערכת מקלטון - עיריית יהוד מונוסון</p>
          <p>www.miklaton.yehud-monosson.muni.il</p>
        </div>
      </main>
    </div>
  );
}
