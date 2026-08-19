-- YOA-38: היעדרויות (חופש/מחלה/פגרה/קורס) מיובאות מהטבלה הימנית של קובץ
-- הסידור אל security_staff_leave - הטבלה שהייתה ריקה מאז ומעולם כי הזנה
-- ידנית לא תאמה את דרך העבודה. source מבדיל בין רשומות שיובאו מהקובץ
-- (מוחלפות בכל העלאה של אותו שבוע) לרשומות שהוזנו ידנית במסך (לא נגעות).
alter table public.security_staff_leave
  add column source text not null default 'manual';
