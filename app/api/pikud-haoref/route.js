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
      
      // Log raw response for debugging
      console.log('Pikud Haoref API Response:', JSON.stringify(data, null, 2));
      
      // Handle different response formats
      let alertsData = data.data || data || [];
      
      // If response is a string, try to parse it
      if (typeof alertsData === 'string' && alertsData.trim()) {
        try {
          alertsData = JSON.parse(alertsData);
        } catch (e) {
          console.error('Failed to parse alert string:', e);
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(alertsData)) {
        if (typeof alertsData === 'object' && alertsData !== null) {
          alertsData = [alertsData];
        } else {
          alertsData = [];
        }
      }
      
      console.log('Processed alerts array:', alertsData);
      
      if (alertsData.length === 0) {
        return NextResponse.json({ 
          alerts: [], 
          status: 'no_alerts',
          timestamp: new Date().toISOString()
        });
      }

      // Filter alerts for Yehud-Monosson ONLY
      const relevantAlerts = alertsData.filter(alert => {
        // Try multiple possible field names
        const alertText = alert.data || alert.title || alert.name || alert.city || alert.area || alert.label || JSON.stringify(alert);
        
        console.log('Checking alert text:', alertText);
        
        // Exclude cities that are NOT Yehud-Monosson
        const excludedCities = ['אור יהודה', 'אבן יהודה', 'טירת יהודה', 'בני יהודה', 'אחיהוד', 'חוות מקנה יהודה', 'היישוב היהודי'];
        
        // Check if it's an excluded city
        if (excludedCities.some(excluded => alertText.includes(excluded))) {
          console.log('Excluded city found:', alertText);
          return false;
        }
        
        // Check if it contains "יהוד" or "מונוסון" (will match all Yehud-Monosson variations)
        const matches = alertText.includes('יהוד') || alertText.includes('מונוסון');
        console.log('Match result:', matches, 'for text:', alertText);
        return matches;
      });
      
      console.log('Filtered relevant alerts:', relevantAlerts);

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
