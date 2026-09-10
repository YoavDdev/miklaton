import { describe, it, expect } from 'vitest';
import {
  isSystemNoise,
  PENDING_TREATMENT,
  buildTicketExceptionalMessages,
  parseTicketExceptionalResponse,
} from '@/lib/daily-report-ai';

const ticket = (over = {}) => ({
  id: '511069',
  openedAt: new Date('2026-09-10T15:46:00'),
  department: 'פיקוח על הבנייה',
  subject: 'מפגעים מביצוע עבודה קבלנית',
  address: 'מוהליבר 17',
  description: 'התושבת נפלה על הפנים, נסעה למיון',
  lastTreatment: 'סמיר עדכן שהוא דיבר עם בעלת הנכס, והיא שולחת קבלן',
  agaf: 'הנדסה',
  ...over,
});

describe('isSystemNoise - מה שאינו דרך טיפול', () => {
  it('הודעת מסרון למטפלים אינה טיפול', () => {
    expect(isSystemNoise('נשלח מסרון (SMS) אודות עדכון הפנייה למטפלים: דודי בלזברג')).toBe(true);
  });

  it('הודעת אימייל אינה טיפול', () => {
    expect(isSystemNoise('נשלח אימייל אודות עדכון הפנייה למטפלים: רענן פלג')).toBe(true);
  });

  it('עדכון סטטוס אינו טיפול', () => {
    expect(isSystemNoise('סטטוס הפנייה עודכן ל-בטיפול')).toBe(true);
  });

  it('שורה ריקה אינה טיפול', () => {
    expect(isSystemNoise('')).toBe(true);
    expect(isSystemNoise('   ')).toBe(true);
    expect(isSystemNoise(null)).toBe(true);
  });

  it('טיפול אמיתי עובר', () => {
    expect(isSystemNoise('סמיר עדכן שהוא דיבר עם בעלת הנכס, והיא שולחת קבלן')).toBe(false);
    expect(isSystemNoise('הרחוב נשטף')).toBe(false);
  });
});

describe('buildTicketExceptionalMessages', () => {
  it('מסנן הודעות מערכת לפני שהן מגיעות ל-AI', () => {
    const msgs = buildTicketExceptionalMessages(
      [ticket({ lastTreatment: 'נשלח מסרון (SMS) אודות עדכון הפנייה למטפלים: דודי בלזברג' })],
      'כללים'
    );
    const user = msgs.find((m) => m.role === 'user').content;
    expect(user).not.toContain('נשלח מסרון');
  });

  it('מעביר טיפול אמיתי כמו שהוא', () => {
    const user = buildTicketExceptionalMessages([ticket()], 'כללים').find((m) => m.role === 'user').content;
    expect(user).toContain('סמיר עדכן');
  });

  it('הכללים של המוקד נכנסים להנחיה', () => {
    const system = buildTicketExceptionalMessages([ticket()], 'כלל מיוחד של יהוד').find((m) => m.role === 'system').content;
    expect(system).toContain('כלל מיוחד של יהוד');
  });

  it('אומר ל-AI לא להמציא דרך טיפול', () => {
    const system = buildTicketExceptionalMessages([ticket()], 'כללים').find((m) => m.role === 'system').content;
    expect(system).toContain('""');
  });

  it('אוסר במפורש לשלב עובדות משתי פניות', () => {
    const system = buildTicketExceptionalMessages([ticket()], 'כללים').find((m) => m.role === 'system').content;
    expect(system).toContain('פנייה אחת בלבד');
  });
});

describe('parseTicketExceptionalResponse', () => {
  const tickets = [ticket(), ticket({ id: '511000', description: 'רכב נטוש', lastTreatment: '' })];

  it('בונה שורות לאירועים שנבחרו בלבד', () => {
    const raw = JSON.stringify({
      events: [{ ticket_id: '511069', description: 'תושבת נפלה ונפצעה', treatment: 'קבלן נשלח למקום', handler: 'פיקוח על הבנייה' }],
    });
    const rows = parseTicketExceptionalResponse(raw, tickets);
    expect(rows).toHaveLength(1);
    expect(rows[0].treatment).toBe('קבלן נשלח למקום');
    expect(rows[0].handler).toBe('פיקוח על הבנייה');
    // מספר הפנייה והמיקום מגיעים מהפנייה, לא מה-AI
    expect(rows[0].description).toBe(
      'מספר פנייה: 511069\nמיקום: מוהליבר 17\nתיאור הפנייה: תושבת נפלה ונפצעה'
    );
    expect(rows[0].time_label).toBe('10.09 15:46');
  });

  it('אירוע בלי דרך טיפול מקבל "ממתין להשלמה" ולא נשאר ריק', () => {
    const raw = JSON.stringify({
      events: [{ ticket_id: '511000', description: 'רכב נטוש', treatment: '', handler: 'בטחון' }],
    });
    const rows = parseTicketExceptionalResponse(raw, tickets);
    expect(rows[0].treatment).toBe(PENDING_TREATMENT);
    expect(rows[0].needs_treatment).toBe(true);
  });

  it('אירוע עם טיפול אינו מסומן כחסר', () => {
    const raw = JSON.stringify({
      events: [{ ticket_id: '511069', description: 'x', treatment: 'טופל בשטח' }],
    });
    expect(parseTicketExceptionalResponse(raw, tickets)[0].needs_treatment).toBe(false);
  });

  it('הגורם המטפל נלקח מהמחלקה בפנייה ולא מה-AI', () => {
    const raw = JSON.stringify({
      events: [{ ticket_id: '511069', description: 'x', treatment: 'y', handler: 'המצאה של המודל' }],
    });
    expect(parseTicketExceptionalResponse(raw, tickets)[0].handler).toBe('פיקוח על הבנייה');
  });

  it('המיקום תמיד של הפנייה שהמזהה שלה הוחזר', () => {
    const raw = JSON.stringify({
      events: [{ ticket_id: '511000', description: 'רכב נטוש', treatment: 'y' }],
    });
    expect(parseTicketExceptionalResponse(raw, tickets)[0].description).toContain('מיקום: מוהליבר 17');
  });

  it('אותה פנייה פעמיים בתשובה מפיקה שורה אחת', () => {
    // המודל חוזר על עצמו לעיתים. הכלל "אירוע אחד לכל פנייה" נאכף בקוד
    // ולא בתקווה שהמודל יציית - אחרת הדוח יוצא עם שורות כפולות.
    const raw = JSON.stringify({
      events: [
        { ticket_id: '511069', description: 'ראשון', treatment: 'א' },
        { ticket_id: '511069', description: 'שני', treatment: 'ב' },
      ],
    });
    const rows = parseTicketExceptionalResponse(raw, tickets);
    expect(rows).toHaveLength(1);
    expect(rows[0].treatment).toBe('א');
  });

  it('מזהה פנייה שאינו קיים נזרק - לא ממציאים אירועים', () => {
    const raw = JSON.stringify({ events: [{ ticket_id: '999999', description: 'המצאה', treatment: 'x' }] });
    expect(parseTicketExceptionalResponse(raw, tickets)).toEqual([]);
  });

  it('תשובה שאינה JSON זורקת שגיאה ברורה', () => {
    expect(() => parseTicketExceptionalResponse('לא JSON', tickets)).toThrow(/JSON/);
  });

  it('עוטף ב-fence עדיין נקרא', () => {
    const raw = '```json\n' + JSON.stringify({ events: [{ ticket_id: '511069', description: 'x', treatment: 'y' }] }) + '\n```';
    expect(parseTicketExceptionalResponse(raw, tickets)).toHaveLength(1);
  });
});
