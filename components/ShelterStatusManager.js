'use client';
import { useState, useEffect } from 'react';

export default function ShelterStatusManager({ shelters }) {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  // Filter public shelters only
  const publicShelters = shelters.filter(s => s.shelterType === 'public');
  
  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    try {
      const response = await fetch('/api/shelter-status');
      const data = await response.json();
      setStatuses(data.statuses || {});
    } catch (error) {
      console.error('Error loading statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (shelterNumber) => {
    setSaving(shelterNumber);
    const newStatus = !statuses[shelterNumber];
    
    try {
      const response = await fetch('/api/shelter-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shelterNumber,
          isOpen: newStatus,
          updatedBy: 'מוקדן'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setStatuses(result.data.statuses);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setSaving(null);
    }
  };

  const openAllShelters = async () => {
    setSaving('all');
    try {
      const updates = publicShelters.map(shelter => ({
        shelterNumber: shelter.number,
        isOpen: true
      }));
      
      for (const update of updates) {
        await fetch('/api/shelter-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...update, updatedBy: 'מוקדן' })
        });
      }
      
      await loadStatuses();
    } catch (error) {
      console.error('Error opening all shelters:', error);
    } finally {
      setSaving(null);
    }
  };

  const closeAllShelters = async () => {
    setSaving('all');
    try {
      const updates = publicShelters.map(shelter => ({
        shelterNumber: shelter.number,
        isOpen: false
      }));
      
      for (const update of updates) {
        await fetch('/api/shelter-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...update, updatedBy: 'מוקדן' })
        });
      }
      
      await loadStatuses();
    } catch (error) {
      console.error('Error closing all shelters:', error);
    } finally {
      setSaving(null);
    }
  };

  // Count open shelters
  const openCount = Object.values(statuses).filter(Boolean).length;
  const allOpen = openCount === publicShelters.length && publicShelters.length > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-blue-100 text-sm">
                {openCount} מתוך {publicShelters.length} מקלטים פתוחים
              </p>
            </div>
          </div>
          {allOpen && (
            <div className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm animate-pulse">
              ✓ כל המקלטים פתוחים
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-3 mb-6">
          <button
            onClick={openAllShelters}
            disabled={saving !== null}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            פתח את כל המקלטים
          </button>
          <button
            onClick={closeAllShelters}
            disabled={saving !== null}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            סגור את כל המקלטים
          </button>
        </div>

        <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 mb-6 rounded">
          <p className="text-yellow-800 text-sm font-semibold">
            ⚠️ מקלטים ציבוריים נפתחים רק לאחר אישור מנכ"ל ופיקוד העורף
          </p>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {publicShelters.map((shelter) => {
            const isOpen = statuses[shelter.number];
            const isSaving = saving === shelter.number;
            
            return (
              <div
                key={shelter.id}
                className={`border-2 rounded-lg p-4 transition-all ${
                  isOpen
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {shelter.type === 'מוסד חינוך' ? '🏫' : 
                         shelter.type === 'מקלט פרטי' ? '🏢' : '🏛️'}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-900">{shelter.name}</h3>
                        <p className="text-sm text-gray-600">{shelter.address}</p>
                        {shelter.notes && (
                          <p className="text-xs text-blue-600 mt-1">{shelter.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleStatus(shelter.number)}
                    disabled={isSaving}
                    className={`px-6 py-3 rounded-lg font-bold transition-all min-w-[120px] ${
                      isOpen
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                    } disabled:opacity-50`}
                  >
                    {isSaving ? '...' : isOpen ? '✓ פתוח' : '✕ סגור'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
