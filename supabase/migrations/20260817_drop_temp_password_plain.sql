-- ============================================================
-- הסרת אחסון סיסמאות זמניות בטקסט גלוי (YOA-12, ממצא C5)
-- להריץ בפרודקשן אחרי פריסת הקוד שמפסיק לכתוב לעמודה.
-- אף קוד לא קורא את העמודה (אומת בסריקה) — ההסרה בטוחה.
-- ============================================================

-- מחיקת הערכים הקיימים לפני הסרת העמודה (ליתר ביטחון מול גיבויים לוגיים)
update public.password_resets set temp_password_plain = null
where temp_password_plain is not null;

alter table public.password_resets drop column if exists temp_password_plain;
