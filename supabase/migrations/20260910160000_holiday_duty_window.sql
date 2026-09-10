-- חלון הכוננות אינו זהה לשעות החג.
--
-- מבחינת המוקד הכוננות מתחילה עם היום ולא עם הדלקת הנרות, וכשחג נופל בסוף
-- שבוע ההסדר מתחיל כבר ביום שישי בבוקר. לכל חג התנהגות אחרת שאי אפשר לגזור
-- מלוח השנה, ולכן מנהל המוקד קובע את החלון בעצמו.
--
-- ריק = ברירת מחדל לפי ימי החג. שני הקצוות נדרשים יחד.

alter table public.holiday_periods
  add column duty_start_date date,
  add column duty_end_date date,
  add constraint holiday_periods_duty_window_ordered
    check (duty_start_date is null or duty_end_date is null or duty_end_date >= duty_start_date);

comment on column public.holiday_periods.duty_start_date is
  'תחילת חלון הכוננות. ריק = יום כניסת החג.';
comment on column public.holiday_periods.duty_end_date is
  'סוף חלון הכוננות. ריק = יום צאת החג.';
