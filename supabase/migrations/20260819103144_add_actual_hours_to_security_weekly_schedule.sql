-- YOA-37: שעות שנכתבו בתא של עובד באקסל הן השעות שבהן עובדים בפועל -
-- ככה מנהל הביטחון עושה שינויים במשמרת. עד עכשיו הן נשמרו כהערת טקסט
-- וכל התצוגות (סידור שבועי, פקודת יום, מסך) הציגו את שעות המשמרת
-- הרשמיות - כלומר שעות שגויות. NULL = השיבוץ יורש את שעות המשמרת.
alter table public.security_weekly_schedule
  add column actual_start time without time zone,
  add column actual_end time without time zone;
