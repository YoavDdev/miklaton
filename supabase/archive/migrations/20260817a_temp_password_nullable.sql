-- ============================================================
-- שלב א' של הסרת סיסמאות זמניות גלויות (YOA-12, ממצא C5)
-- ⚠️ להריץ *לפני* פריסת הקוד החדש (בטוח לחלוטין מול הקוד הישן).
--
-- הקוד החדש מפסיק לכתוב את temp_password_plain — העמודה חייבת
-- להפוך ל-nullable קודם, אחרת כל INSERT של איפוס סיסמה ייכשל.
-- ============================================================

alter table public.password_resets
  alter column temp_password_plain drop not null;

-- ה-login קורא עכשיו גם את must_change_password מהפרופיל —
-- הרחבת ה-grant העמודתי (הוגדר ב-20260813_rls_anon_lockdown) כדי
-- שההתחברות תמשיך לעבוד גם תחת fallback ל-anon key.
grant select (id, full_name, role, status, must_change_password)
  on public.user_profiles to anon, authenticated;
