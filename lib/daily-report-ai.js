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

/**
 * מקור חלופי לאירועים החריגים כשאין הדבקת WhatsApp (החלטת יואב 10.09).
 *
 * המקור המועדף נשאר ה-WhatsApp - שם יושב הטיפול האמיתי, ולעיתים קרובות
 * הוא מגיע רק אחרי עשרות הודעות בעוד ששורת הטיפול בבינה נשארת תקועה על
 * הודעת מערכת. כאן אנחנו גוזרים את המיטב ממה שרשום בפנייה עצמה, ולא
 * ממציאים את מה שאינו שם.
 */
export const PENDING_TREATMENT = 'ממתין להשלמה';

// מה שבינה כותבת מעצמה. אלה 39% משורות הטיפול ביום רגיל, והן אינן
// אומרות דבר על מה שנעשה בשטח.
const SYSTEM_NOISE = [
  /^נשלח מסרון\s*\(SMS\)/,
  /^נשלח אימייל/,
  /^סטטוס הפנייה עודכן/,
];

export function isSystemNoise(text) {
  const s = String(text ?? '').trim();
  if (!s || s === '-') return true;
  return SYSTEM_NOISE.some((re) => re.test(s));
}

export function buildTicketExceptionalMessages(tickets, rules) {
  const system = `אתה מנסח את מקטע "אירועים חריגים" בדוח הסיכום היומי של מוקד עיריית יהוד-מונוסון.
הקלט: פניות המוקד של היום. אין היום עדכוני WhatsApp, ולכן הדוח נשען על מה שרשום בפניות בלבד.

שלב א - בחר אילו פניות נכנסות לדוח, לפי הכללים:
${rules}

**כל אירוע נגזר מפנייה אחת בלבד.** אסור לשלב עובדות משתי פניות לאירוע אחד, גם אם הן דומות
או סמוכות בזמן. כתובת, נסיבות ותוצאה חייבות להגיע מאותה פנייה שאת המזהה שלה אתה מחזיר.

שלב ב - לכל פנייה שנבחרה נסח בעברית, בסגנון מקצועי וקצר של דוח עירוני:
- description: מה קרה בפנייה הזו - עובדות, משפט עד שניים. **בלי המיקום** (הוא נלקח מהפנייה
  אוטומטית) ובלי פעולות הטיפול (שדה נפרד).
- treatment: דרך הטיפול = הפעולות שבוצעו בשטח והתוצאה, לפי שדה "טיפול" של הפנייה בלבד.
  **אם שדה הטיפול חסר, או שאינו מתאר פעולה בשטח או תוצאה - החזר "" ואל תמציא דבר.**
  אלה אינם דרך טיפול ומחייבים "": הערה פנימית בין עובדים ("מה זה שייך לי", "יש מלל בפנייה"),
  "פניה כפולה", "פרטי", "נפתח מחדש", "להעביר ל...", ודיווח על העברת הפנייה לגורם אחר בלי
  שנעשתה פעולה.
  "טופל" בלי פירוט - החזר "טופל" כמו שהוא, זו תוצאה.

דלג על פניות שגרתיות. עדיף מקטע קצר ומדויק על פני רשימה ארוכה ומנופחת.

החזר JSON בלבד:
{"events":[{"ticket_id":"<המזהה מהרשימה>","description":"...","treatment":"..."}]}
אל תמציא מזהים - השתמש רק במזהים שברשימה.`;

  const lines = tickets.map((t) => ticketLine(isSystemNoise(t.lastTreatment) ? { ...t, lastTreatment: '' } : t));
  return [
    { role: 'system', content: system },
    { role: 'user', content: `פניות היום (${tickets.length}):\n${lines.join('\n')}` },
  ];
}

export function parseTicketExceptionalResponse(raw, tickets) {
  const byId = new Map(tickets.map((t) => [String(t.id), t]));
  const text = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('תשובת ה-AI אינה JSON תקין');
  }

  const rows = [];
  const seen = new Set(); // המודל חוזר על אותה פנייה לעיתים; הדוח לא יכפיל שורות
  for (const ev of parsed?.events || []) {
    const id = String(ev?.ticket_id ?? '').trim();
    const ticket = byId.get(id);
    if (!ticket) continue; // מזהה מומצא - נזרק, כמו במסלול הסיווג
    if (seen.has(id)) continue;
    seen.add(id);

    const treatment = String(ev.treatment || '').trim();
    const opened = ticket.openedAt ? new Date(ticket.openedAt) : null;
    const narrative = String(ev.description || '').trim();

    // מספר הפנייה והמיקום נלקחים מהפנייה עצמה ולא מה-AI. זה הפורמט של הדוח
    // הידני, וזו גם ההגנה: מודל ששילב עובדות משתי פניות לא יכול להזיז את
    // הכתובת - היא תמיד של הפנייה שאת המזהה שלה הוא החזיר.
    const description = [
      `מספר פנייה: ${ticket.id}`,
      ticket.address ? `מיקום: ${ticket.address}` : null,
      narrative ? `תיאור הפנייה: ${narrative}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    rows.push({
      ticket_id: String(ticket.id),
      time_label: opened
        ? `${pad(opened.getDate())}.${pad(opened.getMonth() + 1)} ${pad(opened.getHours())}:${pad(opened.getMinutes())}`
        : '',
      description,
      treatment: treatment || PENDING_TREATMENT,
      // הגורם המטפל הוא המחלקה שאליה הפנייה משויכת בבינה - עובדה, לא ניחוש.
      handler: ticket.department || ticket.agaf || '',
      needs_treatment: !treatment,
    });
  }
  return rows;
}
