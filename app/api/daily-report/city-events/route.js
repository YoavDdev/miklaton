import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { mapCityEvents } from '@/lib/daily-report-city';

// אירועים בעיר (YOA-42 שלב 3, docs/16): פרוקסי ל-API הפתוח של אתר
// העירייה. האתר לא זמין ⇒ רשימה ריקה, לא שגיאה - הדוח יוצא תמיד.
const ROLES = ['shift_supervisor', 'call_center_manager'];
const EVENTS_URL = 'https://yehud-monosson.muni.il/wp-json/wp/v2/events';
const MAX_PAGES = 3;

export async function GET(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const dateParam = new URL(request.url).searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam || '')) {
      return NextResponse.json({ success: false, error: 'date=YYYY-MM-DD נדרש' }, { status: 400 });
    }
    const reportDate = new Date(`${dateParam}T12:00:00`);

    try {
      const events = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${EVENTS_URL}?per_page=100&page=${page}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Miklaton' },
        });
        clearTimeout(timer);
        if (!res.ok) break; // עמוד מעבר לסוף מחזיר 400 - סיימנו
        const batch = await res.json();
        events.push(...batch);
        if (batch.length < 100) break;
      }
      return NextResponse.json({ success: true, data: mapCityEvents(events, reportDate) });
    } catch (fetchError) {
      return NextResponse.json({
        success: true,
        data: [],
        warning: 'אתר העירייה לא זמין כרגע - המקטע נשאר לעריכה ידנית',
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
