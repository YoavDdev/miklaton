import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { mapCityEvents } from '@/lib/daily-report-city';

// אירועים בעיר (YOA-42 שלב 3, docs/16): פרוקסי ל-API הפתוח של אתר
// העירייה. האתר לא זמין ⇒ רשימה ריקה, לא שגיאה - הדוח יוצא תמיד.
const ROLES = ['shift_supervisor', 'call_center_manager'];
const EVENTS_URL = 'https://yehud-monosson.muni.il/wp-json/wp/v2/events';

/**
 * רק השדות שהמקטע צריך.
 *
 * קריטי, לא אופטימיזציה: תוסף ה-SEO באתר מזריק ל-yoast_head תגית עם
 * nonce="..." בלי לברוח את הגרשיים, וזה שובר את כל ה-JSON כבר בתו 7452 -
 * הרבה לפני האירועים. כל עוד השדה נמצא בתשובה, res.json() נכשל והמקטע
 * חוזר ריק. אי אפשר לתקן את זה בצד שלהם, אבל אפשר פשוט לא לבקש את השדה.
 * דרך אגב זה גם חותך את התשובה מ-1.8MB ל-51KB לעמוד.
 */
const FIELDS = 'id,title,acf';
const PER_PAGE = 100;

// תקרת ביטחון. באתר כ-3,165 אירועים = כ-32 עמודים; התקרה רק מונעת לולאה
// אינסופית אם האתר יחזיר כותרת שבורה.
const MAX_PAGES = 60;
const CONCURRENCY = 10;
const TIMEOUT_MS = 10000;

/**
 * מטמון קצר בזיכרון.
 *
 * משיכת כל האירועים היא כ-32 בקשות לאתר העירייה. לוח האירועים משתנה
 * לעיתים רחוקות, והדוח מופק כמה פעמים ביום - אין סיבה לחזור על הסבב
 * בכל לחיצה, וגם לא הוגן כלפי האתר שלהם.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null; // { at, events }

const pageUrl = (page) =>
  `${EVENTS_URL}?per_page=${PER_PAGE}&page=${page}&_fields=${FIELDS}`;

async function fetchPage(page) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl(page), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Miklaton' },
    });
    if (!res.ok) return { events: [], totalPages: null };
    const events = await res.json();
    const header = res.headers?.get?.('x-wp-totalpages');
    const totalPages = header ? Number(header) : null;
    return { events: Array.isArray(events) ? events : [], totalPages };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * מושך את כל האירועים.
 *
 * למה כולם ולא רק את הראשונים: WordPress ממיין לפי תאריך הפרסום ולא לפי
 * תאריך האירוע, ואינו תומך במיון או בסינון לפי שדה ACF (orderby=meta_value
 * מחזיר 400, ו-meta_key/meta_value נענים בהתעלמות). אירוע שנוצר לפני חודשיים
 * ומתקיים מחר יושב עמוק ברשימה, ומשיכה חלקית מפילה אותו מהדוח בשקט.
 */
async function fetchAllEvents() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.events;

  const first = await fetchPage(1);
  const all = [...first.events];

  const totalPages = Math.min(
    Number.isFinite(first.totalPages) && first.totalPages > 0 ? first.totalPages : 1,
    MAX_PAGES
  );

  const remaining = [];
  for (let p = 2; p <= totalPages; p += 1) remaining.push(p);

  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((p) => fetchPage(p)));
    for (const r of results) all.push(...r.events);
  }

  cache = { at: Date.now(), events: all };
  return all;
}

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
      const events = await fetchAllEvents();
      return NextResponse.json({ success: true, data: mapCityEvents(events, reportDate) });
    } catch (fetchError) {
      // הפרדה בין "האתר לא ענה" ל"האתר ענה משהו שאי אפשר לקרוא". שתי
      // ההודעות היו זהות בעבר, וזה הסתיר את באג ה-yoast_head במשך שבועות.
      const malformed =
        fetchError instanceof SyntaxError || /JSON|token/i.test(fetchError?.message || '');
      return NextResponse.json({
        success: true,
        data: [],
        warning: malformed
          ? 'אתר העירייה החזיר נתונים פגומים - המקטע נשאר לעריכה ידנית'
          : 'אתר העירייה לא זמין כרגע - המקטע נשאר לעריכה ידנית',
      });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
