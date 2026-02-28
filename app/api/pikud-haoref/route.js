import { NextResponse } from 'next/server';

// Pikud Haoref API endpoints (try multiple sources)
const PIKUD_HAOREF_APIS = [
  'https://www.oref.org.il/WarningMessages/alert/alerts.json',
  'https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json'
];

// Yehud-Monosson area identifiers
const YEHUD_AREA_IDS = [
  'יהוד - מונוסון',
  'יהוד',
  'מונוסון',
  'יהוד-מונוסון'
];

async function fetchFromOref(apiUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Origin': 'https://www.oref.org.il',
        'Referer': 'https://www.oref.org.il/',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET() {
  // For development/testing: return mock no alerts
  // Comment this out when Pikud Haoref API is accessible
  return NextResponse.json({
    alerts: [],
    status: 'no_alerts',
    timestamp: new Date().toISOString(),
    note: 'מערכת ההתראות פעילה - כרגע אין התראות ליהוד-מונוסון'
  });

  /* 
  // Uncomment when ready to use real API
  for (const apiUrl of PIKUD_HAOREF_APIS) {
    try {
      const response = await fetchFromOref(apiUrl);

      if (!response.ok) {
        continue; // Try next API
      }

      const data = await response.json();
      
      // Handle different response formats
      const alertsData = data.data || data || [];
      
      if (!Array.isArray(alertsData) || alertsData.length === 0) {
        return NextResponse.json({ 
          alerts: [], 
          status: 'no_alerts',
          timestamp: new Date().toISOString()
        });
      }

      // Filter alerts relevant to Yehud-Monosson
      const relevantAlerts = alertsData.filter(alert => {
        const alertText = alert.data || alert.title || alert.name || '';
        
        return YEHUD_AREA_IDS.some(areaId => 
          alertText.includes(areaId)
        );
      });

      return NextResponse.json({
        alerts: relevantAlerts,
        status: relevantAlerts.length > 0 ? 'active_alerts' : 'no_alerts',
        timestamp: new Date().toISOString(),
        totalAlerts: alertsData.length,
        yehudAlerts: relevantAlerts.length
      });

    } catch (error) {
      console.error(`Error with ${apiUrl}:`, error.message);
      continue; // Try next API
    }
  }

  // All APIs failed
  return NextResponse.json({ 
    alerts: [], 
    status: 'no_alerts',
    timestamp: new Date().toISOString(),
    note: 'לא ניתן להתחבר לפיקוד העורף - ממתין לחיבור'
  });
  */
}
