'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import sheltersData from '@/data/shelters.json';
import alertFlowsData from '@/data/alertFlows.json';
import GeneralNotifications from '@/components/GeneralNotifications';
import OnCallManager from '@/components/OnCallManager';

const ZONE_LABELS = { A: 'מזרח וצפון', B: 'מרכז', C: 'מערב' };
const ZONE_COLORS = {
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-green-100 text-green-800',
  C: 'bg-orange-100 text-orange-800',
};

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('oncall');
  const [shelters, setShelters] = useState(sheltersData);
  const [searchTerm, setSearchTerm] = useState('');
  const [geocodingStatus, setGeocodingStatus] = useState({});
  const [inspectionReports, setInspectionReports] = useState([]);
  const [reportsFilter, setReportsFilter] = useState('all');
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/inspection');
      if (res.ok) setInspectionReports(await res.json());
    } catch { /* silent */ }
    setLoadingReports(false);
  };

  const markResolved = async (id) => {
    await fetch('/api/inspection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' }),
    });
    fetchReports();
  };

  useEffect(() => {
    if (activeTab === 'inspection') fetchReports();
  }, [activeTab]);

  useEffect(() => {
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
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              הודעות
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
            <button
              onClick={() => setActiveTab('inspection')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-colors relative ${
                activeTab === 'inspection'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              דיווחי פקחים
              {inspectionReports.filter(r => r.status === 'open').length > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {inspectionReports.filter(r => r.status === 'open').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'oncall' && (
          <OnCallManager />
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
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-900">{shelter.name}</h3>
                    {shelter.number && (
                      <p className="text-sm text-gray-500">מספר: {shelter.number}</p>
                    )}
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

        {activeTab === 'inspection' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">דיווחי פקחים</h2>
              <button
                onClick={fetchReports}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                🔄 רענן
              </button>
            </div>

            <div className="flex gap-2 mb-5 flex-wrap">
              {['all', 'open', 'resolved'].map((f) => (
                <button
                  key={f}
                  onClick={() => setReportsFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                    reportsFilter === f
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'הכל' : f === 'open' ? '⚠️ פתוחים' : '✅ טופלו'}
                  {f === 'all' && ` (${inspectionReports.length})`}
                  {f === 'open' && ` (${inspectionReports.filter(r => r.status === 'open').length})`}
                  {f === 'resolved' && ` (${inspectionReports.filter(r => r.status === 'resolved').length})`}
                </button>
              ))}
            </div>

            {loadingReports ? (
              <div className="text-center py-12 text-gray-500">טוען דיווחים...</div>
            ) : (
              <div className="space-y-4">
                {inspectionReports
                  .filter(r => reportsFilter === 'all' || r.status === reportsFilter)
                  .length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-semibold">אין דיווחים</p>
                  </div>
                ) : (
                  inspectionReports
                    .filter(r => reportsFilter === 'all' || r.status === reportsFilter)
                    .map((report) => (
                      <div
                        key={report.id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          report.status === 'resolved'
                            ? 'border-gray-200 bg-gray-50 opacity-70'
                            : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${ZONE_COLORS[report.zone] || 'bg-gray-100 text-gray-700'}`}>
                              אזור {report.zone} — {ZONE_LABELS[report.zone] || report.zone}
                            </span>
                            <span className="text-xs bg-gray-200 text-gray-700 font-semibold px-2 py-1 rounded-full">
                              {report.locationType}
                            </span>
                            {report.status === 'resolved' && (
                              <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
                                ✅ טופל
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">
                            {new Date(report.timestamp).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>

                        <p className="font-bold text-gray-900 mb-1">{report.locationName}</p>
                        {report.locationAddress && (
                          <p className="text-xs text-gray-500 mb-2">📍 {report.locationAddress}</p>
                        )}
                        <p className="text-gray-800 text-sm bg-white border border-gray-200 rounded-lg p-3 mb-3">
                          {report.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            פקח: <strong>{report.inspectorName}</strong>
                          </span>
                          {report.status === 'open' && (
                            <button
                              onClick={() => markResolved(report.id)}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                              ✅ סמן כטופל
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <GeneralNotifications />
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
