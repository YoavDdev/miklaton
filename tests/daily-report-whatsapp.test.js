import { describe, it, expect } from 'vitest';
import { buildWhatsappMessages, parseWhatsappResponse } from '@/lib/daily-report-whatsapp';

/**
 * YOA-42: עדכוני ה-WhatsApp הם מקור האירועים החריגים (החלטת יואב
 * 26.08) - ההודעות מפורטות, עם דרך טיפול אמיתית, לרוב בלי מספר פנייה.
 * ה-AI מפרק, מנסח מקצועית ומצליב מספר פנייה מהקובץ כשאפשר.
 * החוזים: PII של פונים לא יוצא; תשובת ה-AI מאומתת - הצלבה למספר
 * פנייה שלא קיים בקובץ נמחקת (לא ממציאים מספרים בדוח).
 */
const TICKETS = [
  {
    id: '508484',
    openedAt: new Date(2026, 7, 26, 9, 49),
    department: 'חשמל ותאורה',
    subject: 'עמוד תאורה נוטה',
    description: 'עמוד תאורה עקום ליד הפטאנק',
    address: 'רם כהן 5',
    reporterName: 'גיל סימנהויז',
    reporterPhone: '052-3039955',
  },
];

const WA_TEXT = `[13:05] עדכון: שריפת קוצים בשטח פתוח מאחורי רחוב העצמאות. כיבוי אש במקום, אין נפגעים. הפיקוח סוגר את הציר.
[16:20] עמוד תאורה עקום ברם כהן 5 ליד הפטאנק - חשמל ותאורה בטיפול, יוחלף מחר.`;

describe('buildWhatsappMessages', () => {
  const messages = buildWhatsappMessages(WA_TEXT, TICKETS, 'כללים לבדיקה');
  const all = JSON.stringify(messages);

  it('הטקסט המודבק והפניות להצלבה בפנים - בלי פרטי הפונים', () => {
    expect(all).toContain('שריפת קוצים');
    expect(all).toContain('508484');
    expect(all).not.toContain('גיל סימנהויז');
    expect(all).not.toContain('052-3039955');
  });

  it('הנחיית הניסוח: מקצועי, קצר, מדויק - ופורמט הדוח', () => {
    expect(messages[0].content).toMatch(/מקצועי/);
    expect(messages[0].content).toContain('דרך טיפול');
  });
});

describe('parseWhatsappResponse', () => {
  it('אירועים תקינים ממופים, הצלבה נשמרת רק למספר שקיים בקובץ', () => {
    const raw = JSON.stringify({
      events: [
        { time_label: '26.08 13:05', description: 'שריפת קוצים בשטח פתוח מאחורי רחוב העצמאות', treatment: 'כיבוי אש במקום - הציר נסגר על ידי הפיקוח', handler: 'כיבוי אש', ticket_id: null },
        { time_label: '26.08 16:20', description: 'עמוד תאורה עקום ברם כהן 5', treatment: 'חשמל ותאורה - בטיפול', handler: 'חשמל ותאורה', ticket_id: '508484' },
        { time_label: '', description: 'אירוע עם מספר מומצא', treatment: '', handler: '', ticket_id: '999999' },
      ],
    });
    const events = parseWhatsappResponse(raw, TICKETS);
    expect(events.length).toBe(3);
    expect(events[0].ticket_id).toBeNull();
    expect(events[1].ticket_id).toBe('508484');
    expect(events[2].ticket_id).toBeNull(); // המספר לא בקובץ - נמחק
  });

  it('אירוע בלי תיאור נזרק; JSON שבור זורק שגיאה', () => {
    const raw = JSON.stringify({ events: [{ description: '   ', treatment: 'x' }] });
    expect(parseWhatsappResponse(raw, TICKETS)).toEqual([]);
    expect(() => parseWhatsappResponse('לא JSON', TICKETS)).toThrow();
  });

  it('fence של markdown לא מפריע', () => {
    const raw = '```json\n{"events":[{"description":"אירוע","treatment":"טופל","handler":"פיקוח","time_label":"26.08 10:00","ticket_id":null}]}\n```';
    expect(parseWhatsappResponse(raw, TICKETS)[0].description).toBe('אירוע');
  });
});
