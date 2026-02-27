'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FlowRunner from '@/components/FlowRunner';
import ShelterSearch from '@/components/ShelterSearch';
import OnCallPanel from '@/components/OnCallPanel';
import alertFlowsData from '@/data/alertFlows.json';

export default function OperatorPage() {
  const router = useRouter();
  const [selectedFlowId, setSelectedFlowId] = useState('missiles');
  const [activeEvent, setActiveEvent] = useState(null);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const startEvent = () => {
    const flow = alertFlowsData.find((f) => f.id === selectedFlowId);
    if (flow) {
      setActiveEvent(flow);
    }
  };

  const endEvent = (summary) => {
    setActiveEvent(null);
  };

  const ekronUrl = process.env.NEXT_PUBLIC_EKRON_URL || '#';
  const incidentFormUrl = process.env.NEXT_PUBLIC_INCIDENT_FORM_URL || '#';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">מקלטון - עמדת מפעיל</h1>
          <button
            onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            יציאה
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                🚨 פעילות בזמן אזעקה
              </h2>

              {!activeEvent ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">
                      סוג אירוע
                    </label>
                    <select
                      value={selectedFlowId}
                      onChange={(e) => setSelectedFlowId(e.target.value)}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    >
                      {alertFlowsData.map((flow) => (
                        <option key={flow.id} value={flow.id} disabled={flow.steps.length === 0}>
                          {flow.title} {flow.steps.length === 0 ? '(לא זמין)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={startEvent}
                    disabled={!selectedFlowId || alertFlowsData.find(f => f.id === selectedFlowId)?.steps.length === 0}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors"
                  >
                    🚨 התחל אירוע
                  </button>

                  <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-200">
                    <a
                      href={ekronUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                      🔗 פתח Ekron
                    </a>
                    <a
                      href={incidentFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                      📋 טופס דיווח אירוע
                    </a>
                  </div>
                </div>
              ) : (
                <FlowRunner flow={activeEvent} onEnd={endEvent} />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                📍 חיפוש מקלט לתושב
              </h2>
              <ShelterSearch />
            </div>
          </div>
        </div>

        {activeEvent && <OnCallPanel />}
      </main>
    </div>
  );
}
