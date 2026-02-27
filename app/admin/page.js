'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import onCallData from '@/data/onCall.json';
import sheltersData from '@/data/shelters.json';
import alertFlowsData from '@/data/alertFlows.json';
import { getAccessibilityColor } from '@/lib/rtl';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('oncall');
  const [onCallContacts, setOnCallContacts] = useState([]);
  const [shelters, setShelters] = useState(sheltersData);
  const [searchTerm, setSearchTerm] = useState('');
  const [geocodingStatus, setGeocodingStatus] = useState({});

  useEffect(() => {
    const allContacts = [];
    Object.keys(onCallData.departments).forEach(deptKey => {
      const dept = onCallData.departments[deptKey];
      dept.contacts.forEach(contact => {
        allContacts.push({
          ...contact,
          department: dept.name
        });
      });
    });

    const overrides = localStorage.getItem('onCallActiveOverrides');
    if (overrides) {
      try {
        const parsed = JSON.parse(overrides);
        const updated = allContacts.map(c => ({
          ...c,
          active: parsed[c.id] !== undefined ? parsed[c.id] : c.active
        }));
        setOnCallContacts(updated);
      } catch (e) {
        console.error('Failed to parse overrides', e);
        setOnCallContacts(allContacts);
      }
    } else {
      setOnCallContacts(allContacts);
    }

    const shelterOverrides = localStorage.getItem('shelterCoordinateOverrides');
    if (shelterOverrides) {
      try {
        const parsed = JSON.parse(shelterOverrides);
        const merged = sheltersData.map(shelter => ({
          ...shelter,
          ...(parsed[shelter.id] || {})
        }));
        setShelters(merged);
      } catch (e) {
        console.error('Failed to parse shelter overrides', e);
      }
    }
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const toggleContactActive = (contactId) => {
    const updated = onCallContacts.map(c =>
      c.id === contactId ? { ...c, active: !c.active } : c
    );
    setOnCallContacts(updated);

    const overrides = {};
    updated.forEach(c => {
      overrides[c.id] = c.active;
    });
    localStorage.setItem('onCallActiveOverrides', JSON.stringify(overrides));
  };

  const geocodeShelter = async (shelter) => {
    if (shelter.lat !== null && shelter.lng !== null) {
      alert('למקלט זה כבר יש קואורדינטות');
      return;
    }

    setGeocodingStatus({ ...geocodingStatus, [shelter.id]: 'loading' });

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(shelter.address)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const newCoordinates = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        };

        const updatedShelters = shelters.map(s =>
          s.id === shelter.id ? { ...s, ...newCoordinates } : s
        );
        setShelters(updatedShelters);

        const overrides = JSON.parse(localStorage.getItem('shelterCoordinateOverrides') || '{}');
        overrides[shelter.id] = newCoordinates;
        localStorage.setItem('shelterCoordinateOverrides', JSON.stringify(overrides));

        setGeocodingStatus({ ...geocodingStatus, [shelter.id]: 'success' });
      } else {
        setGeocodingStatus({ ...geocodingStatus, [shelter.id]: 'error' });
        alert('לא נמצאו תוצאות לכתובת זו');
      }
    } catch (error) {
      setGeocodingStatus({ ...geocodingStatus, [shelter.id]: 'error' });
      alert('שגיאה בחיפוש קואורדינטות');
    }
  };

  const exportShelterOverrides = () => {
    const overrides = localStorage.getItem('shelterCoordinateOverrides');
    if (!overrides) {
      alert('אין שינויים לייצא');
      return;
    }

    const blob = new Blob([overrides], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shelter-coordinates-patch-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredShelters = shelters.filter(s =>
    s.name.includes(searchTerm) || s.address.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">מקלטון - ניהול מערכת</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/operator')}
              className="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              לעמדת מפעיל
            </button>
            <button
              onClick={handleLogout}
              className="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              יציאה
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('oncall')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
                activeTab === 'oncall'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ניהול תורנויות
            </button>
            <button
              onClick={() => setActiveTab('shelters')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
                activeTab === 'shelters'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              מקלטים
            </button>
            <button
              onClick={() => setActiveTab('flows')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
                activeTab === 'flows'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              נהלי תפעול
            </button>
          </div>
        </div>

        {activeTab === 'oncall' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ניהול אנשי קשר תורנים</h2>
            <p className="text-sm text-gray-600 mb-6">
              {onCallData.weekLabel} - שינויים נשמרים ב-localStorage. לשינויים קבועים ערוך את data/onCall.json
            </p>

            <div className="space-y-3">
              {onCallContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`flex items-center justify-between p-4 border-2 rounded-lg transition-all ${
                    contact.active
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={contact.active}
                      onChange={() => toggleContactActive(contact.id)}
                      className="w-6 h-6"
                    />
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{contact.name}</p>
                      <p className="text-sm text-gray-600">{contact.department} • משמרת: {contact.shift}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-gray-900">{contact.phone}</p>
                    <p className="text-xs text-gray-500">
                      {contact.active ? 'פעיל השבוע' : 'לא פעיל'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'shelters' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">ניהול מקלטים</h2>
              <button
                onClick={exportShelterOverrides}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                📥 ייצוא שינויים
              </button>
            </div>

            <div className="mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש מקלט..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-4">
              {filteredShelters.map((shelter) => (
                <div key={shelter.id} className="border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{shelter.name}</h3>
                      {shelter.number && (
                        <p className="text-sm text-gray-500">מספר: {shelter.number}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getAccessibilityColor(shelter.accessibility)}`}>
                      {shelter.accessibility}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-2">📍 {shelter.address}</p>

                  {shelter.notes && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mb-3">
                      💡 {shelter.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-4">
                    {shelter.lat !== null && shelter.lng !== null ? (
                      <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                        ✓ קואורדינטות: {shelter.lat.toFixed(4)}, {shelter.lng.toFixed(4)}
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
                          ✗ חסרות קואורדינטות
                        </div>
                        <button
                          onClick={() => geocodeShelter(shelter)}
                          disabled={geocodingStatus[shelter.id] === 'loading'}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          {geocodingStatus[shelter.id] === 'loading' ? 'מחפש...' : '🔍 מצא קואורדינטות'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border-r-4 border-yellow-500 rounded">
              <p className="text-sm text-yellow-800">
                <strong>הערה:</strong> שינויי קואורדינטות נשמרים ב-localStorage בלבד.
                לשינויים קבועים, ייצא את השינויים והעתק אותם לקובץ data/shelters.json
              </p>
            </div>
          </div>
        )}

        {activeTab === 'flows' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">נהלי תפעול</h2>

            <div className="space-y-6">
              {alertFlowsData.map((flow) => (
                <div key={flow.id} className="border-2 border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{flow.title}</h3>
                  {flow.description && (
                    <p className="text-gray-600 mb-4">{flow.description}</p>
                  )}

                  {flow.steps.length > 0 ? (
                    <div className="space-y-3">
                      <p className="font-semibold text-gray-900">
                        {flow.steps.length} שלבים בנוהל:
                      </p>
                      {flow.steps.map((step, index) => (
                        <div key={step.id} className="bg-gray-50 p-3 rounded">
                          <div className="flex items-start gap-3">
                            <span className="font-bold text-purple-600">
                              {index + 1}.
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{step.label}</p>
                              <p className="text-sm text-gray-600">
                                סוג: {step.type === 'decision' ? 'החלטה' : 'פעולה'}
                              </p>
                              {step.criticalNote && (
                                <p className="text-sm text-red-700 mt-1">
                                  ⚠️ {step.criticalNote}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">נוהל זה עדיין לא הוגדר</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border-r-4 border-blue-500 rounded">
              <p className="text-sm text-blue-800">
                <strong>הערה:</strong> לעריכת נהלי תפעול, ערוך את הקובץ data/alertFlows.json בריפו
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
