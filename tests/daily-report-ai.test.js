import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RULES,
  buildClassifyMessages,
  parseClassifyResponse,
} from '@/lib/daily-report-ai';

/**
 * YOA-42 שלב 2 (docs/16): מנוע הסיווג. שני חוזים קשיחים:
 * 1. זהות הפונה (שם, טלפון) לעולם לא עוזבת את המערכת - לא בהודעות ל-AI.
 * 2. תשובת ה-AI לא מהימנה מהגדרה - הפרסר מאמת מזהים וקטגוריות,
 *    וכל מה שלא תקין נופל בשקט לחלון הידני (ה-Preview הוא רשת הביטחון).
 */
const TICKETS = [
  {
    id: '508484',
    openedAt: new Date(2026, 7, 26, 9, 49),
    status: 'בתכנית עבודה',
    department: 'חשמל ותאורה',
    subject: 'עמוד תאורה נוטה',
    description: 'עמוד תאורה עקום ליד הפטאנק, מסוכן',
    address: 'רם כהן 5',
    lastTreatment: 'חשמל ותאורה - בטיפול',
    reporterName: 'גיל סימנהויז',
    reporterPhone: '052-3039955',
  },
  {
    id: '508485',
    openedAt: new Date(2026, 7, 26, 9, 53),
    status: 'הטיפול הסתיים',
    department: 'תברואה',
    subject: 'פינוי פח אשפה',
    description: 'לא פינו את הפח אתמול',
    address: 'אנילביץ 9',
    lastTreatment: '',
    reporterName: 'רחל פורת',
    reporterPhone: '052-5361332',
    groupCount: 3,
  },
];

describe('buildClassifyMessages', () => {
  const messages = buildClassifyMessages(TICKETS, DEFAULT_RULES);
  const all = JSON.stringify(messages);

  it('שם וטלפון של הפונה לא מופיעים בשום הודעה', () => {
    expect(all).not.toContain('גיל סימנהויז');
    expect(all).not.toContain('052-3039955');
    expect(all).not.toContain('רחל פורת');
  });

  it('הכללים, הפניות והקיבוץ בפנים', () => {
    expect(all).toContain('508484');
    expect(all).toContain('עמוד תאורה עקום');
    expect(all).toContain('3 פניות');
    expect(messages[0].content).toContain(DEFAULT_RULES.slice(0, 20));
  });

  it('פורמט התשובה הנדרש מוגדר במפורש', () => {
    expect(messages[0].content).toContain('danger');
    expect(messages[0].content).toContain('notable');
    expect(messages[0].content).toContain('routine');
  });
});

describe('parseClassifyResponse', () => {
  it('תשובה תקינה ממופה לפי מזהה', () => {
    const raw = JSON.stringify({
      tickets: [
        { id: '508484', category: 'danger', reason: 'מפגע בטיחותי מסוכן' },
        { id: '508485', category: 'routine' },
      ],
    });
    const map = parseClassifyResponse(raw, TICKETS);
    expect(map.get('508484')).toEqual({ category: 'danger', reason: 'מפגע בטיחותי מסוכן' });
    expect(map.get('508485').category).toBe('routine');
  });

  it('מזהה שלא קיים בפניות - נזרק; קטגוריה לא חוקית - הופכת ל-routine', () => {
    const raw = JSON.stringify({
      tickets: [
        { id: '999999', category: 'danger', reason: 'המצאה' },
        { id: '508484', category: 'catastrophe', reason: 'קטגוריה שלא קיימת' },
      ],
    });
    const map = parseClassifyResponse(raw, TICKETS);
    expect(map.has('999999')).toBe(false);
    expect(map.get('508484').category).toBe('routine');
  });

  it('JSON שבור - שגיאה ברורה, לא קריסה שקטה', () => {
    expect(() => parseClassifyResponse('אופס, לא JSON', TICKETS)).toThrow();
  });

  it('JSON עטוף ב-markdown fence עדיין נקרא', () => {
    const raw = '```json\n{"tickets":[{"id":"508484","category":"notable","reason":"אירוע"}]}\n```';
    const map = parseClassifyResponse(raw, TICKETS);
    expect(map.get('508484').category).toBe('notable');
  });
});
