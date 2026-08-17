import { NextResponse } from 'next/server';
import sheltersData from '@/data/shelters.json';
import { requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function GET(request) {
  // הצרכנים (ShelterSearch, AddressInput) מניחים שהתשובה היא תמיד מערך -
  // לכן גם שגיאות אימות/קצב מוחזרות בגוף מערך ריק
  const auth = await requireRole(request);
  if (auth.error) return NextResponse.json([], { status: 401 });

  // מגן על מכסת ה-Geocoding של Google (עלות כספית).
  // המפתח פר-משתמש ולא פר-IP - כל המוקד יושב מאחורי NAT אחד
  const limited = rateLimit(request, `geocode:${auth.user.userId}`, { limit: 30, windowMs: 60_000 });
  if (limited) return NextResponse.json([], { status: 429, headers: { 'Retry-After': '60' } });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  if (!GOOGLE_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY is not set - geocoding disabled');
    return NextResponse.json([]);
  }

  try {
    // שימוש ב-Google Geocoding API - יותר מדויק עם מספרי בית
    // נוסח את השאילתה עם העיר קודם לדיוק טוב יותר
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent('יהוד-מונוסון, ' + query + ', ישראל')}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(googleUrl);

    if (!response.ok) {
      throw new Error('Google Geocoding API error');
    }

    const googleData = await response.json();
    
    console.log('Google Geocoding API Response for:', query);
    console.log('Status:', googleData.status);
    console.log('Results count:', googleData.results?.length || 0);
    if (googleData.results && googleData.results.length > 0) {
      console.log('First result:', googleData.results[0].formatted_address);
      console.log('Location:', googleData.results[0].geometry.location);
    }
    
    if (googleData.status !== 'OK' || !googleData.results || googleData.results.length === 0) {
      return NextResponse.json([]);
    }

    // המרה לפורמט Nominatim לתאימות
    let data = googleData.results.map(result => ({
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
      display_name: result.formatted_address,
      address: result.address_components
    }));
    
    // גבולות גיאוגרפיים של יהוד-מונוסון (מורחבים מעט)
    const YEHUD_BOUNDS = {
      south: 32.015,
      north: 32.050,
      west: 34.860,
      east: 34.910
    };
    
    const yehudMonossonResults = data.filter(result => {
      const displayName = result.display_name.toLowerCase();
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      // בדיקה 1: האם בתוך גבולות יהוד-מונוסון?
      const inBounds = lat >= YEHUD_BOUNDS.south && lat <= YEHUD_BOUNDS.north &&
                       lon >= YEHUD_BOUNDS.west && lon <= YEHUD_BOUNDS.east;
      
      // בדיקה 2: האם מכיל יהוד/מונוסון בשם?
      const hasYehudMonosson = displayName.includes('יהוד') || displayName.includes('מונוסון');
      
      // בדיקה 3: האם זה עיר אחרת בבירור?
      const isOtherCity = displayName.includes('קרית ביאליסטוק') || 
                          displayName.includes('רמת גן') || 
                          displayName.includes('בני ברק') ||
                          displayName.includes('גבעתיים') ||
                          displayName.includes('אור יהודה');
      
      // מקבל אם: (בגבולות גיאוגרפיים OR יש יהוד/מונוסון בשם) AND לא עיר אחרת
      return (inBounds || hasYehudMonosson) && !isOtherCity;
    });
    
    const yehudOnly = yehudMonossonResults.filter(r => {
      const name = r.display_name.toLowerCase();
      return (name.includes('יהוד') && !name.includes('מונוסון')) || 
             (!name.includes('יהוד') && !name.includes('מונוסון')); // תוצאות בגבולות ללא שם עיר
    });
    const monossonOnly = yehudMonossonResults.filter(r => r.display_name.toLowerCase().includes('מונוסון'));
    
    const combinedResults = [
      ...yehudOnly.slice(0, 3),
      ...monossonOnly.slice(0, 2)
    ].slice(0, 5);
    
    return NextResponse.json(combinedResults);
  } catch (error) {
    return NextResponse.json(
      { error: 'שגיאה בחיפוש כתובת' },
      { status: 500 }
    );
  }
}
