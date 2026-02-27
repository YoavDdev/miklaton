'use client';

import { useState, useEffect } from 'react';
import onCallData from '@/data/onCall.json';

export default function OnCallPanel() {
  const [departmentContacts, setDepartmentContacts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const overrides = localStorage.getItem('onCallActiveOverrides');
    const depts = [];

    Object.keys(onCallData.departments).forEach(deptKey => {
      const dept = onCallData.departments[deptKey];
      let activeContacts = dept.contacts.filter(c => c.active);

      if (overrides) {
        try {
          const parsed = JSON.parse(overrides);
          activeContacts = dept.contacts.filter(c => {
            const override = parsed[c.id];
            return override !== undefined ? override : c.active;
          });
        } catch (e) {
          console.error('Failed to parse on-call overrides', e);
        }
      }

      if (activeContacts.length > 0) {
        depts.push({
          name: dept.name,
          contacts: activeContacts
        });
      }
    });

    setDepartmentContacts(depts);
  }, []);

  const copyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
  };

  if (departmentContacts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">אנשי קשר תורנים</h3>
        <p className="text-gray-500">אין אנשי קשר פעילים השבוע</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4 hover:from-purple-600 hover:to-pink-600 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            <div className="text-right">
              <h3 className="text-xl font-bold text-white">אנשי קשר תורנים</h3>
              <p className="text-sm text-purple-100">📅 {onCallData.weekLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-semibold">
              {isOpen ? 'סגור' : 'הצג'} ({departmentContacts.reduce((acc, dept) => acc + dept.contacts.length, 0)})
            </span>
            <svg 
              className={`w-6 h-6 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">מחלקה</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">שם</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">משמרת</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">טלפון</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {departmentContacts.map((dept, deptIdx) => (
              dept.contacts.map((contact, contactIdx) => (
                <tr 
                  key={contact.id} 
                  className="border-b border-gray-200 hover:bg-purple-50 transition-colors"
                >
                  {contactIdx === 0 && (
                    <td 
                      className="px-4 py-3 font-semibold text-gray-900 bg-purple-50 border-l-4 border-purple-500"
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
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                      ⏰ {contact.shift}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700" dir="ltr">{contact.phone}</td>
                  <td className="px-4 py-3 text-center">
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
      )}
    </div>
  );
}
