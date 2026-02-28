'use client';
import { useState, useEffect } from 'react';

export default function PikudHaorefAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Fetch alerts immediately
    fetchAlerts();

    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchAlerts, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/pikud-haoref');
      const data = await response.json();
      
      setAlerts(data.alerts || []);
      setStatus(data.status);
      setLastUpdate(new Date(data.timestamp));
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3"></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-blue-50 border-r-4 border-blue-500 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <h3 className="font-bold text-blue-800">מערכת התראות פיקוד העורף</h3>
            <p className="text-sm text-blue-700">
              המערכת פעילה ומחכה לחיבור לפיקוד העורף
            </p>
          </div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border-r-4 border-green-500 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <h3 className="font-bold text-green-800">אין התראות פעילות ביהוד-מונוסון</h3>
            <p className="text-sm text-green-700">
              עדכון אחרון: {lastUpdate?.toLocaleTimeString('he-IL')}
            </p>
          </div>
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div 
          key={index}
          className="bg-red-600 text-white rounded-lg p-4 shadow-lg border-4 border-red-700 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <div className="flex-1">
              <h3 className="font-bold text-xl">התראה פעילה - יהוד מונוסון</h3>
              <p className="text-lg mt-1">{alert.data || alert.title}</p>
              {alert.category && (
                <p className="text-sm mt-2 bg-red-700 inline-block px-3 py-1 rounded-full">
                  {alert.category === 1 ? '🚀 טילים' : 
                   alert.category === 2 ? '✈️ חדירת כלי טיס עוין' : 
                   alert.category === 3 ? '💥 אירוע חומרים מסוכנים' : 
                   alert.category === 4 ? '🌍 רעידת אדמה' : 
                   alert.category === 5 ? '🌊 צונאמי' : 
                   'התראה'}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 text-sm text-red-100">
            התראה התקבלה בשעה: {new Date().toLocaleTimeString('he-IL')}
          </div>
        </div>
      ))}
      
      <div className="text-xs text-gray-500 text-center">
        מתעדכן כל 5 שניות • מקור: פיקוד העורף
      </div>
    </div>
  );
}
