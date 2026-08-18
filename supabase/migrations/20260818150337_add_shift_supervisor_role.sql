-- ================================================================
-- תפקיד אחמ״ש (shift_supervisor)
--
-- אחמ״ש מנהל את משמרת המוקד. התפקיד קיים בארגון מזמן - הוא מופיע
-- בתסריטי ההתראה עצמם (data/alertFlows.json: "מנהל/אחמ״ש: סורק מצלמות |
-- מוקדן: עונה לתושבים") - אבל לא היה קיים בתוכנה, שהכירה שבעה תפקידים
-- בלבד ולא הבחינה בין נציג למי שמנהל אותו.
--
-- שתי רמות, ושתיהן נחוצות:
--   1. התפקיד כאן - מי מוסמך לנהל משמרת. שלושה אנשים כרגע.
--   2. call_center_schedule.position - מי מנהל את המשמרת *הזו*. אותו אדם
--      יכול להיות אחמ״ש במשמרת אחת ונציג באחרת, וכך זה בפועל בנתונים.
--
-- ההרשאות שהתפקיד יקבל מוגדרות ב-docs/15-console-design.md.
-- ================================================================

alter table public.user_profiles drop constraint if exists valid_role;

alter table public.user_profiles add constraint valid_role check (
  role::text = any (array[
    'ceo',
    'call_center_manager',
    'shift_supervisor',
    'sector_manager',
    'operator',
    'admin',
    'inspector',
    'shelter_manager'
  ]::text[])
);
