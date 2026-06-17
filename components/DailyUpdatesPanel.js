'use client';

import { useState, useEffect } from 'react';

/**
 * DailyUpdatesPanel - תצוגת עדכונים יומיומיים
 * 
 * מציג עדכונים פעילים כרגע (חסימות כבישים, אירועים, תחזוקה)
 * כולל אפשרות להוספת עדכון חדש (למוקדן/מנהל מוקד)
 */
export default function DailyUpdatesPanel({ canEdit = false, municipalityId = null }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchUpdates();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [showHistory, municipalityId]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (municipalityId) params.append('municipality_id', municipalityId);
      if (showHistory) params.append('history', 'true');
      
      const response = await fetch(`/api/daily-updates?${params}`);
      const data = await response.json();

      if (data.success) {
        setUpdates(data.updates || []);
      } else {
        setError(data.error || 'שגיאה בטעינת עדכונים');
      }
    } catch (err) {
      console.error('Error fetching updates:', err);
      setError('שגיאה בטעינת עדכונים');
    } finally {
      setLoading(false);
    }
  };

  const getTypeInfo = (type) => {
    const types = {
      road_closure: { icon: '🚧', label: 'חסימת כביש', color: 'red' },
      event: { icon: '🎉', label: 'אירוע', color: 'blue' },
      maintenance: { icon: '🔧', label: 'תחזוקה', color: 'yellow' },
      alert: { icon: '⚠️', label: 'התראה', color: 'orange' },
      other: { icon: '📢', label: 'אחר', color: 'gray' }
    };
    return types[type] || types.other;
  };

  const formatTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff < 0) return 'הסתיים';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `עוד ${days} ימים`;
    }
    if (hours > 0) {
      return `עוד ${hours} שעות`;
    }
    return `עוד ${minutes} דקות`;
  };

  const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && updates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-700">
          <span className="text-xl">⚠️</span>
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  const activeUpdates = updates.filter(u => new Date(u.end_time) > new Date());
  const expiredUpdates = updates.filter(u => new Date(u.end_time) <= new Date());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <h3 className="text-white font-bold text-lg">עדכונים יומיומיים</h3>
              <p className="text-blue-100 text-sm">
                {activeUpdates.length} עדכונים פעילים
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddForm(!showAddForm);
                }}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                ➕ הוסף
              </button>
            )}
            <svg 
              className={`w-6 h-6 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div>
          {/* Add Form */}
          {showAddForm && canEdit && (
            <div className="bg-blue-50 border-b border-blue-200 p-4">
              <AddUpdateForm 
                municipalityId={municipalityId}
                onSuccess={() => {
                  setShowAddForm(false);
                  fetchUpdates();
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* Active Updates */}
          {activeUpdates.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {activeUpdates.map((update) => {
                const typeInfo = getTypeInfo(update.type);
                return (
                  <div 
                    key={update.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <span className="text-2xl flex-shrink-0">{typeInfo.icon}</span>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-bold text-gray-900">{update.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full bg-${typeInfo.color}-100 text-${typeInfo.color}-700 whitespace-nowrap`}>
                            {typeInfo.label}
                          </span>
                        </div>
                        
                        {update.description && (
                          <p className="text-sm text-gray-600 mb-2">{update.description}</p>
                        )}
                        
                        {update.address && (
                          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                            <span>📍</span>
                            <span>{update.address}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>🕐 {formatDateTime(update.start_time)} - {formatDateTime(update.end_time)}</span>
                          <span className="font-medium text-blue-600">
                            {formatTimeRemaining(update.end_time)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <span className="text-4xl mb-2 block">✅</span>
              <p>אין עדכונים פעילים כרגע</p>
            </div>
          )}

          {/* History Toggle */}
          {!showHistory && expiredUpdates.length > 0 && (
            <div className="bg-gray-50 p-3 border-t border-gray-200">
              <button
                onClick={() => setShowHistory(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                📜 הצג היסטוריה ({expiredUpdates.length} עדכונים)
              </button>
            </div>
          )}

          {/* History */}
          {showHistory && expiredUpdates.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-200">
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">📜 היסטוריה</span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  ✕ סגור
                </button>
              </div>
              <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {expiredUpdates.map((update) => {
                  const typeInfo = getTypeInfo(update.type);
                  return (
                    <div key={update.id} className="p-3 opacity-60">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{typeInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-700">{update.title}</div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(update.start_time)} - {formatDateTime(update.end_time)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>עדכון אחרון: {new Date().toLocaleTimeString('he-IL')}</span>
              <button
                onClick={fetchUpdates}
                className="text-blue-600 hover:text-blue-700 font-medium"
                disabled={loading}
              >
                {loading ? 'מעדכן...' : '🔄 רענן'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple Add Form Component (inline for now)
function AddUpdateForm({ municipalityId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'road_closure',
    address: '',
    start_time: '',
    end_time: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/daily-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          municipality_id: municipalityId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onSuccess();
      } else {
        alert('שגיאה: ' + data.error);
      }
    } catch (error) {
      alert('שגיאה בשמירת העדכון');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="כותרת *"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
        <select
          value={formData.type}
          onChange={(e) => setFormData({...formData, type: e.target.value})}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="road_closure">🚧 חסימת כביש</option>
          <option value="event">🎉 אירוע</option>
          <option value="maintenance">🔧 תחזוקה</option>
          <option value="alert">⚠️ התראה</option>
          <option value="other">📢 אחר</option>
        </select>
      </div>
      
      <textarea
        placeholder="תיאור"
        value={formData.description}
        onChange={(e) => setFormData({...formData, description: e.target.value})}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        rows="2"
      />
      
      <input
        type="text"
        placeholder="כתובת"
        value={formData.address}
        onChange={(e) => setFormData({...formData, address: e.target.value})}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
      
      <div className="grid grid-cols-2 gap-3">
        <input
          type="datetime-local"
          value={formData.start_time}
          onChange={(e) => setFormData({...formData, start_time: e.target.value})}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
        <input
          type="datetime-local"
          value={formData.end_time}
          onChange={(e) => setFormData({...formData, end_time: e.target.value})}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
      </div>
      
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
        >
          {submitting ? 'שומר...' : '✅ שמור'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium text-sm"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
