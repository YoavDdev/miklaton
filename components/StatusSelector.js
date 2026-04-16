'use client';

export const FIELD_STATUSES = {
  ready: { label: 'מוכן', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
  on_way: { label: 'בדרך', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🚐' },
  arrived: { label: 'הגיע', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '📍' },
  working: { label: 'עובד', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🔧' },
  done: { label: 'סיים', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '✨' },
  returned: { label: 'חזר', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '🏠' },
};

export default function StatusSelector({ currentStatus, onStatusChange, compact = false, disabled = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2" dir="rtl">
        <span className="text-xs font-bold text-gray-600">הסטטוס שלי:</span>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(FIELD_STATUSES).map(([key, status]) => (
            <button
              key={key}
              onClick={() => !disabled && onStatusChange(key)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                currentStatus === key
                  ? `${status.color} ring-2 ring-offset-1 ring-blue-400 font-bold shadow-md`
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-sm">{status.icon}</span> {status.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-3 shadow-sm" dir="rtl">
      <div className="text-xs font-bold text-gray-600 mb-2 text-center">
        🎯 בחר סטטוס שטח
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(FIELD_STATUSES).map(([key, status]) => (
          <button
            key={key}
            onClick={() => onStatusChange(key)}
            disabled={disabled}
            className={`px-3 py-2.5 rounded-lg text-center border-2 transition-all hover:scale-105 ${
              currentStatus === key
                ? `${status.color} shadow-lg ring-2 ring-blue-400`
                : `bg-gray-50 border-gray-200 hover:border-gray-300`
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="text-2xl mb-1">{status.icon}</div>
            <div className="text-xs font-bold text-gray-700">{status.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
