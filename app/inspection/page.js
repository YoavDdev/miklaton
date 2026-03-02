'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ZONES = [
  { id: 'A', name: 'מזרח וצפון', color: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
  { id: 'B', name: 'מרכז',       color: 'bg-green-500 hover:bg-green-600', border: 'border-green-500', text: 'text-green-700', light: 'bg-green-50' },
  { id: 'C', name: 'מערב',       color: 'bg-orange-500 hover:bg-orange-600', border: 'border-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
];

export default function InspectionLandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedZone, setSelectedZone] = useState(null);
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!name.trim()) {
      setError('יש להזין שם פקח');
      return;
    }
    if (!selectedZone) {
      setError('יש לבחור אזור');
      return;
    }
    const params = new URLSearchParams({ name: name.trim() });
    router.push(`/inspection/${selectedZone}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔍</div>
            <h1 className="text-2xl font-bold text-gray-900">סיור פקח</h1>
            <p className="text-gray-500 text-sm mt-1">בדיקת מקלטים ורחובות</p>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">שם הפקח</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="הזן שם מלא..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
              autoComplete="off"
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">בחר אזור</label>
            <div className="flex flex-col gap-3">
              {ZONES.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => { setSelectedZone(zone.id); setError(''); }}
                  className={`w-full py-4 rounded-xl border-2 font-bold text-lg transition-all ${
                    selectedZone === zone.id
                      ? `${zone.light} ${zone.border} ${zone.text} shadow-inner`
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <span className="text-2xl ml-3">{zone.id === 'A' ? '🔵' : zone.id === 'B' ? '🟢' : '🟠'}</span>
                  אזור {zone.id} — {zone.name}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xl rounded-xl transition-colors shadow-md"
          >
            התחל סיור ←
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          מקלטון • מערכת פיקוח עירונית
        </p>
      </div>
    </div>
  );
}
