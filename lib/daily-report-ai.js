import { stripPii } from '@/lib/binaa-tickets';

/**
 * YOA-42 שלב 2 (docs/16): מנוע הסיווג של האירועים החריגים.
 * לוגיקה טהורה - הראוט רק מחווט אותה מול OpenAI.
 *
 * שני עקרונות קשיחים:
 * - זהות הפונה מוסרת (stripPii) לפני שהפנייה נכנסת להודעה.
 * - תשובת ה-AI מאומתת: מזהים שלא קיימים נזרקים, קטגוריות לא חוקיות
 *   הופכות ל-routine. ה-Preview הוא רשת הביטחון, לא ה-AI.
 */

export const CATEGORIES = ['danger', 'notable', 'routine'];

// ברירת המחדל של כללי הסיווג - שדה עריכה בעברית (daily_report_settings);
// הבסיס מהאפיון: "תאונת דרכים, אירוע משטרה, הצפה, נפילת עץ - תמיד;
// גבייה ושי"ל - לעולם לא".
export const DEFAULT_RULES = `סכנה (נכנס לדוח, מוצג ראשון): תאונת דרכים, אירוע משטרה או ביטחוני, חפץ חשוד, שריפה, הצפה, קריסה או נפילה של עץ/מבנה/עמוד, פציעה או נפילה של אדם, אדם תקוע במעלית, חומרים מסוכנים, אלימות.
חשוב לידיעה (נכנס לדוח): מפגע בטיחותי משמעותי במרחב הציבורי, תקלת תשתית רחבה (חשמל או מים בכמה רחובות), אירוע חריג במוסד חינוך, בעל חיים מסוכן או פגוע, אירוע עם מעורבות גורמי חוץ (משטרה, מד"א, כיבוי).
שגרתי (לא נכנס לדוח): גזם, ניקיון, חניה, תמרור, גינון, מפגעי תברואה נקודתיים, בקשות תחזוקה בגנים ובתי ספר, איתור בעלי רכב. פניות גבייה ושי"ל - לעולם לא בדוח.`;

const pad = (n) => String(n).padStart(2, '0');

function ticketLine(t) {
  const clean = stripPii(t);
  const time = clean.openedAt
    ? `${pad(clean.openedAt.getDate())}.${pad(clean.openedAt.getMonth() + 1)} ${pad(clean.openedAt.getHours())}:${pad(clean.openedAt.getMinutes())}`
    : '';
  const parts = [
    `id=${clean.id}`,
    time,
    clean.department,
    clean.subject,
    clean.address,
    `תיאור: ${clean.description}`,
  ];
  if (clean.lastTreatment && clean.lastTreatment.trim() !== '-') {
    parts.push(`טיפול: ${clean.lastTreatment}`);
  }
  if (clean.groupCount > 1) parts.push(`(${clean.groupCount} פניות על אותו אירוע)`);
  return parts.filter(Boolean).join(' | ');
}

export function buildClassifyMessages(tickets, rules) {
  const system = `אתה מסווג פניות מוקד עירוני לדוח הסיכום היומי של עיריית יהוד-מונוסון.
לכל פנייה קבע קטגוריה אחת:
- "danger" - סכנה
- "notable" - חשוב לידיעה
- "routine" - שגרתי

כללי הסיווג (קובעים תמיד; מותר לך לזהות סכנה גם אם אינה ברשימה):
${rules}

החזר JSON בלבד במבנה:
{"tickets":[{"id":"<המזהה>","category":"danger|notable|routine","reason":"<נימוק של שורה בעברית - רק לפניות שאינן routine>"}]}
כלול כל פנייה מהרשימה בדיוק פעם אחת. אל תמציא מזהים.`;

  const user = `פניות היום (${tickets.length}):\n${tickets.map(ticketLine).join('\n')}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function parseClassifyResponse(raw, tickets) {
  const known = new Set(tickets.map(t => t.id));
  // מודלים אוהבים לעטוף ב-fence גם כשמבקשים JSON נקי
  const text = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('תשובת ה-AI אינה JSON תקין');
  }
  const map = new Map();
  for (const item of parsed?.tickets || []) {
    const id = String(item?.id ?? '').trim();
    if (!known.has(id)) continue;
    const category = CATEGORIES.includes(item.category) ? item.category : 'routine';
    map.set(id, {
      category,
      reason: category === 'routine' ? undefined : String(item.reason || '').slice(0, 300) || undefined,
    });
  }
  return map;
}
