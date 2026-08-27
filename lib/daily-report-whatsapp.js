import { stripPii } from '@/lib/binaa-tickets';

/**
 * YOA-42: עדכוני ה-WhatsApp כמקור האירועים החריגים (החלטת יואב 26.08).
 * ההודעות בקבוצת העדכונים ולמנכ"ל מפורטות ונושאות דרך טיפול אמיתית,
 * לרוב בלי מספר פנייה. ה-AI מפרק את ההדבקה לאירועים, מנסח מקצועית
 * בפורמט הדוח, ומצליב מספר פנייה מקובץ היום כשיש התאמה ברורה.
 *
 * חוזים: פרטי הפונים לא נכנסים להודעות; הצלבה למספר שלא קיים בקובץ
 * נמחקת - בדוח לא מופיעים מספרי פניות מומצאים.
 */

const pad = (n) => String(n).padStart(2, '0');

function ticketLine(t) {
  const clean = stripPii(t);
  const time = clean.openedAt
    ? `${pad(clean.openedAt.getDate())}.${pad(clean.openedAt.getMonth() + 1)} ${pad(clean.openedAt.getHours())}:${pad(clean.openedAt.getMinutes())}`
    : '';
  return [`id=${clean.id}`, time, clean.department, clean.subject, clean.address, clean.description?.slice(0, 120)]
    .filter(Boolean)
    .join(' | ');
}

export function buildWhatsappMessages(text, tickets, rules) {
  const system = `אתה מנסח את מקטע "אירועים חריגים" בדוח הסיכום היומי של מוקד עיריית יהוד-מונוסון.
הקלט: הודעות WhatsApp שנשלחו היום בקבוצת העדכונים של העירייה ולמנכ"ל - אלה האירועים שבאמת חשובים.

המשימה: פרק את הטקסט לאירועים נפרדים, ולכל אירוע נסח בעברית - בסגנון מקצועי, קצר ומדויק של דוח עירוני:
- description: תיאור האירוע - עובדות בלבד, בלי סופרלטיבים, משפט עד שניים. אל תכלול את המיקום בתיאור - יש לו שדה נפרד.
- location: המיקום (רחוב ומספר / שם אתר) כפי שמופיע בהודעה, או מהפנייה התואמת. "" אם לא ידוע.
- treatment: דרך טיפול - מבוסס על מה שכתוב בהודעה עצמה (זה המידע האמין ביותר), בניסוח ענייני.
- handler: הגורם המטפל (פיקוח, שיטור עירוני, כיבוי אש, חברת חשמל, חכ"ל וכו') אם ברור.
- time_label: השעה בפורמט "DD.MM HH:MM" אם מופיעה בהודעה, אחרת "".
- ticket_id: אם האירוע תואם בבירור פנייה מרשימת פניות היום שלמטה (לפי מיקום, נושא ושעה) - המזהה שלה; אחרת null. אל תנחש.

דלג על הודעות שאינן אירוע (שיחת חולין, אישורי קבלה, שאלות).
${rules ? `הנחיות נוספות מהמוקד:\n${rules}\n` : ''}
החזר JSON בלבד:
{"events":[{"time_label":"...","description":"...","location":"...","treatment":"...","handler":"...","ticket_id":"<id או null>"}]}`;

  const user = `הודעות ה-WhatsApp של היום:
"""
${text}
"""

פניות היום מבינה (להצלבת ticket_id בלבד):
${tickets.map(ticketLine).join('\n')}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function parseWhatsappResponse(raw, tickets) {
  const known = new Set(tickets.map(t => t.id));
  const text = String(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('תשובת ה-AI אינה JSON תקין');
  }
  const events = [];
  for (const ev of parsed?.events || []) {
    const description = String(ev?.description || '').trim().slice(0, 1000);
    if (!description) continue;
    const rawId = ev.ticket_id == null ? null : String(ev.ticket_id).trim();
    events.push({
      time_label: String(ev.time_label || '').trim().slice(0, 30),
      description,
      location: String(ev.location || '').trim().slice(0, 120),
      treatment: String(ev.treatment || '').trim().slice(0, 600),
      handler: String(ev.handler || '').trim().slice(0, 80),
      ticket_id: rawId && known.has(rawId) ? rawId : null,
    });
  }
  return events;
}
