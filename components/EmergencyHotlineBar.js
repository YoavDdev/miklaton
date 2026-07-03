'use client';

export default function EmergencyHotlineBar() {
  const phones = [
    { label: 'משטרה', number: '100' },
    { label: 'מד\"א', number: '101' },
    { label: 'כבאות', number: '102' },
    { label: 'חשמל', number: '103' },
    { label: 'פיקוד עורף', number: '104' },
  ];

  return (
    <div className="bg-slate-800/90 border-b border-slate-600/30 text-white py-1 px-4" dir="rtl">
      <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
        {phones.map((p) => (
          <a
            key={p.label}
            href={`tel:${p.number}`}
            className="flex items-center gap-1 hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
          >
            <span className="font-bold">{p.label}</span>
            <span className="font-black ltr">{p.number}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
