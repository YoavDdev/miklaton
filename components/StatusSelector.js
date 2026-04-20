'use client';

export const FIELD_STATUSES = {
  ready: { 
    label: 'מוכן', 
    color: 'bg-green-100 text-green-800 border-green-300', 
    activeColor: 'bg-green-500 text-white border-green-600',
    icon: '✅' 
  },
  on_way: { 
    label: 'בדרך', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300', 
    activeColor: 'bg-yellow-500 text-white border-yellow-600',
    icon: '🚐' 
  },
  arrived: { 
    label: 'הגיע', 
    color: 'bg-blue-100 text-blue-800 border-blue-300', 
    activeColor: 'bg-blue-500 text-white border-blue-600',
    icon: '📍' 
  },
  working: { 
    label: 'עובד', 
    color: 'bg-orange-100 text-orange-800 border-orange-300', 
    activeColor: 'bg-orange-500 text-white border-orange-600',
    icon: '🔧' 
  },
  done: { 
    label: 'סיים', 
    color: 'bg-purple-100 text-purple-800 border-purple-300', 
    activeColor: 'bg-purple-500 text-white border-purple-600',
    icon: '✨' 
  },
  returned: { 
    label: 'חזר', 
    color: 'bg-gray-100 text-gray-800 border-gray-300', 
    activeColor: 'bg-gray-600 text-white border-gray-700',
    icon: '🏠' 
  },
};

export default function StatusSelector({ currentStatus, onStatusChange, compact = false, disabled = false }) {
  if (compact) {
    const currentStatusData = FIELD_STATUSES[currentStatus];
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3" dir="rtl">
        {/* Current status badge - prominent */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700">הסטטוס שלי:</span>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-base shadow-lg border-2 ${currentStatusData?.activeColor || 'bg-gray-200 text-gray-800'} animate-pulse`}>
            <span className="text-xl">{currentStatusData?.icon}</span>
            <span>{currentStatusData?.label}</span>
          </div>
        </div>
        
        {/* Status change buttons */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(FIELD_STATUSES).map(([key, status]) => {
            if (key === currentStatus) return null; // Don't show current status in the list
            return (
              <button
                key={key}
                onClick={() => !disabled && onStatusChange(key)}
                disabled={disabled}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition-all hover:scale-110 active:scale-95 border-2 shadow-md ${
                  status.color
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}`}
                title={`שנה ל${status.label}`}
              >
                <span className="text-base">{status.icon}</span> {status.label}
              </button>
            );
          })}
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
