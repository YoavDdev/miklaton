'use client';

export default function WeatherAlertBar({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  const severityColor = (severity) => {
    if (severity === 'high') return 'bg-red-600 text-white border-red-400';
    return 'bg-orange-500 text-white border-orange-400';
  };

  const iconByType = (type) => {
    switch (type) {
      case 'wind': return '💨';
      case 'rain': return '🌧️';
      case 'thunder': return '⚡';
      case 'heat': return '🔥';
      case 'cold': return '❄️';
      default: return '⚠️';
    }
  };

  return (
    <div className={`text-center py-2 px-4 border-b ${severityColor(alerts[0].severity)}`} dir="rtl">
      <div className="flex items-center justify-center gap-3 flex-wrap text-sm font-bold">
        <span>⚠️ תשומת לב מזג אוויר:</span>
        {alerts.map((a, i) => (
          <span key={i} className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded">
            <span>{iconByType(a.type)}</span>
            <span>{a.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
