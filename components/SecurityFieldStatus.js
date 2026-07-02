'use client';

import { useState, useEffect } from 'react';

export default function SecurityFieldStatus() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [securityDeptId, setSecurityDeptId] = useState(null);

  useEffect(() => {
    fetchSecurityDepartment();
  }, []);

  useEffect(() => {
    if (securityDeptId) {
      fetchTodayOrder();
      // Refresh every 60 seconds
      const interval = setInterval(fetchTodayOrder, 60000);
      return () => clearInterval(interval);
    }
  }, [securityDeptId]);

  const fetchSecurityDepartment = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        const secDept = data.data?.find(d => d.name?.includes('בטחון'));
        if (secDept) setSecurityDeptId(secDept.id);
        else setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      setLoading(false);
    }
  };

  const fetchTodayOrder = async () => {
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const res = await fetch(`/api/security-daily-order?department_id=${securityDeptId}&order_date=${dateStr}`);
      const data = await res.json();
      
      if (data.success && data.entries) {
        setEntries(data.entries);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Error fetching daily order:', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine if a worker is currently active based on their shift time
  const isCurrentlyActive = (startTime, endTime) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Handle overnight shifts (e.g., 21:00 - 05:00)
    if (endMinutes < startMinutes) {
      // If current time is after start OR before end
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  // Check if shift already ended today
  const hasEnded = (startTime, endTime) => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    
    // Overnight shift - hasn't ended yet today if we're before end time
    if (endMinutes < startMinutes) {
      return false; // overnight shifts are considered "will end tomorrow"
    }
    
    return currentMinutes >= endMinutes && currentMinutes >= startMinutes;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-3"></div>
        <div className="h-16 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!securityDeptId || entries.length === 0) {
    return null; // Don't show anything if no security dept or no daily order
  }

  const activeEntries = entries.filter(e => isCurrentlyActive(e.start_time, e.end_time));
  const finishedEntries = entries.filter(e => hasEnded(e.start_time, e.end_time));

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6 border border-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-l from-green-700 to-green-800 px-4 py-3 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          🛡️ מכלול ביטחון - סטטוס שטח
        </h3>
        <span className="text-green-200 text-xs">
          {activeEntries.length} פעילים כרגע
        </span>
      </div>

      {/* Active now - green */}
      {activeEntries.length > 0 && (
        <div className="p-3">
          <div className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            כרגע בשטח ({activeEntries.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate">
                    {entry.staff_name || entry.staff?.full_name || 'לא שובץ'}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{entry.start_time}-{entry.end_time}</span>
                    {entry.vehicle && <span className="text-green-700 font-medium">🚗 {entry.vehicle}</span>}
                    <span className="text-green-600">{entry.role_title}</span>
                  </div>
                </div>
                {entry.staff?.phone && (
                  <a href={`tel:${entry.staff.phone}`} className="text-green-600 hover:text-green-800 shrink-0">
                    📞
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finished today - gray */}
      {finishedEntries.length > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-100">
          <div className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            סיימו משמרת היום ({finishedEntries.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {finishedEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 opacity-70">
                <div className="w-2 h-2 bg-gray-400 rounded-full shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-600 text-sm truncate">
                    {entry.staff_name || entry.staff?.full_name || 'לא שובץ'}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{entry.start_time}-{entry.end_time}</span>
                    {entry.vehicle && <span>🚗 {entry.vehicle}</span>}
                    <span>{entry.role_title}</span>
                  </div>
                </div>
                {entry.staff?.phone && (
                  <a href={`tel:${entry.staff.phone}`} className="text-gray-400 hover:text-gray-600 shrink-0">
                    📞
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeEntries.length === 0 && finishedEntries.length === 0 && (
        <div className="p-4 text-center text-gray-400 text-sm">
          אין נתוני משמרות להיום
        </div>
      )}
    </div>
  );
}
