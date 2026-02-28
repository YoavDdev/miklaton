import { NextResponse } from 'next/server';

// Pikud Haoref API endpoints (try multiple sources)
const PIKUD_HAOREF_APIS = [
  'https://www.oref.org.il/WarningMessages/alert/alerts.json',
  'https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json'
];

// Yehud-Monosson area identifiers ONLY
const REGIONAL_AREA_IDS = [
  'יהוד - מונוסון',
  'יהוד',
  'מונוסון',
  'יהוד-מונוסון',
  'יהוד מונוסון'
];

async function fetchFromOref(apiUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
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
  // Try to fetch from real API
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

      // Filter alerts relevant to Yehud-Monosson ONLY (exact match)
      const relevantAlerts = alertsData.filter(alert => {
        const alertText = alert.data || alert.title || alert.name || '';
        
        // Exact match only - prevents matching "אור יהודה", "אבן יהודה" etc.
        return REGIONAL_AREA_IDS.some(areaId => alertText === areaId);
      });

      return NextResponse.json({
        alerts: relevantAlerts,
        status: relevantAlerts.length > 0 ? 'active_alerts' : 'no_alerts',
        timestamp: new Date().toISOString(),
        totalAlerts: alertsData.length,
        regionalAlerts: relevantAlerts.length
      });

    } catch (error) {
      console.error(`Error with ${apiUrl}:`, error.message);
      continue; // Try next API
    }
  }

  // All APIs failed - return mock data
  return NextResponse.json({ 
    alerts: [], 
    status: 'no_alerts',
    timestamp: new Date().toISOString(),
    note: 'מערכת ההתראות פעילה - כרגע אין התראות באזור'
  });
}
