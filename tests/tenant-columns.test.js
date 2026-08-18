import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * YOA-29 — יסודות רב-רשותיים, החלק הזול.
 *
 * המטרה כאן אינה לתקן את 37 הטבלאות הקיימות — זה פרויקט נפרד שנכון להריץ
 * רק כשרשות שנייה באופק. המטרה היא **להפסיק להעמיק את החוב**: כל טבלה
 * שנולדת מכאן והלאה חייבת עמודת רשות, אחרת נצטרך לשבור אותה מאוחר יותר.
 *
 * הבדיקה נועלת את המצב הקיים כקו בסיס. טבלה חדשה בלי municipality_id
 * תכשיל אותה; מי שיש לו סיבה טובה יוסיף אותה ל-EXEMPT עם נימוק כתוב.
 */

const BASELINE = path.join(process.cwd(), 'supabase', 'baseline', '0001_baseline.sql');

/**
 * טבלאות קיימות ללא עמודת רשות, עם הסיבה. אין להוסיף לרשימה הזו טבלה חדשה
 * אלא אם היא באמת חוצת-רשויות או חסרת משמעות רב-רשותית.
 */
const EXEMPT = {
  municipalities: 'טבלת הרשויות עצמה - היא הצד השני של הקשר',
  system_settings: 'הגדרות מערכת גלובליות',
  password_resets: 'קשור למשתמש, והמשתמש כבר נושא רשות',
  audit_log: 'קשור למשתמש, והמשתמש כבר נושא רשות',
  user_departments: 'קשר בין משתמש למכלול; שניהם כבר נושאים רשות',
  operator_sessions: 'קשור למשתמש',
  operator_messages: 'קשור למשתמש',
  knowledge_chat_history: 'קשור למשתמש',

  // חוב קיים: נגזרות של מכלול, שכבר נושא רשות. יטופלו בפרויקט הרב-רשותי המלא.
  contacts: 'חוב קיים - נגזר ממכלול',
  duty_roster: 'חוב קיים - נגזר ממכלול',
  on_call_shifts: 'חוב קיים - נגזר ממכלול',
  call_category_contacts: 'חוב קיים - נגזר מקטגוריה',
  call_category_rules: 'חוב קיים - נגזר מקטגוריה',
  call_category_subcategories: 'חוב קיים - נגזר מקטגוריה',
  call_category_subcategory_contacts: 'חוב קיים - נגזר מקטגוריה',
  call_center_schedule: 'חוב קיים - נגזר ממכלול',
  call_center_shifts: 'חוב קיים - נגזר ממכלול',
  call_center_staff: 'חוב קיים - נגזר ממכלול',
  security_daily_orders: 'חוב קיים - נגזר ממכלול',
  security_daily_order_entries: 'חוב קיים - נגזר מפקודת יום',
  security_settings: 'חוב קיים - נגזר ממכלול',
  security_shift_changes: 'חוב קיים - נגזר ממשמרת',
  security_shifts: 'חוב קיים - נגזר ממכלול',
  security_staff: 'חוב קיים - נגזר ממכלול',
  security_staff_leave: 'חוב קיים - נגזר מעובד',
  security_weekly_schedule: 'חוב קיים - נגזר ממכלול',
  emergency_events: 'חוב קיים - אירוע חירום',
  event_journal: 'חוב קיים - נגזר מאירוע',
  event_participants: 'חוב קיים - נגזר מאירוע',
  garbage_collection_schedule: 'חוב קיים',
  general_notifications: 'חוב קיים',
  inspection_reports: 'חוב קיים',
  knowledge_base: 'חוב קיים',
  shelter_status: 'חוב קיים',
  surveys: 'חוב קיים',
  survey_responses: 'חוב קיים - נגזר מסקר',
  war_mode: 'חוב קיים',
};

function tablesFromBaseline() {
  const sql = fs.readFileSync(BASELINE, 'utf8');
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS "public"\."([a-z_]+)" \(([\s\S]*?)\n\);/g)].map(
    (m) => ({ name: m[1], hasTenant: m[2].includes('municipality_id') })
  );
}

const tables = tablesFromBaseline();

describe('YOA-29 — כל טבלה חדשה נולדת עם עמודת רשות', () => {
  it('ה-baseline נקרא בהצלחה', () => {
    expect(tables.length).toBeGreaterThan(40);
  });

  it('אין טבלה חדשה בלי municipality_id', () => {
    const offenders = tables
      .filter((t) => !t.hasTenant && !(t.name in EXEMPT))
      .map((t) => t.name);
    expect(
      offenders,
      'טבלה חדשה חייבת municipality_id, או רישום ב-EXEMPT עם נימוק'
    ).toEqual([]);
  });

  it('רשימת הפטורים אינה מכילה טבלאות שנמחקו', () => {
    const existing = new Set(tables.map((t) => t.name));
    const stale = Object.keys(EXEMPT).filter((n) => !existing.has(n));
    expect(stale, 'פטור לטבלה שכבר לא קיימת').toEqual([]);
  });

  it('טבלה שקיבלה עמודת רשות יוצאת מרשימת הפטורים', () => {
    const fixed = tables.filter((t) => t.hasTenant && t.name in EXEMPT).map((t) => t.name);
    expect(fixed, 'יש לה כבר municipality_id - להסיר מ-EXEMPT').toEqual([]);
  });
});
